import { lookup } from 'node:dns/promises'
import { get } from 'node:https'
import ipaddr from 'ipaddr.js'

const MAX_BYTES = 4 * 1024 * 1024

async function readPublicImage(address, redirects = 0, deadline = Date.now() + 45000) {
  const budget = cap => {
    const remaining = deadline - Date.now()
    if (remaining <= 0) throw new Error('image timeout')
    return Math.min(cap, remaining)
  }
  const url = new URL(address)
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || redirects > 3) throw new Error('invalid destination')
  const hostname = url.hostname.replace(/^\[|\]$/g, '')
  if (ipaddr.isValid(hostname) && ipaddr.process(hostname).range() !== 'unicast') throw new Error('private address')
  let dnsTimer
  let addresses
  try {
    addresses = await Promise.race([lookup(hostname, { all: true }), new Promise((_, reject) => { dnsTimer = setTimeout(() => reject(new Error('DNS timeout')), budget(5000)) })])
  } finally { clearTimeout(dnsTimer) }
  // Some local proxy DNS modes return benchmark addresses. Resolve those via a
  // fixed public resolver, then still connect only to the validated public IP.
  if (addresses.length && addresses.every(item => ipaddr.parse(item.address).kind() === 'ipv4' && ipaddr.parse(item.address).match(ipaddr.parseCIDR('198.18.0.0/15')))) {
    const answer = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=A`, { headers: { Accept: 'application/dns-json' }, signal: AbortSignal.timeout(budget(8000)) })
    if (!answer.ok) throw new Error('DNS lookup failed')
    const data = await answer.json()
    addresses = (data.Answer ?? []).filter(record => record.type === 1).map(record => ({ address: record.data, family: 4 }))
  }
  if (!addresses.length || addresses.some(item => ipaddr.process(item.address).range() !== 'unicast')) throw new Error('private destination')
  const selected = addresses[0]
  const timeoutMs = budget(12000)
  return new Promise((resolve, reject) => {
    // Pin the validated DNS answer to the connection; validate every redirect separately.
    const request = get(url, { family: selected.family, lookup: (_host, _options, callback) => callback(null, selected.address, selected.family), headers: { Accept: 'image/png,image/jpeg,image/webp,image/gif,image/avif' } }, response => {
      const status = response.statusCode ?? 500
      if (status >= 300 && status < 400 && response.headers.location) {
        response.destroy()
        try { readPublicImage(new URL(response.headers.location, url).href, redirects + 1, deadline).then(resolve, reject) }
        catch (error) { reject(error) }
        return
      }
      const type = String(response.headers['content-type'] ?? '').split(';')[0].toLowerCase()
      if (status !== 200 || !/^image\/(?:png|jpeg|webp|gif|avif)$/.test(type) || Number(response.headers['content-length'] ?? 0) > MAX_BYTES) { response.destroy(); reject(new Error('invalid image response')); return }
      const chunks = []
      let bytes = 0
      response.on('data', chunk => {
        bytes += chunk.length
        if (bytes > MAX_BYTES) { response.destroy(new Error('image too large')); return }
        chunks.push(chunk)
      })
      response.on('error', reject)
      response.on('end', () => resolve({ type, bytes: Buffer.concat(chunks) }))
    })
    const timeout = setTimeout(() => request.destroy(new Error('image timeout')), timeoutMs)
    request.on('close', () => clearTimeout(timeout))
    request.on('error', reject)
  })
}

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); res.statusCode = 405; return res.end() }
  try {
    const url = new URL(req.url, 'https://prismpress.local').searchParams.get('url')
    if (!url || url.length > 4096) throw new Error('invalid URL')
    const result = await readPublicImage(url)
    res.setHeader('Content-Type', result.type)
    res.setHeader('Cache-Control', 'private, max-age=300')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.statusCode = 200
    return res.end(result.bytes)
  } catch {
    res.setHeader('Cache-Control', 'no-store')
    res.statusCode = 422
    return res.end('Image could not be loaded from a public HTTPS address.')
  }
}
