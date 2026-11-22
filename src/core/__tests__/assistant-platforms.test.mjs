import { afterEach, describe, expect, it, vi } from 'vitest'
import { validatePackage } from '../../../extensions/publish-assistant/package.mjs'
import { destinations } from '../../../extensions/publish-assistant/bridge.mjs'
import { fillRichDraft } from '../../../extensions/publish-assistant/rich.mjs'
import { fillJuejinDraft } from '../../../extensions/publish-assistant/juejin.mjs'
import { fillZhihuDraft } from '../../../extensions/publish-assistant/zhihu.mjs'
const article = platform => ({ version: 1, platform, title: 'PrismPress测试文章', parts: [{ kind: 'html', html: '<p>正文</p>' }, { kind: 'image', data: 'data:image/png;base64,aGVsbG8=' }] })
describe('additional publishing destinations', () => {
  afterEach(() => vi.unstubAllGlobals())
  it.each(['zhihu', 'csdn', 'bilibili'])('validates %s and uses a fixed HTTPS editor', platform => {
    expect(validatePackage(article(platform)).platform).toBe(platform)
    expect(new URL(destinations[platform]).protocol).toBe('https:')
  })
  it('requires complete and unique Markdown image markers for Juejin', () => {
    const value = { ...article('juejin'), markdown: '正文\n![图片](PRISMPRESS_IMAGE_0_END)' }
    expect(validatePackage(value).markdown).toBe(value.markdown)
    for (const markdown of ['', '正文', '![图](PRISMPRESS_IMAGE_1_END)', 'PRISMPRESS_IMAGE_0_END PRISMPRESS_IMAGE_0_END']) expect(() => validatePackage({ ...value, markdown })).toThrow()
  })
  it('rejects the blocked WeChat destination without broadening its permissions', () => {
    expect(() => validatePackage(article('wechat'))).toThrow()
    expect(destinations.wechat).toBeUndefined()
  })
  it('refuses existing content in rich editors before editing title', async () => {
    vi.stubGlobal('location', { origin: 'https://zhuanlan.zhihu.com' })
    const title = { value: '原有文章' }; const editor = { textContent: '原有正文' }
    vi.stubGlobal('document', { querySelector: selector => selector.startsWith('.PostEditor') ? {} : selector.startsWith('textarea') ? title : editor })
    expect((await fillZhihuDraft(article('zhihu'))).ok).toBe(false)
    expect(title.value).toBe('原有文章')
  })
  it('does not write into a different origin', async () => {
    vi.stubGlobal('location', { origin: 'https://example.com' })
    expect((await fillRichDraft(article('zhihu'))).ok).toBe(false)
    expect((await fillJuejinDraft(article('juejin'))).ok).toBe(false)
    expect((await fillZhihuDraft(article('zhihu'))).ok).toBe(false)
  })
  it.each(['csdn', 'bilibili'])('refuses existing content inside the %s editor frame', async platform => {
    const title = { value: '原有标题' }
    const editor = { textContent: '原有正文' }
    const frameDocument = { querySelector: selector => selector.startsWith('body') || selector.startsWith('[contenteditable') ? editor : title }
    vi.stubGlobal('location', { origin: new URL(destinations[platform]).origin })
    vi.stubGlobal('document', { querySelector: selector => selector.startsWith('iframe') ? { contentDocument: frameDocument } : title })
    expect((await fillRichDraft(article(platform))).ok).toBe(false)
    expect(title.value).toBe('原有标题')
    expect(editor.textContent).toBe('原有正文')
  })
  it('blocks characters observed to be corrupted in saved titles or Bilibili bodies', () => {
    expect(() => validatePackage({ ...article('csdn'), title: '测试🦕标题' })).toThrow()
    expect(() => validatePackage({ ...article('bilibili'), title: '测试🦕标题' })).toThrow()
    expect(() => validatePackage({ ...article('bilibili'), parts: [{ kind: 'html', html: '<p>正文👏</p>' }] })).toThrow()
    expect(validatePackage({ ...article('csdn'), parts: [{ kind: 'html', html: '<p>正文👏</p>' }] }).platform).toBe('csdn')
  })
})
