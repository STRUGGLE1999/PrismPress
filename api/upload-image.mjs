import { put } from '@vercel/blob'
import { createHash } from 'node:crypto'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return res.status(405).json({ error: '请使用 POST 请求' })
  if (!process.env.BLOB_READ_WRITE_TOKEN) return res.status(503).json({ error: '站内图片托管尚未配置，请联系网站管理员' })
  const match = /^data:image\/(png|jpeg|gif|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(req.body?.dataUrl ?? '')
  if (!match || match[2].length > 4 * 1024 * 1024) return res.status(400).json({ error: '请使用不超过 3MB 的 PNG、JPEG、GIF 或 WebP 图片' })
  const bytes = Buffer.from(match[2], 'base64')
  const kind = match[1]
  const valid = kind === 'png' ? bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a'
    : kind === 'jpeg' ? bytes.subarray(0, 3).toString('hex') === 'ffd8ff'
    : kind === 'gif' ? /^GIF8[79]a$/.test(bytes.subarray(0, 6).toString())
    : bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP'
  if (!valid || !bytes.length || bytes.length > 3 * 1024 * 1024) return res.status(400).json({ error: '图片格式或大小不符合要求' })
  try {
    const hash = createHash('sha256').update(bytes).digest('hex')
    const blob = await put(`article-images/${hash}.${kind}`, bytes, {
      access: 'public', contentType: `image/${kind}`, addRandomSuffix: false, allowOverwrite: true,
    })
    return res.status(200).json({ url: blob.url })
  } catch { return res.status(502).json({ error: '图片托管失败，原图已保留，请稍后重试' }) }
}
