// Self-contained because Chrome serializes this function into the active page.
export async function fillXhsDraft(article, waitForEditor = false) {
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
  const normalize = text => text.replace(/[\s\u200b\ufeff]/g, '')
  if (waitForEditor) {
    for (let attempt = 0; attempt < 120; attempt++) {
      if (document.querySelector('div.tiptap[contenteditable="true"]') && document.querySelector('textarea[placeholder="输入标题"]')) break
      const create = [...document.querySelectorAll('button')].find(button => button.textContent.trim() === '新的创作')
      if (create) create.click()
      await pause(1000)
    }
  }
  const editor = document.querySelector('div.tiptap[contenteditable="true"]')
  const title = document.querySelector('textarea[placeholder="输入标题"]')
  if (location.origin !== 'https://creator.xiaohongshu.com' || !editor || !title) return { message: '请先进入小红书“写长文”，并打开新的空白创作', ok: false }
  if (normalize(editor.textContent) || editor.querySelector('img') || title.value.trim()) return { message: '当前文章已有内容，助手已停止。请新建空白长文，避免覆盖', ok: false }
  const cleanHtml = html => {
    const root = new DOMParser().parseFromString(html, 'text/html').body
    const allowed = new Set(['P','DIV','SPAN','H1','H2','H3','H4','STRONG','B','EM','I','U','S','UL','OL','LI','BLOCKQUOTE','PRE','CODE','BR','HR','A'])
    for (const element of [...root.querySelectorAll('*')].reverse()) {
      if (['SCRIPT','STYLE','IFRAME','OBJECT','SVG','MATH','FORM','INPUT','IMG'].includes(element.tagName)) { element.remove(); continue }
      if (!allowed.has(element.tagName)) { element.replaceWith(...element.childNodes); continue }
      for (const attribute of [...element.attributes]) {
        if (element.tagName === 'A' && attribute.name === 'href' && /^https?:\/\//i.test(attribute.value)) continue
        element.removeAttribute(attribute.name)
      }
    }
    return root.innerHTML
  }
  const end = () => {
    editor.focus()
    const range = document.createRange()
    range.selectNodeContents(editor)
    range.collapse(false)
    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
  }
  const deadline = Date.now() + 180000
  let inserted = 0
  let expected = ''
  try {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
    setter.call(title, article.title)
    title.dispatchEvent(new Event('input', { bubbles: true }))
    title.dispatchEvent(new Event('change', { bubbles: true }))
    for (const part of article.parts) {
      if (Date.now() > deadline) throw new Error('填入超时，请检查当前稿件')
      end()
      const transfer = new DataTransfer()
      if (part.kind === 'html') {
        const html = cleanHtml(part.html)
        const text = new DOMParser().parseFromString(html, 'text/html').body.textContent
        if (!text.trim() && !/<hr\b/i.test(html)) continue
        expected += normalize(text)
        const before = normalize(editor.textContent)
        transfer.setData('text/html', html)
        transfer.setData('text/plain', text)
        editor.dispatchEvent(new ClipboardEvent('paste', { clipboardData: transfer, bubbles: true, cancelable: true }))
        await pause(100)
        if (text.trim() && normalize(editor.textContent) === before) throw new Error('编辑器未接收文字')
      } else {
        const before = editor.querySelectorAll('img').length
        const match = part.data.match(/^data:(image\/\w+);base64,(.+)$/)
        const binary = atob(match[2])
        const bytes = Uint8Array.from(binary, char => char.charCodeAt(0))
        transfer.items.add(new File([bytes], `prismpress-${inserted + 1}.${match[1].split('/')[1]}`, { type: match[1] }))
        const upload = [...document.querySelectorAll('.menu-items-container button')].find(button =>
          button.querySelector('svg path')?.getAttribute('d')?.startsWith('M6.91635 8.25017'))
        if (!upload) throw new Error('未找到原生插图按钮，页面可能已改版')
        // A leading quote/list can leave the cursor in a block that forbids images.
        for (let attempt = 0; upload.classList.contains('disabled') && attempt < 3; attempt++) {
          editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }))
          await pause(50)
        }
        if (upload.classList.contains('disabled')) throw new Error('当前位置不允许插图，已停止')
        // The platform creates a detached file input. Hand it the file during this
        // button action, then restore the native method even if uploading fails.
        const nativeClick = HTMLInputElement.prototype.click
        let captured = false
        const choose = function (...args) {
          if (this.type !== 'file') return nativeClick.apply(this, args)
          if (captured) throw new Error('插图控件重复请求文件，已停止')
          captured = true
          this.files = transfer.files
          this.dispatchEvent(new Event('change', { bubbles: true }))
        }
        try {
          HTMLInputElement.prototype.click = choose
          upload.click()
          await pause(0)
        } finally {
          if (HTMLInputElement.prototype.click === choose) HTMLInputElement.prototype.click = nativeClick
        }
        if (!captured) throw new Error('原生插图控件未接收文件，已停止')
        let ready = false
        let stable = 0
        for (let attempt = 0; attempt < 120; attempt++) {
          if (Date.now() > deadline) throw new Error('填入超时，请检查当前稿件')
          await pause(500)
          const images = [...editor.querySelectorAll('img')]
          if (images.length > before + 1) throw new Error('检测到重复插图，已停止；请检查当前稿件')
          // Native insertions stay as local previews until the platform saves the draft.
          const loaded = images.length === before + 1 && images.slice(before).every(img => img.complete && img.naturalWidth > 0 &&
            (img.src.startsWith('blob:https://creator.xiaohongshu.com/') || (/^https:\/\//.test(img.src) && new URL(img.src).hostname.endsWith('.xhscdn.com'))))
          stable = loaded ? stable + 1 : 0
          if (stable >= 2) { ready = true; break }
        }
        if (!ready) throw new Error('图片未能进入正文，请检查当前页；不要重复导入')
        inserted++
        expected += '[PRISMPRESS_IMAGE]'
      }
    }
    if (title.value !== article.title) throw new Error('标题未能保留')
    if (editor.querySelectorAll('img').length !== inserted) throw new Error('图片总数不一致，请检查当前稿件')
    const sequence = node => node.nodeType === 3 ? node.textContent :
      node.nodeType === 1 && node.tagName === 'IMG' ? '[PRISMPRESS_IMAGE]' : [...node.childNodes].map(sequence).join('')
    if (normalize(sequence(editor)) !== expected) throw new Error('正文或图片位置与交接文件不一致，请检查当前稿件')
    return { ok: true, images: inserted, message: `已填入，待保存：文字和 ${inserted} 张图片。请点击“暂存离开”，再重开检查图片；助手未保存或发布。` }
  } catch (error) {
    return { ok: false, images: inserted, message: `已停止，当前页内容保留（已接收 ${inserted} 张图片）。${error.message}` }
  }
}
