export async function fillJuejinDraft(article) {
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
  const normalize = text => text.replace(/[\s\u200b\ufeff]/g, '')
  if (location.origin !== 'https://juejin.cn' || article.platform !== 'juejin' || !article.markdown) return { ok: false, message: '请打开掘金空白Markdown文章' }
  let title
  let input
  let preview
  for (let attempt = 0; attempt < 90; attempt++) {
    title = document.querySelector('input[placeholder="输入文章标题..."]')
    input = document.querySelector('.CodeMirror textarea')
    preview = document.querySelector('.bytemd-preview .markdown-body')
    if (title && input && preview) break
    await pause(1000)
  }
  if (!title || !input || !preview) return { ok: false, message: '请先登录掘金并打开Markdown编辑器' }
  if (title.value.trim() || normalize(preview.textContent) || preview.querySelector('img')) return { ok: false, message: '当前稿件已有内容，助手未修改，请新建空白文章' }
  const paste = transfer => {
    input.focus()
    input.dispatchEvent(new ClipboardEvent('paste', { clipboardData: transfer, bubbles: true, cancelable: true }))
  }
  const sources = []
  const deadline = Date.now() + 180000
  try {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(title, article.title)
    title.dispatchEvent(new Event('input', { bubbles: true }))
    for (const part of article.parts.filter(part => part.kind === 'image')) {
      const match = part.data.match(/^data:(image\/\w+);base64,(.+)$/)
      const transfer = new DataTransfer()
      transfer.items.add(new File([Uint8Array.from(atob(match[2]), char => char.charCodeAt(0))], `prismpress-${sources.length + 1}.${match[1].split('/')[1]}`, { type: match[1] }))
      const before = preview.querySelectorAll('img').length
      paste(transfer)
      let src
      for (let attempt = 0; attempt < 100; attempt++) {
        if (Date.now() > deadline) throw new Error('交付超时，请检查当前稿件')
        await pause(500)
        const images = [...preview.querySelectorAll('img')]
        if (images.length > before + 1) throw new Error('图片重复，已停止')
        if (images.length === before + 1 && images.at(-1).complete && images.at(-1).naturalWidth > 0 && /^https:\/\//.test(images.at(-1).src)) { src = images.at(-1).src; break }
      }
      if (!src) throw new Error('掘金未接收图片')
      sources.push(src)
    }
    let markdown = article.markdown
    for (let index = 0; index < sources.length; index++) markdown = markdown.replaceAll(`PRISMPRESS_IMAGE_${index}_END`, sources[index])
    input.focus()
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA', keyCode: 65, which: 65, metaKey: /Mac/.test(navigator.platform), ctrlKey: !/Mac/.test(navigator.platform), bubbles: true, cancelable: true }))
    const transfer = new DataTransfer(); transfer.setData('text/plain', markdown); paste(transfer)
    await pause(1500)
    const sequence = node => node.nodeType === 3 ? node.textContent : node.nodeType === 1 && node.tagName === 'IMG' ? '[PRISMPRESS_IMAGE]' : [...node.childNodes].map(sequence).join('')
    let expected = ''
    for (const part of article.parts) expected += part.kind === 'image' ? '[PRISMPRESS_IMAGE]' : normalize(new DOMParser().parseFromString(part.html, 'text/html').body.textContent)
    const images = [...preview.querySelectorAll('img')]
    if (title.value !== article.title || normalize(sequence(preview)) !== expected || images.length !== sources.length || !images.every(image => image.complete && image.naturalWidth > 0)) throw new Error('标题、正文或图片位置校验未通过')
    return { ok: true, images: images.length, message: `已填入，待确认保存：文字和 ${images.length} 张图片。请到草稿箱重开检查后再发布。` }
  } catch (error) { return { ok: false, message: `已停止，当前页面内容保留。${error.message}；请检查，勿重复发送。` } }
}
