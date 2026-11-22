import type { Nodes, Root, RootContent } from 'mdast'
import type { CompileOptions, PlatformProfile, SlideCard } from '../../types'
import { renderTexToSvg } from '../../formula/mathjax'
import { paginateSlide } from './render'

interface Topic { title: string; texts: string[]; line: number; table?: string[][]; formula?: string }
const plain = (node: Nodes): string => {
  if (['image', 'imageReference', 'html', 'footnoteReference'].includes(node.type)) return ''
  if ('children' in node) return node.children.map(child => plain(child as Nodes)).join(node.type === 'list' ? '\n' : '')
  return 'value' in node ? String(node.value) : ''
}
const sentences = (texts: string[]) => texts.flatMap(text => text.split(/(?<=[。！？!?；;])|\n/)).map(text => text.trim()).filter(text => Array.from(text).length >= 6 && Array.from(text).length <= 90 && !/[：:]$/.test(text))

/** Extract whole short statements; select meaningful topics, never pad a page quota. */
export async function buildCoreDeck(root: Root, platform: PlatformProfile, lineMap?: number[], passport?: CompileOptions['passport']) {
  let title = passport?.title || '未命名文章'
  let current: Topic | undefined
  const topics: Topic[] = []
  const topic = (line: number) => {
    if (!current) { current = { title, texts: [], line }; topics.push(current) }
    return current
  }
  const inspect = (node: Nodes, group: Topic) => {
    if (node.type === 'inlineMath' && !group.formula) group.formula = node.value
    if ('children' in node) node.children.forEach(child => inspect(child as Nodes, group))
  }
  for (const node of root.children as RootContent[]) {
    const line = lineMap?.[(node.position?.start.line ?? 1) - 1] ?? node.position?.start.line ?? 1
    if (node.type === 'heading') {
      if (node.depth === 1 && !current) { title = passport?.title || plain(node); continue }
      if (node.depth <= 2) { current = { title: plain(node), texts: [], line }; topics.push(current) }
      continue
    }
    if (node.type === 'paragraph' || node.type === 'blockquote' || node.type === 'list') {
      const group = topic(line)
      group.texts.push(plain(node)); inspect(node, group)
    }
    if (node.type === 'table') topic(line).table = node.children.map(row => row.children.map(cell => plain(cell)))
    if (node.type === 'math') topic(line).formula = node.value
  }
  const meaningful = topics.map((group, index) => ({ ...group, index, points: [...new Set(sentences(group.texts))] }))
    .filter(group => group.points.length || group.table || group.formula)
  const priority = (heading: string) => /等级\s*[1-9]|阶段\s*[1-9]|步骤\s*[1-9]/.test(heading) ? 50 : /启示|清单|实践|方法|建议|结论|总结|结语/.test(heading) ? 20 : 0
  const selected = [...meaningful].sort((a, b) => priority(b.title) - priority(a.title) || a.index - b.index)
    .slice(0, meaningful.length > 3 ? 7 : 3).sort((a, b) => a.index - b.index)
  const tags = passport?.tags ?? ['知识分享', '创作笔记']
  const pages: Array<Omit<SlideCard, 'index' | 'total'>> = []
  if (selected.length > 3) pages.push({ kind: 'cover', title, subtitle: undefined, bullets: selected.slice(0, 3).map(group => group.title), kicker: '核心图集', sourceLine: 1, tags })
  for (const group of selected) {
    const score = (text: string) => Array.from(group.title).filter(char => /[\u4e00-\u9fff]/.test(char) && text.includes(char)).length + (/建议|关键|核心|需要|因此|应该|意味着/.test(text) ? 3 : 0)
    const ranked = group.points.map((text, index) => ({ text, index, score: score(text) })).sort((a, b) => b.score - a.score || a.index - b.index).slice(0, 2).sort((a, b) => a.index - b.index)
    const page: Omit<SlideCard, 'index' | 'total'> = { kind: 'section', title: group.title, bullets: ranked.map(point => point.text), kicker: '核心图集', sourceLine: group.line, tags, layout: /对比|差异|区别/.test(group.title) ? 'comparison' : /步骤|清单|方法/.test(group.title) ? 'steps' : 'points' }
    if (group.formula) { const result = await renderTexToSvg(group.formula, true); if (result.svg) page.formulaSvg = result.svg }
    if (group.table && group.table.length <= 3 && group.table.every(row => row.length <= 4 && row.every(cell => Array.from(cell).length <= 24))) page.tableRows = group.table
    if (paginateSlide(page).length > 1) page.bullets = page.bullets.slice(0, 1)
    if (paginateSlide(page).length > 1) { page.tableRows = undefined; page.formulaSvg = undefined }
    if (!page.bullets.length && !page.image && !page.formulaSvg && !page.tableRows) continue
    pages.push(page)
  }
  if (!pages.length) pages.push({ kind: 'section', title, bullets: [], subtitle: '添加一些内容，开始制作图集。', kicker: '核心图集', sourceLine: 1, tags })
  const slides = pages.map((page, index) => ({ ...page, index: index + 1, total: pages.length }))
  const publishTitle = passport?.shortTitle20 ?? title
  const sections = slides.filter(slide => slide.kind !== 'cover').map(slide => [slide.title !== title ? slide.title : '', ...slide.bullets.slice(0, 1)].filter(Boolean).join('\n')).filter(Boolean)
  const hashtags = tags.map(tag => `#${tag}`).join(' ')
  const paragraphs = [publishTitle]
  for (const section of sections) {
    if (Array.from([...paragraphs, section, hashtags].join('\n\n')).length <= platform.summary.max) paragraphs.push(section)
  }
  const caption = [...paragraphs, hashtags].filter(Boolean).join('\n\n')
  return { slides, caption }
}
