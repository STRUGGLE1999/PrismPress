import { compressImageToDataUrl } from '@/core/images/local'
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
export async function prepareDouyinImageSources(sources: Record<string, string>, urls: string[]): Promise<Record<string, string>> {
  const prepared = { ...sources }
  for (const url of new Set(urls)) {
    const resolved = prepared[url] ?? url
    if (!/^(?:https:\/\/|data:image\/)/i.test(resolved)) continue
    let dataUrl = inlineRemote.get(resolved)
    if (!dataUrl) {
      const response = await fetch(resolved.startsWith('data:') ? resolved : `/api/image?url=${encodeURIComponent(resolved)}`, { signal: AbortSignal.timeout(60000) })
      if (!response.ok) throw new Error('有一张配图未能读取，请重试准备正文')
      const blob = await response.blob()
      const image = await compressImageToDataUrl(new File([blob], 'article-image', { type: blob.type }), { minWidth: 100, minHeight: 100 })
      dataUrl = image.dataUrl
      inlineRemote.set(resolved, dataUrl)
    }
    prepared[url] = dataUrl
  }
  return prepared
}
