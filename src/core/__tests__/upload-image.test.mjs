import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('@vercel/blob', () => ({ put: vi.fn() }))
import { put } from '@vercel/blob'
import handler from '../../../api/upload-image.mjs'
const png = 'data:image/png;base64,iVBORw0KGgo='
function response() { return { statusCode: 200, setHeader() {}, status(n) { this.statusCode = n; return this }, json(body) { this.body = body; return this } } }
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks() })
describe('site image hosting', () => {
  it('rejects a file with a false image MIME', async () => {
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'private')
    const res = response()
    await handler({ method: 'POST', headers: {}, body: { dataUrl: 'data:image/png;base64,PGh0bWw+' } }, res)
    expect(res.statusCode).toBe(400); expect(put).not.toHaveBeenCalled()
  })
  it('uploads without an experience code and returns only a public URL', async () => {
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'private')
    vi.mocked(put).mockResolvedValue({ url: 'https://test.public.blob.vercel-storage.com/article-images/test.png' })
    const res = response()
    await handler({ method: 'POST', headers: {}, body: { dataUrl: png } }, res)
    expect(res.statusCode).toBe(200)
    expect(put.mock.calls[0][0]).toMatch(/^article-images\/[a-f0-9]{64}\.png$/)
    expect(put.mock.calls[0][2].access).toBe('public')
    expect(res.body).toEqual({ url: 'https://test.public.blob.vercel-storage.com/article-images/test.png' })
  })
})
