type AssistantReply = { ok: boolean; message?: string; version?: string }
function request(action: 'ping' | 'send', article?: unknown) {
  return new Promise<AssistantReply>((resolve, reject) => {
    const id = crypto.randomUUID()
    const receive = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== location.origin || event.data?.channel !== 'prismpress:response' || event.data.id !== id) return
      cleanup()
      resolve(event.data)
    }
    const timer = window.setTimeout(() => {
      cleanup()
      reject(new Error(action === 'ping' ? '未连接发布助手。请安装或更新助手，并刷新本站后重试。' : '交付结果未确认，请先检查已打开的平台页面，勿重复发送。'))
    }, action === 'ping' ? 2000 : 330000)
    const cleanup = () => { window.clearTimeout(timer); window.removeEventListener('message', receive) }
    window.addEventListener('message', receive)
    window.postMessage({ channel: 'prismpress:request', id, action, article }, location.origin)
  })
}
export async function connectAssistant(platform: string) {
  const reply = await request('ping')
  const compatible = reply.version === '0.4.0' || reply.version === '0.3.0' && ['xiaohongshu', 'douyin'].includes(platform)
  if (!reply.ok || !compatible) throw new Error('请将发布助手更新至0.4版，并刷新本站。')
}
export async function sendToAssistant(json: string) {
  return request('send', JSON.parse(json))
}
