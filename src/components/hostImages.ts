import { compressImageToDataUrl } from '@/core/images/local'
import { waitForTask } from '@/core/waitForTask'
const hosted = new Map<string, string>()

/** Upload only the referenced local bytes; keep originals for editing and recovery. */
export async function hostImageSources(sources: Record<string, string>): Promise<Record<string, string>> {
  const local = [...new Set(Object.values(sources).filter(value => value.startsWith('data:image/')))]
  if (!local.length) return sources
  for (const dataUrl of local) {
    if (hosted.has(dataUrl)) continue
    const response = await fetch('/api/upload-image', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataUrl }), signal: AbortSignal.timeout(60000),
    }).catch(() => { throw new Error('图片托管请求失败，原图已保留，请稍后重试') })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error || '图片托管失败，未复制内容')
    }
    const url = new URL(data.url)
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.public.blob.vercel-storage.com')) throw new Error('图片托管返回的地址无效')
    hosted.set(dataUrl, url.href)
  }
  return Object.fromEntries(Object.entries(sources).map(([key, value]) => [key, hosted.get(value) ?? value]))
}

const inlineRemote = new Map<string, string>()

/** Give editors image bytes so they do not need to fetch third-party image hosts. */
export async function prepareInlineImageSources(sources: Record<string, string>, urls: string[], options: { minDimension?: number; signal?: AbortSignal; onProgress?: (done: number, total: number) => void } = {}): Promise<Record<string, string>> {
  const prepared = { ...sources }
  const unique = [...new Set(urls)]
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new DOMException('timeout', 'TimeoutError')), 90000)
  const signal = options.signal ? AbortSignal.any([controller.signal, options.signal]) : controller.signal
  let done = 0
  options.onProgress?.(0, unique.length)
  const prepare = async (url: string) => {
    signal.throwIfAborted()
    const resolved = prepared[url] ?? url
    if (!/^(?:https:\/\/|data:image\/)/i.test(resolved)) throw new Error('有配图尚未导入，请先补齐配图')
    const minDimension = options.minDimension ?? 100
    const cacheKey = `${minDimension}:${resolved}`
    let dataUrl = inlineRemote.get(cacheKey)
    if (!dataUrl) {
      const imageSignal = AbortSignal.any([signal, AbortSignal.timeout(30000)])
      const response = await fetch(resolved.startsWith('data:') ? resolved : `/api/image?url=${encodeURIComponent(resolved)}`, { signal: imageSignal })
      if (!response.ok) throw new Error('有一张配图未能读取，请重试准备正文')
      const blob = await waitForTask(response.blob(), imageSignal, '配图读取超时，请重试')
      const image = await waitForTask(compressImageToDataUrl(new File([blob], 'article-image', { type: blob.type }), { minWidth: minDimension, minHeight: minDimension }), imageSignal, '配图处理超时，请重试')
      signal.throwIfAborted()
      dataUrl = image.dataUrl
      inlineRemote.set(cacheKey, dataUrl)
    }
    prepared[url] = dataUrl
    options.onProgress?.(++done, unique.length)
  }
  try {
    for (let start = 0; start < unique.length; start += 3) {
      await waitForTask(Promise.all(unique.slice(start, start + 3).map(prepare)), signal, '配图准备超时，已保留原稿与图片，请重试')
    }
    return prepared
  } catch (error) {
    controller.abort(error)
    throw error
  } finally {
    clearTimeout(timer)
  }
}
