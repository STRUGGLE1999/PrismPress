import { visit } from 'unist-util-visit'
import { parseMarkdown, replaceImageReference } from '@/core'
import type { LocalImageAsset } from './localImage'

export function materializeImages(markdown: string, assets: Record<string, LocalImageAsset>): string {
  const names = Object.keys(assets)
  return Object.values(assets).reduce((text, asset) => replaceImageReference(text, asset.name,
    asset.mode === 'remote' && asset.remoteUrl ? asset.remoteUrl : asset.dataUrl,
    names.filter((name) => name.split('/').pop() === asset.name.split('/').pop()).length === 1), markdown)
}

/** Recover older drafts that stored picture bytes directly in the source. */
export function detachInlineImages(markdown: string) {
  const assets: Record<string, LocalImageAsset> = {}
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
