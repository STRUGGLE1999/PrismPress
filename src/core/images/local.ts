export interface CompressedImage {
  dataUrl: string
  width: number
  height: number
  bytes: number
  mime: string
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('读取图片失败'))
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('图片解码失败'))
    image.src = src
  })
}

/**
 * 前端免配置图片内联：FileReader + Canvas 等比压缩。
 * 生成 data URI 后直接替换 Markdown 中的相对路径，七端预览/复制立即可见。
 */
export async function compressImageToDataUrl(
  file: File,
  options: { maxWidth?: number; maxHeight?: number; quality?: number } = {},
): Promise<CompressedImage> {
  const maxWidth = options.maxWidth ?? 1400
  const maxHeight = options.maxHeight ?? 2600
  const quality = options.quality ?? 0.84
  const original = await readAsDataUrl(file)
  const image = await loadImage(original)
  const scale = Math.min(1, maxWidth / Math.max(1, image.naturalWidth), maxHeight / Math.max(1, image.naturalHeight))
  const width = Math.max(1, Math.round(image.naturalWidth * scale))
  const height = Math.max(1, Math.round(image.naturalHeight * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('当前浏览器不支持 Canvas')

  const keepPng = file.type === 'image/png' && file.size < 1_200_000
  if (!keepPng) {
    context.fillStyle = '#FFFFFF'
    context.fillRect(0, 0, width, height)
  }
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, 0, 0, width, height)

  const mime = keepPng ? 'image/png' : 'image/jpeg'
  const dataUrl = canvas.toDataURL(mime, keepPng ? undefined : quality)
  return {
    dataUrl,
    width,
    height,
    bytes: Math.round((dataUrl.length * 3) / 4),
    mime,
  }
}

function baseName(path: string): string {
  const parts = path.split(/[\\/]/)
  return parts[parts.length - 1] ?? path
}

/**
 * 将 Markdown / 内嵌 HTML 中引用该文件名的图片地址替换为新的 URL 或 data URI。
 */
export function replaceImageReference(markdown: string, fileName: string, nextUrl: string): string {
  const target = baseName(fileName)

  const nextMarkdown = markdown.replace(
    /(!\[[^\]]*\]\()(\S+?)(\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?(\))/g,
    (whole, prefix: string, src: string, title: string | undefined, suffix: string) => {
      let decoded = src
      try {
        decoded = decodeURI(src)
      } catch {
        decoded = src
      }
      if (baseName(decoded) !== target) return whole
      return `${prefix}${nextUrl}${title ?? ''}${suffix}`
    },
  )

  return nextMarkdown.replace(
    /(<img\b[^>]*\bsrc\s*=\s*["'])([^"']+)(["'])/gi,
    (whole, prefix: string, src: string, suffix: string) => {
      let decoded = src
      try {
        decoded = decodeURI(src)
      } catch {
        decoded = src
      }
      if (baseName(decoded) !== target) return whole
      return `${prefix}${nextUrl}${suffix}`
    },
  )
}
