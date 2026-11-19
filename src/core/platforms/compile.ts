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
import { getPlatform, resolveHeadingDemotion } from './registry'
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
  const platform = getPlatform(platformId)
  const sanitize = sanitizeMarkdown(source)
  const document = analyzeMarkdown(sanitize.output)
  const images = resolveImageReport(scanImages(document.images, sanitize.output), options.imageSources ?? {})
  // Parse only the short source. Attach picture bytes to parsed nodes afterwards.
  visit(document.root, (node) => {
    if (node.type === 'image') node.url = options.imageSources?.[node.url] ?? node.url
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
      message: `语法净水器已自动修复 ${fixCount} 处跨端隐患。`,
    })
  }

  if (images.red > 0) {
    diagnostics.push({
      code: 'IMAGE_LOCAL_PATH',
      severity: 'error',
      message: `检测到 ${images.red} 张本地或失效图片，目标平台可能无法访问，请先检查地址或转成公开 HTTPS 链接。`,
    })
  }
  if (images.yellow > 0) {
    diagnostics.push({
      code: 'IMAGE_HOTLINK_RISK',
      severity: 'warning',
      message: `检测到 ${images.yellow} 张平台私有图床图片，跨平台复制可能触发 Referer 防盗链 403。`,
    })
  }

  let previewHtml: string | undefined
  let body = ''
  let externalLinks: ExternalLink[] = []
  let slides = undefined

  if (platform.format === 'deck') {
    const deck = await buildSlideDeck(document.root, platform, sanitize.lineMap, options.passport)
    body = deck.caption
    slides = deck.slides
    externalLinks = collectExternalLinks(document.links)
    diagnostics.push({
      code: 'DECK_GENERATED',
      severity: 'info',
      message: `已按章节整理为 ${deck.slides.length} 张 3:4 摘要卡片及配套文案；卡片是内容摘录，不包含原文全部细节与配图。`,
    })
  } else if (platform.format === 'html') {
    const theme = getRichTheme(options.themeId)
    const rendered = await renderRichDocument(document.root, {
      platform,
      theme,
      referenceTitle: options.referenceTitle,
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
        message: `${platform.name} 仅支持两级标题，已将 ${demoted} 个三级/四级标题降维为带引导符的高亮块，杜绝 ### 外露。`,
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
        message: `已为 ${document.stats.tables} 个表格注入横向滑动护盾，手机端不再挤成「一字长蛇阵」。`,
      })
    }

    if (rendered.formulaFallbacks > 0) {
      diagnostics.push({
        code: 'FORMULA_FALLBACK',
        severity: 'warning',
        message: `${rendered.formulaFallbacks} 个公式未能编译为 SVG，已降级为等宽文本，请检查 LaTeX 语法。`,
      })
    }
  } else {
    const transformed = transformMarkdown(sanitize.output, platform, {
      injectToc: options.injectToc,
    })
    body = options.imageSources ? rewriteImageUrls(transformed.markdown, (source) => options.imageSources?.[source]) : transformed.markdown
    previewHtml = (await renderRichDocument(document.root, { platform, theme: getRichTheme('native'), lineMap: sanitize.lineMap, stripTopH1: true })).html
    externalLinks = collectExternalLinks(document.links)
    diagnostics.push(...transformed.diagnostics)
  }

  return {
    platform,
    format: platform.format,
    previewHtml,
    body,
    plainText: platform.format === 'deck' ? body : document.plainText,
    slides,
    stats: { ...document.stats, images: images.total },
    diagnostics,
    externalLinks,
    sanitize,
    images,
  }
}
