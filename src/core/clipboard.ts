import type { CompileResult } from './types'
import { waitForTask } from './waitForTask'

async function writeClipboard(task: Promise<void>): Promise<void> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new DOMException('timeout', 'TimeoutError')), 10000)
  try { await waitForTask(task, controller.signal, '剪贴板写入等待超时，请保持页面在前台并允许剪贴板权限后重试') }
  finally { clearTimeout(timer) }
}

function copyPlainViaSelection(text: string): void {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.left = '-99999px'
  document.body.appendChild(textarea)
  try {
    textarea.select()
    if (!document.execCommand('copy')) throw new Error('浏览器未能写入剪贴板')
  } finally {
    document.body.removeChild(textarea)
  }
}

function copyRichViaSelection(html: string): void {
  const holder = document.createElement('div')
  holder.contentEditable = 'true'
  holder.style.position = 'fixed'
  holder.style.left = '-99999px'
  holder.style.top = '0'
  holder.innerHTML = html
  document.body.appendChild(holder)

  let selection: Selection | null = null
  let copied = false
  try {
    selection = window.getSelection()
    const range = document.createRange()
    range.selectNodeContents(holder)
    selection?.removeAllRanges()
    selection?.addRange(range)
    copied = document.execCommand('copy')
  } catch {
    // Report refusal instead of silently dropping images and formatting.
  } finally {
    selection?.removeAllRanges()
    document.body.removeChild(holder)
  }
  if (!copied) throw new Error('富文本复制失败，请允许剪贴板权限后重试')
}

/**
 * 双协议剪贴板：
 * - 富文本平台写入 text/html（保留内联样式），同时带 text/plain 兜底
 * - Markdown 平台写入 text/plain
 */
export async function copyCompiledArticle(result: CompileResult): Promise<void> {
  if (result.format === 'markdown' || result.format === 'deck') {
    if (navigator.clipboard?.writeText) {
      await writeClipboard(navigator.clipboard.writeText(result.body))
      return
    }
    copyPlainViaSelection(result.body)
    return
  }

  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    const item = new ClipboardItem({
      'text/html': new Blob([result.body], { type: 'text/html' }),
      'text/plain': new Blob([result.plainText || result.body], { type: 'text/plain' }),
    })
    await writeClipboard(navigator.clipboard.write([item]))
    return
  }

  copyRichViaSelection(result.body)
}

export async function copyPlainText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await writeClipboard(navigator.clipboard.writeText(text))
    return
  }
  copyPlainViaSelection(text)
}
