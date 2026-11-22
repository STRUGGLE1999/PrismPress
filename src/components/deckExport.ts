import { strToU8, zipSync } from 'fflate'
import type { SlideCard } from '@/core'
import type { VisualStyleId } from '../../shared/visual-design.mjs'
import { renderSlideSvg } from '@/core/platforms/deck/render'

const pictures = new Map<string, Promise<string>>()
const completed = new Map<string, string>()
async function embeddedImage(src: string) {
  const ready = completed.get(src)
  if (ready) { completed.delete(src); completed.set(src, ready); return ready }
  const cached = pictures.get(src)
  if (cached) return cached
  const task = (async () => {
    let response: Response | undefined
    try { response = await fetch(src, { signal: AbortSignal.timeout(20000) }) }
    catch (error) { if (!/^https:\/\//i.test(src)) throw error }
    if ((!response || !response.ok) && /^https:\/\//i.test(src)) response = await fetch(`/api/image?url=${encodeURIComponent(src)}`, { signal: AbortSignal.timeout(60000) })
    if (!response?.ok) throw new Error('配图地址不可访问')
    const bitmap = await createImageBitmap(await response.blob())
    const canvas = document.createElement('canvas')
    const scale = Math.min(1, 1080 / bitmap.width, 1440 / bitmap.height)
    canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) { bitmap.close(); throw new Error('浏览器不支持图片处理') }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close()
    return canvas.toDataURL('image/png')
  })()
  pictures.set(src, task)
  void task.then(value => {
    completed.set(src, value)
    while (completed.size > 12) completed.delete(completed.keys().next().value!)
  }, () => {}).finally(() => pictures.delete(src))
  return task
}

export async function prepareSlideSvg(slide: SlideCard, style: VisualStyleId, platform: string) {
  const ready = slide.image ? { ...slide, image: { ...slide.image, src: await embeddedImage(slide.image.src) } } : slide
  return renderSlideSvg(ready, style, platform)
}

export async function svgPng(svg: string): Promise<Blob> {
  await document.fonts.ready
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  try {
    const image = new Image(); image.src = url; await image.decode()
    const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 1440
    const context = canvas.getContext('2d')
    if (!context) throw new Error('浏览器不支持图片导出')
    context.drawImage(image, 0, 0)
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG 导出失败')), 'image/png'))
  } finally { URL.revokeObjectURL(url) }
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function deckZip(slides: SlideCard[], style: VisualStyleId, platform: string, caption: string, progress: (done: number) => void) {
  const files: Record<string, Uint8Array> = { '配套文案.txt': strToU8(caption) }
  for (const slide of slides) {
    const blob = await svgPng(await prepareSlideSvg(slide, style, platform))
    files[`${String(slide.index).padStart(3, '0')}.png`] = new Uint8Array(await blob.arrayBuffer())
    progress(slide.index)
  }
  files['阅读说明.txt'] = strToU8('图片按文件名顺序排列，配套文案可用于发布说明。请在目标平台检查后发布。')
  return new Blob([zipSync(files, { level: 0 }) as Uint8Array<ArrayBuffer>], { type: 'application/zip' })
}
