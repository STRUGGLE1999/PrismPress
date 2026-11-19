import type {
  SanitizeCount,
  SanitizeFix,
  SanitizeReport,
  SanitizeRuleId,
} from '../types'
import { SANITIZE_RULES, ZERO_WIDTH_PATTERN } from './rules'

interface WorkingLine {
  text: string
  /** 原始行号（0-based） */
  origin: number
  inFence: boolean
}

const FENCE_OPEN = /^\s{0,3}(`{3,}|~{3,})/
const HEADING_WITH_CONTENT = /^( {0,3})(#{1,6})(?!#)([ \t]*)(\S.*)$/
const HEADING_FULLY_BOLD = /^( {0,3})(#{1,6})[ \t]+(?:\*\*|__)(.+?)(?:\*\*|__)[ \t]*#*[ \t]*$/
const INLINE_CODE = /(`+[^`]*`+)/g

function truncate(value: string, max = 160): string {
  return value.length > max ? `${value.slice(0, max)}…` : value
}

/** 仅在行内代码之外执行变换，避免误伤 `$ 代码 $` */
function outsideInlineCode(line: string, transform: (chunk: string) => string): string {
  return line
    .split(INLINE_CODE)
    .map((chunk, index) => (index % 2 === 1 ? chunk : transform(chunk)))
    .join('')
}

/**
 * 行内公式边界收紧。
 * - 两侧都有空格：直接收紧（$ f(x) $ → $f(x)$）
 * - 只有单侧空格：仅当内容含明确 TeX 特征时收紧，避免误伤货币金额
 */
function tightenInlineMath(chunk: string, onFix: (before: string, after: string) => void): string {
  return chunk.replace(/(?<!\\)\$(?!\$)([^$\n]+?)(?<!\\)\$(?!\$)/g, (whole, rawContent: string) => {
    const leading = /^[ \t]+/.test(rawContent)
    const trailing = /[ \t]+$/.test(rawContent)
    if (!leading && !trailing) return whole
    const content = rawContent.trim()
    if (!content) return whole
    const hasTexSignal = /\\[a-zA-Z]+|[_^{}]|[=<>]/.test(content)
    if (!leading || !trailing) {
      if (!hasTexSignal) return whole
    }
    const fixed = `$${content}$`
    onFix(whole, fixed)
    return fixed
  })
}

/** 计算每一行是否处于 fenced code block 内（围栏行本身也视为内部） */
function markFences(rawLines: string[]): boolean[] {
  let fenceChar: string | null = null
  let fenceLength = 0
  return rawLines.map((line) => {
    const match = line.match(FENCE_OPEN)
    if (match) {
      const char = match[1][0]
      if (fenceChar === null) {
        fenceChar = char
        fenceLength = match[1].length
        return true
      }
      if (fenceChar === char && match[1].length >= fenceLength && !line.slice(match[0].length).trim()) {
        fenceChar = null
        return true
      }
    }
    return fenceChar !== null
  })
}

/**
 * 跨平台语法自动净水器（Auto-Sanitizer）
 *
 * 处理顺序：零宽字符 → 标题补空格 → 标题去加粗 → 行内公式收紧 → 块级公式独立成段。
 * 会跳过 fenced code block 与行内代码，避免修改代码示例。
 */
export function sanitizeMarkdown(input: string): SanitizeReport {
  const eol = input.includes('\r\n') ? '\r\n' : '\n'
  const rawLines = input.replace(/\r\n?/g, '\n').split('\n')
  const inFence = markFences(rawLines)

  const fixes: SanitizeFix[] = []
  const counter: Record<SanitizeRuleId, number> = {
    'heading-space': 0,
    'heading-bold': 0,
    'inline-math-padding': 0,
    'block-math-spacing': 0,
    'zero-width': 0,
  }

  const addFix = (rule: SanitizeRuleId, line: number, before: string, after: string) => {
    counter[rule] += 1
    fixes.push({ rule, line: line + 1, before: truncate(before), after: truncate(after) })
  }

  const passOne: WorkingLine[] = rawLines.map((raw, index) => {
    let text = raw

    // 1. 零宽 / 隐形字符
    const zeroWidthMatches = text.match(ZERO_WIDTH_PATTERN)
    if (zeroWidthMatches) {
      const cleaned = text.replace(ZERO_WIDTH_PATTERN, '')
      counter['zero-width'] += zeroWidthMatches.length
      fixes.push({
        rule: 'zero-width',
        line: index + 1,
        before: `【含 ${zeroWidthMatches.length} 个零宽字符】${truncate(raw)}`,
        after: truncate(cleaned),
      })
      text = cleaned
    }

    if (inFence[index]) {
      return { text, origin: index, inFence: true }
    }

    // 2. 标题粘连：##标题 → ## 标题
    const heading = text.match(HEADING_WITH_CONTENT)
    if (heading && heading[3].length === 0) {
      const fixed = `${heading[1]}${heading[2]} ${heading[4]}`
      addFix('heading-space', index, text, fixed)
      text = fixed
    }

    // 3. 标题内冗余加粗：## **标题** → ## 标题
    const bold = text.match(HEADING_FULLY_BOLD)
    if (bold) {
      const fixed = `${bold[1]}${bold[2]} ${bold[3]}`
      addFix('heading-bold', index, text, fixed)
      text = fixed
    }

    // 4. 行内公式内侧空格
    text = outsideInlineCode(text, (chunk) =>
      tightenInlineMath(chunk, (before, after) => addFix('inline-math-padding', index, before, after)),
    )

    return { text, origin: index, inFence: false }
  })

  // 5. 块级公式独立成段
  const passTwo = normalizeBlockMath(passOne, addFix)

  const output = passTwo.map((line) => line.text).join(eol)
  const counts: SanitizeCount[] = SANITIZE_RULES.map((rule) => ({
    rule: rule.id,
    label: rule.label,
    count: counter[rule.id],
  }))

  return {
    input,
    output,
    changed: output !== input,
    fixes,
    counts,
    lineMap: passTwo.map((line) => line.origin + 1),
  }
}

function normalizeBlockMath(
  lines: WorkingLine[],
  addFix: (rule: SanitizeRuleId, line: number, before: string, after: string) => void,
): WorkingLine[] {
  const out: WorkingLine[] = []
  const blank = (origin: number): WorkingLine => ({ text: '', origin, inFence: false })

  const ensureBlankBefore = (origin: number): boolean => {
    const last = out[out.length - 1]
    if (last && last.text.trim() !== '') {
      out.push(blank(origin))
      return true
    }
    return false
  }

  const ensureBlankAfterIfNeeded = (origin: number, next?: WorkingLine): boolean => {
    if (next && next.text.trim() !== '') {
      out.push(blank(origin))
      return true
    }
    return false
  }

  let index = 0
  while (index < lines.length) {
    const line = lines[index]
    if (line.inFence) {
      out.push(line)
      index += 1
      continue
    }

    const trimmed = line.text.trim()
    if (!trimmed.includes('$$')) {
      out.push(line)
      index += 1
      continue
    }

    // 段落中夹带的完整块级公式：正文$$...$$正文 → 三段
    if (!trimmed.startsWith('$$')) {
      const embedded = trimmed.match(/^(.*?)\$\$([\s\S]+?)\$\$(.*)$/)
      if (embedded) {
        const before = embedded[1].trim()
        const formula = `$$${embedded[2].trim()}$$`
        const after = embedded[3].trim()
        if (before) out.push({ text: before, origin: line.origin, inFence: false })
        const beforeBlank = ensureBlankBefore(line.origin)
        out.push({ text: formula, origin: line.origin, inFence: false })
        if (after) {
          out.push(blank(line.origin))
          out.push({ text: after, origin: line.origin, inFence: false })
        } else if (lines[index + 1]?.text.trim()) {
          out.push(blank(line.origin))
        }
        addFix(
          'block-math-spacing',
          line.origin,
          trimmed,
          beforeBlank || after ? '$$...$$ 已独立成段' : '$$...$$ 已独立成段',
        )
        index += 1
        continue
      }
    }

    if (trimmed.startsWith('$$')) {
      const inner = trimmed.slice(2)
      const completeOnOneLine = inner.length > 2 && inner.endsWith('$$') && !inner.slice(0, -2).includes('$$')

      const beforeBlank = ensureBlankBefore(line.origin)
      out.push(line)
      index += 1

      if (completeOnOneLine) {
        const afterBlank = ensureBlankAfterIfNeeded(line.origin, lines[index])
        if (beforeBlank || afterBlank) {
          addFix('block-math-spacing', line.origin, trimmed, '$$...$$ 前后已保留空行')
        }
        continue
      }

      // 多行公式：一直复制到闭合的 $$ 行
      let closingOrigin = line.origin
      while (index < lines.length) {
        const current = lines[index]
        out.push(current)
        closingOrigin = current.origin
        index += 1
        if (!current.inFence && current.text.includes('$$')) break
      }
      const afterBlank = ensureBlankAfterIfNeeded(closingOrigin, lines[index])
      if (beforeBlank || afterBlank) {
        addFix('block-math-spacing', line.origin, trimmed, '$$...$$ 前后已保留空行')
      }
      continue
    }

    out.push(line)
    index += 1
  }

  return out
}
