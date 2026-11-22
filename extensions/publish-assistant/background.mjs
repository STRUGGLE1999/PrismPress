import { validatePackage } from './package.mjs'
import { fillXhsDraft } from './adapter.mjs'
import { fillZhihuDraft } from './zhihu.mjs'
import { fillRichDraft } from './rich.mjs'
import { fillJuejinDraft } from './juejin.mjs'
import { fillDouyinDraft } from './douyin.mjs'
import { destinations, trustedSource } from './bridge.mjs'
const active = new Set()
chrome.runtime.onMessage.addListener((request, sender, respond) => {
  if (sender.frameId !== 0 || !sender.tab?.id || !trustedSource(sender.url)) return false
  if (request?.action === 'ping') { respond({ ok: true, version: '0.4.0' }); return false }
  if (request?.action !== 'send') return false
  ;(async () => {
    let platform
    let tab
    let owned = false
    try {
      const article = validatePackage(request.article)
      platform = article.platform
      if (active.has(platform)) { respond({ ok: false, message: '这个平台已有交付任务，请先检查目标页面' }); return }
      active.add(platform)
      owned = true
      // Reuse only a visibly blank editor, never an existing draft or recovery page.
      const candidates = await chrome.tabs.query({ url: `${new URL(destinations[platform]).origin}/*` })
      for (const candidate of candidates) {
        try {
          const [check] = await chrome.scripting.executeScript({ target: { tabId: candidate.id }, func: (platform) => {
            const frame = document.querySelector(platform === 'csdn' ? 'iframe.cke_wysiwyg_frame' : platform === 'bilibili' ? 'iframe[src*="/york/read-editor"]' : 'iframe[data-prismpress-none]')
            const doc = frame?.contentDocument || document
            const editors = { zhihu: '.public-DraftEditor-content[contenteditable="true"]', csdn: 'body[contenteditable="true"]', bilibili: '.tiptap[contenteditable="true"]', juejin: '.bytemd-preview .markdown-body' }
            const titles = { zhihu: 'textarea[placeholder="请输入标题（最多 100 个字）"]', csdn: '#txtTitle', bilibili: 'textarea[placeholder="请输入标题（建议30字以内）"]', juejin: 'input[placeholder="输入文章标题..."]' }
            const editor = doc.querySelector(editors[platform] || 'div.tiptap[contenteditable="true"]')
            const title = (platform === 'csdn' ? document : doc).querySelector(titles[platform] || 'textarea[placeholder="输入标题"],input[placeholder="请输入文章标题，最多不超过30个字"]')
            return Boolean(editor && title && !title.value.trim() && !editor.textContent.replace(/[\s\u200b\ufeff]/g, '') && !editor.querySelector('img'))
          }, args: [platform] })
          if (check?.result === true) { tab = candidate; await chrome.tabs.update(tab.id, { active: true }); break }
        } catch { /* Closed or navigating tabs are not reusable. */ }
      }
      tab ??= await chrome.tabs.create({ url: destinations[platform], active: true })
      // Wait for navigation only. Adapters wait for a logged-in blank editor.
      for (let attempt = 0; attempt < 60; attempt++) {
        const state = await chrome.tabs.get(tab.id)
        if (state.status === 'complete') break
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      const [execution] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, world: 'MAIN', func: platform === 'xiaohongshu' ? fillXhsDraft : platform === 'douyin' ? fillDouyinDraft : platform === 'juejin' ? fillJuejinDraft : platform === 'zhihu' ? fillZhihuDraft : fillRichDraft, args: [article, true] })
      respond(execution?.result || { ok: false, message: '未收到填入结果，请检查目标页，勿重复发送' })
    } catch { respond({ ok: false, message: tab ? '交付中断，请检查已打开的页面；内容可能已部分填入，勿重复发送' : '无法打开目标平台，请检查助手权限后重试' }) }
    finally { if (owned) active.delete(platform) }
  })()
  return true
})
