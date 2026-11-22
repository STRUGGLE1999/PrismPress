// Chrome serializes this function; keep target-page dependencies inside it.
export async function fillRichDraft(article) {
  const profiles = {
    csdn: { origin: 'https://mp.csdn.net', title: '#txtTitle', editor: 'body[contenteditable="true"]', frame: 'iframe.cke_wysiwyg_frame', name: 'CSDN' },
    bilibili: { origin: 'https://member.bilibili.com', title: 'textarea[placeholder="请输入标题（建议30字以内）"],input[placeholder="请输入标题（建议30字以内）"]', editor: '[contenteditable="true"]', frame: 'iframe[src*="/york/read-editor"]', name: 'B站' },
  }
  const profile = profiles[article.platform]
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
  const normalize = text => text.replace(/[\s\u200b\ufeff]/g, '')
  if (!profile || location.origin !== profile.origin) return { ok: false, message: '目标平台不匹配，已停止' }
  let doc
  let editor
  let title
  for (let attempt = 0; attempt < 90; attempt++) {
    const frame = profile.frame ? document.querySelector(profile.frame) : null
    try { doc = frame?.contentDocument || document } catch { doc = document }
    editor = doc.querySelector(profile.editor)
    title = (article.platform === 'csdn' ? document : doc).querySelector(profile.title)
    if (editor && title) break
    await pause(1000)
  }
  if (!editor || !title) return { ok: false, message: `请先登录${profile.name}并打开空白文章编辑器；当前页面尚未就绪` }
  if (normalize(editor.textContent) || editor.querySelector('img') || title.value.trim()) return { ok: false, message: '当前稿件已有内容，助手未修改。请新建空白文章后再发送' }
  const win = doc.defaultView
  const root = new DOMParser().parseFromString('', 'text/html').body
  let expected = ''
  let count = 0
  const sequence = node => {
    if (node.nodeType === 3) return node.textContent
    if (node.nodeType === 1 && node.matches('.cke_widget_drag_handler_container,.cke_widget_drag_handler')) return ''
    if (node.nodeType === 1 && node.classList.contains('cke_widget_image')) return '[PRISMPRESS_IMAGE]'
    if (node.nodeType === 1 && node.classList.contains('eva3-enhanced-image-wrapper')) return '[PRISMPRESS_IMAGE]'
    if (node.nodeType === 1 && node.tagName === 'IMG') return '[PRISMPRESS_IMAGE]'
    if (node.nodeType === 1 && node.matches('button,textarea,input,[data-placeholder]')) return ''
    return [...node.childNodes].map(sequence).join('')
  }
  try {
    for (const part of article.parts) {
      if (part.kind === 'image') {
        const image = document.createElement('img'); image.src = part.data
        root.append(image); expected += '[PRISMPRESS_IMAGE]'; count++
      } else {
        const block = new DOMParser().parseFromString(part.html, 'text/html').body
        const allowed = new Set(['P','DIV','SPAN','H1','H2','H3','H4','H5','H6','STRONG','B','EM','I','U','S','UL','OL','LI','BLOCKQUOTE','PRE','CODE','BR','HR','TABLE','THEAD','TBODY','TR','TH','TD'])
        for (const element of [...block.querySelectorAll('*')].reverse()) {
          if (element.tagName === 'A') { element.replaceWith(...element.childNodes); continue }
          if (['SCRIPT','STYLE','IFRAME','OBJECT','SVG','MATH','FORM','INPUT','IMG'].includes(element.tagName)) { element.remove(); continue }
          if (!allowed.has(element.tagName)) { element.replaceWith(...element.childNodes); continue }
          for (const attr of [...element.attributes]) element.removeAttribute(attr.name)
        }
        expected += normalize(block.textContent)
        root.append(...block.childNodes)
      }
    }
    const titleWin = title.ownerDocument.defaultView
    const prototype = title.tagName === 'TEXTAREA' ? titleWin.HTMLTextAreaElement.prototype : titleWin.HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(title, article.title)
    title.dispatchEvent(new titleWin.Event('input', { bubbles: true }))
    title.dispatchEvent(new titleWin.Event('change', { bubbles: true }))
    editor.focus()
    const range = doc.createRange()
    range.selectNodeContents(editor)
    range.collapse(false)
    const selection = win.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
    doc.dispatchEvent(new win.Event('selectionchange'))
    await pause(150)
    const transfer = new win.DataTransfer()
    transfer.setData('text/html', root.innerHTML)
    transfer.setData('text/plain', root.textContent)
    editor.dispatchEvent(new win.ClipboardEvent('paste', { clipboardData: transfer, bubbles: true, cancelable: true }))
    let stable = 0
    for (let attempt = 0; attempt < 120; attempt++) {
      await pause(500)
      const images = [...editor.querySelectorAll('img')].filter(img => !img.closest('button,.cke_widget_drag_handler_container') && !img.classList.contains('cke_widget_drag_handler'))
      if (images.length > count) throw new Error('图片数量超出原稿，已停止')
      const ready = images.length === count && images.every(img => img.complete && img.naturalWidth > 0 && (/^https?:\/\//.test(img.src) || article.platform === 'bilibili' && /^data:image\//.test(img.src)))
      stable = ready ? stable + 1 : 0
      if (stable >= 2) {
        if (title.value !== article.title) throw new Error('标题未能保留')
        if (normalize(sequence(editor)) !== expected) throw new Error('正文或图片位置与原稿不一致')
        return { ok: true, images: count, message: `已填入，待保存：文字和 ${count} 张图片。请在${profile.name}检查、保存并重开核对后再发布。` }
      }
    }
    throw new Error('图片未被平台完整接收，或文字未能填入')
  } catch (error) { return { ok: false, message: `已停止，当前页面内容保留。${error.message}；请检查后再决定是否新建稿件。` } }
}
