import { afterEach, expect, it, vi } from 'vitest'
import handler from '../../../api/passport.mjs'
const response = () => ({ code: 200, setHeader() {}, status(n) { this.code = n; return this }, json(v) { this.body = v; return this } })
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
it('摘要缺少独立密钥时不发送封面密钥', async () => {
  vi.stubEnv('OPENAI_API_KEY', ''); vi.stubEnv('AIARTMIRROR_API_KEY', 'cover-secret')
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
  const res = response(); await handler({ method: 'POST', body: { article: '不应发送的正文' } }, res)
  expect(res.code).toBe(503); expect(fetch).not.toHaveBeenCalled()
  expect(res.body.error).not.toMatch(/OPENAI_API_KEY|\.env|环境变量/)
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
  const value = { title: '测试', shortTitle20: '测试', summaries: { wechat: '摘要', juejin: '文章围绕真实技术问题展开，说明解决方案、关键实现步骤及验证结果，同时分析适用场景和需要注意的工程取舍，帮助开发者理解实践方法。', csdn: '摘要', douyin: '抖音摘要' }, tags: ['技术'], category: { juejin: '人工智能', generic: '技术' } }
  finish(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(value) } }] })))
  await Promise.all([first, second])
  expect(a.code).toBe(200); expect(fetch).toHaveBeenCalledTimes(1); expect(a.body).toEqual(b.body)
  expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer passport-secret')
  expect(JSON.parse(fetch.mock.calls[0][1].body).max_completion_tokens).toBe(1600)
})
it('sends the full ending and requests an independent Douyin summary', async () => {
  vi.stubEnv('OPENAI_API_KEY', 'passport-secret')
  const value = { title: '测试', shortTitle20: '测试', summaries: { wechat: '全文结论', juejin: '文章围绕真实技术问题展开，说明解决方案、关键实现步骤及验证结果，同时分析适用场景和需要注意的工程取舍，帮助开发者理解实践方法。', csdn: '全文方法与结论', douyin: '独立的核心观点' }, tags: ['技术'], category: { juejin: '人工智能', generic: '技术' } }
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(value) } }] })))
  vi.stubGlobal('fetch', fetch)
  const res = response()
  await handler({ method: 'POST', body: { article: '背景。'.repeat(6000) + '文章末尾的关键结论。' } }, res)
  expect(res.code).toBe(200)
  const messages = JSON.parse(fetch.mock.calls[0][1].body).messages
  expect(JSON.parse(messages[1].content).article).toContain('文章末尾的关键结论')
  expect(messages[0].content).toContain('不截断其他平台摘要')
  expect(res.body.summaries.douyin).toBe('独立的核心观点')
})
