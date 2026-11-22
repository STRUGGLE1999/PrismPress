import { describe, expect, it } from 'vitest'
import { sanitizeMarkdown } from '../sanitizer/sanitize'

describe('Auto-Sanitizer', () => {
  it('repairs Chinese quoted bold without modifying code or escaped markers', () => {
    const source = '永远是**“重点”**。\n\n`**“代码”**`\n\n```md\n**“代码块”**\n```\n\n    **“缩进代码”**\n\n\\**“原样”**'
    const result = sanitizeMarkdown(source)
    expect(result.output).toContain('永远是“**重点**”。')
    expect(result.output).toContain('`**“代码”**`')
    expect(result.output).toContain('```md\n**“代码块”**\n```')
    expect(result.output).toContain('    **“缩进代码”**')
    expect(result.output).toContain('\\**“原样”**')
    expect(result.counts.find(item => item.rule === 'quoted-bold')?.count).toBe(1)
  })
  it('修复标题缺空格，并跳过代码块', () => {
    const input = ['##一、背景', '', '```md', '##代码块内保持原样', '```', '', '###三级标题'].join('\n')
    const report = sanitizeMarkdown(input)
    expect(report.output).toContain('## 一、背景')
    expect(report.output).toContain('### 三级标题')
    expect(report.output).toContain('##代码块内保持原样')
    expect(report.counts.find((item) => item.rule === 'heading-space')?.count).toBe(2)
  })

  it('剥离标题内部的冗余加粗', () => {
    const report = sanitizeMarkdown('## **核心结论**\n\n### __另一个标题__')
    expect(report.output).toContain('## 核心结论')
    expect(report.output).toContain('### 另一个标题')
    expect(report.output).not.toContain('**')
    expect(report.output).not.toContain('__')
  })

  it('收紧行内公式空格，但不误伤货币金额', () => {
    const report = sanitizeMarkdown('公式 $ f(x) = x^2 $ 很重要。\n\n一杯咖啡 $ 5 美元。')
    expect(report.output).toContain('$f(x) = x^2$')
    expect(report.output).toContain('$ 5 美元')
  })

  it('让夹在段落中的块级公式独立成段', () => {
    const report = sanitizeMarkdown('排序公式$$ score = a + b $$其中 alpha 与 beta 为权重。')
    expect(report.output.split('\n')).toEqual([
      '排序公式',
      '',
      '$$score = a + b$$',
      '',
      '其中 alpha 与 beta 为权重。',
    ])
    expect(report.counts.find((item) => item.rule === 'block-math-spacing')?.count).toBe(1)
  })

  it('为多行块级公式补齐前后空行', () => {
    const report = sanitizeMarkdown('前置段落\n$$\na = b\n$$\n后置段落')
    expect(report.output).toBe('前置段落\n\n$$\na = b\n$$\n\n后置段落')
  })

  it('清除零宽字符并报告数量', () => {
    const report = sanitizeMarkdown('标\u200b题\ufeff测试\u200c')
    expect(report.output).toBe('标题测试')
    expect(report.counts.find((item) => item.rule === 'zero-width')?.count).toBe(3)
  })

  it('净水结果幂等', () => {
    const first = sanitizeMarkdown('##标题\n\n$ x $ 与 $$a=b$$ 混排').output
    const second = sanitizeMarkdown(first)
    expect(second.output).toBe(first)
    expect(second.changed).toBe(false)
  })

  it('输出净水行号到原始源码的映射', () => {
    const report = sanitizeMarkdown('前文\n$$\na = b\n$$\n后文')
    expect(report.lineMap).toEqual([1, 2, 2, 3, 4, 4, 5])
  })
})
