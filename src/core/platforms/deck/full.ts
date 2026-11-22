import { visit } from 'unist-util-visit'
import type { Nodes, Root } from 'mdast'
import type { CompileOptions, SlideCard } from '../../types'
import { renderTexToSvg } from '../../formula/mathjax'
import { paginateSlide } from './render'

type Page = Omit<SlideCard, 'index' | 'total'>

export function htmlPictures(html: string) {
  return [...html.matchAll(/<img\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi)].flatMap(match => {
    const attributes = new Map([...match[0].matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)].map(attr => [attr[1].toLowerCase(), attr[2] ?? attr[3] ?? attr[4]]))
    const src = attributes.get('src')
    return src ? [{ src: src.replace(/&amp;/g, '&'), alt: attributes.get('alt') ?? '', text: match[0] }] : []
  })
}

export async function buildFullDeck(root: Root, lineMap?: number[], passport?: CompileOptions['passport']) {
  const first = root.children.find(node => node.type === 'heading' && node.depth === 1)
  const definitions = new Map(root.children.filter(node => node.type === 'definition').map(node => [node.identifier, node.url]))
  const readable = (node: Nodes): string => {
    if (node.type === 'image' || node.type === 'imageReference') return ''
    if (node.type === 'inlineMath') return `$${node.value}$`
    if (node.type === 'footnoteReference') return `[${node.identifier}]`
    const value = 'children' in node ? node.children.map(child => readable(child as Nodes)).join('') : 'value' in node ? String(node.value) : ''
    if (!value) return ''
    if (node.type === 'link') return `${value}（${node.url}）`
    if (node.type === 'linkReference') return `${value}（${definitions.get(node.identifier) ?? node.identifier}）`
    return value
  }
  const title = passport?.title ?? (first ? readable(first) : '未命名文章')
  const tags = passport?.tags ?? []
  const raw: Page[] = []
  let heading = title
  let sourceLine = 1
  let pendingHeading = false
  const empty = (): Page => ({ kind: 'section', title: heading, bullets: [], kicker: '原文分页', sourceLine, tags, layout: /对比|差异|区别|\bvs\b/i.test(heading) ? 'comparison' : 'points' })
  let page = empty()
  const hasContent = () => Boolean(page.bullets.length || page.tableRows || page.formulaSvg || page.highlight || page.quote || page.image)
  const flush = (keepHeading = false) => {
    if (hasContent() || (keepHeading && pendingHeading)) raw.push(...paginateSlide(page))
    page = empty(); pendingHeading = false
  }
  const addText = (value: string, quote = false) => {
    const text = value.trim()
    if (!text) return
    if (quote) { flush(); page.quote = text; flush(); return }
    if (page.tableRows || page.formulaSvg || page.highlight || page.quote || page.image) flush()
    page.bullets.push(text)
  }
  const picture = (src: string, alt: string) => { flush(); page.image = { src, alt }; page.layout = 'image'; flush() }
  const paragraph = async (node: Nodes & { children: Nodes[] }, prefix: string, quote: boolean) => {
    let text = prefix
    const emit = () => { addText(text, quote); text = '' }
    const inline = async (child: Nodes): Promise<void> => {
      if (child.type === 'image' || child.type === 'imageReference') {
        emit()
        picture(child.type === 'image' ? child.url : definitions.get(child.identifier) ?? child.identifier, child.alt ?? '')
      } else if (child.type === 'inlineMath') {
        emit()
        if (page.formulaSvg) flush()
        const result = await renderTexToSvg(child.value, false)
        if (result.svg) page.formulaSvg = result.svg
        else page.highlight = child.value
      } else if ('children' in child) {
        for (const part of child.children) await inline(part as Nodes)
        if (child.type === 'link' && readable(child)) text += `（${child.url}）`
        if (child.type === 'linkReference' && readable(child)) text += `（${definitions.get(child.identifier) ?? child.identifier}）`
      } else if (child.type === 'html') {
        const images = htmlPictures(child.value)
        if (images.length) { emit(); images.forEach(image => picture(image.src, image.alt)) }
        else text += child.value.replace(/<br\s*\/?\s*>/gi, '\n').replace(/<[^>]+>/g, '')
      }
      else text += readable(child)
    }
    for (const child of node.children) await inline(child)
    emit()
  }
  const walk = async (node: Nodes, prefix = '', quote = false, depth = 0): Promise<void> => {
    sourceLine = lineMap?.[(node.position?.start.line ?? 1) - 1] ?? node.position?.start.line ?? 1
    if (!hasContent()) page.sourceLine = sourceLine
    if (node.type === 'definition') return
    if (node === first) {
      visit(node, child => {
        if (child.type === 'image') picture(child.url, child.alt ?? '')
        if (child.type === 'imageReference') picture(definitions.get(child.identifier) ?? child.identifier, child.alt ?? '')
        if (child.type === 'html') htmlPictures(child.value).forEach(image => picture(image.src, image.alt))
      })
      return
    }
    switch (node.type) {
      case 'heading':
        if (node.depth > 2) addText(`【${readable(node)}】`)
        else { flush(true); heading = readable(node); page = empty(); pendingHeading = true }
        visit(node, child => {
          if (child.type === 'image') picture(child.url, child.alt ?? '')
          if (child.type === 'imageReference') picture(definitions.get(child.identifier) ?? child.identifier, child.alt ?? '')
          if (child.type === 'html') htmlPictures(child.value).forEach(image => picture(image.src, image.alt))
        })
        return
      case 'paragraph': await paragraph(node as Nodes & { children: Nodes[] }, prefix, quote); return
      case 'list':
        for (const [index, item] of node.children.entries()) {
          const marker = `${'　'.repeat(depth)}${node.ordered ? `${(node.start ?? 1) + index}. ` : item.checked === true ? '☑ ' : item.checked === false ? '☐ ' : '• '}`
          for (const [n, child] of item.children.entries()) await walk(child as Nodes, n === 0 ? marker : '', quote, depth + 1)
        }
        page.layout = 'steps'; return
      case 'blockquote':
        for (const child of node.children) await walk(child as Nodes, '', true, depth)
        return
      case 'table': {
        let hasPictures = false
        visit(node, child => { if (child.type === 'image' || child.type === 'imageReference' || (child.type === 'html' && htmlPictures(child.value).length)) hasPictures = true })
        if (hasPictures) {
          flush()
          for (const [r, row] of node.children.entries()) for (const [c, cell] of row.children.entries()) {
            addText(`【表格第 ${r + 1} 行、第 ${c + 1} 列】`)
            await paragraph(cell as Nodes & { children: Nodes[] }, '', false)
          }
          flush(); return
        }
        if (page.tableRows || page.formulaSvg || page.quote || page.highlight) flush()
        page.tableRows = node.children.map(row => row.children.map(cell => readable(cell)))
        return
      }
      case 'math': {
        if (page.formulaSvg || page.highlight || page.quote) flush()
        const result = await renderTexToSvg(node.value, true)
        if (result.svg) page.formulaSvg = result.svg
        else page.highlight = node.value
        return
      }
      case 'code': flush(); page.highlight = node.value; flush(); return
      case 'html': {
        const html = node.value.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
        let rest = html
        for (const image of htmlPictures(html)) {
          const offset = rest.indexOf(image.text)
          addText(rest.slice(0, offset).replace(/<[^>]*>/g, ' ').trim(), quote)
          picture(image.src, image.alt)
          rest = rest.slice(offset + image.text.length)
        }
        addText(rest.replace(/<[^>]*>/g, ' ').trim(), quote)
        return
      }
      case 'footnoteDefinition':
        addText(`[${node.identifier}]`)
        for (const child of node.children) await walk(child as Nodes)
        return
      default: return
    }
  }
  for (const node of root.children) await walk(node as Nodes)
  flush(true)
  const pages: Page[] = [
    { kind: 'cover', title, subtitle: '原文分页 · 正文与配图按顺序阅读', bullets: [], kicker: '文章图集', sourceLine: 1, tags }, ...raw,
  ]
  return pages.map((slide, index) => ({ ...slide, index: index + 1, total: pages.length }))
}
