import { analyzeMarkdown } from '../markdown/document'

export type SummaryKey = 'juejin' | 'wechat' | 'csdn'

export interface SummaryRule {
  key: SummaryKey
  label: string
  min: number
  max: number
  note: string
}

export interface PassportSummary extends SummaryRule {
  text: string
  length: number
  compliant: boolean
}

export interface PassportCategory {
  juejin: string
  generic: string
}

export interface MetadataPassport {
  title: string
  /** 小红书 / 抖音 ≤ 20 字爆款短标题 */
  shortTitle20: string
  keywords: string[]
  tags: string[]
  tagsCsv: string
  hashtags: string
  zhihuTopics: string[]
  bilibiliSummary: string
  summaries: Record<SummaryKey, PassportSummary>
  category: PassportCategory
  readingMinutes: number
  generatedAt: number
}

export const SUMMARY_RULES: Record<SummaryKey, SummaryRule> = {
  juejin: {
    key: 'juejin',
    label: '掘金',
    min: 50,
    max: 100,
    note: '强制 50~100 字，少于 50 字无法发布',
  },
  wechat: {
    key: 'wechat',
    label: '微信公众号',
    min: 0,
    max: 120,
    note: '不超过 120 字，建议主动填写',
  },
  csdn: {
    key: 'csdn',
    label: 'CSDN',
    min: 0,
    max: 256,
    note: '不超过 256 字，需纯文本',
  },
}

const STOPWORDS = new Set(
  [
    '的',
    '了',
    '是',
    '在',
    '和',
    '与',
    '及',
    '或',
    '而',
    '也',
    '都',
    '就',
    '被',
    '把',
    '对',
    '从',
    '到',
    '为',
    '以',
    '于',
    '中',
    '上',
    '下',
    '里',
    '这',
    '那',
    '其',
    '之',
    '我们',
    '你们',
    '他们',
    '我',
    '你',
    '他',
    '她',
    '它',
    '这个',
    '那个',
    '这些',
    '那些',
    '一个',
    '一种',
    '一些',
    '一次',
    '一样',
    '一直',
    '一定',
    '不是',
    '就是',
    '只是',
    '还有',
    '而且',
    '并且',
    '或者',
    '而是',
    '因为',
    '所以',
    '但是',
    '如果',
    '虽然',
    '然后',
    '已经',
    '还是',
    '可能',
    '可以',
    '需要',
    '没有',
    '什么',
    '怎么',
    '为什么',
    '如何',
    '为了',
    '以及',
    '通过',
    '进行',
    '实现',
    '使用',
    '其中',
    '目前',
    '同时',
    '对于',
    '关于',
    '根据',
    '由于',
    '不同',
    '无法',
    '能够',
    '等级',
    '帮助',
    '工作',
    '提供',
    '包含',
    '支持',
    '具有',
    '之后',
    '之前',
    '现在',
    '今天',
    '时候',
    '时间',
    '问题',
    '情况',
    '结果',
    '过程',
    '方法',
    '方式',
    '方面',
    '部分',
    '地方',
    '东西',
    '事情',
    '大家',
    '朋友',
    '作者',
    '读者',
    '文章',
    '本文',
    '内容',
    '相关',
    '主要',
    '很多',
    '非常',
    '自己',
    '这样',
    '这种',
    '觉得',
    '感觉',
    '人们',
    '答案',
    '以及',
    '还是',
    '只是',
    '不同',
    '一样',
    '没有什么',
    'the',
    'a',
    'an',
    'and',
    'or',
    'but',
    'of',
    'to',
    'in',
    'on',
    'at',
    'by',
    'for',
    'with',
    'from',
    'as',
    'is',
    'are',
    'was',
    'were',
    'be',
    'been',
    'it',
    'its',
    'this',
    'that',
    'these',
    'those',
    'we',
    'you',
    'they',
    'our',
    'your',
    'their',
    'has',
    'have',
    'had',
    'can',
    'will',
    'not',
    'how',
    'why',
    'what',
    'when',
    'where',
    'which',
    'who',
  ].map((word) => word.toLowerCase()),
)

let segmenter: Intl.Segmenter | null | undefined

/** 中文分词容易把「知识库」「重排序」拆碎，用领域词表补齐高频专有词 */
const DOMAIN_TERMS = [
  '知识库',
  '检索',
  '召回',
  '重排序',
  '大模型',
  '人工智能',
  '机器学习',
  '深度学习',
  '向量',
  '语义',
  '切分',
  '文档',
  '问答',
  '幻觉',
  '准确率',
  '召回率',
  '工作流',
  '自动化',
  '产品经理',
  '用户体验',
  '增长',
  '商业',
  '复盘',
  '创业',
  '职场',
  '效率',
  '创作者',
  '写作',
  '发布',
  '多平台',
  '图片',
  '防盗链',
  '公式',
  '表格',
  '代码块',
  '标题',
  '摘要',
  '标签',
  '封面',
  '浏览器',
  '前端',
  '后端',
  '数据库',
  '算法',
  '架构',
  '开源',
  '工具',
  '平台',
  '用户',
  '阅读',
  '文学',
  '孤独',
  '旅行',
  '生活',
  '治愈',
  '成长',
  'RAG',
  'Agent',
  'LLM',
  'Markdown',
  'API',
  'PicList',
  'Cloudflare',
]

const TAG_STOPWORDS = new Set([
  '平台',
  '工具',
  '用户',
  '内容',
  '问题',
  '方法',
  '方式',
  '工作流',
  '效率',
  '时间',
  '系统',
  '功能',
  '场景',
])

function getSegmenter(): Intl.Segmenter | null {
  if (segmenter === undefined) {
    segmenter =
      typeof Intl !== 'undefined' && 'Segmenter' in Intl
        ? new Intl.Segmenter('zh-CN', { granularity: 'word' })
        : null
  }
  return segmenter
}

function charLength(value: string): number {
  return Array.from(value).length
}

function sliceChars(value: string, length: number): string {
  return Array.from(value).slice(0, Math.max(0, length)).join('')
}

function normalizeToken(raw: string): string {
  return raw
    .replace(/^[^\p{L}\p{N}+#]+/u, '')
    .replace(/[^\p{L}\p{N}+#]+$/u, '')
    .trim()
}

export function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/~~~[\s\S]*?~~~/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<img\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/(?<!\\)\$[^$\n]+\$/g, ' ')
    // 整行标题与表格不参与摘要造句，避免把“改造前 改造后 提升”拼进导语
    .replace(/^[ \t]*#{1,6}[^\n]*$/gm, ' ')
    .replace(/^[ \t]*\|.*\|[ \t]*$/gm, ' ')
    .replace(/^[ \t]*[^|\n]*(?:\|[^|\n]*){2,}$/gm, ' ')
    .replace(/^[ \t]*(参考资料|参考文献|参考)[：:].*$/gm, ' ')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+[.)]\s+/gm, '')
    .replace(/\[[ xX]\]/g, ' ')
    .replace(/`{1,3}([^`]*)`{1,3}/g, '$1')
    .replace(/\*\*|__|~~|\*/g, '')
    .replace(/\\\|/g, ' ')
    .replace(/\|/g, ' ')
    .replace(/^[\s|:-]+$/gm, ' ')
    .replace(/\[\d+\]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function tokenize(text: string): string[] {
  const engine = getSegmenter()
  const rawTokens: string[] = []
  if (engine) {
    for (const part of engine.segment(text)) {
      if (part.isWordLike) rawTokens.push(part.segment)
    }
  } else {
    rawTokens.push(...text.split(/[^\p{L}\p{N}+#]+/u))
  }
  return rawTokens.map(normalizeToken).filter((token) => {
    if (charLength(token) < 2 || charLength(token) > 16) return false
    if (/^\d+$/.test(token)) return false
    return !STOPWORDS.has(token.toLowerCase())
  })
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function countOccurrences(text: string, term: string): number {
  const haystack = text.toLowerCase()
  const needle = term.toLowerCase()
  if (/^[a-z0-9.+#-]+$/i.test(term)) {
    const pattern = new RegExp(`(?<![a-z0-9])${escapeRegExp(needle)}(?![a-z0-9])`, 'g')
    return (haystack.match(pattern) ?? []).length
  }
  let count = 0
  let index = haystack.indexOf(needle)
  while (index !== -1) {
    count += 1
    index = haystack.indexOf(needle, index + needle.length)
  }
  return count
}

function extractKeywords(text: string, title: string, limit = 8): string[] {
  const counts = new Map<string, { count: number; original: string; domain: boolean }>()
  for (const token of tokenize(text)) {
    const key = token.toLowerCase()
    const item = counts.get(key)
    if (item) {
      item.count += 1
    } else {
      counts.set(key, { count: 1, original: token, domain: false })
    }
  }

  for (const term of DOMAIN_TERMS) {
    const key = term.toLowerCase()
    const occurrences = countOccurrences(text, term)
    if (occurrences === 0) continue
    const item = counts.get(key)
    if (item) {
      item.count += occurrences
      item.domain = true
    } else {
      counts.set(key, { count: occurrences, original: term, domain: true })
    }
  }

  const titleTokens = new Set(tokenize(title).map((token) => token.toLowerCase()))
  const headTokens = new Set(tokenize(sliceChars(text, 320)).map((token) => token.toLowerCase()))

  const ranked = [...counts.entries()]
    .map(([key, value]) => {
      let score = value.count * 1.2
      if (headTokens.has(key)) score += 0.9
      if (titleTokens.has(key) || title.toLowerCase().includes(key)) score += 2.4
      if (value.domain) score += 1.8
      score += Math.min(charLength(value.original), 8) * 0.14
      return { key, original: value.original, score }
    })
    .sort((a, b) => b.score - a.score)

  const selected: string[] = []
  for (const item of ranked) {
    const conflictIndex = selected.findIndex(
      (word) => word.toLowerCase().includes(item.key) || item.key.includes(word.toLowerCase()),
    )
    if (conflictIndex !== -1) {
      // 同一语义只保留更完整的词，例如「知识库」优先于「知识」
      if (charLength(item.original) > charLength(selected[conflictIndex])) {
        selected[conflictIndex] = item.original
      }
      continue
    }
    selected.push(item.original)
    if (selected.length >= limit) break
  }
  return selected
}

interface ScoredSentence {
  index: number
  text: string
  score: number
  length: number
}

function splitSentences(text: string): string[] {
  return text
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[。！？!?；;])/))
    .map((sentence) => {
      const cleaned = sentence.replace(/\s+/g, ' ').trim()
      if (!cleaned || /[：:]$/.test(cleaned)) return ''
      return /[。！？!?；;…]$/.test(cleaned) ? cleaned : `${cleaned}。`
    })
    .filter((sentence) => charLength(sentence) >= 12 && charLength(sentence) <= 220)
    .filter((sentence) => !/^(参考资料|参考文献|参考|价格测试|本文由|作者|编辑|扫码|关注)/.test(sentence))
    .filter((sentence) => !/\[[ xX]\]/.test(sentence))
    .filter((sentence) => !/^(这张图|那张图|上图|下图|如图|图片来源|图片)/.test(sentence))
    .filter((sentence) => !/公式\s+其中|其中\s*[，,]/.test(sentence))
}

function scoreSentences(sentences: string[], keywords: string[], title: string): ScoredSentence[] {
  const weights = new Map<string, number>()
  keywords.forEach((keyword, index) => {
    weights.set(keyword.toLowerCase(), 1 - index * 0.07)
  })
  const titleKeys = new Set(tokenize(title).map((token) => token.toLowerCase()))

  return sentences.map((sentence, index) => {
    const tokens = tokenize(sentence).map((token) => token.toLowerCase())
    let weight = 0
    let titleHits = 0
    for (const token of tokens) {
      weight += weights.get(token) ?? 0
      if (titleKeys.has(token)) titleHits += 1
    }
    const length = charLength(sentence)
    let score = (weight / Math.sqrt(Math.max(10, length))) * 12 + titleHits * 0.5
    if (index < 2) score += 1.6
    if (index < 4) score += 0.4
    if (length < 16) score -= 0.6
    if (length > 140) score -= 0.5
    return { index, text: sentence, score, length }
  })
}

function clampText(text: string, max: number): string {
  const cleaned = text
    .replace(/[\u200b\u200c\u200d\u2060\ufeff]/g, '')
    .replace(/[`#*_~>]/g, '')
    .replace(/\$+/g, '')
    .replace(/\\[a-zA-Z]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[；;，,：:、]\s*$/, '。')
  const chars = Array.from(cleaned)
  if (chars.length <= max) return cleaned
  const head = chars.slice(0, max).join('')
  const lastPunctuation = Math.max(
    head.lastIndexOf('。'),
    head.lastIndexOf('！'),
    head.lastIndexOf('？'),
    head.lastIndexOf('；'),
  )
  if (lastPunctuation >= Math.floor(max * 0.55)) {
    return head.slice(0, lastPunctuation + 1)
  }
  return `${head.slice(0, Math.max(0, max - 1))}…`
}

function buildSummary(
  sentences: string[],
  keywords: string[],
  title: string,
  rule: SummaryRule,
): string {
  const target = rule.min > 0
    ? Math.min(rule.max, Math.max(rule.min, Math.round((rule.min + rule.max) / 2)))
    : Math.round(rule.max * 0.85)

  const allScored = scoreSentences(sentences, keywords, title)
  const byIndex = [...allScored].sort((a, b) => a.index - b.index)
  const ranked = [...allScored].sort((a, b) => b.score - a.score)
  const chosen: ScoredSentence[] = []
  let length = 0

  // 先用正文开头的 1~2 句做导语，保证摘要从文章主旨开始，而不是从中间随机摘句
  for (const sentence of byIndex.slice(0, 2)) {
    if (length + sentence.length <= rule.max) {
      chosen.push(sentence)
      length += sentence.length
    } else if (chosen.length === 0) {
      const truncated = clampText(sentence.text, rule.max)
      chosen.push({ ...sentence, text: truncated, length: charLength(truncated) })
      length = charLength(truncated)
      break
    }
  }

  for (const sentence of ranked) {
    if (length >= target) break
    if (chosen.some((item) => item.index === sentence.index)) continue
    if (length + sentence.length <= rule.max) {
      chosen.push(sentence)
      length += sentence.length
    }
  }

  let text = ''
  if (chosen.length === 0) {
    text = title || sentences[0] || '本文记录了完整的实践过程与思考。'
  } else {
    chosen.sort((a, b) => a.index - b.index)
    text = chosen
      .map((item) => item.text)
      .join('')
      .replace(/\s+/g, ' ')
      .trim()
  }
  text = clampText(text, rule.max)

  const keywordText = keywords.slice(0, 3).join('、') || title
  const fillers = [
    `本文围绕${keywordText}展开，梳理关键过程、实践细节与可复用经验，供读者参考。`,
    '文中同时记录了踩坑过程与修正思路，适合收藏后结合原文阅读。',
    '希望这份复盘能为同类场景提供一份可直接借鉴的参考。',
  ]

  let fillerIndex = 0
  while (charLength(text) < rule.min && charLength(text) < rule.max) {
    const need = Math.min(rule.min - charLength(text), rule.max - charLength(text))
    const filler = sliceChars(fillers[fillerIndex % fillers.length], need)
    if (!filler) break
    text += filler
    fillerIndex += 1
  }

  return clampText(text, rule.max)
}

function buildBilibiliSummary(wechatSummary: string): string {
  return `课代表省流：${clampText(wechatSummary, 96)}`
}

function detectCategory(keywords: string[]): PassportCategory {
  const rules: Array<{ words: string[]; juejin: string; generic: string }> = [
    { words: ['react', 'vue', '前端', 'css', '浏览器', 'javascript', 'typescript', 'next.js'], juejin: '前端', generic: '前端开发' },
    { words: ['后端', '服务端', '数据库', 'java', 'go', 'python', 'spring', 'redis', 'mysql', '微服务'], juejin: '后端', generic: '后端开发' },
    { words: ['android', '安卓', 'kotlin'], juejin: 'Android', generic: 'Android 开发' },
    { words: ['ios', 'swift', 'objective-c'], juejin: 'iOS', generic: 'iOS 开发' },
    { words: ['ai', '人工智能', '大模型', '模型', 'agent', 'rag', 'llm', '算法', '机器学习', '检索'], juejin: '人工智能', generic: '人工智能与算法' },
    { words: ['工具', '效率', 'vscode', 'git', 'docker', 'devops', '命令行'], juejin: '开发工具', generic: '开发工具与效率' },
    { words: ['读书', '文学', '小说', '书评', '历史', '哲学', '人文', '阅读'], juejin: '阅读', generic: '读书与人文' },
    { words: ['产品', '商业', '增长', '运营', '职场', '复盘', '管理', '创业', '用户'], juejin: '代码人生', generic: '职场与商业思考' },
    { words: ['生活', '旅行', '日常', '成长', '治愈', '咖啡', '摄影', '记录'], juejin: '代码人生', generic: '生活方式与成长' },
  ]

  const lowered = keywords.map((keyword) => keyword.toLowerCase())
  let best: { score: number; juejin: string; generic: string } | null = null
  for (const rule of rules) {
    const score = rule.words.reduce(
      (total, word) => total + (lowered.some((keyword) => keyword.includes(word)) ? 1 : 0),
      0,
    )
    if (score > 0 && (!best || score > best.score)) {
      best = { score, juejin: rule.juejin, generic: rule.generic }
    }
  }
  return best ?? { juejin: '代码人生', generic: '综合创作' }
}

/**
 * 免 API Key 的确定性发布护照生成器。
 * 基于标题、关键词权重、句子位置与平台字数硬约束，0.1 秒内给出可发布文案。
 */
export function generatePassport(markdown: string): MetadataPassport {
  const analysis = analyzeMarkdown(markdown)
  const plain = stripMarkdown(markdown)
  const sentences = splitSentences(plain)
  const firstSentence = sentences[0] ?? plain.slice(0, 42) ?? '未命名文稿'
  const title = analysis.title?.trim() || firstSentence.slice(0, 42)
  const keywords = extractKeywords(`${title}\n${plain}`, title)
  const category = detectCategory(keywords)
  const tagKeywords = keywords.filter((keyword) => !TAG_STOPWORDS.has(keyword.toLowerCase()))
  const tags = (tagKeywords.length >= 3 ? tagKeywords : keywords).slice(0, 6)

  const summaries = Object.fromEntries(
    (Object.keys(SUMMARY_RULES) as SummaryKey[]).map((key) => {
      const rule = SUMMARY_RULES[key]
      const text = buildSummary(sentences, keywords, title, rule)
      const length = charLength(text)
      return [
        key,
        {
          ...rule,
          text,
          length,
          compliant: length >= rule.min && length <= rule.max,
        },
      ]
    }),
  ) as Record<SummaryKey, PassportSummary>

  const rawShort = title.replace(/^[《「【]|[\s：:—-].*$/g, '').trim()
  const shortBase = charLength(rawShort) >= 8 ? rawShort : title
  const shortTitle20 = sliceChars(shortBase, 19)

  return {
    title: title.slice(0, 64),
    shortTitle20,
    keywords,
    tags,
    tagsCsv: tags.slice(0, 5).join(','),
    hashtags: tags.slice(0, 6).map((t) => `#${t}`).join(' '),
    zhihuTopics: tags.slice(0, 3),
    bilibiliSummary: buildBilibiliSummary(summaries.wechat.text),
    summaries,
    category,
    readingMinutes: analysis.stats.readingMinutes,
    generatedAt: Date.now(),
  }
}
