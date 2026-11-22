import { afterEach, expect, it, vi } from 'vitest'
import { extractPassport, passportState, applyAiPassport } from '../../components/passportState'
import { generatePassport } from '../metadata/passport'
afterEach(() => vi.unstubAllGlobals())
it('离开返回复用同稿任务，结果不会显示到其他文章', async () => {
  const cache = new Map()
  vi.stubGlobal('localStorage', { getItem: (key: string) => cache.get(key), setItem: (key: string, value: string) => cache.set(key, value) })
  let finish!: (value: Response) => void
  const fetch = vi.fn(() => new Promise<Response>((resolve) => { finish = resolve })); vi.stubGlobal('fetch', fetch)
  const first = extractPassport('A正文', 'A')
  expect(passportState('A正文').loading).toBe(true)
  expect(passportState('B正文').loading).toBe(false)
  expect(extractPassport('A正文', 'A')).toBe(first)
  const value = { title: 'A新标题', shortTitle20: 'A短标题', tags: ['测试'], summaries: { wechat: 'A摘要', juejin: 'A摘要', csdn: 'A摘要', douyin: 'A短摘要' }, category: { juejin: '前端', generic: '测试' }, bilibiliSummary: 'A总结' }
  finish(new Response(JSON.stringify(value)))
  await first
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(passportState('A正文').value?.title).toBe('A新标题')
  expect(passportState('B正文').value).toBeUndefined()
  const applied = applyAiPassport(generatePassport('A正文'), passportState('A正文').value)
  expect(applied.title).toBe(generatePassport('A正文').title)
  expect(applied.hashtags).toBe('#测试')
  expect(applied.summaries.wechat.text).toBe('A摘要')
})
