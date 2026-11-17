import type { Diagnostic, PlatformProfile } from '../../types'

export interface MarkdownTransformResult {
  markdown: string
  diagnostics: Diagnostic[]
  tocInjected: boolean
  filledFenceLanguages: number
}

const FENCE_LINE = /^(\s{0,3})(`{3,}|~{3,})(.*)$/

function fillFenceLanguages(lines: string[]): { lines: string[]; filled: number } {
  let inFence = false
  let fenceChar = ''
  let filled = 0

  const next = lines.map((line) => {
    const match = line.match(FENCE_LINE)
    if (!match) return line

    const [, indent, fence, info] = match
    const char = fence[0]

    if (!inFence) {
      inFence = true
      fenceChar = char
      if (info.trim() === '') {
        filled += 1
        return `${indent}${fence}text`
      }
      return line
    }

    if (char === fenceChar && info.trim() === '') {
      inFence = false
      fenceChar = ''
    }
    return line
  })

  return { lines: next, filled }
}

/** 代码块 / 表格前后补空行，避免 GFM 解析器把相邻内容吞进同一个块 */
function ensureBlockSpacing(lines: string[]): string[] {
  const out: string[] = []
  let index = 0

  const appendBlankIfNeeded = () => {
    if (out.length > 0 && out[out.length - 1].trim() !== '') out.push('')
  }

  while (index < lines.length) {
    const line = lines[index]
    const fence = line.match(FENCE_LINE)

    if (fence) {
      appendBlankIfNeeded()
      const char = fence[2][0]
      const closing = new RegExp(`^\\s{0,3}${char}{3,}\\s*$`)
      out.push(line)
      index += 1
      while (index < lines.length) {
        const current = lines[index]
        out.push(current)
        index += 1
        if (closing.test(current)) break
      }
      if (index < lines.length && lines[index].trim() !== '') out.push('')
      continue
    }

    if (/^\s*\|.*\|\s*$/.test(line)) {
      appendBlankIfNeeded()
      while (index < lines.length && /^\s*\|.*\|\s*$/.test(lines[index])) {
        out.push(lines[index])
        index += 1
      }
      if (index < lines.length && lines[index].trim() !== '') out.push('')
      continue
    }

    out.push(line)
    index += 1
  }

  return out
}

function injectToc(lines: string[]): { lines: string[]; injected: boolean } {
  if (lines.some((line) => /@\[TOC\]/i.test(line))) return { lines, injected: false }

  const firstContent = lines.findIndex((line) => line.trim() !== '')
  if (firstContent !== -1 && /^#\s+/.test(lines[firstContent])) {
    return {
      lines: [...lines.slice(0, firstContent + 1), '', '@[TOC](文章目录)', '', ...lines.slice(firstContent + 1)],
      injected: true,
    }
  }
  return { lines: ['@[TOC](文章目录)', '', ...lines], injected: true }
}

function stripRawHtml(lines: string[]): { lines: string[]; stripped: number } {
  let stripped = 0
  const joined = lines.join('\n')
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, () => {
      stripped += 1
      return ''
    })
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<(?!https?:|mailto:)[^>]+>/gi, () => {
      stripped += 1
      return ''
    })
  return { lines: joined.split('\n'), stripped }
}

function countUnclosedMath(lines: string[]): number[] {
  const result: number[] = []
  let inFence = false
  let fenceChar = ''

  lines.forEach((line, index) => {
    const fence = line.match(FENCE_LINE)
    if (fence) {
      if (!inFence) {
        inFence = true
        fenceChar = fence[2][0]
      } else if (fence[2][0] === fenceChar && fence[3].trim() === '') {
        inFence = false
      }
      return
    }
    if (inFence) return
    if (line.includes('$$')) return
    if (/`[^`]*`/.test(line)) return
    const dollars = (line.match(/(?<!\\)\$/g) ?? []).length
    if (dollars % 2 !== 0) result.push(index + 1)
  })

  return result
}

function collapseBlankLines(text: string): string {
  return text.replace(/\n{3,}/g, '\n\n').replace(/\n*$/, '\n')
}

/**
 * Markdown 阵营编译器（CSDN / 掘金）。
 * 输入已净水的 Markdown，输出可直接写入 text/plain 剪贴板的平台净化版。
 */
export function transformMarkdown(
  markdown: string,
  platform: PlatformProfile,
  options: { injectToc?: boolean } = {},
): MarkdownTransformResult {
  const diagnostics: Diagnostic[] = []
  let lines = markdown.replace(/\r\n?/g, '\n').split('\n')

  if (platform.stripRawHtml) {
    const stripped = stripRawHtml(lines)
    lines = stripped.lines
    if (stripped.stripped > 0) {
      diagnostics.push({
        code: 'RAW_HTML_STRIPPED',
        severity: 'info',
        message: `已清理 ${stripped.stripped} 处 ${platform.name} 不兼容的 HTML 标签。`,
      })
    }
  }

  let filledFenceLanguages = 0
  if (platform.fillFenceLanguage) {
    const filled = fillFenceLanguages(lines)
    lines = filled.lines
    filledFenceLanguages = filled.filled
    if (filled.filled > 0) {
      diagnostics.push({
        code: 'FENCE_LANGUAGE_FILLED',
        severity: 'info',
        message: `已为 ${filled.filled} 个未标注语言的代码块补齐 text 标识。`,
      })
    }
  }

  lines = ensureBlockSpacing(lines)

  let tocInjected = false
  const shouldInjectToc = options.injectToc ?? platform.injectToc
  if (shouldInjectToc) {
    const toc = injectToc(lines)
    lines = toc.lines
    tocInjected = toc.injected
    if (toc.injected) {
      diagnostics.push({
        code: 'TOC_INJECTED',
        severity: 'info',
        message: '已在文章顶部注入 @[TOC](文章目录)。',
      })
    }
  }

  const unclosedLines = countUnclosedMath(lines)
  if (unclosedLines.length > 0) {
    diagnostics.push({
      code: 'UNCLOSED_INLINE_MATH',
      severity: 'warning',
      message: `第 ${unclosedLines.join('、')} 行存在未闭合的 $ 符号，建议发布前补全。`,
    })
  }

  return {
    markdown: collapseBlankLines(lines.join('\n')),
    diagnostics,
    tocInjected,
    filledFenceLanguages,
  }
}
