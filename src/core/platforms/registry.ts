import type { PlatformId, PlatformProfile } from '../types'

/**
 * 七大平台协议注册表 —— PrismPress 的单一事实来源。
 * 一束白光，七色光谱：微信公众号、小红书图文、抖音图文、知乎、B站专栏、掘金、CSDN。
 * 正文编译、预览画布仿真、发布护照、剪贴板协议全部从这里读取。
 */
export const PLATFORMS: PlatformProfile[] = [
  {
    id: 'wechat',
    name: '微信公众号',
    shortName: '公众号',
    accent: '#07C160',
    editor: 'rich',
    clipboard: 'text/html',
    format: 'html',
    supportsLatex: false,
    maxHeadingLevel: null,
    headingStrategy: 'native',
    headingDemotion: [
      { from: 3, marker: '▎' },
      { from: 4, marker: '◆' },
    ],
    footnoteLinks: true,
    tableShield: true,
    injectToc: false,
    fillFenceLanguage: true,
    stripRawHtml: false,
    summary: {
      min: 0,
      max: 120,
      hardLimit: false,
      note: '建议填写简明摘要，帮助读者快速了解文章。',
    },
    tagsFormat: '#话题1 #话题2 #话题3（最多 3~5 个原创话题）',
    categoryRule: '原创声明 / 作者名 ≤ 8 字',
    coverRatio: '头条 2.35:1（900×383）；次条 1:1',
    editorUrl: 'https://mp.weixin.qq.com/',
    protocolNote: '已适配公众号的标题、表格与参考资料排版。',
  },
  {
    id: 'xiaohongshu',
    name: '小红书图文',
    shortName: '小红书',
    accent: '#FF2442',
    editor: 'visual_deck',
    clipboard: 'text/plain',
    format: 'deck',
    supportsLatex: false,
    maxHeadingLevel: 2,
    headingStrategy: 'two-level',
    headingDemotion: [
      { from: 3, marker: '📌' },
      { from: 4, marker: '✨' },
    ],
    footnoteLinks: false,
    tableShield: false,
    injectToc: false,
    fillFenceLanguage: false,
    stripRawHtml: true,
    summary: {
      min: 20,
      max: 1000,
      hardLimit: true,
      note: '标题严格 ≤ 20 字！正文限 1000 字内，自动按章节切分为 3:4 (1080×1440) 高清滑动知识卡片。',
    },
    tagsFormat: '#话题1 #话题2 #话题3（推荐 5~8 个高热垂直标签）',
    categoryRule: '图文笔记 · 3:4 竖版多图卡片 + 种草/干货短文案',
    coverRatio: '3:4 黄金竖版（1080×1440）',
    editorUrl: 'https://creator.xiaohongshu.com/publish/publish?source=official&target=image',
    protocolNote: '文章已整理为竖版图集与发布文案。',
  },
  {
    id: 'douyin',
    name: '抖音图文',
    shortName: '抖音',
    accent: '#FE2C55',
    editor: 'visual_deck',
    clipboard: 'text/plain',
    format: 'deck',
    supportsLatex: false,
    maxHeadingLevel: 2,
    headingStrategy: 'two-level',
    headingDemotion: [
      { from: 3, marker: '⚡' },
      { from: 4, marker: '▸' },
    ],
    footnoteLinks: false,
    tableShield: false,
    injectToc: false,
    fillFenceLanguage: false,
    stripRawHtml: true,
    summary: {
      min: 20,
      max: 1000,
      hardLimit: true,
      note: '标题 ≤ 20 字，图集核心考核「前 3 张划阅率」与停留时长，自动生成高反差霓虹信息流图集。',
    },
    tagsFormat: '#话题1 #话题2 #话题3（推荐 3~5 个算法兴趣标签 + BGM 建议）',
    categoryRule: '抖音图文 / 深度长图文 · 3:4 全屏划动卡片',
    coverRatio: '3:4 竖屏图集（1080×1440）',
    editorUrl: 'https://creator.douyin.com/creator-micro/content/upload?default-tab=3',
    protocolNote: '文章已整理为竖版图集与发布文案。',
  },
  {
    id: 'zhihu',
    name: '知乎',
    shortName: '知乎',
    accent: '#0084FF',
    editor: 'rich',
    clipboard: 'text/html',
    format: 'html',
    supportsLatex: true,
    maxHeadingLevel: 2,
    headingStrategy: 'two-level',
    headingDemotion: [
      { from: 3, marker: '▎' },
      { from: 4, marker: '◆' },
    ],
    footnoteLinks: false,
    tableShield: false,
    injectToc: false,
    fillFenceLanguage: false,
    stripRawHtml: true,
    summary: {
      min: 0,
      max: 100,
      hardLimit: false,
      note: '前 100 字导语决定信息流展开率。',
    },
    tagsFormat: '必绑 1~3 个「知乎话题」',
    categoryRule: '投稿专栏 + 关联 1~3 个高热问题',
    coverRatio: '16:9（推荐 1280×720）',
    editorUrl: 'https://zhuanlan.zhihu.com/write',
    protocolNote: '已适配知乎文章排版。',
  },
  {
    id: 'bilibili',
    name: 'B站专栏',
    shortName: 'B站',
    accent: '#FB7299',
    editor: 'rich',
    clipboard: 'text/html',
    format: 'html',
    supportsLatex: false,
    maxHeadingLevel: 2,
    headingStrategy: 'two-level',
    headingDemotion: [
      { from: 3, marker: '▎' },
      { from: 4, marker: '◆' },
    ],
    footnoteLinks: false,
    tableShield: false,
    injectToc: false,
    fillFenceLanguage: false,
    stripRawHtml: true,
    summary: {
      min: 0,
      max: 100,
      hardLimit: false,
      note: '专栏导语 ≤ 100 字，可另附评论区「课代表总结」。',
    },
    tagsFormat: '互动话题 + 最多 10 个标签',
    categoryRule: '专栏分区（科技 / 生活 / 轻小说等）',
    coverRatio: '16:9 或 4:3',
    editorUrl: 'https://member.bilibili.com/platform/upload/text/edit',
    protocolNote: '已适配B站专栏排版。',
  },
  {
    id: 'csdn',
    name: 'CSDN',
    shortName: 'CSDN',
    accent: '#FC5531',
    editor: 'markdown',
    clipboard: 'text/plain',
    format: 'markdown',
    supportsLatex: true,
    maxHeadingLevel: 6,
    headingStrategy: 'native',
    headingDemotion: [],
    footnoteLinks: false,
    tableShield: false,
    injectToc: true,
    fillFenceLanguage: true,
    stripRawHtml: false,
    summary: {
      min: 0,
      max: 256,
      hardLimit: true,
      note: '严格 ≤ 256 字，需纯文本，剔除代码块与 # 号。',
    },
    tagsFormat: '最多 5 个标签（逗号 / 回车分隔）',
    categoryRule: '分类专栏 + 文章类型（原创）',
    coverRatio: '16:9（推荐 1280×720）',
    editorUrl: 'https://editor.csdn.net/md/?not_checkout=1',
    protocolNote: '保留 Markdown 格式，便于继续编辑。',
  },
  {
    id: 'juejin',
    name: '掘金',
    shortName: '掘金',
    accent: '#1E80FF',
    editor: 'markdown',
    clipboard: 'text/plain',
    format: 'markdown',
    supportsLatex: true,
    maxHeadingLevel: 6,
    headingStrategy: 'native',
    headingDemotion: [],
    footnoteLinks: false,
    tableShield: false,
    injectToc: false,
    fillFenceLanguage: false,
    stripRawHtml: false,
    summary: {
      min: 50,
      max: 100,
      hardLimit: true,
      note: '摘要上限100字，建议50～100字。',
    },
    tagsFormat: '必选 1~3 个平台标签',
    categoryRule: '必选 1 个分类：后端 / 前端 / Android / iOS / 人工智能 / 开发工具 / 代码人生 / 阅读',
    coverRatio: '16:9 或 3:2（推荐 1300×730）',
    editorUrl: 'https://juejin.cn/editor/drafts/new',
    protocolNote: '保留 Markdown 格式，便于继续编辑。',
  },
]

export const PLATFORM_MAP: Record<PlatformId, PlatformProfile> = Object.fromEntries(
  PLATFORMS.map((platform) => [platform.id, platform]),
) as Record<PlatformId, PlatformProfile>

export function getPlatform(id: PlatformId): PlatformProfile {
  return PLATFORM_MAP[id]
}

/** 返回该标题层级应使用的降维引导符；null 表示保留原生标题 */
export function resolveHeadingDemotion(platform: PlatformProfile, depth: number): string | null {
  if (platform.headingStrategy === 'native') return null
  if (platform.maxHeadingLevel !== null && depth <= platform.maxHeadingLevel) return null
  const rule = [...platform.headingDemotion]
    .sort((a, b) => b.from - a.from)
    .find((item) => depth >= item.from)
  return rule?.marker ?? '▎'
}

/** Resolve a social platform's article or image-deck destination as one contract. */
export function getPublicationPlatform(id: PlatformId, mode: 'article' | 'deck' = 'article'): PlatformProfile {
  const base = getPlatform(id)
  if ((id !== 'xiaohongshu' && id !== 'douyin') || mode === 'deck') return base
  return { ...base, name: id === 'xiaohongshu' ? '小红书长文' : '抖音文章', format: 'html', editor: 'rich', clipboard: 'text/html',
    summary: { ...base.summary, min: 0, max: id === 'douyin' ? 30 : base.summary.max },
    titleMax: id === 'douyin' ? 30 : 64,
    editorUrl: id === 'xiaohongshu' ? 'https://creator.xiaohongshu.com/publish/publish?source=official&target=article' : 'https://creator.douyin.com/creator-micro/content/upload?default-tab=5',
    protocolNote: id === 'xiaohongshu' ? '保留全文排版；小红书长文中的图片需另行插入。' : '保留正文与配图的文章排版。' }
}
