// Only injected into the exact PrismPress origins listed in the manifest.
(() => {
  if (window !== window.top) return
  let busy = false
  window.addEventListener('message', async event => {
    const data = event.data
    if (event.source !== window || event.origin !== location.origin || data?.channel !== 'prismpress:request' || typeof data.id !== 'string' || data.id.length > 100 || !['ping', 'send'].includes(data.action)) return
    const reply = result => window.postMessage({ channel: 'prismpress:response', id: data.id, ...result }, location.origin)
    if (data.action === 'send' && busy) { reply({ ok: false, message: '已有任务正在交付，请先检查目标页面' }); return }
    if (data.action === 'send') busy = true
    try {
      const result = await chrome.runtime.sendMessage({ action: data.action, article: data.article })
      reply(result || { ok: false, message: '助手连接中断，请检查目标页，勿重复发送' })
    } catch { reply({ ok: false, message: '助手连接中断，请检查目标页，勿重复发送；更新助手后请刷新本站' }) }
    finally { if (data.action === 'send') busy = false }
  })
})()
