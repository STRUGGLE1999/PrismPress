import { useEffect, useRef, useState } from 'react'
import type { RichTheme } from '@/core'
import { PrismIcon } from './PrismIcon'
import { pendingCover, startCover } from './coverJobs'

interface CoverStudioProps {
  markdown: string
  title: string
  theme: RichTheme
  category: string
  onToast: (message: string, tone?: 'success' | 'error' | 'info') => void
}

interface CoverCollection {
  prefix: string
  label: string
}

const COVERS = [
  { key: 'wechat', label: '公众号头条', ratio: '2.35:1', width: 900, height: 383, suffix: '2.35x1' },
  { key: 'universal', label: '社区横版', ratio: '16:9', width: 1280, height: 720, suffix: '16x9' },
  { key: 'social3x4', label: '小红书 / 抖音首图', ratio: '3:4', width: 1080, height: 1440, suffix: '3x4' },
] as const

export const ENGINEERING_COVER_TITLE = '为什么很多 AI 工程项目无法帮助求职者拿到工作？'

export function getCoverCollection(title: string): CoverCollection | null {
  if (title === ENGINEERING_COVER_TITLE) {
    return { prefix: 'ai-engineering', label: 'AI 工程五级进阶' }
  }
  if (title === '每位开发者都应该了解的 30 个智能体工程核心概念') {
    return { prefix: 'agent-concepts', label: '智能体工程核心概念' }
  }
  return null
}

export function CoverStudio({ title, markdown, onToast }: CoverStudioProps) {
  return <DynamicCoverStudio key={markdown} title={title} markdown={markdown} onToast={onToast} />
}

function StaticCoverStudio({ title, onToast }: Pick<CoverStudioProps, 'title' | 'onToast'>) {
  const collection = getCoverCollection(title)
  if (!collection) {
    return (
      <div className="rounded-2xl bg-[#FAF8F5] px-6 py-12 text-center">
        <PrismIcon name="image" size={40} />
        <h3 className="mt-3 text-sm font-semibold text-[#27272A]">这篇文章尚未制作专属封面</h3>
        <p className="mx-auto mt-2 max-w-md text-xs leading-6 text-[#71717A]">
          两篇真实示例已配有各自设计的封面。你可以继续复制当前文章，在平台编辑器中添加自己的封面。
        </p>
      </div>
    )
  }
  return <CollectionPreview key={collection.prefix} collection={collection} onToast={onToast} />
}

function CollectionPreview({ collection, onToast }: {
  collection: CoverCollection
  onToast: CoverStudioProps['onToast']
}) {
  const wechatRef = useRef<HTMLCanvasElement>(null)
  const universalRef = useRef<HTMLCanvasElement>(null)
  const socialRef = useRef<HTMLCanvasElement>(null)
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    const canvases = [wechatRef.current, universalRef.current, socialRef.current]
    const draw = async () => {
      const images = await Promise.all(COVERS.map(async (spec) => {
        const image = new Image()
        image.src = `/covers/${collection.prefix}-${spec.key}.png`
        await image.decode()
        return image
      }))
      if (!alive) return
      canvases.forEach((canvas, index) => {
        if (!canvas) throw new Error('封面画布尚未准备好')
        canvas.width = COVERS[index].width
        canvas.height = COVERS[index].height
        const context = canvas.getContext('2d')
        if (!context) throw new Error('当前浏览器不支持封面导出')
        // Preserve the complete generated artwork and typography when resizing.
        context.drawImage(images[index], 0, 0, canvas.width, canvas.height)
      })
      setPhase('ready')
    }
    draw().catch(() => { if (alive) setPhase('error') })
    return () => { alive = false }
  }, [collection.prefix, attempt])

  const download = (spec: typeof COVERS[number], canvas: HTMLCanvasElement | null) => {
    if (phase !== 'ready' || !canvas) return
    canvas.toBlob((blob) => {
      if (!blob) {
        onToast('封面导出失败，请重试', 'error')
        return
      }
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `prismpress-${collection.prefix}-${spec.suffix}.png`
      anchor.click()
      URL.revokeObjectURL(url)
      onToast(`已下载${spec.label} PNG`, 'success')
    }, 'image/png')
  }

  return (
    <div>
      <p className="mb-4 text-xs leading-6 text-[#71717A]">
        {collection.label} · 三种比例分别构图，下载后可用于对应平台。
      </p>
      {phase === 'error' && (
        <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">
          <span>封面加载失败，请检查网络后重试。</span>
          <button type="button" onClick={() => { setPhase('loading'); setAttempt((value) => value + 1) }} className="shrink-0 rounded-lg border border-rose-200 px-3 py-1.5 font-semibold">重新加载</button>
        </div>
      )}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {COVERS.map((spec, index) => {
          const ref = index === 0 ? wechatRef : index === 1 ? universalRef : socialRef
          return (
            <div key={spec.key} className={`overflow-hidden rounded-xl border border-[#EAE4DC] bg-white ${index === 2 ? 'md:col-span-2 md:mx-auto md:w-full md:max-w-[340px]' : ''}`}>
              <div className="relative bg-[#FAF8F5]">
                <canvas ref={ref} width={spec.width} height={spec.height} className={`block h-auto w-full ${phase === 'ready' ? '' : 'invisible'}`} aria-label={`${spec.label}封面预览`} />
                {phase !== 'ready' && <p role="status" className="absolute inset-0 flex items-center justify-center p-4 text-center text-xs text-[#71717A]">{phase === 'error' ? '封面暂不可用' : '正在加载封面…'}</p>}
              </div>
              <div className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#27272A]">{spec.label}</p>
                  <p className="mt-1 text-[11px] text-[#71717A]">{spec.ratio} · {spec.width}×{spec.height}</p>
                </div>
                <button type="button" onClick={() => download(spec, ref.current)} disabled={phase !== 'ready'} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[#EAE4DC] px-3 py-2 text-[11px] font-semibold text-[#52525B] transition hover:bg-[#FAF8F5] disabled:opacity-40">
                  <PrismIcon name="download" /> 下载 PNG
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function coverDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('prismpress-covers', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('covers')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function coverKey(article: string, ratio: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(article))
  return `${Array.from(new Uint8Array(digest), (v) => v.toString(16).padStart(2, '0')).join('')}:${ratio}`
}

async function storeCover(key: string, value?: Blob): Promise<Blob | undefined> {
  const db = await coverDatabase()
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('covers', value ? 'readwrite' : 'readonly')
      const request = value ? tx.objectStore('covers').put(value, key) : tx.objectStore('covers').get(key)
      tx.oncomplete = () => resolve(value ?? request.result)
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } finally { db.close() }
}

function DynamicCoverStudio({ title, markdown, onToast }: Pick<CoverStudioProps, 'title' | 'markdown' | 'onToast'>) {
  const [ratio, setRatio] = useState<typeof COVERS[number]['key']>('universal')
  const [code, setCode] = useState('')
  const [phase, setPhase] = useState<'loading' | 'ready' | 'generating'>('loading')
  const [blob, setBlob] = useState<Blob>()
  const [url, setUrl] = useState('')
  const [message, setMessage] = useState('')
  const [attempt, setAttempt] = useState(0)
  const jobKey = `${ratio}\0${markdown}`
  const spec = COVERS.find((item) => item.key === ratio)!

  useEffect(() => {
    let current = true
    setBlob(undefined); setPhase('loading'); setMessage('')
    const job = pendingCover(jobKey)
    if (job) {
      setPhase('generating'); setMessage('正在生成，可切换页签，完成后会保存到本机。')
      job.then((result) => {
        if (!current) return
        setBlob(result.blob)
        setMessage(result.saved ? '已生成并保存到本机。请检查文字和裁切效果。' : '已生成，但本机保存失败，请及时下载。')
      }).catch((error) => {
        if (current) setMessage(error instanceof Error ? error.message : '生成失败')
      }).finally(() => { if (current) setPhase('ready') })
    } else {
      coverKey(markdown, ratio).then((key) => storeCover(key)).then((saved) => {
        if (current) setBlob(saved)
      }).catch(() => { if (current) setMessage('无法读取本机封面缓存，仍可生成和下载。') })
        .finally(() => { if (current) setPhase('ready') })
    }
    return () => { current = false }
  }, [markdown, ratio, jobKey, attempt])
  useEffect(() => {
    if (!blob) { setUrl(''); return }
    const next = URL.createObjectURL(blob); setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [blob])

  function generate() {
    if (phase !== 'ready') return
    if (pendingCover(jobKey)) { setAttempt((value) => value + 1); return }
    startCover(jobKey, async () => {
      const response = await fetch('/api/cover', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${code}` },
        body: JSON.stringify({ title, article: markdown, ratio }),
      })
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || '封面服务暂不可用，请确认服务端已部署')
      }
      const original = await response.blob()
      const image = await createImageBitmap(original)
      const canvas = document.createElement('canvas'); canvas.width = spec.width; canvas.height = spec.height
      const context = canvas.getContext('2d')
      if (!context) { image.close(); throw new Error('浏览器不支持封面导出') }
      const scale = Math.max(spec.width / image.width, spec.height / image.height)
      context.drawImage(image, (spec.width - image.width * scale) / 2, (spec.height - image.height * scale) / 2, image.width * scale, image.height * scale)
      image.close()
      const result = await new Promise<Blob>((resolve, reject) => canvas.toBlob((output) => output ? resolve(output) : reject(new Error('封面导出失败')), 'image/png'))
      try { await storeCover(await coverKey(markdown, ratio), result); return { blob: result, saved: true } }
      catch { return { blob: result, saved: false } }
    })
    setPhase('generating')
    setAttempt((value) => value + 1)
  }

  return <div>
    <p className="mb-4 text-xs leading-6 text-[#71717A]">根据当前标题和正文设计封面；每次生成一张，正文参考最多取前 16000 字。点击生成会将文字发送至 AIArtMirror。生成结果只保存到当前浏览器。</p>
    <div className="flex flex-wrap items-center gap-3">
      <label className="text-sm">封面比例 <select aria-label="封面比例" value={ratio} disabled={phase === 'generating'} onChange={(e) => setRatio(e.target.value as typeof ratio)} className="rounded-lg border p-2">{COVERS.map((item) => <option key={item.key} value={item.key}>{item.label} · {item.ratio}</option>)}</select></label>
      <label className="text-sm">体验口令 <input type="password" autoComplete="off" aria-label="体验口令" value={code} onChange={(e) => setCode(e.target.value)} className="w-36 rounded-lg border p-2" /></label>
      <button type="button" className="primary-action" disabled={phase !== 'ready' || !code.trim() || !markdown.trim()} onClick={() => void generate()}>{phase === 'generating' ? '正在生成…' : blob ? '重新生成此比例' : '生成此比例'}</button>
      {phase === 'generating' && <button type="button" className="text-action" onClick={() => { setPhase('ready'); setMessage('生成仍在后台继续，完成后会缓存。再次点击只会继续等待同一任务，不会重复下单。') }}>停止等待</button>}
    </div>
    <p role="status" className="my-3 text-xs leading-6 text-[#71717A]">{message || (phase === 'loading' ? '正在读取本机封面…' : '口令由运营方提供；每次生成可能计费，失败不会自动重试。')}</p>
    {url && <div className="my-4 max-w-2xl overflow-hidden rounded-xl border border-[#EAE4DC]">
      <img src={url} alt={`${title} · ${spec.label}生成封面`} className="h-auto w-full" />
      <div className="flex items-center justify-between p-3 text-xs"><span>{spec.width}×{spec.height} · 居中裁切，请核对文字</span><a className="text-action" href={url} download={`prismpress-${ratio}.png`}>下载 PNG</a></div>
    </div>}
    {getCoverCollection(title) && <details className="mt-6"><summary className="cursor-pointer text-sm">查看预制示例封面（非实时生成）</summary><div className="mt-4"><StaticCoverStudio title={title} onToast={onToast} /></div></details>}
  </div>
}
