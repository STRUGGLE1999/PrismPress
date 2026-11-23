import { afterEach, describe, expect, it, vi } from 'vitest'
import { prepareInlineImageSources } from '@/components/hostImages'
import { compressImageToDataUrl } from '@/core/images/local'

vi.mock('@/core/images/local', () => ({ compressImageToDataUrl: vi.fn(async () => ({ dataUrl: 'data:image/png;base64,prepared' })) }))
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); vi.clearAllMocks() })

describe('抖音配图准备', () => {
  it('keeps B站 dimensions separate from the Douyin padding cache', async () => {
    const fetcher = vi.fn(async () => ({ ok: true, blob: async () => new Blob(['image']) }))
    vi.stubGlobal('fetch', fetcher)
    const urls = ['https://example.com/shared-small.png']
    await prepareInlineImageSources({}, urls, { minDimension: 0 })
    expect(compressImageToDataUrl).toHaveBeenLastCalledWith(expect.any(File), { minWidth: 0, minHeight: 0 })
    await prepareInlineImageSources({}, urls)
    expect(compressImageToDataUrl).toHaveBeenLastCalledWith(expect.any(File), { minWidth: 100, minHeight: 100 })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
  it('reads slow images in batches of three rather than waiting for each image serially', async () => {
    vi.useFakeTimers()
    const fetcher = vi.fn(() => new Promise(resolve => setTimeout(() => resolve({ ok: true, blob: async () => new Blob(['image']) }), 100)))
    vi.stubGlobal('fetch', fetcher)
    const urls = Array.from({ length: 9 }, (_, i) => `https://example.com/batch-${i}.png`)
    const task = prepareInlineImageSources({}, urls)
    expect(fetcher).toHaveBeenCalledTimes(3)
    await vi.advanceTimersByTimeAsync(300)
    expect(Object.keys(await task)).toEqual(urls)
  })

  it('exits within the total deadline even when an image read never returns', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', () => new Promise(() => {}))
    const task = prepareInlineImageSources({}, ['https://example.com/stuck.png'])
    const rejected = expect(task).rejects.toThrow('配图准备超时')
    await vi.advanceTimersByTimeAsync(90000)
    await rejected
    expect(vi.getTimerCount()).toBe(0)
  })

  it('cancels immediately and does not report progress from a late image result', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', () => new Promise(resolve => setTimeout(() => resolve({ ok: true, blob: async () => new Blob(['image']) }), 100)))
    const controller = new AbortController()
    const progress = vi.fn()
    const task = prepareInlineImageSources({}, ['https://example.com/cancel.png'], { signal: controller.signal, onProgress: progress })
    const rejected = expect(task).rejects.toMatchObject({ name: 'AbortError' })
    controller.abort()
    await rejected
    await vi.advanceTimersByTimeAsync(100)
    expect(progress.mock.calls).toEqual([[0, 1]])
  })

  it('retains completed images so retry only fetches the failed image', async () => {
    const first = 'https://example.com/retry-first.png'
    const second = 'https://example.com/retry-second.png'
    const progress = vi.fn()
    const fetcher = vi.fn(async (url: string) => ({ ok: !url.includes('retry-second'), blob: async () => new Blob(['image']) }))
    vi.stubGlobal('fetch', fetcher)
    // Separate batches make the first image a completed result before the failure.
    await prepareInlineImageSources({}, [first])
    await expect(prepareInlineImageSources({}, [first, second])).rejects.toThrow('未能读取')
    fetcher.mockImplementation(async () => ({ ok: true, blob: async () => new Blob(['image']) }))
    fetcher.mockClear()
    const result = await prepareInlineImageSources({}, [first, second], { onProgress: progress })
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(result[first]).toContain('data:image/')
    expect(progress).toHaveBeenLastCalledWith(2, 2)
  })
})
