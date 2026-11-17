import { visit } from 'unist-util-visit'
import { parseMarkdown } from '../markdown/document'

export interface CompressedImage {
  dataUrl: string
  width: number
  height: number
  bytes: number
  mime: string
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('读取图片失败'))
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('图片解码失败'))
    image.src = src
  })
}

/**
 * 前端免配置图片内联：FileReader + Canvas 等比压缩。
 * 图片数据由工作区单独管理，生成预览和剪贴板内容时再关联。
 */
export async function compressImageToDataUrl(
  file: File,
  options: { maxWidth?: number; maxHeight?: number; quality?: number } = {},
): Promise<CompressedImage> {
  const maxWidth = options.maxWidth ?? 1400
  const maxHeight = options.maxHeight ?? 2600
  const quality = options.quality ?? 0.84
  const original = await readAsDataUrl(file)
  const image = await loadImage(original)
  const scale = Math.min(1, maxWidth / Math.max(1, image.naturalWidth), maxHeight / Math.max(1, image.naturalHeight))
  const width = Math.max(1, Math.round(image.naturalWidth * scale))
  const height = Math.max(1, Math.round(image.naturalHeight * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('当前浏览器不支持 Canvas')

  const keepPng = file.type === 'image/png' && file.size < 1_200_000
  if (!keepPng) {
    context.fillStyle = '#FFFFFF'
    context.fillRect(0, 0, width, height)
  }
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, 0, 0, width, height)

  const mime = keepPng ? 'image/png' : 'image/jpeg'
  const dataUrl = canvas.toDataURL(mime, keepPng ? undefined : quality)
  return {
    dataUrl,
    width,
    height,
    bytes: Math.round((dataUrl.length * 3) / 4),
    mime,
  }
}

function normalizedPath(path: string): string {
  try { path = decodeURIComponent(path) } catch { /* Keep malformed escapes unchanged. */ }
  return path.replace(/\\/g, '/').replace(/^file:\/\//i, '').replace(/^(?:\.\/)+/, '')
}

/** Replace actual image nodes, preserving code examples and unrelated remote URLs. */
export function replaceImageReference(markdown: string, fileName: string, nextUrl: string, allowBaseName = true): string {
  const target = normalizedPath(fileName)
  const matches = (source: string) => {
    if (/^(?:https?:|data:|blob:|\/\/)/i.test(source)) return false
    const path = normalizedPath(source)
    if (path === target || (path.includes('/') && (path.endsWith(`/${target}`) || target.endsWith(`/${path}`)))) return true
    return allowBaseName && path.split('/').pop() === target.split('/').pop()
  }
  return rewriteImageUrls(markdown, (source) => matches(source) ? nextUrl : undefined)
}

/** Parse short source once; never feed newly embedded image bytes back to the parser. */
export function rewriteImageUrls(markdown: string, resolve: (source: string) => string | undefined): string {
  const edits: { start: number; end: number; text: string }[] = []
  visit(parseMarkdown(markdown), (node) => {
    const start = node.position?.start.offset
    const end = node.position?.end.offset
    if (start === undefined || end === undefined) return
    if (node.type === 'image') {
      const nextUrl = resolve(node.url)
      if (!nextUrl) return
      const alt = (node.alt ?? '').replace(/[\\[\]]/g, '\\$&')
      const title = node.title ? ` "${node.title.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : ''
      edits.push({ start, end, text: `![${alt}](${nextUrl}${title})` })
    } else if (node.type === 'html') {
      const text = node.value.replace(/(<img\b[^>]*\bsrc\s*=\s*["'])([^"']+)(["'])/gi,
        (whole, prefix: string, src: string, suffix: string) => { const nextUrl = resolve(src); return nextUrl ? `${prefix}${nextUrl}${suffix}` : whole })
      if (text !== node.value) edits.push({ start, end, text })
    }
  })
  return edits.sort((a, b) => b.start - a.start).reduce((text, edit) => text.slice(0, edit.start) + edit.text + text.slice(edit.end), markdown)
}
