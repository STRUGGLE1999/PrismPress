import { describe, expect, it } from 'vitest'
import { compileArticle as compileRaw } from '../platforms/compile'
const compileArticle: typeof compileRaw = (source, platform, options = {}) => compileRaw(source, platform, { publicationMode: 'deck', ...options })
import { SAMPLE_ARTICLES } from '@/data/samples'
import { renderSlideSvg } from '../platforms/deck/render'

describe('核心图集默认方式', () => {
  it('短内容不强行补成6张，不加空目录或总结', async () => {
    const result = await compileArticle('# 一个建议\n\n先定义完成标准，再选择合适的工具。', 'xiaohongshu')
    expect(result.slides).toHaveLength(1)
    expect(result.slides![0].bullets).toContain('先定义完成标准，再选择合适的工具。')
    expect(result.body).toContain('先定义完成标准，再选择合适的工具。')
    expect(result.body).not.toMatch(/非全文|核心图集|20字内|按核心观点摘录/)
  })
  it('引用式原图不会进入无图模板', async () => {
    const result = await compileArticle('# 核心概览\n\n![架构总览][fig]\n\n[fig]: diagram.png', 'xiaohongshu')
    expect(result.slides!.every(slide => !slide.image)).toBe(true)
  })
  it('长文按核心主题组织，最多8张，三种风格均不会溢出', async () => {
    for (const sample of SAMPLE_ARTICLES) {
      const result = await compileArticle(sample.markdown, 'douyin')
      expect(result.slides!.length).toBeLessThanOrEqual(8)
      expect(result.slides!.length).toBeGreaterThanOrEqual(1)
      for (const slide of result.slides!) for (const style of ['editorial', 'notes', 'signal', 'brief'] as const) expect(() => renderSlideSvg(slide, style, 'douyin'), `${style}: ${slide.title}`).not.toThrow()
    }
  })
  it('正文填入漫画模板，不等待原图，三风格结构不同', async () => {
    const result = await compileArticle('# 交付方法\n\n## 实施步骤\n\n先定义标准，再逐步验证结果。\n\n![流程](flow.png)', 'xiaohongshu')
    expect(result.slides![0].image).toBeUndefined()
    expect(result.slides![0].bullets.length).toBeGreaterThan(0)
    const card = { ...result.slides![0], image: undefined }
    const notes = renderSlideSvg(card, 'notes', 'xiaohongshu')
    const signal = renderSlideSvg(card, 'signal', 'xiaohongshu')
    expect(notes).toContain('rotate(-4')
    expect(signal).toContain('#DFFD84')
    expect(notes).not.toContain('#DFFD84')
  })
  it('编辑封面或配图页增加段落后，渲染不会静默丢弃', async () => {
    const result = await compileArticle('# 核心阅读\n\n原始观点需要完整保留。', 'xiaohongshu')
    const base = result.slides![0]
    for (const style of ['editorial', 'notes', 'signal', 'brief'] as const) {
      expect(renderSlideSvg({ ...base, kind: 'cover', bullets: ['第一点', '第二点', '第三点', '第四点'] }, style, 'xiaohongshu')).toContain('第四点')
      expect(renderSlideSvg({ ...base, image: { src: 'photo.png', alt: '图' }, bullets: ['第一点', '第二点'] }, style, 'xiaohongshu')).toContain('第二点')
    }
  })
  it('更换文章和失效图片不引入远程图片或上篇内容', async () => {
    for (const platform of ['xiaohongshu', 'douyin'] as const) {
      const result = await compileArticle('# 周末的安排\n\n## 先休息一下\n\n给自己留下一段不被打扰的时间。\n\n![失效图](https://invalid.example/photo.png)', platform)
      expect(result.slides!.every(slide => !slide.image)).toBe(true)
      for (const style of ['editorial', 'notes', 'signal', 'brief'] as const) {
        const svg = renderSlideSvg(result.slides![0], style, platform)
        expect(svg).toContain('给自己留下一段不被打扰的时间。')
        expect(svg).not.toMatch(/<image|invalid.example|工程进阶/)
        if (style !== 'brief') expect(svg).toContain('viewBox="0 0 56 56"')
      }
    }
  })
  it('紫韵简报只提取视觉规则，不带入参考新闻、署名与水印', async () => {
    const result = await compileArticle('# 阅读方法\n\n## 每天读一点\n\n阅读建议：先选择感兴趣的主题，再记录一个发现。', 'xiaohongshu')
    const svg = renderSlideSvg(result.slides![0], 'brief', 'xiaohongshu')
    expect(svg).toContain('#F6F2FD')
    expect(svg).toContain('rx="32"')
    expect(svg).toContain('阅读建议：')
    expect(svg).not.toMatch(/APEC|大事追踪社|868402680|<image|viewBox="0 0 56 56"/)
  })
  it('发布文案保留完整标题和内容段落，不混入产品说明且控制字数', async () => {
    const title = '为什么忙了一天，仍然没有完成最重要的事情？'
    const source = `# ${title}\n\n` + Array.from({ length: 8 }, (_, index) => `## 第${index + 1}个实践方法\n\n${'先明确目标，再把行动拆成可以验证的小步骤。'.repeat(3)}`).join('\n\n')
    for (const platform of ['xiaohongshu', 'douyin'] as const) {
      const result = await compileArticle(source, platform)
      expect(result.body.startsWith(title + '\n\n')).toBe(true)
      expect(result.body).toContain('先明确目标')
      expect(result.body).not.toMatch(/20字内|非全文|核心图集|共 \d+ 张|发布前|按核心观点摘录/)
      expect(Array.from(result.body).length).toBeLessThanOrEqual(1000)
      expect(result.plainText).toBe(result.body)
    }
  })
  it('五级进阶主题不会只截取文章最前面的背景', async () => {
    const source = '# 工程进阶\n\n## 开场\n\n这是一段介绍背景的完整文字。\n\n' + Array.from({ length: 5 }, (_, i) => `## 等级 ${i + 1}\n\n第${i + 1}个等级强调可验证的能力建设。`).join('\n\n') + '\n\n## 方法清单\n\n先选择问题，然后设计可重复的评估。'
    const result = await compileArticle(source, 'xiaohongshu')
    for (let level = 1; level <= 5; level++) expect(result.slides!.some(slide => slide.title === `等级 ${level}`)).toBe(true)
    expect(result.slides!.length).toBeLessThanOrEqual(8)
  })
})
