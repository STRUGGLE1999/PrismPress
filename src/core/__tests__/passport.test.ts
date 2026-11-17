import { describe, expect, it } from 'vitest'
import { generatePassport } from '../metadata/passport'
import { SAMPLE_ARTICLES } from '@/data/samples'

describe('免 API Key 发布护照', () => {
  it('为长文生成符合平台字数硬约束的摘要', () => {
    const passport = generatePassport(SAMPLE_ARTICLES[0].markdown)
    expect(passport.summaries.juejin.length).toBeGreaterThanOrEqual(50)
    expect(passport.summaries.juejin.length).toBeLessThanOrEqual(100)
    expect(passport.summaries.wechat.length).toBeLessThanOrEqual(120)
    expect(passport.summaries.csdn.length).toBeLessThanOrEqual(256)
    expect(passport.summaries.juejin.compliant).toBe(true)
    expect(passport.summaries.wechat.compliant).toBe(true)
  })

  it('摘要剔除 Markdown 符号与代码块内容', () => {
    const passport = generatePassport(SAMPLE_ARTICLES[0].markdown)
    const all = Object.values(passport.summaries)
      .map((item) => item.text)
      .join('')
    expect(all).not.toContain('#')
    expect(all).not.toContain('```')
    expect(all).not.toContain('const plan')
  })

  it('提取标签、知乎话题与 B 站省流总结', () => {
    const passport = generatePassport(SAMPLE_ARTICLES[0].markdown)
    expect(passport.keywords.length).toBeGreaterThanOrEqual(3)
    expect(passport.tagsCsv.split(',').length).toBeGreaterThanOrEqual(3)
    expect(passport.zhihuTopics).toHaveLength(3)
    expect(passport.bilibiliSummary.startsWith('课代表省流：')).toBe(true)
    expect(passport.category.juejin).toBe('人工智能')
    expect(Array.from(passport.shortTitle20).length).toBeLessThanOrEqual(20)
    expect(passport.hashtags).toContain('#')
  })

  it('极短文章也能补足掘金 50 字下限', () => {
    const passport = generatePassport('# 短标题\n\n只有一句话。')
    expect(passport.summaries.juejin.length).toBeGreaterThanOrEqual(50)
    expect(passport.summaries.juejin.length).toBeLessThanOrEqual(100)
  })
})
