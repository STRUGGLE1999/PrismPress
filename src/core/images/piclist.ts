export const PICLIST_ENDPOINT = 'http://127.0.0.1:36677/upload'

export interface PicListOptions {
  endpoint?: string
  timeoutMs?: number
}

function readBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result)
      const comma = result.indexOf(',')
      resolve(comma === -1 ? result : result.slice(comma + 1))
    }
    reader.onerror = () => reject(reader.error ?? new Error('读取图片失败'))
    reader.readAsDataURL(file)
  })
}

function extractUrl(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const data = payload as {
    success?: boolean
    result?: unknown
    data?: unknown
    url?: unknown
  }
  if (Array.isArray(data.result) && typeof data.result[0] === 'string') return data.result[0]
  if (Array.isArray(data.data) && typeof data.data[0] === 'string') return data.data[0]
  if (typeof data.data === 'string') return data.data
  if (typeof data.url === 'string') return data.url
  return null
}

async function postJson(
  endpoint: string,
  body: unknown,
  signal: AbortSignal,
): Promise<{ ok: boolean; url: string | null; status: number; message: string }> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  const text = await response.text()
  let payload: unknown = null
  try {
    payload = JSON.parse(text)
  } catch {
    payload = null
  }
  return {
    ok: response.ok,
    status: response.status,
    url: extractUrl(payload),
    message: text.slice(0, 300),
  }
}

/**
 * 调用本机 PicList Server 上传单张图片。
 * 依次尝试 FormData、data URL JSON、纯 base64 JSON 三种主流接口形态，
 * 兼容不同版本的 PicList / PicGo Server。
 */
export async function uploadToPicList(file: File, options: PicListOptions = {}): Promise<string> {
  const endpoint = options.endpoint ?? PICLIST_ENDPOINT
  const timeoutMs = options.timeoutMs ?? 20_000
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    const form = new FormData()
    form.append('file', file, file.name)
    try {
      const response = await fetch(endpoint, { method: 'POST', body: form, signal: controller.signal })
      const text = await response.text()
      let payload: unknown = null
      try {
        payload = JSON.parse(text)
      } catch {
        payload = null
      }
      const url = extractUrl(payload)
      if (response.ok && url) return url
    } catch {
      // 继续尝试 JSON 形态
    }

    const base64 = await readBase64(file)
    const dataUrl = `data:${file.type || 'image/png'};base64,${base64}`

    const dataUrlAttempt = await postJson(endpoint, { list: [dataUrl] }, controller.signal)
    if (dataUrlAttempt.ok && dataUrlAttempt.url) return dataUrlAttempt.url

    const base64Attempt = await postJson(endpoint, { list: [base64] }, controller.signal)
    if (base64Attempt.ok && base64Attempt.url) return base64Attempt.url

    throw new Error(
      `PicList 返回异常（HTTP ${base64Attempt.status || dataUrlAttempt.status || 0}）。请确认 PicList Server 已启动、端口为 36677，并允许跨域访问。`,
    )
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('连接 PicList 超时。请确认本机 PicList 正在运行，Server 端口为 36677。')
    }
    if (error instanceof TypeError) {
      throw new Error(
        '无法连接本机 PicList。请启动 PicList 并在「设置 → Server」中开启服务；若浏览器拦截跨域，请改用「Canvas 内联转换」。',
      )
    }
    throw error
  } finally {
    window.clearTimeout(timer)
  }
}
