import { useEffect, useRef, useState } from 'react'
import type { RichTheme } from '@/core'
import { PrismIcon } from './PrismIcon'

interface CoverStudioProps {
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

export function CoverStudio({ title, onToast }: CoverStudioProps) {
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
