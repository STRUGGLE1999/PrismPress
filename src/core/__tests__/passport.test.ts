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

  it('极短文章如实提示不足，不编造经历补足字数', () => {
    const passport = generatePassport('# 短标题\n\n只有一句话。')
    expect(passport.summaries.juejin.length).toBeLessThan(50)
    expect(passport.summaries.juejin.compliant).toBe(false)
    expect(passport.summaries.juejin.text).not.toMatch(/踩坑|复盘|可复用经验/)
  })

  it('过滤以冒号结尾的半截引导句与泛化动词标签', () => {
    const passport = generatePassport(SAMPLE_ARTICLES[0].markdown)
    expect(passport.summaries.wechat.text).not.toContain('：。')
    expect(passport.summaries.wechat.text).not.toContain(':.')
    expect(passport.tags).not.toContain('能够')
  })
})

 describe('规则提取结构边界', () => {
  it('排除目录、引用式图片和长围栏中的内容', () => {
    const p = generatePassport('# 稳定摘要\n\n目录\n\n- [导航噪音导航噪音](#chapter)\n\n![图片噪音图片噪音][img]\n\n[img]: /a.png\n\n````md\n```js\n内部噪音内部噪音。\n```\n````\n\n这段正文介绍本地工具如何帮助创作者整理素材，保持发布内容准确。')
    expect(p.summaries.wechat.text).toContain('这段正文')
    expect(p.summaries.wechat.text).not.toMatch(/导航噪音|图片噪音|内部噪音/)
  })
  it('空稿不生成虚构摘要，超长单句仍可截取', () => {
    expect(generatePassport('').summaries.wechat.text).toBe('')
    const p = generatePassport('# 长文\n\n' + '正文内容'.repeat(100))
    expect(p.summaries.wechat.text).toContain('正文内容')
    expect(p.summaries.wechat.length).toBeLessThanOrEqual(120)
  })
})

it('excludes source title metadata and selects the article conclusion', () => {
  const p = generatePassport('# 工程决策\n\n> **英文原标题**：Original title\n> **副标题**：Subtitle.\n> **作者**：Someone\n\n这篇文章讨论工程决策如何处理系统过载，避免只追求速度。\n\n工程决策需要比较送达率与延迟。\n\n总结：工程决策必须明确失败方式，并通过文档、交叉审查和多指标验证系统行为。')
  expect(p.summaries.wechat.text).not.toMatch(/Original title|Subtitle|英文原标题|Someone/)
  expect(p.summaries.csdn.text).toContain('明确失败方式')
})

it('fits an overlong summary at a clause boundary instead of cutting a word', async () => {
  const { fitSummary, SUMMARY_RULES } = await import('../../../shared/summary-rules.mjs')
  const text = 'AI改变代码审查方式，工程师应检查架构决策和系统行为，使用交叉审查和多指标验证结果，而不是盲信单项测试分数。'.repeat(4)
  const fitted = fitSummary(text, SUMMARY_RULES.juejin)
  expect(Array.from(fitted).length).toBeLessThanOrEqual(100)
  expect(Array.from(fitted).length).toBeGreaterThanOrEqual(50)
  expect(fitted).toMatch(/[。！？]$/)
})
