import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { validatePackage } from '../../../extensions/publish-assistant/package.mjs'
import { fillXhsDraft } from '../../../extensions/publish-assistant/adapter.mjs'
const valid = () => ({ version: 1, platform: 'xiaohongshu', title: '验证文章', parts: [{ kind: 'html', html: '<p>正文</p>' }, { kind: 'image', data: 'data:image/png;base64,aGVsbG8=' }] })
describe('local publishing assistant contract', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('refuses an existing draft before changing its title or content', async () => {
    const editor = { textContent: '已有正文', querySelector: vi.fn() }
    const title = { value: '已有标题' }
    vi.stubGlobal('location', { origin: 'https://creator.xiaohongshu.com' })
    vi.stubGlobal('document', { querySelector: selector => selector.startsWith('div') ? editor : title })
    expect((await fillXhsDraft(valid())).ok).toBe(false)
    expect(editor.textContent).toBe('已有正文')
    expect(title.value).toBe('已有标题')
  })
  it('refuses a non-target page', async () => {
    vi.stubGlobal('location', { origin: 'https://example.com' })
    vi.stubGlobal('document', { querySelector: () => null })
    expect((await fillXhsDraft(valid())).ok).toBe(false)
  })
  it('preserves ordered text and embedded image bytes without extra fields', () => {
    const value = valid()
    value.cookie = 'must not transfer'
    expect(validatePackage(value)).toEqual(valid())
  })
  it('rejects remote images, malformed bytes and unsupported destinations', () => {
    for (const data of ['https://example.com/image.png', 'data:image/svg+xml;base64,aGVsbG8=', 'data:image/png;base64,?!']) {
      const value = valid(); value.parts[1].data = data
      expect(() => validatePackage(value)).toThrow()
    }
    expect(() => validatePackage({ ...valid(), platform: 'unknown' })).toThrow()
    expect(() => validatePackage({ ...valid(), title: '字'.repeat(65) })).toThrow()
  })
  it('accepts Douyin articles but enforces its shorter title limit', () => {
    expect(validatePackage({ ...valid(), platform: 'douyin' }).platform).toBe('douyin')
    expect(() => validatePackage({ ...valid(), platform: 'douyin', title: '字'.repeat(31) })).toThrow()
  })
  it('rejects unknown parts and oversized inputs', () => {
    expect(() => validatePackage({ ...valid(), parts: [{ kind: 'script', html: 'bad' }] })).toThrow()
    expect(() => validatePackage({ ...valid(), parts: Array(202).fill({ kind: 'html', html: '<p>x</p>' }) })).toThrow()
    expect(() => validatePackage({ ...valid(), parts: [{ kind: 'html', html: 'x'.repeat(1000001) }] })).toThrow()
  })
  it('limits automatic access to the supported editors and trusted PrismPress sites', () => {
    const manifest = JSON.parse(readFileSync(new URL('../../../extensions/publish-assistant/manifest.json', import.meta.url), 'utf8'))
    expect(manifest.permissions).toEqual(['activeTab', 'scripting'])
    expect(manifest.host_permissions).toEqual(['https://creator.xiaohongshu.com/*', 'https://creator.douyin.com/*', 'https://zhuanlan.zhihu.com/*', 'https://mp.csdn.net/*', 'https://juejin.cn/*', 'https://member.bilibili.com/*'])
    expect(manifest.content_scripts[0].matches).toEqual(['https://prismpress-sigma.vercel.app/*', 'http://127.0.0.1:5175/*', 'http://localhost:5175/*'])
    expect(manifest.background.type).toBe('module')
  })
})
