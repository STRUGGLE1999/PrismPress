import { describe, expect, it } from 'vitest'
import { buildVisualPrompt, VISUAL_STYLES } from '../../../shared/visual-design.mjs'

describe('standalone visual design', () => {
  it('locks the selected style but takes the subject from the article', () => {
    const prompt = buildVisualPrompt({ title: '检索评估', article: '公开样例的召回率比较', ratio: '3:4', safe: '中央区域', style: 'notes' })
    expect(prompt).toContain('公开样例的召回率比较')
    expect(prompt).toContain('手绘')
    expect(prompt).toContain('3:4')
    expect(prompt).not.toMatch(/\.codex|EXTEND\.md|bun /)
    expect(VISUAL_STYLES.map(s => s.id)).toEqual(['brief', 'editorial', 'notes', 'signal'])
  })
  it('illustration mode requests a text-free image, not generated card typography', () => {
    expect(buildVisualPrompt({ title: '步骤', article: '正文', ratio: '3:4', safe: '中央区域', style: 'editorial', purpose: 'illustration' })).toContain('不要任何文字')
  })
})
