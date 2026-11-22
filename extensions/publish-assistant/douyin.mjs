// Serialized into the target page; use only the visible DOM and paste events.
export async function fillDouyinDraft(article, waitForEditor = false) {
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
  const normalize = text => text.replace(/[\s\u200b\ufeff]/g, '')
  if (location.origin !== 'https://creator.douyin.com') return { ok: false, message: '请打开抖音文章编辑页' }
  if (waitForEditor) {
    for (let attempt = 0; attempt < 120; attempt++) {
      if (document.querySelector('div.tiptap[contenteditable="true"]')) break
      // A pending article may be the user's only recovery copy. Never replace it.
      if (document.body.textContent.includes('你还有上次未发布的文章')) return { ok: false, message: '抖音有未发布文章，请先继续编辑并处理该稿，再发送新稿；助手未覆盖内容' }
      const create = [...document.querySelectorAll('button')].find(button => button.textContent.trim() === '我要发文')
      if (create) create.click()
      await pause(1000)
    }
  }
  const editor = document.querySelector('div.tiptap[contenteditable="true"]')
  const title = document.querySelector('input[placeholder="请输入文章标题，最多不超过30个字"]')
  if (!editor || !title) return { ok: false, message: '请先登录抖音并进入空白文章编辑页，再从 PrismPress 发送' }
  if (normalize(editor.textContent) || editor.querySelector('img') || title.value.trim()) return { ok: false, message: '当前文章已有内容，助手已停止。请先处理已有文章，避免覆盖' }
  try {
    const root = new DOMParser().parseFromString('', 'text/html').body
    let expected = ''
    let images = 0
    for (const part of article.parts) {
      if (part.kind === 'image') {
        const img = document.createElement('img')
        img.src = part.data
        root.append(img)
        expected += '[PRISMPRESS_IMAGE]'
        images++
      } else {
        const block = new DOMParser().parseFromString(part.html, 'text/html').body
        const allowed = new Set(['P','DIV','SPAN','H1','H2','H3','H4','STRONG','B','EM','I','U','S','UL','OL','LI','BLOCKQUOTE','PRE','CODE','BR','HR'])
        // The article editor rejects tables: retain each cell as row text.
        for (const table of [...block.querySelectorAll('table')]) {
          const rows = [...table.querySelectorAll('tr')].map(row => {
            const p = document.createElement('p')
            p.textContent = [...row.querySelectorAll('th,td')].map(cell => cell.textContent).join(' ｜ ')
            return p
          })
          table.replaceWith(...rows)
        }
        for (const element of [...block.querySelectorAll('*')].reverse()) {
          if (['SCRIPT','STYLE','IFRAME','OBJECT','SVG','MATH','FORM','INPUT','IMG'].includes(element.tagName)) { element.remove(); continue }
          if (!allowed.has(element.tagName)) { element.replaceWith(...element.childNodes); continue }
          for (const attr of [...element.attributes]) element.removeAttribute(attr.name)
        }
        expected += normalize(block.textContent)
        root.append(...block.childNodes)
      }
    }
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(title, article.title)
    title.dispatchEvent(new Event('input', { bubbles: true }))
    title.dispatchEvent(new Event('change', { bubbles: true }))
    editor.focus()
    const transfer = new DataTransfer()
    transfer.setData('text/html', root.innerHTML)
    transfer.setData('text/plain', root.textContent)
    editor.dispatchEvent(new ClipboardEvent('paste', { clipboardData: transfer, bubbles: true, cancelable: true }))
    const sequence = node => {
      if (node.nodeType === 3) return node.textContent
      if (node.nodeType === 1 && node.tagName === 'IMG') return '[PRISMPRESS_IMAGE]'
      if (node.nodeType === 1 && (node.matches('button,textarea,input') || node.getAttribute('contenteditable') === 'false' && !node.querySelector('img'))) return ''
      return [...node.childNodes].map(sequence).join('')
    }
    let stable = 0
    for (let attempt = 0; attempt < 120; attempt++) {
      await pause(500)
      const actual = [...editor.querySelectorAll('img')]
      if (actual.length > images) throw new Error('图片数量超出预期')
      const ready = actual.length === images && actual.every(img => img.complete && img.naturalWidth > 0 && /^https:\/\//.test(img.src) && !img.src.startsWith('data:'))
      stable = ready ? stable + 1 : 0
      if (stable >= 2) {
        if (editor.querySelector('[data-dy-warning="true"]')) throw new Error('平台提示存在不支持的正文格式')
        if (title.value !== article.title || normalize(sequence(editor)) !== expected) throw new Error('标题、正文或图片位置与原稿不一致')
        return { ok: true, images, message: `已填入，待保存：文字和 ${images} 张图片。请检查封面等设置，暂存并重开核对后再发布。` }
      }
    }
    throw new Error('图片处理超时或未被平台接收')
  } catch (error) { return { ok: false, message: `已停止，当前页内容保留。${error.message}；请检查，勿重复发送。` } }
}
