import { createServer } from 'node:http'
import { parseArgs } from 'node:util'
import { createServer as createViteServer } from 'vite'
import cover from '../api/cover.mjs'
import passport from '../api/passport.mjs'
import image from '../api/image.mjs'
import uploadImage from '../api/upload-image.mjs'

try { process.loadEnvFile('.env.local') } catch (error) { if (error.code !== 'ENOENT') throw error }
const { values } = parseArgs({ options: { host: { type: 'string', default: '127.0.0.1' }, port: { type: 'string', default: '5173' } } })
const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' })
const server = createServer(async (req, res) => {
  const pathname = req.url?.split('?')[0]
  if (pathname === '/api/image') return image(req, res)
  if (pathname !== '/api/cover' && pathname !== '/api/passport' && pathname !== '/api/upload-image') return vite.middlewares(req, res)
  res.status = (status) => { res.statusCode = status; return res }
  res.json = (body) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); return res }
  try {
    const chunks = []; let bytes = 0
    for await (const chunk of req) {
      bytes += chunk.length
      if (bytes > (pathname === '/api/upload-image' ? 4300000 : 512000)) return res.status(413).json({ error: pathname === '/api/upload-image' ? '图片超过 3MB，请缩小后重试' : '文章过长，请缩短后重试' })
      chunks.push(chunk)
    }
    const body = Buffer.concat(chunks).toString()
    req.body = body ? JSON.parse(body) : {}
    await (pathname === '/api/upload-image' ? uploadImage(req, res) : pathname === '/api/passport' ? passport(req, res) : cover(req, res))
  } catch { if (!res.headersSent) res.status(400).json({ error: '请求格式错误' }) }
})
server.listen(Number(values.port), values.host, () => console.log(`PrismPress: http://${values.host}:${values.port}`))
