import { createHash } from 'node:crypto'

const jobs = new Map()

const chars = (value) => Array.from(String(value ?? '')).length
const slice = (value, max) => Array.from(String(value ?? '').replace(/\s+/g, ' ').trim()).slice(0, max).join('')

async function generate(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: '请使用 POST 请求' })
  }

  const key = process.env.OPENAI_API_KEY
  if (!key) {
    return res.status(503).json({ error: '尚未配置 OPENAI_API_KEY，请在 .env.local 或服务端环境变量中填写密钥' })
  }

  const { title = '', article = '' } = req.body ?? {}
  if (typeof article !== 'string' || !article.trim() || article.length > 100000) {
    return res.status(400).json({ error: '请提供有效的文章正文（最多 10 万字）' })
  }

  const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.aicodemirror.ai')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/v1$/, '')
  const model = (process.env.OPENAI_MODEL || 'gpt-6.1-sol').trim()
  const excerpt = article
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/data:[^\s)]+/g, '')
    .slice(0, 14000)

  const systemPrompt = [
    '你是资深中文科技与新媒体主编。请根据用户提供的文章标题与正文，提炼多平台发布资料，只输出合法 JSON 对象，不要输出 Markdown 代码块或多余解释。',
    'JSON 字段要求：',
    '- title: 文章主标题（不超过 64 字）',
    '- shortTitle20: 适合小红书/抖音的吸睛短标题（严格不超过 19 个字）',
    '- summaries: { wechat: "公众号摘要，精炼有吸引力，严格不超过 115 字", juejin: "掘金技术摘要，严格在 55 到 95 字之间", csdn: "CSDN 摘要，概括核心痛点与收获，严格不超过 240 字" }',
    '- bilibiliSummary: "课代表省流：..." 格式的 B 站评论区总结（不超过 95 字）',
    '- tags: 包含 5 到 6 个高价值专业名词或核心主题词的字符串数组（不要“能够”“等级”“很多”这类泛化动词或虚词）',
    '- category: { juejin: "从[前端,后端,人工智能,Android,iOS,开发工具,代码人生,阅读]中选一", generic: "通用分类名，如 人工智能与算法 / 前端开发 / 职场与商业思考" }',
  ].join('\n')

  try {
    const upstream = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        max_completion_tokens: 1600,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify({ title: String(title).slice(0, 200), article: excerpt }) },
        ],
      }),
      signal: AbortSignal.timeout(60000),
    })

    if (!upstream.ok) {
      const message =
        upstream.status === 401
          ? '大模型 API 密钥无效，请检查 OPENAI_API_KEY'
          : upstream.status === 404 || upstream.status === 503
            ? `模型 ${model} 或接口线路不可用，请检查 OPENAI_BASE_URL 与模型名称`
            : upstream.status === 429
              ? '大模型服务繁忙或额度不足，请稍后重试'
              : `大模型服务返回错误（HTTP ${upstream.status}）`
      return res.status(502).json({ error: message })
    }

    const data = await upstream.json()
    const rawContent = String(data.choices?.[0]?.message?.content ?? '').trim()
    const jsonText = rawContent.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    const parsed = JSON.parse(jsonText)
    if (!parsed || typeof parsed.title !== 'string' || !parsed.title.trim() || !Array.isArray(parsed.tags) || !parsed.tags.every((tag) => typeof tag === 'string') || !parsed.summaries || !['wechat', 'juejin', 'csdn'].every((name) => typeof parsed.summaries[name] === 'string') || !parsed.category || typeof parsed.category.juejin !== 'string' || typeof parsed.category.generic !== 'string') throw new Error('invalid passport')

    const tags = Array.isArray(parsed.tags)
      ? parsed.tags.map((item) => slice(String(item).replace(/^#+/, ''), 16)).filter(Boolean).slice(0, 6)
      : []

    let juejinText = slice(parsed.summaries?.juejin || parsed.summaries?.wechat || '', 98)
    if (chars(juejinText) > 0 && chars(juejinText) < 50) {
      juejinText = slice(`${juejinText} 本文结合具体场景梳理了核心思路、关键步骤与实践经验，供开发者参考。`, 98)
    }

    return res.status(200).json({
      title: slice(parsed.title || title, 64),
      shortTitle20: slice(parsed.shortTitle20 || parsed.title || title, 19),
      tags,
      bilibiliSummary: slice(parsed.bilibiliSummary || `课代表省流：${parsed.summaries?.wechat || ''}`, 98),
      summaries: {
        wechat: slice(parsed.summaries?.wechat || '', 118),
        juejin: juejinText,
        csdn: slice(parsed.summaries?.csdn || parsed.summaries?.wechat || '', 250),
      },
      category: {
        juejin: slice(parsed.category?.juejin || '人工智能', 16),
        generic: slice(parsed.category?.generic || '人工智能与算法', 24),
      },
    })
  } catch {
    return res.status(502).json({ error: '未能完成 AI 摘要提炼（超时或响应格式异常），请稍后重试' })
  }
}

// Coalesce simultaneous identical requests within one function instance. Edge rate limiting
// remains necessary across instances; no completed response or article is retained here.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  const { article, title = '' } = req.body ?? {}
  if (req.method !== 'POST' || !process.env.OPENAI_API_KEY || typeof article !== 'string' || !article.trim() || article.length > 100000 || typeof title !== 'string') return generate(req, res)
  const key = createHash('sha256').update(JSON.stringify([title, article])).digest('hex')
  let task = jobs.get(key)
  if (!task) {
    const captured = { code: 200, body: undefined, setHeader() {}, status(code) { this.code = code; return this }, json(body) { this.body = body; return this } }
    task = generate(req, captured).then(() => ({ code: captured.code, body: captured.body }))
    jobs.set(key, task)
    void task.finally(() => jobs.delete(key)).catch(() => {})
  }
  const result = await task
  return res.status(result.code).json(result.body)
}
