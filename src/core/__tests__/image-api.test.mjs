import { afterEach, describe, expect, it, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import { Readable } from 'node:stream'
vi.mock('node:dns/promises', () => ({ lookup: vi.fn() }))
vi.mock('node:https', () => ({ get: vi.fn() }))
import { lookup } from 'node:dns/promises'
import { get } from 'node:https'
import handler from '../../../api/image.mjs'

const response = () => ({ headers: {}, statusCode: 0, setHeader(k, v) { this.headers[k] = v }, end(body) { this.body = body } })
afterEach(() => { vi.resetAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers() })
describe('public image relay', () => {
  it.each(['127.0.0.1', '10.0.0.1', '169.254.169.254', '::1', '::ffff:192.168.1.1'])('rejects resolved private destination %s before connecting', async address => {
    lookup.mockResolvedValue([{ address, family: address.includes(':') ? 6 : 4 }])
    const res = response()
    await handler({ method: 'GET', url: '/api/image?url=https%3A%2F%2Fexample.com%2Fa.png' }, res)
    expect(res.statusCode).toBe(422)
    expect(get).not.toHaveBeenCalled()
  })
  it('rejects unsupported protocol and embedded credentials', async () => {
    for (const url of ['http://example.com/a.png', 'https://user:password@example.com/a.png']) {
      const res = response()
      await handler({ method: 'GET', url: `/api/image?url=${encodeURIComponent(url)}` }, res)
      expect(res.statusCode).toBe(422)
    }
    expect(get).not.toHaveBeenCalled()
  })
  it('returns public image bytes with their MIME type', async () => {
    lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }])
    let pinned
    get.mockImplementation((_url, options, callback) => {
      options.lookup('example.com', {}, (error, address) => { if (error) throw error; pinned = address })
      const request = new EventEmitter()
      queueMicrotask(() => {
        const upstream = Readable.from([Buffer.from('PNG bytes')])
        upstream.statusCode = 200; upstream.headers = { 'content-type': 'image/png' }
        upstream.on('close', () => request.emit('close'))
        callback(upstream)
      })
      return request
    })
    const res = response()
    await handler({ method: 'GET', url: '/api/image?url=https%3A%2F%2Fexample.com%2Fa.png' }, res)
    expect(res.statusCode).toBe(200)
    expect(res.headers['Content-Type']).toBe('image/png')
    expect(res.body.toString()).toBe('PNG bytes')
    expect(pinned).toBe('93.184.216.34')
  })
  it.each([
    [{ type: 1, data: '127.0.0.1' }],
    [{ type: 1, data: '93.184.216.34' }, { type: 1, data: '10.0.0.1' }],
  ])('rejects private or mixed public-resolver responses', async records => {
    lookup.mockResolvedValue([{ address: '198.18.1.2', family: 4 }])
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ Answer: records }))))
    const res = response()
    await handler({ method: 'GET', url: '/api/image?url=https%3A%2F%2Fexample.com%2Fa.png' }, res)
    expect(res.statusCode).toBe(422); expect(get).not.toHaveBeenCalled()
  })
  it('revalidates redirects and never connects to the redirected private host', async () => {
    lookup.mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }]).mockResolvedValueOnce([{ address: '127.0.0.1', family: 4 }])
    get.mockImplementation((_url, _options, callback) => {
      const request = new EventEmitter()
      queueMicrotask(() => callback({ statusCode: 302, headers: { location: 'https://localhost/private' }, destroy() { request.emit('close') } }))
      return request
    })
    const res = response()
    await handler({ method: 'GET', url: '/api/image?url=https%3A%2F%2Fexample.com%2Fa.png' }, res)
    expect(res.statusCode).toBe(422)
    expect(get).toHaveBeenCalledTimes(1)
  })
  it('malformed redirect URL becomes a handled failure', async () => {
    lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }])
    get.mockImplementation((_url, _options, callback) => {
      const request = new EventEmitter()
      queueMicrotask(() => callback({ statusCode: 302, headers: { location: 'https://[' }, destroy() { request.emit('close') } }))
      return request
    })
    const res = response()
    await handler({ method: 'GET', url: '/api/image?url=https%3A%2F%2Fexample.com%2Fa.png' }, res)
    expect(res.statusCode).toBe(422)
  })
  it('bounds initial DNS wait before the function deadline', async () => {
    vi.useFakeTimers()
    lookup.mockImplementation(() => new Promise(() => {}))
    const res = response()
    const task = handler({ method: 'GET', url: '/api/image?url=https%3A%2F%2Fexample.com%2Fa.png' }, res)
    await vi.advanceTimersByTimeAsync(5001); await task
    expect(res.statusCode).toBe(422); expect(get).not.toHaveBeenCalled()
  })
  it.each([true, false])('bounds buffered bytes with declared-size=%s', async declared => {
    lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }])
    get.mockImplementation((_url, _options, callback) => {
      const request = new EventEmitter()
      queueMicrotask(() => {
        const upstream = Readable.from([Buffer.alloc(4 * 1024 * 1024 + 1)])
        upstream.statusCode = 200; upstream.headers = { 'content-type': 'image/png', ...(declared ? { 'content-length': String(4 * 1024 * 1024 + 1) } : {}) }
        upstream.on('close', () => request.emit('close')); callback(upstream)
      })
      return request
    })
    const res = response()
    await handler({ method: 'GET', url: '/api/image?url=https%3A%2F%2Fexample.com%2Fa.png' }, res)
    expect(res.statusCode).toBe(422)
  })
})
