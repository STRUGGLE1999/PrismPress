import { afterEach, describe, expect, it, vi } from 'vitest'
import { trustedSource } from '../../../extensions/publish-assistant/bridge.mjs'
import { fillDouyinDraft } from '../../../extensions/publish-assistant/douyin.mjs'
const article = { version: 1, platform: 'douyin', title: '验证', parts: [{ kind: 'html', html: '<p>正文</p>' }] }
const sender = { frameId: 0, tab: { id: 10 }, url: 'http://127.0.0.1:5175/' }
async function background() {
  let listener
  const api = { runtime: { onMessage: { addListener: cb => { listener = cb } } }, tabs: { query: vi.fn().mockResolvedValue([]), update: vi.fn().mockResolvedValue({}), create: vi.fn().mockResolvedValue({ id: 20 }), get: vi.fn().mockResolvedValue({ status: 'complete' }) }, scripting: { executeScript: vi.fn().mockResolvedValue([{ result: { ok: true, message: '已填入，待保存' } }]) } }
  vi.stubGlobal('chrome', api)
  vi.resetModules()
  await import('../../../extensions/publish-assistant/background.mjs')
  return { listener, api, send: (request, who = sender) => new Promise(resolve => { const async = listener(request, who, resolve); if (!async) resolve(undefined) }) }
}
describe('website assistant bridge', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('allows exact origins, rejecting lookalikes, other ports and nested attacker URLs', () => {
    for (const url of ['https://prismpress-sigma.vercel.app/', sender.url, 'http://localhost:5175/']) expect(trustedSource(url)).toBe(true)
    for (const url of ['https://prismpress-sigma.vercel.app.evil.org/', 'http://127.0.0.1:9999/', 'https://evil.org/?url=https://prismpress-sigma.vercel.app', 'bad']) expect(trustedSource(url)).toBe(false)
  })
  it('never opens a target from an untrusted sender or subframe', async () => {
    const { send, api } = await background()
    await send({ action: 'send', article }, { ...sender, url: 'https://evil.org' })
    await send({ action: 'send', article }, { ...sender, frameId: 1 })
    expect(api.tabs.create).not.toHaveBeenCalled()
  })
  it('validates before opening and reports fill separately from save', async () => {
    const { send, api } = await background()
    expect((await send({ action: 'send', article: { ...article, platform: 'evil' } })).ok).toBe(false)
    expect(api.tabs.create).not.toHaveBeenCalled()
    expect(await send({ action: 'send', article })).toEqual({ ok: true, message: '已填入，待保存' })
    expect(api.tabs.create).toHaveBeenCalledWith({ url: 'https://creator.douyin.com/creator-micro/content/upload?default-tab=5', active: true })
  })
  it('blocks overlapping sends without releasing the first task lock', async () => {
    const { send, api } = await background()
    let complete
    api.scripting.executeScript.mockImplementationOnce(() => new Promise(resolve => { complete = resolve }))
    const first = send({ action: 'send', article })
    await vi.waitFor(() => expect(complete).toBeTypeOf('function'))
    expect((await send({ action: 'send', article })).ok).toBe(false)
    expect((await send({ action: 'send', article })).ok).toBe(false)
    expect(api.tabs.create).toHaveBeenCalledTimes(1)
    complete([{ result: { ok: true } }]); await first
  })
  it('releases the lock when opening a tab fails', async () => {
    const { send, api } = await background()
    api.tabs.create.mockRejectedValueOnce(new Error('closed'))
    expect((await send({ action: 'send', article })).ok).toBe(false)
    expect((await send({ action: 'send', article })).ok).toBe(true)
  })
  it('reuses an already-open blank editor but skips a nonblank editor', async () => {
    const { send, api } = await background()
    api.tabs.query.mockResolvedValue([{ id: 30 }, { id: 31 }])
    api.scripting.executeScript.mockResolvedValueOnce([{ result: false }]).mockResolvedValueOnce([{ result: true }])
    expect((await send({ action: 'send', article })).ok).toBe(true)
    expect(api.tabs.create).not.toHaveBeenCalled()
    expect(api.tabs.update).toHaveBeenCalledWith(31, { active: true })
    expect(api.scripting.executeScript.mock.calls.at(-1)[0].target.tabId).toBe(31)
  })
  it('protects an existing Douyin article and its pending recovery copy', async () => {
    vi.stubGlobal('location', { origin: 'https://creator.douyin.com' })
    const title = { value: '已有标题' }; const editor = { textContent: '已有正文' }
    vi.stubGlobal('document', { querySelector: selector => selector.startsWith('div') ? editor : title })
    expect((await fillDouyinDraft(article)).ok).toBe(false)
    expect(title.value).toBe('已有标题')
    vi.stubGlobal('document', { querySelector: () => null, body: { textContent: '你还有上次未发布的文章' } })
    expect((await fillDouyinDraft(article, true)).ok).toBe(false)
  })
})
