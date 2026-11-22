import { describe, it, expect, vi, afterEach } from 'vitest'
import handler from '../../../api/cover.mjs'

function response() {
  return { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v }, status(n) { this.statusCode = n; return this }, json(v) { this.body = v; return this }, end(v) { this.body = v; return this } }
}
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
describe('paid cover endpoint', () => {
  it('fails closed without server credentials', async () => {
    vi.stubEnv('AIARTMIRROR_API_KEY', '')
    const res = response()
    await handler({ method: 'POST', headers: {}, body: {} }, res)
    expect(res.statusCode).toBe(503)
  })
  it('accepts generation without an experience code and returns only image bytes', async () => {
    vi.stubEnv('AIARTMIRROR_API_KEY', 'private-key')
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ b64_json: 'iVBORw0KGgo=' }], account: 'secret' })))
    vi.stubGlobal('fetch', fetch)
    const res = response()
    await handler({ method: 'POST', headers: {}, body: { title: '标题', article: '正文里的独特内容', ratio: 'wechat' } }, res)
    expect(res.statusCode).toBe(200)
    const sent = JSON.parse(fetch.mock.calls[0][1].body)
    expect(sent.prompt).toContain('正文里的独特内容'); expect(sent.n).toBe(1)
    expect(sent.size).toBe('1536x1024'); expect(sent.model).toBe('gpt-image-2.6-flare')
    expect(res.headers['Content-Type']).toBe('image/png'); expect(res.body.toString()).not.toContain('secret')
  })
})

it('rejects an unsupported ratio without spending', async () => {
  vi.stubEnv('AIARTMIRROR_API_KEY', 'private-key')
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
  const res = response()
  await handler({ method: 'POST', headers: {}, body: { title: '标题', article: '正文', ratio: '__proto__' } }, res)
  expect(res.statusCode).toBe(400); expect(fetch).not.toHaveBeenCalled()
})

it('does not retry provider failures or expose upstream credentials', async () => {
  vi.stubEnv('AIARTMIRROR_API_KEY', 'private-key')
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: 'private-key account internals' } }), { status: 503 }))
  vi.stubGlobal('fetch', fetch)
  const res = response()
  await handler({ method: 'POST', headers: {}, body: { title: '标题', article: '正文', ratio: 'universal' } }, res)
  expect(res.statusCode).toBe(502); expect(fetch).toHaveBeenCalledTimes(1)
  expect(res.body.error).toContain('模型线路暂时不可用'); expect(JSON.stringify(res.body)).not.toContain('private-key')
})
