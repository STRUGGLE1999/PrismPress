import { afterEach, expect, it, vi } from 'vitest'
import handler from '../../../api/passport.mjs'
const response = () => ({ code: 200, setHeader() {}, status(n) { this.code = n; return this }, json(v) { this.body = v; return this } })
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
it('摘要缺少独立密钥时不发送封面密钥', async () => {
  vi.stubEnv('OPENAI_API_KEY', ''); vi.stubEnv('AIARTMIRROR_API_KEY', 'cover-secret')
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
  const res = response(); await handler({ method: 'POST', body: { article: '不应发送的正文' } }, res)
  expect(res.code).toBe(503); expect(fetch).not.toHaveBeenCalled()
})
it('拒绝畸形模型结果，不把空资料作为成功', async () => {
  vi.stubEnv('OPENAI_API_KEY', 'passport-secret')
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: '{}' } }] }))))
  const res = response(); await handler({ method: 'POST', body: { article: '畸形响应测试' } }, res)
  expect(res.code).toBe(502)
})
it('并发同稿复用上游请求，使用专用密钥并限制输出', async () => {
  vi.stubEnv('OPENAI_API_KEY', 'passport-secret'); vi.stubEnv('AIARTMIRROR_API_KEY', 'cover-secret')
  let finish
  const fetch = vi.fn(() => new Promise((resolve) => { finish = resolve })); vi.stubGlobal('fetch', fetch)
  const request = { method: 'POST', body: { title: '测试', article: '同稿并发仅调用一次' } }
  const a = response(), b = response()
  const first = handler(request, a), second = handler(request, b)
  const value = { title: '测试', shortTitle20: '测试', summaries: { wechat: '摘要', juejin: '摘要', csdn: '摘要' }, tags: ['技术'], category: { juejin: '人工智能', generic: '技术' } }
  finish(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(value) } }] })))
  await Promise.all([first, second])
  expect(fetch).toHaveBeenCalledTimes(1); expect(a.body).toEqual(b.body)
  expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer passport-secret')
  expect(JSON.parse(fetch.mock.calls[0][1].body).max_completion_tokens).toBe(1600)
})
