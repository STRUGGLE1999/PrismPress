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
  saveState: 'saved' | 'error'
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
  const totalFixes = sanitize.fixes.length

  useEffect(() => {
    if (!locateRequest || !textareaRef.current || lastLocateNonce.current === locateRequest.nonce) return
    lastLocateNonce.current = locateRequest.nonce
    const textarea = textareaRef.current
    const lines = markdown.split('\n')
    const index = Math.min(Math.max(locateRequest.line - 1, 0), lines.length - 1)
    const start = lines.slice(0, index).reduce((sum, line) => sum + line.length + 1, 0)
    textarea.focus()
    textarea.setSelectionRange(start, start + lines[index].length)
    textarea.scrollTop = Math.max(0, index * 24 - textarea.clientHeight / 3)
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
          <p>导入 Markdown，或先用真实博客走一遍流程。</p>
        </div>
        <input ref={inputRef} type="file" multiple accept=".md,.markdown,.txt,image/*" className="hidden"
          onChange={(event) => { if (event.target.files) onImportFiles(event.target.files); event.target.value = '' }} />
        <button type="button" className="secondary-action" onClick={() => inputRef.current?.click()}>
          <PrismIcon name="upload" /> 导入文件
        </button>
      </div>
      <div className="sample-picker">
        <label htmlFor="real-article">真实示例</label>
        <select id="real-article" value={activeSampleId ?? ''} onChange={(event) => {
          const sample = samples.find((item) => item.id === event.target.value)
          if (sample) onSelectSample(sample)
        }}>
          <option value="" disabled>正在编辑自己的文章</option>
          {activeSampleId === CSDN_COMPARISON_SAMPLE.id && <option value={CSDN_COMPARISON_SAMPLE.id}>AI 工程五级进阶 · CSDN 图床对照</option>}
          {samples.map((sample) => <option key={sample.id} value={sample.id}>{sample.name}</option>)}
        </select>
        <span>完整正文与真实配图</span>
      </div>
      <label htmlFor="article-source" className="sr-only">文章 Markdown 内容</label>
      <textarea id="article-source" ref={textareaRef} value={markdown} onChange={(event) => onMarkdownChange(event.target.value)}
        spellCheck={false} className="source-textarea" placeholder="# 输入文章标题\n\n在这里粘贴 Markdown 正文，也可以拖入 .md 文件和配图。" />
      <div className="editor-footnote">
        <span>{stats.characters.toLocaleString('zh-CN')} 字 · {imageReport.total} 张图片 · 约 {stats.readingMinutes} 分钟阅读</span>
        <span>{saveState === 'saved' ? '已保存在当前浏览器' : '保存失败，请下载备份'}</span>
      </div>
      <details className="advanced-tools">
        <summary>格式检查与图片工具 <span>{totalFixes ? `${totalFixes} 处格式已整理` : '格式检查已完成'}{imageReport.red + imageReport.yellow > 0 ? ` · ${imageReport.red + imageReport.yellow} 张图片需关注` : ''}</span></summary>
        <div className="advanced-body">
          <p>预览会自动整理标题与公式格式。图片提示基于地址分类，未逐张联网检测。</p>
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
              <button type="button" className="secondary-action" disabled={imageBusy !== null} onClick={onInlineConvert}>转为内联图片</button>
            </div>
            <p>内联图片可用于本地预览，目标编辑器可能不接受，粘贴后请检查。</p>
          </div>}
          <div className="flex flex-wrap gap-3">
            <button type="button" className="text-action" onClick={onOpenGuide}>PicList 配置说明</button>
            <button type="button" className="text-action" onClick={() => onSelectSample(CSDN_COMPARISON_SAMPLE)}>载入同篇 CSDN 图床对照稿</button>
          </div>
        </div>
      </details>
    </section>
  )
}
