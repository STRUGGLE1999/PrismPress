/** Shared generation limits; minimums are editorial targets unless explicitly verified. */
export const SUMMARY_RULES = {
  wechat: { key: 'wechat', label: '微信公众号', min: 0, max: 120, note: '摘要不超过120字' },
  juejin: { key: 'juejin', label: '掘金', min: 50, max: 100, note: '摘要上限100字，建议50～100字' },
  csdn: { key: 'csdn', label: 'CSDN', min: 0, max: 256, note: '纯文本摘要不超过256字' },
  douyin: { key: 'douyin', label: '抖音', min: 0, max: 30, note: '文章摘要不超过30字' },
}

/** Prefer a complete clause when a model response reaches or exceeds the limit. */
export function fitSummary(value, rule) {
  const chars = Array.from(String(value ?? '').replace(/\s+/g, ' ').trim())
  if (chars.length < rule.max || (chars.length === rule.max && /[。！？.!?]$/.test(chars.join('')))) return chars.join('')
  const head = chars.slice(0, rule.max)
  const end = head.findLastIndex(char => '。！？；，;,.!?'.includes(char))
  if (end >= Math.max(rule.min - 1, Math.floor(rule.max * 0.55))) {
    const clause = head.slice(0, end + 1).join('')
    return clause.replace(/[；，;,]$/, '。')
  }
  return `${head.slice(0, rule.max - 1).join('')}…`
}
