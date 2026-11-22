import { SUMMARY_RULES, fitSummary } from '../../shared/summary-rules.mjs'
import type { MetadataPassport } from '@/core'
import { imageChangeKey } from './imageWorkspace'

export type AiPassport = Pick<MetadataPassport, 'title' | 'shortTitle20' | 'tags' | 'bilibiliSummary' | 'category'> & {
  summaries: Record<'wechat' | 'juejin' | 'csdn' | 'douyin', string>
}
function isAiPassport(value: unknown): value is AiPassport {
  if (!value || typeof value !== 'object') return false
  const item = value as AiPassport
  return typeof item.title === 'string' && typeof item.shortTitle20 === 'string' && typeof item.bilibiliSummary === 'string'
    && Array.isArray(item.tags) && item.tags.every((tag) => typeof tag === 'string')
    && Boolean(item.summaries) && ['wechat', 'juejin', 'csdn', 'douyin'].every((key) => typeof item.summaries[key as keyof AiPassport['summaries']] === 'string')
    && Boolean(item.category) && typeof item.category.juejin === 'string' && typeof item.category.generic === 'string'
}
interface State { value?: AiPassport; loading: boolean; saved: boolean }
const emptyState: State = { loading: false, saved: true }
const states = new Map<string, State>()
const jobs = new Map<string, Promise<void>>()
const listeners = new Set<() => void>()
const storageKey = 'prismpress:ai-passport:v2'
export function subscribePassport(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } }
export function passportState(article: string): State {
  const key = imageChangeKey(article)
  if (!states.has(key)) {
    let value: AiPassport | undefined
    try { const cached = JSON.parse(localStorage.getItem(storageKey) || '{}')[key]; if (isAiPassport(cached)) value = cached } catch { /* Local storage may be unavailable. */ }
    if (!value) return emptyState
    states.set(key, { value, loading: false, saved: true })
  }
  return states.get(key)!
}
function update(article: string, next: State) {
  states.set(imageChangeKey(article), next)
  listeners.forEach((listener) => listener())
}
export function extractPassport(article: string, title: string): Promise<void> {
  const key = imageChangeKey(article)
  const pending = jobs.get(key)
  if (pending) return pending
  update(article, { ...passportState(article), loading: true })
  const task = (async () => {
    let next = passportState(article)
    try {
      const response = await fetch('/api/passport', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, article }),
      })
      const value = await response.json()
      if (!response.ok) throw new Error(value.error || 'AI 提炼暂不可用')
      if (!isAiPassport(value)) throw new Error('AI 返回的发布资料格式异常')
      let saved = true
      try {
        const cache = JSON.parse(localStorage.getItem(storageKey) || '{}')
        delete cache[key]
        const entries = Object.entries(cache).slice(-19)
        localStorage.setItem(storageKey, JSON.stringify(Object.fromEntries([...entries, [key, value]])))
      } catch { saved = false }
      next = { value, loading: false, saved }
    } finally {
      update(article, { ...next, loading: false })
      jobs.delete(key)
    }
  })()
  jobs.set(key, task)
  return task
}
export function applyAiPassport(base: MetadataPassport, value?: AiPassport): MetadataPassport {
  if (!value) return base
  const summaries = { ...base.summaries }
  for (const key of ['wechat', 'juejin', 'csdn', 'douyin'] as const) {
    const text = fitSummary(value.summaries[key] || base.summaries[key].text, SUMMARY_RULES[key])
    const length = Array.from(text).length
    summaries[key] = { ...base.summaries[key], text, length, compliant: length >= base.summaries[key].min && length <= base.summaries[key].max }
  }
  return { ...base, ...value, title: base.title, summaries, zhihuTopics: value.tags.slice(0, 3), tagsCsv: value.tags.join(', '), hashtags: value.tags.map((tag) => `#${tag}`).join(' ') }
}
