import type { ImageFinding, ImageHealth, ImageReport } from '../types'
import type { RawImage } from '../markdown/document'

interface DomainRule {
  domain: string
  label: string
}

/** 平台私有图床：跨平台复制后大概率触发 Referer 防盗链 403 */
const HOTLINK_DOMAINS: DomainRule[] = [
  { domain: 'csdnimg.cn', label: 'CSDN 私有图床' },
  { domain: 'mmbiz.qpic.cn', label: '微信公众号图床' },
  { domain: 'mmbiz.qlogo.cn', label: '微信公众号图床' },
  { domain: 'zhimg.com', label: '知乎私有图床' },
  { domain: 'hdslb.com', label: 'B 站私有图床' },
  { domain: 'byteimg.com', label: '掘金私有图床' },
  { domain: 'cnblogs.com', label: '博客园私有图床' },
  { domain: '51cto.com', label: '51CTO 私有图床' },
  { domain: 'sinaimg.cn', label: '新浪图床（存在防盗链）' },
]

/** 公认无防盗链的公开 CDN / 图床 */
const PUBLIC_DOMAINS: DomainRule[] = [
  { domain: 'r2.dev', label: 'Cloudflare R2 公开桶' },
  { domain: 'r2.cloudflarestorage.com', label: 'Cloudflare R2' },
  { domain: 'jsdelivr.net', label: 'jsDelivr CDN' },
  { domain: 'githubusercontent.com', label: 'GitHub 静态资源' },
  { domain: 'aliyuncs.com', label: '阿里云 OSS' },
  { domain: 'myqcloud.com', label: '腾讯云 COS' },
  { domain: 'qiniucdn.com', label: '七牛云 CDN' },
  { domain: 'qiniu.com', label: '七牛云' },
  { domain: 'bcebos.com', label: '百度云 BOS' },
  { domain: 'upyun.com', label: '又拍云' },
  { domain: 'cloudinary.com', label: 'Cloudinary' },
  { domain: 'imagekit.io', label: 'ImageKit' },
  { domain: 'imgix.net', label: 'imgix' },
  { domain: 'unsplash.com', label: 'Unsplash' },
  { domain: 'pexels.com', label: 'Pexels' },
  { domain: 'sm.ms', label: 'SM.MS' },
  { domain: 'imgur.com', label: 'Imgur' },
  { domain: 'gitee.com', label: 'Gitee 静态资源' },
]

const IMG_TAG = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi
const ALT_ATTR = /\balt\s*=\s*["']([^"']*)["']/i

function matchDomain(host: string, rules: DomainRule[]): DomainRule | undefined {
  return rules.find((rule) => host === rule.domain || host.endsWith(`.${rule.domain}`))
}

function parseHost(url: string): string | null {
  try {
    const normalized = url.startsWith('//') ? `https:${url}` : url
    return new URL(normalized).hostname.toLowerCase()
  } catch {
    return null
  }
}

function isLocalPath(url: string): boolean {
  if (/^[a-zA-Z]:[\\/]/.test(url)) return true
  if (/^file:\/\//i.test(url)) return true
  if (/^\.{0,2}\//.test(url) || url.startsWith('../')) return true
  // 没有协议、但不是 // 开头的裸路径，如 assets/cover.png
  return !/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(url) && !url.startsWith('//')
}

export function classifyImage(url: string): { health: ImageHealth; reason: string; host: string | null } {
  const trimmed = url.trim()
  if (!trimmed) {
    return { health: 'red', reason: '图片地址为空，无法加载', host: null }
  }

  if (/^data:image\//i.test(trimmed)) {
    return { health: 'green', reason: '内联 Data URI，随正文一起复制，不依赖图床', host: null }
  }

  if (/^blob:/i.test(trimmed)) {
    return { health: 'red', reason: '浏览器临时 Blob 地址，关闭页面即失效，平台无法访问', host: null }
  }

  if (isLocalPath(trimmed)) {
    return {
      health: 'red',
      reason: '本地相对路径，目标平台可能无法访问，建议先转成公开 HTTPS 链接',
      host: null,
    }
  }

  const host = parseHost(trimmed)
  if (!host) {
    return { health: 'red', reason: '无法解析的图片地址，请检查协议与域名', host: null }
  }

  if (/^http:\/\//i.test(trimmed)) {
    return { health: 'yellow', reason: '非 HTTPS 链接，部分平台会按混合内容拦截', host }
  }

  const hotlink = matchDomain(host, HOTLINK_DOMAINS)
  if (hotlink) {
    return {
      health: 'yellow',
      reason: `${hotlink.label}，跨平台复制极易触发 Referer 防盗链 403`,
      host,
    }
  }

  const publicCdn = matchDomain(host, PUBLIC_DOMAINS)
  if (publicCdn) {
    return { health: 'green', reason: `${publicCdn.label}，公开直链，多数平台可直接引用`, host }
  }

  return {
    health: 'green',
    reason: '公开 HTTPS 链接（未命中已知防盗链域名，建议发布前实测一次）',
    host,
  }
}

function scanHtmlImages(markdown: string): RawImage[] {
  const found: RawImage[] = []
  const lines = markdown.split(/\r?\n/)
  lines.forEach((line, index) => {
    if (!line.includes('<img')) return
    IMG_TAG.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = IMG_TAG.exec(line)) !== null) {
      const alt = match[0].match(ALT_ATTR)?.[1] ?? ''
      found.push({ url: match[1], alt, line: index + 1 })
    }
  })
  return found
}

/**
 * 三色图片体检雷达
 * 🟢 畅通公开外链 / 🟡 平台防盗链 403 高危 / 🔴 本地相对路径
 */
export function scanImages(images: RawImage[], markdown = ''): ImageReport {
  const all = markdown ? [...images, ...scanHtmlImages(markdown)] : images
  const seen = new Set<string>()
  const findings: ImageFinding[] = []

  for (const image of all) {
    const key = `${image.line}:${image.url}`
    if (seen.has(key)) continue
    seen.add(key)
    const verdict = classifyImage(image.url)
    findings.push({
      url: image.url,
      alt: image.alt,
      line: image.line,
      health: verdict.health,
      reason: verdict.reason,
      host: verdict.host,
    })
  }

  findings.sort((a, b) => a.line - b.line)

  const counts = { green: 0, yellow: 0, red: 0 }
  for (const finding of findings) counts[finding.health] += 1

  return {
    findings,
    total: findings.length,
    ...counts,
    healthy: counts.yellow === 0 && counts.red === 0,
  }
}

/** Mark already loaded pictures without parsing their encoded bytes as Markdown. */
export function resolveImageReport(report: ImageReport, sources: Record<string, string>): ImageReport {
  const findings = report.findings.map((item) => {
    const source = sources[item.url]
    if (!source) return item
    const status = classifyImage(source)
    return { ...item, ...status, reason: source.startsWith('data:image/') ? '本地图片已读取；复制后请确认目标平台转存结果' : status.reason }
  })
  return { ...report, findings, green: findings.filter((item) => item.health === 'green').length,
    yellow: findings.filter((item) => item.health === 'yellow').length, red: findings.filter((item) => item.health === 'red').length }
}
