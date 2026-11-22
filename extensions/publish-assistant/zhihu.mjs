// Serialized by Chrome into the page; no imports can be referenced here.
export async function fillZhihuDraft(article) {
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
  const normalize = text => text.replace(/[\s\u200b\ufeff]/g, '')
  if (location.origin !== 'https://zhuanlan.zhihu.com' || article.platform !== 'zhihu') return { ok: false, message: '目标平台不匹配' }
  let editor
  let title
  let upload
  for (let attempt = 0; attempt < 90; attempt++) {
    editor = document.querySelector('.public-DraftEditor-content[contenteditable="true"]')
    title = document.querySelector('textarea[placeholder="请输入标题（最多 100 个字）"]')
    upload = document.querySelector('.PostEditor input[type="file"][accept^="image/"]')
    if (editor && title && upload) break
    await pause(1000)
  }
  if (!editor || !title || !upload) return { ok: false, message: '请先登录知乎并打开空白文章编辑器' }
  if (title.value.trim() || normalize(editor.textContent) || editor.querySelector('img')) return { ok: false, message: '当前文章已有内容，助手未修改，请新建空白文章' }
  const sequence = node => {
    if (node.nodeType === 3) return node.textContent
    if (node.nodeType === 1 && node.tagName === 'FIGURE' && node.querySelector('img')) return '[PRISMPRESS_IMAGE]'
    if (node.nodeType === 1 && node.tagName === 'IMG') return '[PRISMPRESS_IMAGE]'
    return [...node.childNodes].map(sequence).join('')
  }
  const deadline = Date.now() + 180000
  let expected = ''
  let count = 0
  try {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(title, article.title)
    title.dispatchEvent(new Event('input', { bubbles: true }))
    for (const part of article.parts) {
      if (Date.now() > deadline) throw new Error('填入超时')
      editor.focus()
      const range = document.createRange(); range.selectNodeContents(editor); range.collapse(false)
      const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range)
      document.dispatchEvent(new Event('selectionchange'))
      await pause(100)
      if (part.kind === 'html') {
        const block = new DOMParser().parseFromString(part.html, 'text/html').body
        const allowed = new Set(['P','DIV','SPAN','H1','H2','H3','H4','STRONG','B','EM','I','U','S','UL','OL','LI','BLOCKQUOTE','PRE','CODE','BR','HR'])
        for (const element of [...block.querySelectorAll('*')].reverse()) {
          if (['SCRIPT','STYLE','IFRAME','OBJECT','SVG','MATH','FORM','INPUT','IMG'].includes(element.tagName)) { element.remove(); continue }
          if (!allowed.has(element.tagName)) { element.replaceWith(...element.childNodes); continue }
          for (const attr of [...element.attributes]) element.removeAttribute(attr.name)
        }
        expected += normalize(block.textContent)
        const transfer = new DataTransfer(); transfer.setData('text/html', block.innerHTML); transfer.setData('text/plain', block.textContent)
        editor.dispatchEvent(new ClipboardEvent('paste', { clipboardData: transfer, bubbles: true, cancelable: true }))
        await pause(150)
      } else {
        const match = part.data.match(/^data:(image\/\w+);base64,(.+)$/)
        const transfer = new DataTransfer()
        transfer.items.add(new File([Uint8Array.from(atob(match[2]), char => char.charCodeAt(0))], `prismpress-${count + 1}.${match[1].split('/')[1]}`, { type: match[1] }))
        upload.files = transfer.files; upload.dispatchEvent(new Event('change', { bubbles: true }))
        let stable = 0
        let ready = false
        for (let attempt = 0; attempt < 120; attempt++) {
          if (Date.now() > deadline) throw new Error('图片上传超时')
          await pause(500)
          const images = [...editor.querySelectorAll('img')]
          if (images.length > count + 1) throw new Error('图片数量超出预期')
          if (editor.textContent.includes('图片导入失败')) throw new Error('平台未接收图片')
          const image = images.at(-1)
          if (image?.loading === 'lazy') image.loading = 'eager'
          stable = images.length === count + 1 && image.complete && image.naturalWidth > 0 && /^https:\/\//.test(image.src) ? stable + 1 : 0
          if (stable >= 2) { ready = true; break }
        }
        if (!ready) throw new Error('图片未完成上传')
        count++; expected += '[PRISMPRESS_IMAGE]'
      }
    }
    if (title.value !== article.title || editor.querySelectorAll('img').length !== count || normalize(sequence(editor)) !== expected) throw new Error('标题、正文或图片位置与原稿不一致')
    return { ok: true, images: count, message: `已填入，待确认保存：文字和 ${count} 张图片。请在知乎确认自动保存并重开检查后再发布。` }
  } catch (error) { return { ok: false, message: `已停止，当前页面内容保留。${error.message}；请检查，勿重复发送。` } }
}
