import { useEffect, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import type { DocStats, ImageReport, SanitizeReport } from '@/core'
import { CSDN_COMPARISON_SAMPLE } from '@/data/samples'
import type { SampleArticle } from '@/data/samples'
import type { LocalImageAsset } from './localImage'
import { PrismIcon } from './PrismIcon'

interface LeftWorkbenchProps {
  markdown: string
  stats: DocStats
  sanitize: SanitizeReport
  imageReport: ImageReport
  samples: SampleArticle[]
  activeSampleId: string | null
  localImages: LocalImageAsset[]
  imageBusy: 'piclist' | 'inline' | null
  saveState: 'saving' | 'saved' | 'error'
  locateRequest: { line: number; nonce: number } | null
  onMarkdownChange: (value: string) => void
  onSelectSample: (sample: SampleArticle) => void
  onImportFiles: (files: FileList | File[]) => void
  onPicListUpload: () => void
  onInlineConvert: () => void
  onOpenGuide: () => void
  onRemoveImage: (name: string) => void
}

export function LeftWorkbench({ markdown, stats, sanitize, imageReport, samples, activeSampleId,
  localImages, imageBusy, saveState, locateRequest, onMarkdownChange, onSelectSample, onImportFiles,
  onPicListUpload, onInlineConvert, onOpenGuide, onRemoveImage,
}: LeftWorkbenchProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lastLocateNonce = useRef(0)
  const [dragging, setDragging] = useState(false)
  const [locatedLine, setLocatedLine] = useState<number | null>(null)
  const totalFixes = sanitize.fixes.length

  useEffect(() => {
    if (!locateRequest || !textareaRef.current || lastLocateNonce.current === locateRequest.nonce) return
    lastLocateNonce.current = locateRequest.nonce
    const textarea = textareaRef.current
    const lines = markdown.split('\n')
    const index = Math.min(Math.max(locateRequest.line - 1, 0), lines.length - 1)
    const start = lines.slice(0, index).reduce((sum, line) => sum + line.length + 1, 0)
    // Measure visual lines with the same width and typography as the textarea.
    // Markdown line numbers alone do not account for wrapped paragraphs or URLs.
    const mirror = document.createElement('div')
    const style = window.getComputedStyle(textarea)
    for (const property of ['font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'padding', 'tab-size', 'word-break', 'text-indent']) {
      mirror.style.setProperty(property, style.getPropertyValue(property))
    }
    Object.assign(mirror.style, {
      position: 'fixed', left: '-100000px', top: '0', visibility: 'hidden',
      width: `${textarea.clientWidth}px`, boxSizing: 'border-box',
      whiteSpace: 'pre-wrap', overflowWrap: 'break-word',
    })
    mirror.textContent = markdown.slice(0, start)
    const marker = document.createElement('span')
    marker.textContent = lines[index] || '\u200b'
    mirror.appendChild(marker)
    document.body.appendChild(mirror)
    const top = marker.getBoundingClientRect().top - mirror.getBoundingClientRect().top
    mirror.remove()
    textarea.focus({ preventScroll: true })
    textarea.setSelectionRange(start, start + lines[index].length)
    textarea.scrollTop = Math.max(0, top - textarea.clientHeight / 3)
    setLocatedLine(index + 1)
    if (window.innerWidth <= 900) textarea.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [locateRequest, markdown])

  const dropFiles = (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    setDragging(false)
    if (event.dataTransfer.files.length) onImportFiles(event.dataTransfer.files)
  }

  return (
    <section id="source-workbench" className={`article-editor ${dragging ? 'is-dragging' : ''}`}
      onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
      onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false) }}
      onDrop={dropFiles}>
      <div className="editor-toolbar">
        <div>
          <h2>准备一篇文章</h2>
          <p>选择 Markdown 正文，可同时选择配图；只选图片不会更换文章。</p>
        </div>
        <input ref={inputRef} type="file" multiple accept=".md,.markdown,.txt,image/*" className="hidden"
          onChange={(event) => { if (event.target.files) onImportFiles(event.target.files); event.target.value = '' }} />
        <button type="button" className="secondary-action" onClick={() => inputRef.current?.click()}>
          <PrismIcon name="upload" /> 导入文章与配图
        </button>
      </div>
      <div className="sample-picker">
        <label htmlFor="real-article">当前内容</label>
        <select id="real-article" value={activeSampleId ?? ''} onChange={(event) => {
          const sample = samples.find((item) => item.id === event.target.value)
          if (sample) onSelectSample(sample)
        }}>
          <option value="" disabled>我的文章</option>
          {activeSampleId === CSDN_COMPARISON_SAMPLE.id && <option value={CSDN_COMPARISON_SAMPLE.id}>AI 工程五级进阶 · CSDN 图床对照</option>}
          {samples.map((sample) => <option key={sample.id} value={sample.id}>{sample.name}</option>)}
        </select>
        <span>{activeSampleId ? '示例文章 · 可切换或导入自己的文章' : '已导入或修改的正文'}</span>
      </div>
      <label htmlFor="article-source" className="sr-only">文章 Markdown 内容</label>
      <textarea id="article-source" ref={textareaRef} value={markdown} onChange={(event) => onMarkdownChange(event.target.value)}
        spellCheck={false} className="source-textarea" placeholder="# 输入文章标题\n\n在这里粘贴 Markdown 正文，也可以拖入 .md 文件和配图。" />
      <div className="editor-footnote">
        <span>{stats.characters.toLocaleString('zh-CN')} 字 · {imageReport.total} 张图片 · 约 {stats.readingMinutes} 分钟阅读</span>
        <span role="status">{locatedLine !== null ? `已定位原稿第 ${locatedLine} 行 · ` : ''}{activeSampleId ? '正在查看示例' : saveState === 'saving' ? '正在保存原稿与配图…' : saveState === 'saved' ? '原稿与配图已保存' : '保存失败，请保留原稿与配图'}</span>
      </div>
      <details className="advanced-tools">
        <summary>格式检查与图片工具 <span>{totalFixes ? `${totalFixes} 处格式已整理` : '格式检查已完成'}{imageReport.red + imageReport.yellow > 0 ? ` · ${imageReport.red + imageReport.yellow} 张图片需关注` : ''}</span></summary>
        <div className="advanced-body">
          <p>查看格式调整与图片地址。</p>
          {totalFixes > 0 && <div className="space-y-2">
            <button type="button" className="secondary-action" onClick={() => onMarkdownChange(sanitize.output)}>将格式修正写回原稿</button>
            {sanitize.counts.filter((item) => item.count > 0).map((item) => <p key={item.rule}>{item.label}：{item.count} 处</p>)}
          </div>}
          <div className="max-h-48 space-y-2 overflow-y-auto">
            {imageReport.findings.map((finding, index) => <div key={`${finding.url}-${index}`} className="image-finding">
              <span className={`health-dot health-${finding.health}`} />
              <div><strong>{finding.alt || '未命名图片'} · 第 {finding.line} 行</strong><p>{finding.reason}</p></div>
            </div>)}
          </div>
          {localImages.length > 0 && <div className="space-y-2">
            {localImages.map((asset) => <div key={asset.name} className="flex items-center gap-2">
              <img src={asset.dataUrl} alt="" className="h-8 w-8 rounded object-cover" />
              <span className="min-w-0 flex-1 truncate">{asset.name}</span>
              <button type="button" onClick={() => onRemoveImage(asset.name)} aria-label={`移除素材 ${asset.name}`}>移除</button>
            </div>)}
            <div className="flex flex-wrap gap-2">
              <button type="button" className="secondary-action" disabled={imageBusy !== null} onClick={onPicListUpload}>{imageBusy === 'piclist' ? '上传中…' : '上传到 PicList 默认图床'}</button>
              <button type="button" className="secondary-action" disabled={imageBusy !== null} onClick={onInlineConvert}>使用本地图片</button>
            </div>
            <p>已导入的图片会随正文一起复制。</p>
          </div>}
          <div className="flex flex-wrap gap-3">
            <button type="button" className="text-action" onClick={onOpenGuide}>PicList 配置说明</button>
            <button type="button" className="text-action" onClick={() => onSelectSample(CSDN_COMPARISON_SAMPLE)}>查看图床示例</button>
          </div>
        </div>
      </details>
    </section>
  )
}
