import { useEffect, useMemo, useState } from 'react'
import type { PlatformProfile, SlideCard } from '@/core'
import { copyPlainText } from '@/core'
import { paginateSlide } from '@/core/platforms/deck/render'
import { VisualStylePicker, useVisualStyle } from './VisualStylePicker'
import { deckZip, downloadBlob, prepareSlideSvg, svgPng } from './deckExport'
import type { DeckDraft } from './deckDraft'

type UnnumberedSlide = Omit<SlideCard, 'index' | 'total'>

interface Props {
  platform: PlatformProfile
  slides: SlideCard[]
  caption: string
  onDraftChange: (draft: DeckDraft) => void
  onLocate: (line: number) => void
  onToast: (message: string, tone?: 'success' | 'error' | 'info') => void
}
const numbered = (slides: UnnumberedSlide[]): SlideCard[] => slides.map((slide, index) => ({ ...slide, index: index + 1, total: slides.length }))

export function SocialDeckSimulator({ platform, slides, caption, onDraftChange, onLocate, onToast }: Props) {
  const cards = slides
  const textCaption = caption
  const [index, setIndex] = useState(0)
  const [style, setStyle] = useVisualStyle(true)
  const [preview, setPreview] = useState<{ slide: SlideCard; style: string; platform: string; svg: string; error: string }>()
  const [attempt, setAttempt] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [exportError, setExportError] = useState('')
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [quote, setQuote] = useState('')
  const [code, setCode] = useState('')
  const [table, setTable] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const current = cards[Math.min(index, cards.length - 1)]
  const activePreview = preview?.slide === current && preview.style === style && preview.platform === platform.id ? preview : undefined
  const svg = activePreview?.svg ?? ''
  const error = activePreview?.error ?? ''
  useEffect(() => {
    let alive = true
    if (!current) return
    prepareSlideSvg(current, style, platform.id).then(value => { if (alive) setPreview({ slide: current, style, platform: platform.id, svg: value, error: '' }) }).catch(reason => {
      if (alive) setPreview({ slide: current, style, platform: platform.id, svg: '', error: current.image ? '此页配图未能载入，无法导出。请检查原图是否可访问或导入配图后重试。' : reason instanceof Error ? reason.message : '页面排版失败' })
    })
    return () => { alive = false }
  }, [current, style, platform.id, attempt])
  const previewUrl = useMemo(() => svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : '', [svg])
  if (!current) return null

  const saveEdit = () => {
    try {
      const updated = { ...current, title, subtitle, bullets: body.split('\n').filter(Boolean), quote: quote || undefined, highlight: code || undefined, tableRows: table ? table.split('\n').map(row => row.split('\t')) : undefined }
      const pages = paginateSlide(updated)
      const next = numbered([...cards.slice(0, index), ...pages, ...cards.slice(index + 1)])
      onDraftChange({ slides: next, caption: textCaption }); setEditing(false)
      onToast(pages.length > 1 ? `内容已保存并自动分成 ${pages.length} 页` : '已更新此页，预览和导出同步', 'success')
    } catch (reason) { onToast(reason instanceof Error ? reason.message : '无法保存此页', 'error') }
  }
  const exportImages = async (all: boolean) => {
    if (exporting || editing) return
    setExporting(true); setProgress(0); setExportError('')
    try {
      if (all) downloadBlob(await deckZip(cards, style, platform.id, textCaption, setProgress), `${platform.id}-图集.zip`)
      else downloadBlob(await svgPng(svg), `${platform.id}-${String(current.index).padStart(3, '0')}.png`)
      onToast(all ? `已导出 ${cards.length} 张图片及配套文案 ZIP` : '已导出当前页 PNG', 'success')
    } catch (reason) { const message = reason instanceof Error ? reason.message : '导出失败，请重试'; setExportError(message); onToast(message, 'error') }
    finally { setExporting(false) }
  }
  const inputClass = 'w-full rounded-lg border border-[#DED7CD] bg-white p-3 text-sm text-[#27272A]'
  return <div className="deck-workspace">
    <div className="deck-controls">
      <VisualStylePicker deck value={style} onChange={setStyle} disabled={exporting || editing} />
      <span className="text-xs text-[#82768A]">{cards.length} 页 · 1080×1440</span>
    </div>
    <div className="deck-layout">
      <div>
        <div className="deck-page" aria-busy={!svg && !error}>
          {previewUrl ? <img src={previewUrl} alt={`${platform.shortName}第${current.index}页：${current.title}`} width={1080} height={1440} /> : <div role={error ? 'alert' : 'status'} className="p-8 text-center text-sm">{error || '正在准备本页…'}{error && <button className="text-action block mx-auto mt-3" onClick={() => setAttempt(value => value + 1)}>重新载入</button>}</div>}
        </div>
        <div className="my-4 flex justify-between items-center gap-2"><button className="secondary-action" disabled={index === 0 || exporting || editing} onClick={() => setIndex(value => value - 1)}>上一页</button><span className="text-sm">{index + 1} / {cards.length}</span><button className="secondary-action" disabled={index >= cards.length - 1 || exporting || editing} onClick={() => setIndex(value => value + 1)}>下一页</button></div>
        <button className="text-action" onClick={() => onLocate(current.sourceLine)}>定位原稿第 {current.sourceLine} 行</button>
      </div>
      <div>
        <div className="flex flex-wrap gap-2 mb-5"><button className="primary-action" disabled={exporting || editing} onClick={() => void exportImages(true)}>{exporting ? `正在导出 ${progress}/${cards.length}…` : '下载全套图片与文案 ZIP'}</button><button className="secondary-action" disabled={!svg || exporting || editing} onClick={() => void exportImages(false)}>下载当前页 PNG</button></div>
        {exportError && <p role="alert" className="mb-4 text-sm text-rose-700">{exportError}</p>}
        <div className="deck-page-list" aria-label="图集页面">{cards.map((card, n) => <button key={n} type="button" aria-current={n === index ? 'page' : undefined} disabled={exporting || editing} onClick={() => setIndex(n)}><span>{String(n + 1).padStart(2, '0')}</span><span>{card.image ? '配图 · ' : ''}{card.title}</span></button>)}</div>
        {!editing ? <button className="secondary-action my-4" disabled={exporting} onClick={() => { setTitle(current.title); setSubtitle(current.subtitle ?? ''); setBody(current.bullets.join('\n')); setQuote(current.quote ?? ''); setCode(current.highlight ?? ''); setTable(current.tableRows?.map(row => row.join('\t')).join('\n') ?? ''); setEditing(true) }}>微调文字</button> : <div className="my-4 space-y-3">
          <label className="block text-sm">页标题<input aria-label="页标题" className={inputClass} value={title} onChange={event => setTitle(event.target.value)} /></label>
          <label className="block text-sm">副标题<input aria-label="副标题" className={inputClass} value={subtitle} onChange={event => setSubtitle(event.target.value)} /></label>
          <label className="block text-sm">正文<textarea aria-label="此页正文" rows={5} className={inputClass} value={body} onChange={event => setBody(event.target.value)} /></label>
          {current.quote && <textarea aria-label="引用内容" className={inputClass} value={quote} onChange={event => setQuote(event.target.value)} />}
          {current.highlight && <textarea aria-label="代码内容" rows={5} className={inputClass} value={code} onChange={event => setCode(event.target.value)} />}
          {current.tableRows && <label className="block text-xs">表格内容<textarea aria-label="表格内容" rows={5} className={inputClass} value={table} onChange={event => setTable(event.target.value)} /></label>}
          <button className="primary-action" onClick={saveEdit}>保存修改</button><button className="text-action ml-4" onClick={() => setEditing(false)}>取消</button>
        </div>}
        <details className="mt-4"><summary className="cursor-pointer text-sm">发布文案</summary><textarea aria-label="发布文案" className={`${inputClass} mt-3`} rows={7} value={textCaption} disabled={exporting} onChange={event => onDraftChange({ slides: cards, caption: event.target.value })} /><button className="text-action mt-2" onClick={() => void copyPlainText(textCaption).then(() => onToast('已复制发布文案', 'success')).catch(() => onToast('复制失败，请重试', 'error'))}>复制发布文案</button></details>
      </div>
    </div>
  </div>
}
