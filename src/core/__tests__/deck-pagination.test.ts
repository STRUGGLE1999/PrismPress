import { describe, expect, it } from 'vitest'
import { compileArticle as compileRaw } from '../platforms/compile'
const compileArticle: typeof compileRaw = (source, platform, options = {}) => compileRaw(source, platform, { publicationMode: 'deck', deckMode: 'full', ...options })
import { renderSlideSvg } from '../platforms/deck/render'
import { SAMPLE_ARTICLES } from '@/data/samples'
import { withDeckDraft } from '@/components/deckDraft'

describe('原文分页图集', () => {
  it('完整分页保留长正文、列表末项及原图，内容过长自动增加页数', async () => {
    const paragraph = '每一段事实都应当完整保留，不能只取开头几句。'.repeat(45) + '最后一句不能消失。'
    const result = await compileArticle('# 原文\n\n## 方法\n\n' + paragraph + '\n\n' + Array.from({ length: 9 }, (_, n) => `- 第${n + 1}个完整步骤。`).join('\n') + '\n\n![图示](local.png)', 'xiaohongshu', { imageSources: { 'local.png': 'data:image/png;base64,aGVsbG8=' } })
    const text = result.slides!.flatMap(s => s.bullets).join('')
    expect(text).toContain(paragraph)
    expect(text).toContain('第9个完整步骤')
    expect(result.slides!.some(s => s.image?.src.startsWith('data:image/png'))).toBe(true)
    expect(result.slides!.length).toBeGreaterThan(3)
    expect(result.body).not.toMatch(/原文分页|共 \d+ 张/)
    for (const slide of result.slides!) expect(() => renderSlideSvg(slide, 'editorial', 'xiaohongshu')).not.toThrow()
  })
  it('完整保留表格末行与代码，摘要方式仍可选择', async () => {
    const source = '# 完整内容\n\n## 数据\n\n|列一|列二|\n|---|---|\n' + Array.from({ length: 12 }, (_, n) => `|数据${n}|解释${n}|`).join('\n') + '\n\n```js\nconst x = 1\nconsole.log(x)\n```'
    const full = await compileArticle(source, 'douyin')
    expect(full.slides!.flatMap(s => s.tableRows ?? []).flat()).toContain('数据11')
    expect(full.slides!.map(s => s.highlight ?? '').join('')).toContain('console.log(x)')
    const summary = await compileArticle(source, 'douyin', { deckMode: 'summary' })
    expect(summary.body).toContain('完整内容')
  })
  it('SVG 为唯一预览与导出内容来源，转义用户文字且不加作者署名', async () => {
    const result = await compileArticle('# <script>用户标题</script>\n\n## 对比\n\n原文内容。', 'xiaohongshu')
    const svg = renderSlideSvg(result.slides![0], 'notes', 'xiaohongshu')
    expect(svg).toContain('<svg')
    expect(svg).not.toContain('Lavenda')
    expect(svg).not.toMatch(/<script\b/i)
    expect(svg).toContain('&lt;script&gt;')
  })
  it('嵌套列表、引用、表格和脚注中的配图不会丢失，行内图前后顺序保留', async () => {
    const source = '# 图文\n\n前文 ![行内](a.png) 后文。\n\n- 列表 ![列表图](b.png)\n\n> 引用 ![引用图](c.png)\n\n| 图片 |\n|---|\n|![表格图](d.png)|\n\n脚注[^n]\n\n[^n]: 说明 ![脚注图](e.png)'
    const result = await compileArticle(source, 'xiaohongshu')
    expect(result.slides!.filter(s => s.image).map(s => s.image!.src)).toEqual(['a.png', 'b.png', 'c.png', 'd.png', 'e.png'])
    const before = result.slides!.findIndex(s => s.bullets.join('').includes('前文'))
    const image = result.slides!.findIndex(s => s.image?.src === 'a.png')
    const after = result.slides!.findIndex(s => s.bullets.join('').includes('后文'))
    expect(before).toBeLessThan(image); expect(image).toBeLessThan(after)
  })
  it('分页代码的换行与缩进不改变，末尾标题不会消失', async () => {
    const code = Array.from({ length: 80 }, (_, i) => `  const item${i} = "一个很长的字符串让代码需要自动换行展示而非改变代码原文";`).join('\n')
    const result = await compileArticle('# 代码\n\n```js\n' + code + '\n```\n\n## 结束标题', 'xiaohongshu')
    expect(result.slides!.map(s => s.highlight ?? '').join('')).toBe(code)
    expect(result.slides!.at(-1)!.title).toBe('结束标题')
  })
  it('保留行内HTML图片位置和任务列表勾选状态', async () => {
    const result = await compileArticle('# 标题\n\n图前 <img src="inline.png" alt="内联图"> 图后。\n\n- [x] 已完成\n- [ ] 待处理', 'xiaohongshu')
    expect(result.slides!.some(slide => slide.image?.src === 'inline.png')).toBe(true)
    const text = result.slides!.flatMap(slide => slide.bullets).join('')
    expect(text).toContain('☑ 已完成'); expect(text).toContain('☐ 待处理')
  })
  it('行内公式只渲染一次，且仍在后续图片之前', async () => {
    const result = await compileArticle('# 数学\n\n图前 $x^2$ ![图](a.png) 图后。', 'xiaohongshu')
    const formula = result.slides!.findIndex(s => s.formulaSvg)
    const picture = result.slides!.findIndex(s => s.image)
    expect(formula).toBeGreaterThan(0); expect(formula).toBeLessThan(picture)
    expect(result.slides!.filter(s => s.formulaSvg)).toHaveLength(1)
    expect(result.slides!.flatMap(s => s.bullets).join('')).not.toContain('$x^2$')
  })
  it('标题及带空格属性的HTML表格图片都保留', async () => {
    const result = await compileArticle('# 标题 ![首图](heading.png)\n\n## 章节 ![章节图](section.png)\n\n| 图片 |\n|---|\n|前 <img src = "table.png" alt = "图示"> 后|', 'xiaohongshu')
    expect(result.slides!.filter(slide => slide.image).map(slide => slide.image!.src)).toEqual(['heading.png', 'section.png', 'table.png'])
  })
  it('修改后的图集和文案成为复制与发布使用的编译产物', async () => {
    const base = await compileArticle('# 标题\n\n正文。', 'xiaohongshu')
    const slides = base.slides!.map((slide, index) => index ? slide : { ...slide, title: '编辑后的标题' })
    const result = withDeckDraft(base, { slides, caption: '编辑后的配套文案' })!
    expect(result.body).toBe('编辑后的配套文案'); expect(result.plainText).toBe(result.body)
    expect(result.slides![0].title).toBe('编辑后的标题')
    expect(base.slides![0].title).toBe('标题')
  })
  it('已有长文示例的每一页在三套风格下均可排版', async () => {
    for (const article of SAMPLE_ARTICLES) {
      const result = await compileArticle(article.markdown, 'xiaohongshu')
      for (const style of ['editorial', 'notes', 'signal'] as const) for (const slide of result.slides!) expect(() => renderSlideSvg(slide, style, 'xiaohongshu')).not.toThrow()
    }
  })
})
