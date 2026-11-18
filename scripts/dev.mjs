import { createServer } from 'node:http'
import { parseArgs } from 'node:util'
import { createServer as createViteServer } from 'vite'
import cover from '../api/cover.mjs'

try { process.loadEnvFile('.env.local') } catch (error) { if (error.code !== 'ENOENT') throw error }
const { values } = parseArgs({ options: { host: { type: 'string', default: '127.0.0.1' }, port: { type: 'string', default: '5173' } } })
const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' })
const server = createServer(async (req, res) => {
  if (req.url?.split('?')[0] !== '/api/cover') return vite.middlewares(req, res)
  res.status = (status) => { res.statusCode = status; return res }
  res.json = (body) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); return res }
  try {
    const chunks = []; let bytes = 0
    for await (const chunk of req) {
      bytes += chunk.length
      if (bytes > 512000) return res.status(413).json({ error: '文章过长，请缩短后重试' })
      chunks.push(chunk)
    }
    const body = Buffer.concat(chunks).toString()
    req.body = body ? JSON.parse(body) : {}
    await cover(req, res)
  } catch { if (!res.headersSent) res.status(400).json({ error: '请求格式错误' }) }
})
server.listen(Number(values.port), values.host, () => console.log(`PrismPress: http://${values.host}:${values.port}`))
