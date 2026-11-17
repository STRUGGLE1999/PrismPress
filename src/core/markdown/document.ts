import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import { visit } from 'unist-util-visit'
import { toString } from 'mdast-util-to-string'
import type { Image, Link, Root } from 'mdast'
import type { DocStats } from '../types'

export const markdownProcessor = unified().use(remarkParse).use(remarkGfm).use(remarkMath)

export interface RawImage {
  url: string
  alt: string
  line: number
}

export interface RawLink {
  url: string
  text: string
  line: number
}

export interface ParsedDocument {
  root: Root
  stats: DocStats
  plainText: string
  title: string | null
  images: RawImage[]
  links: RawLink[]
  /** 各标题的层级，用于判断是否需要降维 */
  headingDepths: number[]
}

export function parseMarkdown(markdown: string): Root {
  return markdownProcessor.parse(markdown)
}

export function countReadingStats(text: string): DocStats {
  const characters = Array.from(text.replace(/\s/g, '')).length
  const cjk = (text.match(/[\u3400-\u9fff\uf900-\ufaff]/g) ?? []).length
  const latinWords = (text.match(/[A-Za-z0-9_]+(?:['’-][A-Za-z0-9_]+)*/g) ?? []).length
  const words = cjk + latinWords
  return {
    characters,
    words,
    readingMinutes: words === 0 ? 0 : Math.max(1, Math.ceil(words / 400)),
    headings: 0,
    paragraphs: 0,
    codeBlocks: 0,
    formulas: 0,
    tables: 0,
    images: 0,
    links: 0,
  }
}

/** 解析 Markdown 并一次性产出 AST、统计、纯文本、图片与链接清单 */
export function analyzeMarkdown(markdown: string): ParsedDocument {
  const root = parseMarkdown(markdown)
  const plainText = toString(root).replace(/\n{3,}/g, '\n\n').trim()
  const stats = countReadingStats(plainText)
  const images: RawImage[] = []
  const links: RawLink[] = []
  const headingDepths: number[] = []
  let title: string | null = null

  visit(root, (node) => {
    switch (node.type) {
      case 'heading':
        stats.headings += 1
        headingDepths.push(node.depth)
        if (node.depth === 1 && !title) title = toString(node).trim()
        break
      case 'paragraph':
        stats.paragraphs += 1
        break
      case 'code':
        stats.codeBlocks += 1
        break
      case 'math':
      case 'inlineMath':
        stats.formulas += 1
        break
      case 'table':
        stats.tables += 1
        break
      case 'image': {
        const image = node as Image
        stats.images += 1
        images.push({
          url: image.url,
          alt: image.alt ?? '',
          line: image.position?.start.line ?? 1,
        })
        break
      }
      case 'link': {
        const link = node as Link
        stats.links += 1
        links.push({
          url: link.url,
          text: toString(link).trim(),
          line: link.position?.start.line ?? 1,
        })
        break
      }
      default:
        break
    }
  })

  return { root, stats, plainText, title, images, links, headingDepths }
}
