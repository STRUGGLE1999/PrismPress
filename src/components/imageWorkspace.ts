import { visit } from 'unist-util-visit'
import { analyzeMarkdown, scanImages, parseMarkdown } from '@/core'
import type { LocalImageAsset } from './localImage'

/** Match filenames before reading or decoding any picture bytes. Ambiguities stay unresolved. */
export function imageSourceNames(markdown: string, names: string[]): Record<string, string> {
  const normalize = (path: string) => {
    try { path = decodeURIComponent(path) } catch { /* Preserve invalid escapes. */ }
    return path.replace(/\\/g, '/').replace(/^file:\/\//i, '').replace(/^(?:\.\/)+/, '')
  }
  const paths = names.map((name) => ({ name, path: normalize(name) }))
  const selected: Record<string, string> = {}
  const references = scanImages(analyzeMarkdown(markdown).images, markdown).findings
  for (const reference of references) {
    if (/^(?:https?:|data:|blob:|\/\/)/i.test(reference.url)) continue
    const path = normalize(reference.url)
    const exact = paths.filter((item) => item.path === path || (path.includes('/') && (item.path.endsWith(`/${path}`) || path.endsWith(`/${item.path}`))))
    const matches = exact.length ? exact : paths.filter((item) => item.path.split('/').pop() === path.split('/').pop())
    if (matches.length === 1) selected[reference.url] = matches[0].name
  }
  return selected
}

export function referencedImageNames(markdown: string, names: string[]): Set<string> {
  return new Set(Object.values(imageSourceNames(markdown, names)))
}

export function imageSources(markdown: string, assets: Record<string, LocalImageAsset>): Record<string, string> {
  return Object.fromEntries(Object.entries(imageSourceNames(markdown, Object.keys(assets))).map(([source, name]) => {
    const asset = assets[name]
    return [source, asset.mode === 'remote' && asset.remoteUrl ? asset.remoteUrl : asset.dataUrl]
  }))
}

/** Recover older drafts that stored picture bytes directly in the source. */
export function detachInlineImages(markdown: string) {
  const assets: Record<string, LocalImageAsset> = {}
  if (!markdown.includes('data:image/')) return { markdown, assets }
  const edits: { start: number; end: number; text: string }[] = []
  let number = 0
  visit(parseMarkdown(markdown), 'image', (node) => {
    const match = /^data:(image\/[\w.+-]+);base64,([\s\S]+)$/i.exec(node.url)
    if (!match || node.position?.start.offset === undefined || node.position.end.offset === undefined) return
    try {
      const bytes = Uint8Array.from(atob(match[2]), (character) => character.charCodeAt(0))
      let name: string
      do { name = `images/导入图片-${++number}.${match[1] === 'image/jpeg' ? 'jpg' : match[1].slice(6)}` } while (markdown.includes(name))
      assets[name] = { name, file: new File([bytes], name.split('/').pop()!, { type: match[1] }), dataUrl: node.url, mime: match[1], bytes: bytes.length, mode: 'inline' }
      const raw = markdown.slice(node.position.start.offset, node.position.end.offset)
      edits.push({ start: node.position.start.offset, end: node.position.end.offset, text: raw.replace(node.url, name) })
    } catch { /* Keep an invalid image unchanged rather than discard its data. */ }
  })
  const source = edits.reverse().reduce((text, edit) => text.slice(0, edit.start) + edit.text + text.slice(edit.end), markdown)
  return { markdown: source, assets }
}

/** A compact change key; avoids persisting image bytes in every copy record. */
export function imageChangeKey(text: string): string {
  let first = 2166136261
  let second = 5381
  for (let index = 0; index < text.length; index++) {
    first = Math.imul(first ^ text.charCodeAt(index), 16777619)
    second = Math.imul(second, 33) ^ text.charCodeAt(index)
  }
  return `${text.length}:${first >>> 0}:${second >>> 0}`
}
