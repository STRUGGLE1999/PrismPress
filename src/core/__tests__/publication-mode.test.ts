import { describe, expect, it, vi, afterEach } from 'vitest'
import { compileArticle } from '../platforms/compile'
import { getPublicationPlatform } from '../platforms/registry'
import { copyCompiledArticle } from '../clipboard'
import { withDeckDraft } from '@/components/deckDraft'

const picture = 'data:image/png;base64,iVBORw0KGgo='
const source = '# 周末阅读计划\n\n## 从一件小事开始\n\n先读自己感兴趣的部分，不急着追求阅读数量。\n\n![封面](local.png)\n\n![引用图][fig]\n\n[fig]: reference.png\n\n[阅读链接][reading]\n\n[reading]: https://example.com/reading\n\n## 收尾\n\n这句文章末尾必须完整保留。'
afterEach(() => vi.unstubAllGlobals())

describe.each(['xiaohongshu', 'douyin'] as const)('%s 两种内容形式', platform => {
  it('默认文章模式保留全文与两种图片引用，使用富文本复制协议', async () => {
    const result = await compileArticle(source, platform, { imageSources: { 'local.png': picture, 'reference.png': picture } })
    expect(result.format).toBe('html')
    expect(result.slides).toBeUndefined()
    expect(result.body).not.toContain('<h1')
    expect(result.plainText).not.toContain('周末阅读计划')
    expect(result.body).toContain('这句文章末尾必须完整保留。')
    expect(result.body.match(/<img\b/g)).toHaveLength(2)
    expect(result.body).toContain(picture)
    expect(result.body).toContain(platform === 'douyin' ? '阅读链接（https://example.com/reading）' : 'href="https://example.com/reading"')
    expect(result.platform.clipboard).toBe('text/html')
  })
  it('图集模式不读取原图，模式切换不会把图集编辑覆盖到文章', async () => {
    const article = await compileArticle(source, platform)
    const deck = await compileArticle(source, platform, { publicationMode: 'deck' })
    expect(deck.format).toBe('deck')
    expect(deck.slides!.every(slide => !slide.image)).toBe(true)
    expect(deck.diagnostics.some(item => item.code === 'IMAGE_LOCAL_PATH')).toBe(false)
    const draft = { slides: deck.slides!, caption: '修改过的图集文案' }
    expect(withDeckDraft(article, draft)?.body).toBe(article.body)
    expect(withDeckDraft(deck, draft)?.body).toBe(draft.caption)
    expect(getPublicationPlatform(platform).editorUrl).not.toBe(getPublicationPlatform(platform, 'deck').editorUrl)
  })
  it('文章表格转成可粘贴段落，保留每行内容而不使用平台不支持的表格节点', async () => {
    const result = await compileArticle('# 任务记录\n\n| 任务 | 结果 |\n| --- | --- |\n| 读书 | 已完成 |\n| 整理 | 最后一行保留 |', platform)
    expect(result.body).not.toContain('<table')
    expect(result.body).toContain('读书 ｜ 已完成')
    expect(result.body).toContain('整理 ｜ 最后一行保留')
  })
  it('文章复制写入完整HTML及纯文字，没有用摘要替代全文', async () => {
    let written: Record<string, Blob> | undefined
    vi.stubGlobal('ClipboardItem', class { constructor(items: Record<string, Blob>) { written = items } })
    const write = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { write } })
    const result = await compileArticle(source, platform, { imageSources: { 'local.png': picture } })
    await copyCompiledArticle(result)
    expect(write).toHaveBeenCalledOnce()
    expect(await written!['text/html'].text()).toContain(picture)
    expect(await written!['text/plain'].text()).toContain('这句文章末尾必须完整保留。')
  })
})
