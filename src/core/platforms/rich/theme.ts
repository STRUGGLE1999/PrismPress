/**
 * 微信公众号 4 套高定内联主题。
 * 所有视觉差异都收敛为 token + 装饰风格，AST 渲染器无需感知具体模板。
 */
export type ThemePreset = 'native' | 'parchment' | 'morandi' | 'warm' | 'terminal'

export interface RichTheme {
  id: ThemePreset
  name: string
  description: string
  /** 适用题材 */
  audience: string
  preset: ThemePreset
  paper: string
  text: string
  muted: string
  accent: string
  accentSecondary: string
  accentSoft: string
  heading: string
  border: string
  quoteBackground: string
  codeBackground: string
  codeBar: string
  codeText: string
  link: string
  tableHeader: string
  highlight: string
  fontFamily: string
  headingFontFamily: string
  monoFont: string
  h2Style: 'parchment' | 'capsule' | 'rounded' | 'terminal'
  h3Style: 'serif' | 'bar' | 'warm' | 'terminal'
  quoteStyle: 'double' | 'bar' | 'warm' | 'terminal'
  codeChrome: 'mac' | 'plain'
  dark: boolean
}

const SERIF_FONT =
  `'Songti SC', 'STSong', 'Noto Serif SC', 'Source Han Serif SC', 'SimSun', Georgia, serif`
const SANS_FONT =
  `'Helvetica Neue', Arial, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', sans-serif`
const MONO_FONT = `'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace`

export const PARCHMENT: RichTheme = {
  id: 'parchment',
  name: '人文书卷 · 羊皮纸风',
  description: '米白羊皮纸底、勃艮第酒红衬线章节标题与古典双线引用框。',
  audience: '读书笔记 / 书评影评 / 人物故事 / 历史文化',
  preset: 'parchment',
  paper: '#FAF7F0',
  text: '#443A30',
  muted: '#8A7A68',
  accent: '#7C2D12',
  accentSecondary: '#A16207',
  accentSoft: '#F3E8D8',
  heading: '#5C2412',
  border: '#DCCBB4',
  quoteBackground: '#F5EDDF',
  codeBackground: '#1E1E2E',
  codeBar: '#181825',
  codeText: '#ECE3D6',
  link: '#8C3A1B',
  tableHeader: '#F1E5D3',
  highlight: '#E8C98A',
  fontFamily: SANS_FONT,
  headingFontFamily: SERIF_FONT,
  monoFont: MONO_FONT,
  h2Style: 'parchment',
  h3Style: 'serif',
  quoteStyle: 'double',
  codeChrome: 'plain',
  dark: false,
}

export const MORANDI: RichTheme = {
  id: 'morandi',
  name: '洞见简报 · 莫兰迪风',
  description: '克制的深海雾霾蓝、结构化编号胶囊与干净对比表格。',
  audience: '职场复盘 / 产品思考 / 商业分析 / 行业周报',
  preset: 'morandi',
  paper: '#FFFFFF',
  text: '#333333',
  muted: '#7A7A7A',
  accent: '#1E3A5F',
  accentSecondary: '#5B7C99',
  accentSoft: '#EEF3F8',
  heading: '#1E3A5F',
  border: '#DCE3EC',
  quoteBackground: '#F5F8FB',
  codeBackground: '#1E1E2E',
  codeBar: '#181825',
  codeText: '#E4E4E7',
  link: '#1E5A96',
  tableHeader: '#EEF3F8',
  highlight: '#C7D8EA',
  fontFamily: SANS_FONT,
  headingFontFamily: SANS_FONT,
  monoFont: MONO_FONT,
  h2Style: 'capsule',
  h3Style: 'bar',
  quoteStyle: 'bar',
  codeChrome: 'plain',
  dark: false,
}

export const WARM: RichTheme = {
  id: 'warm',
  name: '治愈日常 · 暖阳手绘风',
  description: '森林绿配暖杏色圆角块，重点文字模拟荧光马克笔手写划线。',
  audience: '生活记录 / 个人成长 / 旅行游记 / 新手入门',
  preset: 'warm',
  paper: '#FFFDF8',
  text: '#3D4A3B',
  muted: '#8A9485',
  accent: '#4F7A52',
  accentSecondary: '#E8A45C',
  accentSoft: '#EAF3E4',
  heading: '#355C39',
  border: '#E7DFCF',
  quoteBackground: '#FFF7E8',
  codeBackground: '#1E1E2E',
  codeBar: '#111827',
  codeText: '#E5E7EB',
  link: '#3F6B43',
  tableHeader: '#F0F5EA',
  highlight: '#F9D976',
  fontFamily: SANS_FONT,
  headingFontFamily: SANS_FONT,
  monoFont: MONO_FONT,
  h2Style: 'rounded',
  h3Style: 'warm',
  quoteStyle: 'warm',
  codeChrome: 'plain',
  dark: false,
}

export const TERMINAL: RichTheme = {
  id: 'terminal',
  name: '极客终端 · 防发白暗黑风',
  description: 'Mac 三色圆点深色代码块，强制内联深色背景，微信暗黑模式绝不发白。',
  audience: '硬核技术 / 代码教程 / 论文精读 / AI 模型实测',
  preset: 'terminal',
  paper: '#0B1220',
  text: '#C9D6E8',
  muted: '#7D93AD',
  accent: '#22D3EE',
  accentSecondary: '#A78BFA',
  accentSoft: '#0E2A38',
  heading: '#67E8F9',
  border: '#1E3A4A',
  quoteBackground: '#0D1C2B',
  codeBackground: '#1E1E2E',
  codeBar: '#11111B',
  codeText: '#E4E4E7',
  link: '#67E8F9',
  tableHeader: '#102635',
  highlight: '#164E63',
  fontFamily: SANS_FONT,
  headingFontFamily: MONO_FONT,
  monoFont: MONO_FONT,
  h2Style: 'terminal',
  h3Style: 'terminal',
  quoteStyle: 'terminal',
  codeChrome: 'mac',
  dark: true,
}

export const NATIVE: RichTheme = {
  ...MORANDI, id: 'native', name: '微信原生 · 标准正文', preset: 'native',
  description: '白底黑字与系统字体，接近微信文章的常规阅读样式。',
  paper: '#FFFFFF', text: '#333333', heading: '#222222', accent: '#576B95',
  accentSoft: '#F7F7F7', muted: '#888888', border: '#EDEDED',
  fontFamily: `system-ui, -apple-system, BlinkMacSystemFont, 'Helvetica Neue', 'PingFang SC', 'Microsoft YaHei', Arial, sans-serif`,
  headingFontFamily: `system-ui, -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif`,
}

export const RICH_THEMES: RichTheme[] = [NATIVE, PARCHMENT, MORANDI, WARM, TERMINAL]

export const DEFAULT_RICH_THEME = NATIVE

export const DEFAULT_RICH_THEME_ID = DEFAULT_RICH_THEME.id

export function getRichTheme(id?: string): RichTheme {
  return RICH_THEMES.find((theme) => theme.id === id) ?? DEFAULT_RICH_THEME
}
