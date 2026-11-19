/**
 * PrismPress 核心领域模型
 * 所有编译器、净水器、体检雷达共享的类型契约。
 */

export type PlatformId =
  | 'wechat'
  | 'xiaohongshu'
  | 'douyin'
  | 'zhihu'
  | 'bilibili'
  | 'juejin'
  | 'csdn'

/** 编辑器底层协议：富文本 DOM、Markdown 源码 或 视觉滑动图集（小红书/抖音） */
export type EditorProtocol = 'rich' | 'markdown' | 'visual_deck'

export type ClipboardMime = 'text/html' | 'text/plain'

export type CompileFormat = 'html' | 'markdown' | 'deck'

export type Severity = 'info' | 'warning' | 'error'

/** 标题编译策略：native = 原样保留；two-level = 超出层级降维为引导符高亮块 */
export type HeadingStrategy = 'native' | 'two-level'

export interface HeadingDemotionRule {
  /** 从第几级标题开始降维（含） */
  from: number
  /** 引导符，如 ▎ / ◆ */
  marker: string
}

export interface SummaryRule {
  min: number
  max: number
  /** 编辑器是否强制校验（掘金 50-100 字） */
  hardLimit: boolean
  note: string
}

export interface PlatformProfile {
  id: PlatformId
  name: string
  shortName: string
  /** 品牌色，用于 UI */
  accent: string
  editor: EditorProtocol
  clipboard: ClipboardMime
  format: CompileFormat
  supportsLatex: boolean
  /** 编辑器原生的最大标题层级，null 表示不限制 */
  maxHeadingLevel: number | null
  headingStrategy: HeadingStrategy
  headingDemotion: HeadingDemotionRule[]
  /** 公众号：正文外链转文末参考资料角标 */
  footnoteLinks: boolean
  /** 公众号：宽表格横向滑动护盾 */
  tableShield: boolean
  /** Markdown 平台：顶部注入 @[TOC] */
  injectToc: boolean
  /** Markdown 平台：代码块缺语言时补齐 text */
  fillFenceLanguage: boolean
  /** 是否清除自定义 HTML 标签（51CTO） */
  stripRawHtml: boolean
  summary: SummaryRule
  tagsFormat: string
  categoryRule: string
  coverRatio: string
  editorUrl: string
  protocolNote: string
}

export interface Diagnostic {
  code: string
  message: string
  severity: Severity
  line?: number
}

export interface DocStats {
  characters: number
  /** 中文汉字数 + 英文单词数 */
  words: number
  readingMinutes: number
  headings: number
  paragraphs: number
  codeBlocks: number
  formulas: number
  tables: number
  images: number
  links: number
}

export interface ExternalLink {
  url: string
  text: string
  index: number
}

/* ------------------------------------------------------------------ */
/* 语法净水器                                                          */
/* ------------------------------------------------------------------ */

export type SanitizeRuleId =
  | 'heading-space'
  | 'heading-bold'
  | 'inline-math-padding'
  | 'block-math-spacing'
  | 'zero-width'

export interface SanitizeFix {
  rule: SanitizeRuleId
  line: number
  before: string
  after: string
}

export interface SanitizeCount {
  rule: SanitizeRuleId
  label: string
  count: number
}

export interface SanitizeReport {
  input: string
  output: string
  changed: boolean
  fixes: SanitizeFix[]
  counts: SanitizeCount[]
  /** 净水后每一行对应的原始行号（1-based），供预览点击定位回源码使用 */
  lineMap: number[]
}

/* ------------------------------------------------------------------ */
/* 三色图片体检雷达                                                     */
/* ------------------------------------------------------------------ */

export type ImageHealth = 'green' | 'yellow' | 'red'

export interface ImageFinding {
  url: string
  alt: string
  line: number
  health: ImageHealth
  /** 人类可读的判定原因 */
  reason: string
  /** 命中的域名（本地路径为 null） */
  host: string | null
}

export interface ImageReport {
  findings: ImageFinding[]
  total: number
  green: number
  yellow: number
  red: number
  /** 是否全部通过跨端体检 */
  healthy: boolean
}

/* ------------------------------------------------------------------ */
/* 视觉图集卡片（小红书 / 抖音 3:4 滑动知识图集）                       */
/* ------------------------------------------------------------------ */

export type SlideKind = 'cover' | 'section' | 'outro'

export interface SlideCard {
  index: number
  total: number
  kind: SlideKind
  kicker: string
  title: string
  subtitle?: string
  bullets: string[]
  quote?: string
  highlight?: string
  formulaSvg?: string
  tableRows?: string[][]
  sourceLine: number
  tags: string[]
}

/* ------------------------------------------------------------------ */
/* 编译产物                                                            */
/* ------------------------------------------------------------------ */

export interface CompileResult {
  platform: PlatformProfile
  format: CompileFormat
  /** 写入剪贴板的内容：富文本为 HTML，Markdown 平台为净化版 MD，图集平台为配套短文案 */
  body: string
  /** 纯文本降级内容，用于 text/plain 兜底 */
  plainText: string
  /** 小红书 / 抖音 3:4 视觉知识图集切片 */
  slides?: SlideCard[]
  previewHtml?: string
  stats: DocStats
  diagnostics: Diagnostic[]
  externalLinks: ExternalLink[]
  sanitize: SanitizeReport
  images: ImageReport
}

export interface CompileOptions {
  passport?: { title: string; shortTitle20: string; tags: string[] }
  imageSources?: Record<string, string>
  /** 注入 TOC（仅 CSDN 默认开启，可覆盖） */
  injectToc?: boolean
  /** 微信参考资料卡片标题 */
  referenceTitle?: string
  /** 富文本内联主题（公众号 / 知乎 / B站共用渲染器） */
  themeId?: string
}
