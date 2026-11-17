export * from './types'
export { SANITIZE_RULES, SANITIZE_RULE_LABELS } from './sanitizer/rules'
export { sanitizeMarkdown } from './sanitizer/sanitize'
export { analyzeMarkdown, parseMarkdown } from './markdown/document'
export { scanImages, classifyImage } from './images/radar'
export { compressImageToDataUrl, replaceImageReference } from './images/local'
export type { CompressedImage } from './images/local'
export { uploadToPicList, PICLIST_ENDPOINT } from './images/piclist'
export { generatePassport, stripMarkdown, SUMMARY_RULES } from './metadata/passport'
export type {
  MetadataPassport,
  PassportSummary,
  SummaryKey,
  SummaryRule,
  PassportCategory,
} from './metadata/passport'
export { PLATFORMS, PLATFORM_MAP, getPlatform, resolveHeadingDemotion } from './platforms/registry'
export { compileArticle } from './platforms/compile'
export { renderRichDocument } from './platforms/rich/renderer'
export { transformMarkdown } from './platforms/markdown/transform'
export { buildSlideDeck } from './platforms/deck/builder'
export { RICH_THEMES, DEFAULT_RICH_THEME, DEFAULT_RICH_THEME_ID, getRichTheme } from './platforms/rich/theme'
export type { RichTheme, ThemePreset } from './platforms/rich/theme'
export { renderTexToSvg } from './formula/mathjax'
export { copyCompiledArticle, copyPlainText } from './clipboard'
