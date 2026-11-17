import { afterEach, describe, expect, it, vi } from 'vitest'
import { copyCompiledArticle, copyPlainText } from '../clipboard'
import type { CompileResult } from '../types'

function fallbackBrowser(copyResults: boolean[]) {
  const attached = new Set<object>()
  const htmlWrites: string[] = []
  const selectedText: string[] = []
  const selection = { removeAllRanges: vi.fn(), addRange: vi.fn() }
  const document = {
    body: {
      appendChild: (node: object) => attached.add(node),
      removeChild: (node: object) => attached.delete(node),
    },
    createElement: () => ({
      style: {},
      contentEditable: '',
      value: '',
      set innerHTML(value: string) { htmlWrites.push(value) },
      select() { selectedText.push(this.value) },
    }),
    createRange: () => ({ selectNodeContents: vi.fn() }),
    execCommand: vi.fn(() => copyResults.shift() ?? false),
  }
  vi.stubGlobal('document', document)
  vi.stubGlobal('window', { getSelection: () => selection })
  vi.stubGlobal('navigator', {})
  vi.stubGlobal('ClipboardItem', undefined)
  return { attached, htmlWrites, selectedText, document }
}

function article(format: 'html' | 'markdown', body: string, plainText = body): CompileResult {
  return { format, body, plainText } as CompileResult
}

afterEach(() => vi.unstubAllGlobals())

describe('clipboard fallback', () => {
  it('copies literal plain text through a textarea without parsing HTML', async () => {
    const browser = fallbackBrowser([true])
    const text = '<img src=x onerror="alert(1)"> & Markdown **正文**'
    await copyPlainText(text)
    expect(browser.htmlWrites).toEqual([])
    expect(browser.selectedText).toEqual([text])
    expect(browser.attached.size).toBe(0)
  })

  it('keeps Markdown source literal when modern clipboard is absent', async () => {
    const browser = fallbackBrowser([true])
    const text = '# 标题\n\n<div>原始 HTML</div>'
    await copyCompiledArticle(article('markdown', text))
    expect(browser.htmlWrites).toEqual([])
    expect(browser.selectedText).toEqual([text])
  })

  it('rejects if both rich selection and plain fallback are refused', async () => {
    const browser = fallbackBrowser([false, false])
    await expect(copyCompiledArticle(article('html', '<p>正文</p>', '正文'))).rejects.toThrow()
    expect(browser.attached.size).toBe(0)
  })

  it('falls back to literal plain text when rich copying is refused', async () => {
    const browser = fallbackBrowser([false, true])
    await copyCompiledArticle(article('html', '<p>正文</p>', '正文 <原样>'))
    expect(browser.selectedText).toEqual(['正文 <原样>'])
    expect(browser.attached.size).toBe(0)
  })

  it('rejects plain-text refusal and removes its temporary element on exceptions', async () => {
    const browser = fallbackBrowser([false])
    await expect(copyPlainText('正文')).rejects.toThrow()
    expect(browser.attached.size).toBe(0)
    browser.document.execCommand.mockImplementation(() => { throw new Error('copy denied') })
    await expect(copyPlainText('正文')).rejects.toThrow('copy denied')
    expect(browser.attached.size).toBe(0)
  })

  it('keeps the modern plain-text API path unchanged', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    await copyPlainText('正文')
    expect(writeText).toHaveBeenCalledWith('正文')
  })
})
