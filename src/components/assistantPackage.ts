import { rewriteImageUrls } from '@/core/images/local'
import type { CompileResult } from '@/core'

/** Local prototype handoff; image bytes travel with the article, never account credentials. */
export async function buildAssistantPackage(result: CompileResult, title: string) {
  if (!['xiaohongshu', 'douyin', 'zhihu', 'csdn', 'juejin', 'bilibili'].includes(result.platform.id) || result.format === 'deck') throw new Error('该平台暂未接入发布助手')
  if (result.platform.id === 'bilibili' && /[\u{10000}-\u{10ffff}]/u.test(title + result.body)) throw new Error('此稿含B站草稿可能替换为问号的字符（如表情），请先调整这些字符再发送')
  if (result.platform.id === 'csdn' && /[\u{10000}-\u{10ffff}]/u.test(title)) throw new Error('CSDN草稿标题会替换部分表情等字符，请先调整标题再发送；正文可保留')
  const limit = result.platform.id === 'douyin' ? 30 : result.platform.id === 'xiaohongshu' ? 64 : 100
  if (!title.trim() || Array.from(title).length > limit) throw new Error(`请将文章标题调整为1–${limit}字`)
  const document = new DOMParser().parseFromString(result.format === 'html' ? result.body : result.previewHtml ?? '', 'text/html')
  if (document.body.querySelector('svg, math, video, audio, iframe')) throw new Error('助手原型暂不支持公式或音视频，请使用现有复制方式')
  const parts: ({ kind: 'html'; html: string } | { kind: 'image'; data: string })[] = []
  const images = [...document.body.querySelectorAll('img')]
  if (images.length > 100) throw new Error('助手原型暂支持最多100张图片')
  const range = document.createRange()
  range.setStart(document.body, 0)
  const appendHtml = () => {
    const holder = document.createElement('div')
    holder.append(range.cloneContents())
    if (holder.textContent?.trim() || holder.querySelector('hr')) parts.push({ kind: 'html', html: holder.innerHTML })
  }
  for (const image of images) {
    range.setEndBefore(image)
    appendHtml()
    const src = image.getAttribute('src') ?? ''
    let response: Response | undefined
    try { response = await fetch(src, { signal: AbortSignal.timeout(20000) }) }
    catch (error) { if (!/^https:\/\//i.test(src)) throw error }
    if ((!response || !response.ok) && /^https:\/\//i.test(src)) response = await fetch(`/api/image?url=${encodeURIComponent(src)}`, { signal: AbortSignal.timeout(60000) })
    if (!response?.ok) throw new Error(`第${parts.filter(part => part.kind === 'image').length + 1}张图片读取失败，未导出交接文件`)
    const blob = await response.blob()
    if (!/^image\/(png|jpeg|webp|gif)$/.test(blob.type) || blob.size > 4 * 1024 * 1024) throw new Error('图片需为PNG、JPEG、WebP或GIF，且每张不超过4MB')
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(new Error('读取图片失败'))
      reader.readAsDataURL(blob)
    })
    parts.push({ kind: 'image', data })
    range.setStartAfter(image)
  }
  range.setEnd(document.body, document.body.childNodes.length)
  appendHtml()
  if (!parts.some(part => part.kind === 'html')) throw new Error('请添加正文后再导出交接文件')
  let markdown: string | undefined
  if (result.platform.id === 'juejin') {
    if (/PRISMPRESS_IMAGE_\d+_END/.test(result.body)) throw new Error('正文含保留的图片标记，请修改后重试')
    let index = 0
    markdown = rewriteImageUrls(result.body.replace(/^# [^\n]+\n+/, ''), () => `PRISMPRESS_IMAGE_${index++}_END`)
    if (index !== images.length) throw new Error('Markdown图片引用无法完整对应，请使用内联图片语法后重试')
  }
  const json = JSON.stringify({ ...(markdown ? { markdown } : {}), version: 1, platform: result.platform.id, title, parts })
  if (new Blob([json]).size > 48 * 1024 * 1024) throw new Error('交接文件超过48MB，原型暂不支持')
  return json
}
