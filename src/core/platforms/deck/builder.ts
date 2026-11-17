import { toString } from 'mdast-util-to-string'
import type {
  Blockquote,
  Code,
  Heading,
  List,
  Paragraph,
  Root,
  RootContent,
  Table,
  TableCell,
} from 'mdast'
import type { InlineMath, Math as MathNode } from 'mdast-util-math'
import type { PlatformProfile, SlideCard } from '../../types'
import { renderTexToSvg } from '../../formula/mathjax'

export interface DeckCompileResult {
  slides: SlideCard[]
  caption: string
}

interface RawSection {
  title: string
  subtitle?: string
  bullets: string[]
  quote?: string
  highlight?: string
  formulaTex?: string
  tableRows?: string[][]
  sourceLine: number
}

function cleanLine(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[`*_~]/g, '')
    .trim()
}

function splitParagraphIntoPoints(text: string): string[] {
  const cleaned = cleanLine(text)
  if (!cleaned) return []
  if (cleaned.length <= 68) return [cleaned]
  return cleaned
    .split(/(?<=[。！？；;])/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 6)
    .slice(0, 3)
}

function extractTablePreview(table: Table): string[][] {
  return table.children.slice(0, 4).map((row) =>
    row.children.slice(0, 4).map((cell) => cleanLine(toString(cell as TableCell)).slice(0, 18)),
  )
}

/**
 * 将 Markdown AST 智能拆解为小红书 / 抖音 3:4 视觉知识图集（SlideDeck）+ 配套章节摘要文案。
 */
export async function buildSlideDeck(
  root: Root,
  platform: PlatformProfile,
  lineMap?: number[],
): Promise<DeckCompileResult> {
  const mapLine = (line?: number) => {
    if (!line) return 1
    return lineMap?.[line - 1] ?? line
  }

  let docTitle = '未命名文章'
  let docLead = ''
  let titleLine = 1
  const sections: RawSection[] = []
  let current: RawSection | null = null

  const ensureSection = (fallbackTitle: string, line: number): RawSection => {
    if (!current) {
      current = {
        title: fallbackTitle,
        bullets: [],
        sourceLine: mapLine(line),
      }
      sections.push(current)
    }
    return current
  }

  for (const node of root.children as RootContent[]) {
    const line = node.position?.start.line ?? 1
    if (node.type === 'heading') {
      const heading = node as Heading
      const text = cleanLine(toString(heading))
      if (!text) continue
      if (heading.depth === 1 && docTitle === '未命名文章') {
        docTitle = text
        titleLine = mapLine(line)
        continue
      }
      if (heading.depth <= 2) {
        current = {
          title: text.replace(/^([一二三四五六七八九十]+[、.．]|\d+(?:\.\d+)*[、.．)]?)\s*/, ''),
          bullets: [],
          sourceLine: mapLine(line),
        }
        sections.push(current)
      } else {
        const sec = ensureSection('核心要点拆解', line)
        if (!sec.subtitle) {
          sec.subtitle = text
        } else if (sec.bullets.length < 4) {
          sec.bullets.push(`▸ ${text}`)
        }
      }
      continue
    }

    if (node.type === 'blockquote') {
      const quoteText = cleanLine(toString(node as Blockquote))
      if (!quoteText) continue
      if (!docLead && sections.length === 0) {
        docLead = quoteText
      } else {
        const sec = ensureSection('核心洞见', line)
        if (!sec.quote) sec.quote = quoteText
      }
      continue
    }

    if (node.type === 'paragraph') {
      const para = node as Paragraph
      const text = cleanLine(toString(para))
      if (!text) continue
      if (!docLead && sections.length === 0) {
        docLead = text
      }
      // Check inline math inside paragraph
      for (const child of para.children) {
        if (child.type === 'inlineMath' && current && !current.formulaTex) {
          current.formulaTex = (child as InlineMath).value
        }
      }
      const sec = ensureSection('关键背景与痛点', line)
      for (const point of splitParagraphIntoPoints(text)) {
        if (sec.bullets.length < 4) sec.bullets.push(point)
      }
      continue
    }

    if (node.type === 'list') {
      const list = node as List
      const sec = ensureSection('实操清单', line)
      for (const item of list.children) {
        const itemText = cleanLine(toString(item))
        if (itemText && sec.bullets.length < 5) {
          sec.bullets.push(itemText)
        }
      }
      continue
    }

    if (node.type === 'table') {
      const sec = ensureSection('核心数据对比', line)
      if (!sec.tableRows) {
        sec.tableRows = extractTablePreview(node as Table)
      }
      continue
    }

    if (node.type === 'math') {
      const mathNode = node as MathNode
      const sec = ensureSection('核心量化公式', line)
      if (!sec.formulaTex) {
        sec.formulaTex = mathNode.value
      }
      continue
    }

    if (node.type === 'code') {
      const codeNode = node as Code
      const sec = ensureSection('关键实现代码', line)
      const firstMeaningfulLine = codeNode.value
        .split('\n')
        .map((l) => l.trim())
        .find((l) => l && !l.startsWith('//') && !l.startsWith('#'))
      if (firstMeaningfulLine && !sec.highlight) {
        sec.highlight = firstMeaningfulLine.slice(0, 64)
      }
    }
  }

  const trimmedSections = sections.filter(
    (s) => s.bullets.length > 0 || s.quote || s.tableRows || s.formulaTex || s.highlight,
  )

  const tagPool = extractDeckTags(docTitle, trimmedSections)

  const rawSlides: Array<Omit<SlideCard, 'index' | 'total'>> = []

  // 1. 封面卡 (Cover Slide)
  const coverBullets = trimmedSections.slice(0, 3).map((s, idx) => `0${idx + 1} · ${s.title}`)
  rawSlides.push({
    kind: 'cover',
    kicker: 'CHAPTER NOTES · 章节摘要',
    title: docTitle,
    subtitle: docLead || '按原文章节整理的摘要卡片，完整论述请结合原文阅读。',
    bullets: coverBullets.length > 0 ? coverBullets : ['请结合原稿阅读'],
    quote: trimmedSections.find((s) => s.quote)?.quote,
    sourceLine: titleLine,
    tags: tagPool,
  })

  // 2. 章节知识卡 (Section Slides)
  for (let i = 0; i < trimmedSections.length; i += 1) {
    const sec = trimmedSections[i]
    let formulaSvg: string | undefined
    if (sec.formulaTex) {
      const rendered = await renderTexToSvg(sec.formulaTex, true)
      if (rendered.svg) formulaSvg = rendered.svg
    }
    rawSlides.push({
      kind: 'section',
      kicker: `PART 0${i + 1} / 核心章节拆解`,
      title: sec.title,
      subtitle: sec.subtitle,
      bullets: sec.bullets.length > 0 ? sec.bullets : [],
      quote: sec.quote,
      highlight: sec.highlight,
      formulaSvg,
      tableRows: sec.tableRows,
      sourceLine: sec.sourceLine,
      tags: tagPool,
    })
  }

  // 3. 尾页总结与互动卡 (Outro Slide)
  rawSlides.push({
    kind: 'outro',
    kicker: 'SUMMARY · 章节回顾',
    title: '章节回顾',
    subtitle: `共 ${trimmedSections.length} 个章节摘要 · 每张卡片保留部分要点，完整内容以原稿为准。`,
    bullets: trimmedSections.slice(0, 4).map((s, i) => `✅ 要点 ${i + 1}：${s.title}`),
    sourceLine: trimmedSections[trimmedSections.length - 1]?.sourceLine ?? titleLine,
    tags: tagPool,
  })

  const total = rawSlides.length
  const slides: SlideCard[] = rawSlides.map((slide, idx) => ({
    ...slide,
    index: idx + 1,
    total,
  }))

  const caption = buildSocialCaption(docTitle, docLead, trimmedSections, tagPool, platform.id)

  return { slides, caption }
}

function extractDeckTags(title: string, sections: RawSection[]): string[] {
  const joined = `${title} ${sections.map((s) => s.title).join(' ')}`
  const candidates: string[] = []
  const presets = [
    '人工智能',
    'RAG知识库',
    'Agent智能体',
    '产品经理',
    '效率工具',
    '技术笔记',
    '个人成长',
    '读书笔记',
    '职场复盘',
    '慢生活',
    '创作者工具',
  ]
  for (const word of presets) {
    if (joined.toLowerCase().includes(word.toLowerCase().slice(0, 2))) {
      candidates.push(word)
    }
  }
  const defaults = ['知识笔记', '学习记录']
  for (const item of defaults) {
    if (!candidates.includes(item)) candidates.push(item)
  }
  return candidates.slice(0, 6)
}

function buildSocialCaption(
  title: string,
  lead: string,
  sections: RawSection[],
  tags: string[],
  platformId: string,
): string {
  const shortTitle = Array.from(title).slice(0, 19).join('')
  const hashtagLine = tags.map((t) => `#${t}`).join(' ')

  const points = sections.slice(0, 4)
    .map((section, index) => `图${index + 2}｜${Array.from(section.title).slice(0, 48).join('')}${section.bullets[0] ? `：${section.bullets[0].slice(0, 48)}` : ''}`)
    .join('\n')
  return [
    platformId === 'douyin' ? `【20字内抖音标题】${shortTitle}` : `【20字内小红书标题】${shortTitle}`,
    '',
    lead ? Array.from(lead).slice(0, 300).join('') : '本篇按原文章节整理摘要，详细论述请结合原文阅读。',
    '',
    `章节摘要导读${sections.length > 4 ? '（前四节）' : ''}：`,
    points,
    '',
    '图集为章节摘要，不包含原稿的全部文字与配图；发布前请核对。',
    '',
    hashtagLine,
  ].join('\n')
}
