import type { SanitizeRuleId } from '../types'

export interface SanitizeRuleMeta {
  id: SanitizeRuleId
  label: string
  description: string
  /** 规则示例，用于 UI 展示 */
  example: string
}

/**
 * Auto-Sanitizer 规则库。
 * 规则顺序即执行顺序：先修结构（标题），再修数学边界，最后清理隐形字符。
 */
export const SANITIZE_RULES: SanitizeRuleMeta[] = [
  {
    id: 'heading-space',
    label: '标题粘连修复',
    description: '为缺失空格的 ATX 标题补空格，避免 Markdown 平台把 ##标题 当成正文。',
    example: '##一、背景 → ## 一、背景',
  },
  {
    id: 'heading-bold',
    label: '标题冗余加粗剥离',
    description: '移除整行标题内的 ** / __，防止富文本转换后星号外露或双重加粗。',
    example: '## **核心结论** → ## 核心结论',
  },
  {
    id: 'inline-math-padding',
    label: '行内公式边界收紧',
    description: '清理 $ 内侧多余空格，修复知乎 / 掘金公式因空格不渲染的问题。',
    example: '$ f(x) $ → $f(x)$',
  },
  {
    id: 'block-math-spacing',
    label: '块级公式独立成段',
    description: '确保 $$...$$ 前后保留空行，避免与段落粘连后被平台当成普通文本。',
    example: '正文$$\\sum x$$正文 → 正文 / $$\\sum x$$ / 正文',
  },
  {
    id: 'zero-width',
    label: '零宽隐形字符清除',
    description: '清除飞书 / Notion / 网页复制夹带的 \\u200b、\\u200c、\\ufeff 等隐形字符。',
    example: '标\\u200b题 → 标题',
  },
]

export const SANITIZE_RULE_LABELS: Record<SanitizeRuleId, string> = Object.fromEntries(
  SANITIZE_RULES.map((rule) => [rule.id, rule.label]),
) as Record<SanitizeRuleId, string>

/** 需要清除的零宽 / 不可见字符 */
export const ZERO_WIDTH_PATTERN = /[\u200b\u200c\u200d\u2060\ufeff]/g
