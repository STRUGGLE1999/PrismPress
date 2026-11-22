import { visit } from 'unist-util-visit'
import { toString } from 'mdast-util-to-string'
import type {
  Blockquote,
  Code,
  Delete,
  Emphasis,
  Heading,
  Html,
  Image,
  InlineCode,
  Link,
  List,
  ListItem,
  Paragraph,
  Parent,
  Root,
  RootContent,
  Strong,
  Table,
  TableCell,
  TableRow,
  Text,
} from 'mdast'
import type { InlineMath, Math as MathNode } from 'mdast-util-math'
import type { ExternalLink, PlatformProfile } from '../../types'
import { resolveHeadingDemotion } from '../registry'
import { renderTexToSvg, type FormulaSvg } from '../../formula/mathjax'
import type { RichTheme } from './theme'

export interface RichRenderOptions {
  platform: PlatformProfile
  theme: RichTheme
  referenceTitle?: string
  /** 净水后行号 → 原始 Markdown 行号（1-based） */
  lineMap?: number[]
  /** 是否剥离正文首个 H1 标题（因为平台独立标题栏已渲染 H1，防止双重标题） */
  stripTopH1?: boolean
}

export interface RichRenderResult {
  html: string
  externalLinks: ExternalLink[]
  /** MathJax 渲染失败、降级为文本的公式数量 */
  formulaFallbacks: number
}

interface RenderContext {
  platform: PlatformProfile
  theme: RichTheme
  math: Map<object, FormulaSvg>
  linkIndex: Map<string, number>
  externalLinks: ExternalLink[]
  formulaFallbacks: number
  h2Count: number
  h3Count: number
  lineMap?: number[]
}

function sourceLineAttribute(node: RootContent, ctx: RenderContext): string {
  const line = node.position?.start.line
  if (!line) return ''
  const mapped = ctx.lineMap?.[line - 1] ?? line
  return ` data-source-line="${mapped}"`
}

/** 给最外层块级标签注入源码行号，供预览点击反查 */
function withSourceLine(html: string, node: RootContent, ctx: RenderContext): string {
  const attribute = sourceLineAttribute(node, ctx)
  if (!attribute) return html
  return html.replace(/^<([a-zA-Z][\w-]*)/, `<$1${attribute}`)
}

const CN_NUMERALS = ['壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖', '拾', '拾壹', '拾贰']

const SAFE_TAGS = new Set([
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'del',
  'sup',
  'sub',
  'kbd',
  'mark',
  'span',
  'img',
])

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/`/g, '&#96;')
}

/** 预览与富文本产物只允许安全协议，避免 javascript: 伪协议注入 */
function safeUrl(url: string): string {
  const trimmed = url.trim()
  if (/^(https?:|mailto:|tel:|#|\/|\.{1,2}\/)/i.test(trimmed)) return trimmed
  if (/^data:image\//i.test(trimmed)) return trimmed
  return '#'
}

function sanitizeRawHtml(html: string): string {
  const withoutDangerousBlocks = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|iframe|object|embed|link|meta)[\s\S]*?<\/\1>/gi, '')
    .replace(/<(script|style|iframe|object|embed|link|meta)\b[^>]*\/?>/gi, '')

  return withoutDangerousBlocks.replace(
    /<(\/?)([a-zA-Z][\w-]*)([^>]*)>/g,
    (_match, closing: string, rawTag: string, rawAttrs: string) => {
      const tag = rawTag.toLowerCase()
      if (!SAFE_TAGS.has(tag)) return ''
      if (tag === 'img') {
        if (closing) return ''
        const src = rawAttrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1]
        const alt = rawAttrs.match(/\balt\s*=\s*["']([^"']*)["']/i)?.[1] ?? ''
        if (!src || /^javascript:/i.test(src)) return ''
        return `<img src="${escapeAttr(src)}" alt="${escapeAttr(alt)}" style="max-width:100%;height:auto;display:block;margin:16px auto;border-radius:6px;" />`
      }
      if (tag === 'br') return '<br />'
      if (closing) return `</${tag}>`
      return `<${tag}>`
    },
  )
}

function inlineChildren(children: RootContent[], ctx: RenderContext): string {
  return children.map((child) => renderNode(child, ctx)).join('')
}

function renderCodeBlock(node: Code, ctx: RenderContext): string {
  const { theme, platform } = ctx
  const language = (node.lang ?? '').trim() || (platform.fillFenceLanguage ? 'text' : '')
  const code = escapeHtml(node.value)
  const showBar = platform.id === 'wechat'

  if (!showBar) {
    return `<pre style="margin:18px 0;padding:14px 16px;overflow-x:auto;background:${theme.codeBackground};color:${theme.codeText};font-size:13px;line-height:1.65;border-radius:8px;font-family:${theme.monoFont};"><code style="background:transparent;color:${theme.codeText};font-family:${theme.monoFont};white-space:pre;">${code}</code></pre>`
  }

  const dots =
    theme.codeChrome === 'mac'
      ? `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#FF5F57;margin-right:5px;"></span><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#FEBC2E;margin-right:5px;"></span><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#28C840;margin-right:10px;"></span>`
      : ''

  return [
    `<section style="margin:20px 0;border-radius:9px;overflow:hidden;background:${theme.codeBackground};border:1px solid ${theme.border};">`,
    `<section style="padding:8px 13px;background:${theme.codeBar};color:#A6ADC8;font-size:11px;line-height:1.5;font-family:${theme.monoFont};">${dots}<span style="vertical-align:1px;">${escapeHtml(language || 'code')}</span></section>`,
    `<pre style="margin:0;padding:14px 16px;overflow-x:auto;background:${theme.codeBackground};color:${theme.codeText};font-size:13px;line-height:1.65;font-family:${theme.monoFont};-webkit-text-size-adjust:100%;"><code style="background:transparent;color:${theme.codeText};font-family:${theme.monoFont};white-space:pre;">${code}</code></pre>`,
    `</section>`,
  ].join('')
}

function renderHeading(node: Heading, ctx: RenderContext): string {
  const { theme, platform } = ctx
  const content = inlineChildren(node.children, ctx)
  const marker = resolveHeadingDemotion(platform, node.depth)

  if (marker) {
    const primary = marker === '▎'
    if (primary) {
      return `<p style="margin:28px 0 12px;padding:8px 12px;font-size:16px;font-weight:700;line-height:1.6;color:${theme.heading};background:${theme.accentSoft};border-left:4px solid ${theme.accent};border-radius:0 6px 6px 0;"><span style="color:${theme.accent};font-weight:700;">${marker}</span> ${content}</p>`
    }
    return `<p style="margin:22px 0 10px;font-size:15px;font-weight:700;line-height:1.7;color:${theme.accent};"><span style="color:${theme.accent};">${marker}</span> ${content}</p>`
  }

  if (node.depth === 2) {
    ctx.h2Count += 1
    ctx.h3Count = 0
  } else if (node.depth === 3) {
    ctx.h3Count += 1
  }

  if (platform.id === 'wechat') {
    if (theme.preset === 'native') return `<h${Math.min(node.depth, 4)} style="margin:24px 0 12px;font-size:${node.depth <= 2 ? 20 : 17}px;line-height:1.4;font-weight:600;color:${theme.heading};">${content}</h${Math.min(node.depth, 4)}>`
    return renderWechatHeading(node, content, ctx)
  }

  const tag = platform.maxHeadingLevel === 2 ? (node.depth <= 1 ? 'h2' : 'h3') : `h${Math.min(node.depth, 6)}`
  let style = ''
  if (node.depth === 1) {
    style = `margin:34px 0 18px;font-size:22px;line-height:1.45;font-weight:700;text-align:center;color:${theme.heading};`
  } else if (node.depth === 2) {
    style = `margin:30px 0 14px;padding:9px 14px;font-size:19px;line-height:1.5;font-weight:700;color:${theme.heading};background:${theme.accentSoft};border-left:4px solid ${theme.accent};border-radius:0 6px 6px 0;`
  } else if (node.depth === 3) {
    style = `margin:24px 0 10px;padding-left:9px;font-size:17px;line-height:1.6;font-weight:700;color:${theme.heading};border-left:3px solid ${theme.accent};`
  } else {
    style = `margin:20px 0 8px;font-size:16px;line-height:1.7;font-weight:700;color:${theme.accent};`
  }

  return `<${tag} style="${style}">${content}</${tag}>`
}

function renderWechatHeading(node: Heading, content: string, ctx: RenderContext): string {
  const { theme } = ctx
  const h2Index = Math.max(1, ctx.h2Count)
  const h3Index = Math.max(1, ctx.h3Count)
  const h2Pad = String(h2Index).padStart(2, '0')
  const h3Pad = `${h2Index}.${h3Index}`
  const plainTitle = toString(node).trim()
  const manualNumbering = /^([一二三四五六七八九十百]+[、.．]|\d+(?:\.\d+)*[、.．)]?)\s*/.test(plainTitle)

  if (node.depth === 1) {
    if (theme.preset === 'parchment') {
      return `<h1 style="margin:38px 0 24px;text-align:center;font-family:${theme.headingFontFamily};font-size:23px;line-height:1.6;font-weight:700;color:${theme.heading};letter-spacing:0.06em;"><span style="display:inline-block;padding-bottom:12px;border-bottom:1px solid ${theme.border};">${content}</span></h1>`
    }
    if (theme.preset === 'terminal') {
      return `<h1 style="margin:34px 0 20px;padding:0 0 12px;font-family:${theme.headingFontFamily};font-size:21px;line-height:1.6;font-weight:700;color:${theme.heading};border-bottom:1px dashed ${theme.border};"><span style="color:${theme.accent};">&gt;</span> ${content}</h1>`
    }
    if (theme.preset === 'warm') {
      return `<h1 style="margin:36px 0 22px;text-align:center;font-family:${theme.headingFontFamily};font-size:22px;line-height:1.6;font-weight:700;color:${theme.heading};"><span style="display:inline-block;padding:0 10px 10px;border-bottom:3px solid ${theme.highlight};">${content}</span></h1>`
    }
    return `<h1 style="margin:36px 0 20px;text-align:center;font-family:${theme.headingFontFamily};font-size:22px;line-height:1.5;font-weight:700;color:${theme.heading};">${content}</h1>`
  }

  if (node.depth === 2) {
    if (theme.h2Style === 'parchment') {
      const numeral = CN_NUMERALS[(h2Index - 1) % CN_NUMERALS.length]
      const numeralHtml = manualNumbering
        ? ''
        : `<span style="margin-right:8px;color:${theme.accent};font-size:15px;">${numeral}</span>`
      return `<h2 style="margin:40px 0 20px;text-align:center;font-family:${theme.headingFontFamily};font-size:21px;line-height:1.7;font-weight:700;color:${theme.heading};letter-spacing:0.08em;"><span style="display:inline-block;padding:0 16px 10px;border-bottom:3px double ${theme.accent};">${numeralHtml}${content}</span></h2>`
    }
    if (theme.h2Style === 'capsule') {
      const badge = manualNumbering
        ? ''
        : `<span style="display:inline-block;padding:1px 9px;margin-right:9px;border-radius:999px;background:${theme.accent};color:#FFFFFF;font-size:11px;font-family:${theme.monoFont};vertical-align:2px;">${h2Pad}</span>`
      return `<h2 style="margin:34px 0 16px;padding:10px 14px;font-family:${theme.headingFontFamily};font-size:19px;line-height:1.6;font-weight:700;color:${theme.heading};background:${theme.accentSoft};border-radius:8px;">${badge}${content}</h2>`
    }
    if (theme.h2Style === 'rounded') {
      const badge = manualNumbering
        ? ''
        : `<span style="display:inline-block;width:22px;height:22px;line-height:22px;margin-right:9px;border-radius:50%;background:${theme.accentSecondary};color:#FFFFFF;font-size:11px;text-align:center;vertical-align:2px;">${h2Index}</span>`
      return `<h2 style="margin:34px 0 18px;padding:12px 16px;font-family:${theme.headingFontFamily};font-size:19px;line-height:1.65;font-weight:700;color:${theme.heading};background:${theme.accentSoft};border-left:6px solid ${theme.accent};border-radius:14px;">${badge}${content}</h2>`
    }
    const badge = manualNumbering
      ? ''
      : `<span style="margin-right:8px;color:${theme.accent};font-size:13px;">[${h2Pad}]</span>`
    return `<h2 style="margin:34px 0 16px;padding:9px 14px;font-family:${theme.headingFontFamily};font-size:18px;line-height:1.65;font-weight:700;color:${theme.heading};background:${theme.accentSoft};border-left:4px solid ${theme.accent};">${badge}${content}</h2>`
  }

  if (node.depth === 3) {
    if (theme.h3Style === 'serif') {
      return `<h3 style="margin:26px 0 12px;font-family:${theme.headingFontFamily};font-size:17px;line-height:1.7;font-weight:700;color:${theme.heading};"><span style="margin-right:7px;color:${theme.accent};">◆</span>${content}</h3>`
    }
    if (theme.h3Style === 'bar') {
      const badge = manualNumbering
        ? ''
        : `<span style="margin-right:7px;color:${theme.accentSecondary};font-size:12px;font-family:${theme.monoFont};">${h3Pad}</span>`
      return `<h3 style="margin:26px 0 11px;padding-left:9px;font-family:${theme.headingFontFamily};font-size:17px;line-height:1.65;font-weight:700;color:${theme.heading};border-left:3px solid ${theme.accent};">${badge}${content}</h3>`
    }
    if (theme.h3Style === 'warm') {
      return `<h3 style="margin:26px 0 12px;padding:7px 12px;font-family:${theme.headingFontFamily};font-size:17px;line-height:1.65;font-weight:700;color:${theme.heading};background:${theme.accentSoft};border-radius:10px;border-bottom:2px solid ${theme.accentSecondary};">${content}</h3>`
    }
    return `<h3 style="margin:26px 0 11px;font-family:${theme.headingFontFamily};font-size:16px;line-height:1.7;font-weight:700;color:${theme.accent};"><span style="margin-right:7px;">›</span>${content}</h3>`
  }

  if (theme.preset === 'terminal') {
    return `<h4 style="margin:20px 0 8px;font-family:${theme.headingFontFamily};font-size:14px;line-height:1.7;font-weight:700;color:${theme.accentSecondary};">// ${content}</h4>`
  }
  return `<h4 style="margin:22px 0 8px;font-family:${theme.headingFontFamily};font-size:16px;line-height:1.7;font-weight:700;color:${theme.accent};">${content}</h4>`
}

function renderBlockquote(node: Blockquote, ctx: RenderContext): string {
  const { theme } = ctx
  const content = node.children.map((child) => renderNode(child, ctx)).join('')

  if (ctx.platform.id === 'wechat' && theme.preset === 'native') return `<blockquote style="margin:20px 0;padding:0 0 0 12px;border-left:3px solid #E5E5E5;color:#888888;">${content}</blockquote>`
  if (theme.quoteStyle === 'double') {
    return `<blockquote style="margin:24px 0;padding:14px 18px;border-top:3px double ${theme.accent};border-bottom:3px double ${theme.accent};background:${theme.quoteBackground};color:${theme.text};font-style:italic;">${content}</blockquote>`
  }
  if (theme.quoteStyle === 'warm') {
    return `<blockquote style="margin:22px 0;padding:13px 16px;border:1px dashed ${theme.accentSecondary};border-left:5px solid ${theme.accent};border-radius:12px;background:${theme.quoteBackground};color:${theme.text};">${content}</blockquote>`
  }
  if (theme.quoteStyle === 'terminal') {
    return `<blockquote style="margin:22px 0;padding:12px 16px;border-left:4px solid ${theme.accent};border-radius:0 8px 8px 0;background:${theme.quoteBackground};color:${theme.muted};">${content}</blockquote>`
  }
  return `<blockquote style="margin:20px 0;padding:12px 16px;border-left:4px solid ${theme.accent};background:${theme.quoteBackground};color:${theme.muted};border-radius:0 6px 6px 0;">${content}</blockquote>`
}

function renderList(node: List, ctx: RenderContext): string {
  const { theme } = ctx
  const tag = node.ordered ? 'ol' : 'ul'
  const start = node.ordered && node.start != null && node.start !== 1 ? ` start="${node.start}"` : ''
  const items = node.children.map((item) => renderNode(item, ctx)).join('')
  return `<${tag}${start} style="margin:0 0 16px;padding-left:24px;color:${theme.text};line-height:1.8;">${items}</${tag}>`
}

function renderListItem(node: ListItem, ctx: RenderContext): string {
  const { theme } = ctx
  const checkbox = node.checked === true ? '☑ ' : node.checked === false ? '☐ ' : ''
  const content = node.children.map((child) => renderNode(child, ctx)).join('')
  return `<li style="margin:7px 0;line-height:1.8;color:${theme.text};">${checkbox}${content}</li>`
}

function renderLink(node: Link, ctx: RenderContext): string {
  const { platform, theme } = ctx
  const content = inlineChildren(node.children, ctx) || escapeHtml(node.url)
  const url = node.url.trim()

  if (platform.id === 'douyin') {
    return /^https?:\/\//i.test(url) && content !== escapeHtml(url)
      ? `${content}（${escapeHtml(url)}）`
      : content
  }

  if (platform.footnoteLinks && /^https?:\/\//i.test(url)) {
    let index = ctx.linkIndex.get(url)
    if (!index) {
      index = ctx.externalLinks.length + 1
      ctx.linkIndex.set(url, index)
      ctx.externalLinks.push({ url, text: toString(node).trim() || url, index })
    }
    return `<span style="color:${theme.accent};border-bottom:1px dashed ${theme.accent};">${content}</span><sup style="color:${theme.accent};font-size:12px;font-weight:600;">[${index}]</sup>`
  }

  return `<a href="${escapeAttr(safeUrl(url))}" style="color:${theme.link};text-decoration:none;border-bottom:1px solid ${theme.border};">${content}</a>`
}

function renderImage(node: Image, platform: PlatformProfile): string {
  return `<img src="${escapeAttr(safeUrl(node.url))}" alt="${escapeAttr(node.alt ?? '')}" style="max-width:100%;height:auto;display:block;margin:18px auto;border-radius:6px;${platform.id === 'douyin' ? 'min-width:100px;min-height:100px;object-fit:contain;background:#FFFFFF;' : ''}" />`
}

function renderTableCell(
  node: TableCell,
  ctx: RenderContext,
  header: boolean,
  align: 'left' | 'center' | 'right' | null,
): string {
  const { theme } = ctx
  const tag = header ? 'th' : 'td'
  const textAlign = align ?? 'left'
  const background = header ? `background:${theme.tableHeader};font-weight:700;` : ''
  return `<${tag} style="padding:9px 12px;border:1px solid ${theme.border};font-size:14px;line-height:1.7;text-align:${textAlign};${background}color:${theme.text};vertical-align:top;">${inlineChildren(node.children, ctx)}</${tag}>`
}

type CellAlign = 'left' | 'center' | 'right' | null

function renderTableRow(
  node: TableRow,
  ctx: RenderContext,
  header: boolean,
  align: CellAlign[] | null | undefined,
): string {
  const cells = node.children
    .map((cell, index) => renderTableCell(cell as TableCell, ctx, header, align?.[index] ?? null))
    .join('')
  return `<tr>${cells}</tr>`
}

function renderTable(node: Table, ctx: RenderContext): string {
  const { theme, platform } = ctx
  if (platform.format === 'html' && (platform.id === 'xiaohongshu' || platform.id === 'douyin')) {
    return node.children.map((row, index) => `<p style="margin:12px 0;line-height:1.8;${index === 0 ? 'font-weight:600;' : ''}">${row.children.map(cell => inlineChildren(cell.children, ctx)).join(' ｜ ')}</p>`).join('\n')
  }
  const columnCount = Math.max(1, ...node.children.map((row) => row.children.length))
  const minWidth = platform.tableShield ? Math.max(480, columnCount * 140) : null
  const rows = node.children
    .map((row, index) => renderTableRow(row, ctx, index === 0, node.align))
    .join('')

  const table = `<table style="width:100%;border-collapse:collapse;margin:16px 0;${minWidth ? `min-width:${minWidth}px;` : ''}font-size:14px;color:${theme.text};"><tbody>${rows}</tbody></table>`

  if (platform.tableShield) {
    return `<section style="overflow-x:auto;-webkit-overflow-scrolling:touch;margin:16px 0;border-radius:6px;">${table}</section>`
  }
  return table
}

function renderMath(node: InlineMath | MathNode, ctx: RenderContext, display: boolean): string {
  const { theme, platform } = ctx
  const rendered = ctx.math.get(node)
  if (!rendered || !rendered.svg) {
    ctx.formulaFallbacks += 1
    if (display) {
      return `<pre style="margin:16px 0;padding:12px 14px;overflow-x:auto;background:${theme.accentSoft};color:${theme.heading};font-size:13px;border-radius:6px;font-family:${theme.monoFont};"><code>${escapeHtml(node.value)}</code></pre>`
    }
    return `<code style="padding:2px 5px;border-radius:4px;background:${theme.accentSoft};color:${theme.heading};font-family:${theme.monoFont};font-size:90%;">${escapeHtml(node.value)}</code>`
  }

  if (display) {
    if (platform.id === 'wechat') {
      return `<section style="margin:20px 0;padding:13px 12px;background:${theme.accentSoft};border:1px solid ${theme.border};border-radius:10px;text-align:center;overflow-x:auto;color:${theme.text};"><span style="display:block;margin:0 0 9px;color:${theme.muted};font-size:10px;line-height:1.4;letter-spacing:0.12em;font-family:${theme.monoFont};">FORMULA · SVG</span>${rendered.svg}</section>`
    }
    if (platform.id === 'zhihu') {
      return `<p style="margin:20px 0;padding:12px 14px;background:${theme.accentSoft};border-left:4px solid ${theme.accent};border-radius:0 6px 6px 0;text-align:center;overflow-x:auto;color:${theme.text};"><span style="display:inline-block;margin:0 0 8px;padding:1px 8px;border-radius:999px;background:${theme.accent};color:#FFFFFF;font-size:10px;line-height:1.7;font-family:${theme.monoFont};">LaTeX 已净化</span><br />${rendered.svg}</p>`
    }
    return `<section style="margin:18px 0;padding:10px 8px;background:${theme.accentSoft};border-radius:8px;text-align:center;overflow-x:auto;color:${theme.text};">${rendered.svg}</section>`
  }

  if (platform.id === 'wechat') {
    return `<span style="display:inline-block;max-width:100%;padding:0 3px;border-radius:4px;background:${theme.accentSoft};vertical-align:middle;color:${theme.text};">${rendered.svg}</span>`
  }
  if (platform.id === 'zhihu') {
    return `<span style="display:inline-block;max-width:100%;padding:1px 4px;border-radius:4px;background:${theme.accentSoft};border-bottom:1px dashed ${theme.accent};vertical-align:middle;color:${theme.text};">${rendered.svg}</span>`
  }
  return `<span style="display:inline-block;max-width:100%;padding:0 2px;vertical-align:middle;color:${theme.text};">${rendered.svg}</span>`
}

function renderNode(node: RootContent, ctx: RenderContext): string {
  const { theme } = ctx

  switch (node.type) {
    case 'paragraph': {
      const paragraph = node as Paragraph
      const wechat = ctx.platform.id === 'wechat'
      const spacing = wechat ? 'normal' : theme.preset === 'parchment' ? '0.04em' : '0.01em'
      const lineHeight = ctx.platform.id === 'zhihu' ? '1.8' : ctx.platform.id === 'bilibili' ? '1.8' : theme.preset === 'native' && wechat ? '1.6' : '1.75'
      const size = wechat && theme.preset === 'native' ? 17 : 16
      return withSourceLine(
        `<p style="margin:0 0 16px;font-size:${size}px;line-height:${lineHeight};color:${theme.text};letter-spacing:${spacing};">${inlineChildren(paragraph.children, ctx)}</p>`,
        node,
        ctx,
      )
    }
    case 'heading':
      return withSourceLine(renderHeading(node as Heading, ctx), node, ctx)
    case 'text': {
      const text = node as Text
      return escapeHtml(text.value).replace(/\n/g, '<br />')
    }
    case 'strong': {
      const strong = node as Strong
      const content = inlineChildren(strong.children, ctx)
      if (theme.preset === 'warm') {
        return `<strong style="font-weight:700;color:${theme.heading};background-color:${theme.highlight};background:linear-gradient(transparent 58%,${theme.highlight} 58%);padding:0 2px;">${content}</strong>`
      }
      if (theme.preset === 'terminal') {
        return `<strong style="font-weight:700;color:${theme.heading};background:${theme.accentSoft};padding:1px 4px;border-radius:3px;">${content}</strong>`
      }
      return `<strong style="font-weight:700;color:${theme.heading};">${content}</strong>`
    }
    case 'emphasis': {
      const emphasis = node as Emphasis
      return `<em style="font-style:italic;">${inlineChildren(emphasis.children, ctx)}</em>`
    }
    case 'delete': {
      const del = node as Delete
      return `<s style="text-decoration:line-through;color:${theme.muted};">${inlineChildren(del.children, ctx)}</s>`
    }
    case 'inlineCode': {
      const code = node as InlineCode
      return `<code style="padding:2px 5px;border-radius:4px;background:${theme.accentSoft};color:${theme.heading};font-family:${theme.monoFont};font-size:90%;">${escapeHtml(code.value)}</code>`
    }
    case 'code':
      return withSourceLine(renderCodeBlock(node as Code, ctx), node, ctx)
    case 'blockquote':
      return withSourceLine(renderBlockquote(node as Blockquote, ctx), node, ctx)
    case 'list':
      return withSourceLine(renderList(node as List, ctx), node, ctx)
    case 'listItem':
      return withSourceLine(renderListItem(node as ListItem, ctx), node, ctx)
    case 'link':
      return renderLink(node as Link, ctx)
    case 'image':
      return withSourceLine(renderImage(node as Image, ctx.platform), node, ctx)
    case 'table':
      return withSourceLine(renderTable(node as Table, ctx), node, ctx)
    case 'tableRow':
      return withSourceLine(renderTableRow(node as TableRow, ctx, false, undefined), node, ctx)
    case 'tableCell':
      return renderTableCell(node as TableCell, ctx, false, null)
    case 'thematicBreak':
      return withSourceLine(
        `<hr style="margin:28px 0;border:none;border-top:1px solid ${theme.border};" />`,
        node,
        ctx,
      )
    case 'break':
      return '<br />'
    case 'html':
      return sanitizeRawHtml((node as Html).value)
    case 'inlineMath':
      return withSourceLine(renderMath(node as InlineMath, ctx, false), node, ctx)
    case 'math':
      return withSourceLine(renderMath(node as MathNode, ctx, true), node, ctx)
    default: {
      const parent = node as Parent
      if (Array.isArray(parent.children)) {
        return parent.children.map((child) => renderNode(child as RootContent, ctx)).join('')
      }
      return ''
    }
  }
}

function renderReferences(ctx: RenderContext, title: string): string {
  if (!ctx.platform.footnoteLinks || ctx.externalLinks.length === 0) return ''
  const { theme } = ctx
  const items = ctx.externalLinks
    .map(
      (link) =>
        `<p style="margin:5px 0;font-size:13px;line-height:1.7;color:${theme.muted};word-break:break-all;">[${link.index}] ${escapeHtml(link.text)}：<span style="color:${theme.link};">${escapeHtml(link.url)}</span></p>`,
    )
    .join('')

  return `<section style="margin-top:34px;padding-top:16px;border-top:1px solid ${theme.border};"><p style="margin:0 0 10px;font-size:15px;font-weight:700;color:${theme.heading};">${escapeHtml(title)}</p>${items}</section>`
}

async function prerenderMath(root: Root): Promise<Map<object, FormulaSvg>> {
  const targets: Array<{ node: object; tex: string; display: boolean }> = []

  visit(root, (node) => {
    if (node.type === 'inlineMath') {
      targets.push({ node, tex: (node as InlineMath).value, display: false })
    } else if (node.type === 'math') {
      targets.push({ node, tex: (node as MathNode).value, display: true })
    }
  })

  const rendered = await Promise.all(targets.map((target) => renderTexToSvg(target.tex, target.display)))
  const map = new Map<object, FormulaSvg>()
  targets.forEach((target, index) => map.set(target.node, rendered[index]))
  return map
}

/**
 * 富文本阵营编译器（微信公众号 / 知乎 / B站）。
 * 输出可直接写入 text/html 剪贴板的内联样式 HTML。
 */
export async function renderRichDocument(
  root: Root,
  options: RichRenderOptions,
): Promise<RichRenderResult> {
  const math = await prerenderMath(root)
  const ctx: RenderContext = {
    platform: options.platform,
    theme: options.theme,
    math,
    linkIndex: new Map(),
    externalLinks: [],
    formulaFallbacks: 0,
    h2Count: 0,
    h3Count: 0,
    lineMap: options.lineMap,
  }

  const childrenToRender =
    options.stripTopH1 && root.children[0]?.type === 'heading' && (root.children[0] as Heading).depth === 1
      ? root.children.slice(1)
      : root.children
  const body = childrenToRender.map((child) => renderNode(child, ctx)).join('\n')
  const references = renderReferences(ctx, options.referenceTitle ?? '参考资料')
  const html =
    options.platform.id === 'wechat'
      ? `<section style="font-family:${options.theme.fontFamily};font-size:${options.theme.preset === 'native' ? 17 : 16}px;line-height:${options.theme.preset === 'native' ? '1.6' : '1.75'};color:${options.theme.text};background:${options.theme.paper};padding:2px;word-break:break-word;-webkit-text-size-adjust:100%;">${body}${references}</section>`
      : `${body}${references}`

  return {
    html,
    externalLinks: ctx.externalLinks,
    formulaFallbacks: ctx.formulaFallbacks,
  }
}
