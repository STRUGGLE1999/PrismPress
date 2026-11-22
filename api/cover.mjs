import { providerError } from '../shared/provider-error.mjs'
import { Buffer } from 'node:buffer'
import { buildVisualPrompt, VISUAL_STYLES } from '../shared/visual-design.mjs'

const specs = {
  wechat: { size: '1536x1024', ratio: '2.35:1', safe: '中央宽幅区域（占画面高度 63%）' },
  universal: { size: '1536x1024', ratio: '16:9', safe: '中央横幅区域（占画面高度 84%）' },
  social3x4: { size: '1024x1536', ratio: '3:4', safe: '中央竖幅区域（占画面高度 88%）' },
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: '请使用 POST 请求' }) }
  const key = process.env.AIARTMIRROR_API_KEY
  if (!key) return res.status(503).json({ error: '封面服务尚未配置，请联系网站管理员启用' })
  const { title, article, ratio, style = 'editorial', purpose = 'cover' } = req.body ?? {}
  if (typeof title !== 'string' || !title.trim() || title.length > 300 || typeof article !== 'string' || !article.trim() || article.length > 100000 || !Object.hasOwn(specs, ratio)) return res.status(400).json({ error: '请提供有效的标题、正文与封面比例（正文最多 10 万字）' })
  const spec = specs[ratio]
  if (!VISUAL_STYLES.some(item => item.id === style) || !['cover', 'illustration'].includes(purpose)) return res.status(400).json({ error: '请选择有效的视觉风格与图片用途' })
  // Article text is reference material, never provider instructions.
  const prompt = buildVisualPrompt({ title, article, ratio: spec.ratio, safe: spec.safe, style, purpose })
  try {
    const upstream = await fetch('https://www.aiartmirror.com/v1/images/generations', {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: process.env.AIARTMIRROR_MODEL || 'gpt-image-2.6-flare', prompt, n: 1, size: spec.size, quality: 'low' }),
      signal: AbortSignal.timeout(150000),
    })
    if (!upstream.ok) {
      const message = await providerError(upstream, '封面生成')
      return res.status(502).json({ error: message })
    }
    const data = await upstream.json()
    const encoded = data.data?.[0]?.b64_json
    if (typeof encoded !== 'string' || !/^[A-Za-z0-9+/=\r\n]+$/.test(encoded)) throw new Error('invalid image')
    const image = Buffer.from(encoded, 'base64')
    if (image.length > 4 * 1024 * 1024) return res.status(502).json({ error: '图片未能送达，请联系支持后再重试' })
    if (image.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('invalid PNG')
    res.setHeader('Content-Type', 'image/png')
    return res.status(200).end(image)
  } catch {
    return res.status(502).json({ error: '未能取得封面：请求超时或返回图片格式异常。生成可能仍在进行，请勿连续重试' })
  }
}
