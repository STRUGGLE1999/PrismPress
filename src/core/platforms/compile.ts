import { toString } from 'mdast-util-to-string'
import { rewriteImageUrls } from '../images/local'
import { visit } from 'unist-util-visit'
import { resolveImageReport } from '../images/radar'
import type {
  CompileOptions,
  CompileResult,
  Diagnostic,
  ExternalLink,
  PlatformId,
} from '../types'
import { sanitizeMarkdown } from '../sanitizer/sanitize'
import { analyzeMarkdown } from '../markdown/document'
import { scanImages } from '../images/radar'
import { getPublicationPlatform, resolveHeadingDemotion } from './registry'
import { renderRichDocument } from './rich/renderer'
import { getRichTheme } from './rich/theme'
import { transformMarkdown } from './markdown/transform'
import { buildSlideDeck } from './deck/builder'

function collectExternalLinks(links: Array<{ url: string; text: string }>): ExternalLink[] {
  const seen = new Set<string>()
  const result: ExternalLink[] = []
  for (const link of links) {
    if (!/^https?:\/\//i.test(link.url) || seen.has(link.url)) continue
    seen.add(link.url)
    result.push({ url: link.url, text: link.text || link.url, index: result.length + 1 })
  }
  return result
}

/**
 * 七大平台统一编译入口。
 *
 * 流水线：Auto-Sanitizer → mdast 解析 → 图片体检 → 平台协议编译
 * - 富文本阵营：内联样式 HTML（text/html 剪贴板）
 * - Markdown 阵营：净化版 Markdown（text/plain 剪贴板）
 */
export async function compileArticle(
  source: string,
  platformId: PlatformId,
  options: CompileOptions = {},
): Promise<CompileResult> {
  const platform = getPublicationPlatform(platformId, options.publicationMode)
  const isSocialArticle = platform.format === 'html' && (platformId === 'xiaohongshu' || platformId === 'douyin')
  const sanitize = sanitizeMarkdown(source)
  const document = analyzeMarkdown(sanitize.output)
  const images = resolveImageReport(scanImages(document.images, sanitize.output), options.imageSources ?? {})
  if (isSocialArticle) {
    const definitions = new Map(document.root.children.filter(node => node.type === 'definition').map(node => [node.identifier, node]))
    visit(document.root, (node, index, parent) => {
      if ((node.type !== 'imageReference' && node.type !== 'linkReference') || index === undefined || !parent) return
      const definition = definitions.get(node.identifier)
      if (!definition) return
      parent.children[index] = node.type === 'imageReference'
        ? { type: 'image', url: definition.url, title: definition.title, alt: node.alt, position: node.position }
        : { type: 'link', url: definition.url, title: definition.title, children: node.children, position: node.position }
    })
  }
  // Parse only the short source. Attach picture bytes to parsed nodes afterwards.
  visit(document.root, (node) => {
    if (node.type === 'image') node.url = options.imageSources?.[node.url] ?? node.url
    if (node.type === 'definition') node.url = options.imageSources?.[node.url] ?? node.url
    if (node.type === 'html') node.value = node.value.replace(/(<img\b[^>]*\bsrc\s*=\s*["'])([^"']+)(["'])/gi,
      (whole, prefix: string, source: string, suffix: string) => {
        const value = options.imageSources?.[source]
        return value ? `${prefix}${value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')}${suffix}` : whole
      })
  })
  const diagnostics: Diagnostic[] = []

  const fixCount = sanitize.counts.reduce((total, item) => total + item.count, 0)
  if (fixCount > 0) {
    diagnostics.push({
      code: 'SANITIZER_APPLIED',
      severity: 'info',
      message: `已整理 ${fixCount} 处格式。`,
    })
  }

  if (images.red > 0 && (platform.format !== 'deck' || options.deckMode === 'full')) {
    diagnostics.push({
      code: 'IMAGE_LOCAL_PATH',
      severity: 'error',
      message: `有 ${images.red} 张图片需要检查，可导入对应配图。`,
    })
  }
  if (images.yellow > 0 && (platform.format !== 'deck' || options.deckMode === 'full')) {
    diagnostics.push({
      code: 'IMAGE_HOTLINK_RISK',
      severity: 'warning',
      message: `有 ${images.yellow} 张图片来自其他平台，发布时可能无法显示。`,
    })
  }

  let previewHtml: string | undefined
  let body = ''
  let externalLinks: ExternalLink[] = []
  let slides = undefined

  if (platform.format === 'deck') {
    const deck = await buildSlideDeck(document.root, platform, sanitize.lineMap, options.passport, options.deckMode)
    body = deck.caption
    slides = deck.slides
    externalLinks = collectExternalLinks(document.links)
  } else if (platform.format === 'html') {
    const theme = getRichTheme(options.themeId)
    const rendered = await renderRichDocument(document.root, {
      platform,
      theme,
      referenceTitle: options.referenceTitle,
      stripTopH1: true,
      lineMap: sanitize.lineMap,
    })
    body = rendered.html
    externalLinks =
      platform.footnoteLinks && rendered.externalLinks.length > 0
        ? rendered.externalLinks
        : collectExternalLinks(document.links)

    const demoted = document.headingDepths.filter(
      (depth) => resolveHeadingDemotion(platform, depth) !== null,
    ).length
    if (demoted > 0) {
      diagnostics.push({
        code: 'HEADING_DEMOTED',
        severity: 'info',
        message: `已调整 ${demoted} 处标题层级。`,
      })
    }

    if (platform.footnoteLinks && rendered.externalLinks.length > 0) {
      diagnostics.push({
        code: 'LINKS_TO_REFERENCES',
        severity: 'info',
        message: `已将 ${rendered.externalLinks.length} 个正文外链提取为文末「参考资料」角标。`,
      })
    }

    if (platform.tableShield && document.stats.tables > 0) {
      diagnostics.push({
        code: 'TABLE_SHIELD_APPLIED',
        severity: 'info',
        message: `已调整 ${document.stats.tables} 个表格的显示方式。`,
      })
    }

    if (rendered.formulaFallbacks > 0) {
      diagnostics.push({
        code: 'FORMULA_FALLBACK',
        severity: 'warning',
        message: `有 ${rendered.formulaFallbacks} 个公式暂以文本显示，可返回原稿修改。`,
      })
    }
  } else {
    const transformed = transformMarkdown(sanitize.output, platform, {
      injectToc: options.injectToc ?? false,
    })
    const markdownBody = document.root.children[0]?.type === 'heading' && document.root.children[0].depth === 1
      ? transformed.markdown.replace(/^\s*# [^\n]+(?:\n|$)/, '').replace(/^\n+/, '')
      : transformed.markdown
    body = options.imageSources ? rewriteImageUrls(markdownBody, (source) => options.imageSources?.[source]) : markdownBody
    previewHtml = (await renderRichDocument(document.root, { platform, theme: getRichTheme('native'), lineMap: sanitize.lineMap, stripTopH1: true })).html
    externalLinks = collectExternalLinks(document.links)
    diagnostics.push(...transformed.diagnostics)
  }

  const articleNodes = document.root.children[0]?.type === 'heading' && document.root.children[0].depth === 1 ? document.root.children.slice(1) : document.root.children
  const articlePlainText = platform.format === 'html' ? articleNodes.map(node => node.type === 'table' ? node.children.map(row => row.children.map(cell => toString(cell)).join(' ｜ ')).join('\n') : toString(node)).filter(Boolean).join('\n\n') : document.plainText

  return {
    platform,
    format: platform.format,
    previewHtml,
    body,
    plainText: platform.format === 'deck' ? body : articlePlainText,
    slides,
    stats: { ...document.stats, images: images.total },
    diagnostics,
    externalLinks,
    sanitize,
    images,
  }
}
