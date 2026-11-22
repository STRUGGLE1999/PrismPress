import { validatePackage } from './package.mjs'
import { fillXhsDraft } from './adapter.mjs'
const file = document.querySelector('#file')
const button = document.querySelector('#fill')
const status = document.querySelector('#status')
let article
file.addEventListener('change', async () => {
  article = undefined
  button.disabled = true
  try {
    const selected = file.files[0]
    if (!selected || selected.size > 48 * 1024 * 1024) throw new Error('请选择不超过48MB的交接文件')
    article = validatePackage(JSON.parse(await selected.text()))
    document.querySelector('#summary').textContent = `${article.title} · ${article.parts.filter(part => part.kind === 'image').length} 张图片`
    status.textContent = '请确认当前是新的空白长文，再开始填入。'
    button.disabled = false
  } catch (error) { status.textContent = error.message }
})
button.addEventListener('click', async () => {
  button.disabled = true
  file.disabled = true
  status.textContent = '正在填入，请保持当前标签页和此窗口打开。'
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id || !tab.url?.startsWith('https://creator.xiaohongshu.com/')) throw new Error('请先打开小红书空白长文编辑器')
    const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, world: 'MAIN', func: fillXhsDraft, args: [article] })
    if (!result?.result?.message) throw new Error('未收到填入结果，请检查编辑页；不要重复导入')
    status.textContent = result.result.message
  } catch (error) { status.textContent = error.message }
  // Do not offer an immediate retry: a partial import must be reviewed first.
  file.disabled = false
})
