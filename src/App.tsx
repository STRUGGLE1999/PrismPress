import { PlatformIcon, PrismIcon } from '@/components/PrismIcon'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DEFAULT_RICH_THEME_ID,
  PLATFORMS,
  analyzeMarkdown,
  compileArticle,
  compressImageToDataUrl,
  copyCompiledArticle,
  copyPlainText,
  generatePassport,
  getPlatform,
  getRichTheme,
  replaceImageReference,
  sanitizeMarkdown,
  scanImages,
  uploadToPicList,
} from '@/core'
import type { CompileResult, PlatformId, ThemePreset } from '@/core'
import { DEFAULT_SAMPLE, LEGACY_DEMO_MARKDOWN, SAMPLE_ARTICLES } from '@/data/samples'
import type { SampleArticle } from '@/data/samples'
import { LeftWorkbench } from '@/components/LeftWorkbench'
import { CenterPreview } from '@/components/CenterPreview'
import { RightPassport } from '@/components/RightPassport'

type PublishTab = 'passport' | 'covers' | 'relay'
import { PicListGuideModal } from '@/components/PicListGuideModal'
import type { LocalImageAsset } from '@/components/localImage'
import prismBrandImage from '../assets/brand/prismpress-brand-transparent.png'

type ToastTone = 'success' | 'error' | 'info'

interface ToastState {
  message: string
  tone: ToastTone
  id: number
}

const TOAST_STYLE: Record<ToastTone, string> = {
  success: 'border-emerald-200 bg-emerald-50/95 text-emerald-800',
  error: 'border-rose-200 bg-rose-50/95 text-rose-800',
  info: 'border-[#EAE4DC] bg-white/95 text-[#27272A]',
}

function PrismMark() {
  return (
    <div className="flex h-14 w-20 shrink-0 items-center justify-center">
      <img src={prismBrandImage} alt="PrismPress 紫色棱镜与彩色纸张光束" className="h-full w-full object-contain" width={80} height={56} />
    </div>
  )
}

const STORAGE_KEY = 'prismpress:workspace:v2'

interface PersistedWorkspace {
  markdown: string
  activeSampleId: string | null
  platformId: PlatformId
  themeId: ThemePreset
  synced: Partial<Record<PlatformId, string>>
}

function loadWorkspace(): PersistedWorkspace | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PersistedWorkspace>
    if (typeof parsed.markdown !== 'string') return null
    // Replace only the untouched former demo; preserve any user-edited draft.
    if (parsed.markdown === LEGACY_DEMO_MARKDOWN) return null
    const validPlatform = PLATFORMS.some((p) => p.id === parsed.platformId)
      ? (parsed.platformId as PlatformId)
      : 'xiaohongshu'
    return {
      markdown: parsed.markdown,
      activeSampleId: SAMPLE_ARTICLES.some((sample) => sample.id === parsed.activeSampleId) || parsed.activeSampleId === 'real-engineering-csdn' ? parsed.activeSampleId! : null,
      platformId: validPlatform,
      themeId: parsed.themeId ?? DEFAULT_SAMPLE.themeId,
      synced: parsed.synced ?? {},
    }
  } catch {
    return null
  }
}

function App() {
  const initial = useMemo(() => loadWorkspace(), [])
  const [markdown, setMarkdown] = useState(initial?.markdown ?? DEFAULT_SAMPLE.markdown)
  const [activeSampleId, setActiveSampleId] = useState<string | null>(
    initial ? initial.activeSampleId : DEFAULT_SAMPLE.id,
  )
  const [platformId, setPlatformId] = useState<PlatformId>(initial?.platformId ?? 'wechat')
  const [themeId, setThemeId] = useState<ThemePreset>(initial?.themeId ?? DEFAULT_SAMPLE.themeId)
  const [workflowStep, setWorkflowStep] = useState<2 | 3>(2)
  const [editorOpen, setEditorOpen] = useState(false)
  const importInput = useRef<HTMLInputElement>(null)
  const [stageTab, setStageTab] = useState<PublishTab>('passport')
  const [saveState, setSaveState] = useState<'saved' | 'error'>('saved')
  const [result, setResult] = useState<CompileResult | null>(null)
  const [compiledTheme, setCompiledTheme] = useState<ThemePreset>(initial?.themeId ?? DEFAULT_SAMPLE.themeId)
  const [compiling, setCompiling] = useState(true)
  const [compileError, setCompileError] = useState<string | null>(null)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle')
  const [toast, setToast] = useState<ToastState | null>(null)
  const [localImages, setLocalImages] = useState<Record<string, LocalImageAsset>>({})
  const [imageBusy, setImageBusy] = useState<'piclist' | 'inline' | null>(null)
  const [guideOpen, setGuideOpen] = useState(false)
  const [synced, setSynced] = useState<Partial<Record<PlatformId, string>>>(initial?.synced ?? {})
  const [relaying, setRelaying] = useState<PlatformId | null>(null)
  const [locateRequest, setLocateRequest] = useState<{ line: number; nonce: number } | null>(null)
  const locateNonce = useRef(0)
  const toastTimer = useRef<number | null>(null)
  const copyTimer = useRef<number | null>(null)

  const platform = PLATFORMS.find((item) => item.id === platformId) ?? PLATFORMS[0]
  const effectiveThemeId = platformId === 'wechat' ? themeId : DEFAULT_RICH_THEME_ID
  const theme = getRichTheme(effectiveThemeId)

  const sanitize = useMemo(() => sanitizeMarkdown(markdown), [markdown])
  const analysis = useMemo(() => analyzeMarkdown(sanitize.output), [sanitize.output])
  const imageReport = useMemo(
    () => scanImages(analysis.images, sanitize.output),
    [analysis.images, sanitize.output],
  )
  const passport = useMemo(() => generatePassport(markdown), [markdown])
  const localImageList = useMemo(() => Object.values(localImages), [localImages])
  const copyKeys = useMemo(() => Object.fromEntries(PLATFORMS.map((item) => [item.id, `${item.id === 'wechat' ? themeId : DEFAULT_RICH_THEME_ID}\n${markdown}`])) as Record<PlatformId, string>, [markdown, themeId])

  const showToast = useCallback((message: string, tone: ToastTone = 'info') => {
    setToast({ message, tone, id: Date.now() })
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 3400)
  }, [])

  useEffect(() => {
    try {
      const payload: PersistedWorkspace = {
        markdown,
        activeSampleId,
        platformId,
        themeId,
        synced,
      }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
      setSaveState('saved')
    } catch {
      setSaveState('error')
    }
  }, [markdown, activeSampleId, platformId, themeId, synced])

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current)
      if (copyTimer.current) window.clearTimeout(copyTimer.current)
    }
  }, [])

  useEffect(() => {
    let alive = true
    setCompiling(true)
    setCompileError(null)

    const timer = window.setTimeout(() => {
      compileArticle(markdown, platformId, { themeId: effectiveThemeId })
        .then((compiled) => {
          if (!alive) return
          setResult(compiled)
          setCompiledTheme(effectiveThemeId)
          setCompiling(false)
        })
        .catch((error: unknown) => {
          if (!alive) return
          setCompileError(error instanceof Error ? error.message : '编译失败，请检查源稿')
          setCompiling(false)
        })
    }, 150)

    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [markdown, platformId, effectiveThemeId])

  const displayResult =
    result &&
    result.platform.id === platformId &&
    result.sanitize.input === markdown &&
    compiledTheme === effectiveThemeId
      ? result
      : null

  const handleMarkdownChange = (value: string) => {
    setMarkdown(value)
    setActiveSampleId(null)
    setCopyState('idle')
  }

  const handleSelectSample = (sample: SampleArticle) => {
    setMarkdown(sample.markdown)
    setActiveSampleId(sample.id)
    setThemeId(sample.themeId)
    setCopyState('idle')
    showToast(`已载入「${sample.name}」范文`, 'info')
  }

  const handleImportFiles = async (files: FileList | File[]) => {
    const list = Array.from(files)
    if (list.length === 0) return

    const markdownFiles = list.filter(
      (file) => /\.(md|markdown|txt)$/i.test(file.name) || file.type === 'text/markdown',
    )
    const imageFiles = list.filter((file) => file.type.startsWith('image/'))

    let next = markdown
    let loadedMarkdown = false
    if (markdownFiles.length > 0) {
      try {
        next = await markdownFiles[0].text()
        loadedMarkdown = true
        setActiveSampleId(null)
      } catch {
        showToast('读取 Markdown 文件失败', 'error')
      }
    }

    const additions: Record<string, LocalImageAsset> = {}
    for (const file of imageFiles) {
      try {
        const compressed = await compressImageToDataUrl(file)
        additions[file.name] = {
          name: file.name,
          file,
          dataUrl: compressed.dataUrl,
          mime: compressed.mime,
          bytes: compressed.bytes,
          mode: 'inline',
        }
        next = replaceImageReference(next, file.name, compressed.dataUrl)
      } catch {
        showToast(`图片「${file.name}」处理失败`, 'error')
      }
    }

    if (Object.keys(additions).length > 0) {
      setLocalImages((previous) => ({ ...previous, ...additions }))
    }
    if (next !== markdown) {
      setMarkdown(next)
      setCopyState('idle')
    }

    if (loadedMarkdown) {
      setWorkflowStep(2)
      setEditorOpen(false)
    }

    if (loadedMarkdown && imageFiles.length > 0) {
      showToast(`已导入 Markdown，并内联 ${imageFiles.length} 张图片`, 'success')
    } else if (loadedMarkdown) {
      showToast(`已导入「${markdownFiles[0]?.name ?? 'Markdown'}」`, 'success')
    } else if (imageFiles.length > 0) {
      showToast(`已内联 ${imageFiles.length} 张图片，发布前请检查平台是否接受`, 'success')
    } else {
      showToast('未识别到可导入文件，请拖入 .md 或图片', 'error')
    }
  }

  const handlePicListUpload = async () => {
    const assets = Object.values(localImages)
    if (assets.length === 0) {
      showToast('请先把本地图片拖进左栏，再上传到 PicList', 'info')
      return
    }

    setImageBusy('piclist')
    let next = markdown
    const updates: Record<string, LocalImageAsset> = {}
    const errors: string[] = []

    for (const asset of assets) {
      try {
        const url = await uploadToPicList(asset.file)
        next = replaceImageReference(next, asset.name, url)
        updates[asset.name] = { ...asset, mode: 'remote', remoteUrl: url }
      } catch (error) {
        errors.push(error instanceof Error ? error.message : `「${asset.name}」上传失败`)
      }
    }

    if (Object.keys(updates).length > 0) {
      setLocalImages((previous) => {
        const merged = { ...previous }
        for (const [name, asset] of Object.entries(updates)) {
          if (merged[name]) merged[name] = asset
        }
        return merged
      })
    }
    if (next !== markdown) {
      setMarkdown(next)
      setCopyState('idle')
    }

    if (errors.length > 0) {
      showToast(errors[0], 'error')
    } else {
      showToast(`已上传 ${Object.keys(updates).length} 张图片并替换为图床链接`, 'success')
    }
    setImageBusy(null)
  }

  const handleInlineConvert = () => {
    const assets = Object.values(localImages)
    if (assets.length === 0) {
      showToast('请先把本地图片拖进左栏', 'info')
      return
    }
    setImageBusy('inline')
    let next = markdown
    for (const asset of assets) {
      next = replaceImageReference(next, asset.name, asset.dataUrl)
    }
    setMarkdown(next)
    setLocalImages((previous) => {
      const merged = { ...previous }
      for (const asset of assets) {
        if (merged[asset.name]) merged[asset.name] = { ...asset, mode: 'inline' }
      }
      return merged
    })
    setImageBusy(null)
    showToast(`已将 ${assets.length} 张图片内联，请在目标编辑器检查兼容性`, 'success')
  }

  const handleRemoveImage = (name: string) => {
    setLocalImages((previous) => {
      const next = { ...previous }
      delete next[name]
      return next
    })
  }

  const handleCopy = async () => {
    if (!displayResult) return
    try {
      await copyCompiledArticle(displayResult)
      setCopyState('copied')
      setSynced((previous) => ({ ...previous, [platformId]: copyKeys[platformId] }))
      showToast(`${platform.name}专属内容已写入剪贴板`, 'success')
    } catch {
      setCopyState('error')
      showToast('复制失败，请检查浏览器剪贴板权限', 'error')
    }
    if (copyTimer.current) window.clearTimeout(copyTimer.current)
    copyTimer.current = window.setTimeout(() => setCopyState('idle'), 2200)
  }

  const handleCopyText = async (text: string, label: string) => {
    try {
      await copyPlainText(text)
      showToast(`${label}已复制`, 'success')
    } catch {
      showToast('复制失败，请检查浏览器剪贴板权限', 'error')
    }
  }

  const handleLocate = useCallback((line: number) => {
    setWorkflowStep(2)
    setEditorOpen(true)
    locateNonce.current += 1
    setLocateRequest({ line, nonce: locateNonce.current })
    if (window.innerWidth < 1024) {
      document.getElementById('source-workbench')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  const handleRelay = async (id: PlatformId) => {
    if (relaying) return
    const profile = getPlatform(id)
    const popup = window.open('', '_blank')
    setRelaying(id)

    try {
      const targetThemeId = id === 'wechat' ? themeId : DEFAULT_RICH_THEME_ID
      const reusable =
        result &&
        result.platform.id === id &&
        result.sanitize.input === markdown &&
        compiledTheme === targetThemeId
          ? result
          : null
      const compiled = reusable ?? (await compileArticle(markdown, id, { themeId: targetThemeId }))
      await copyCompiledArticle(compiled)

      if (popup && !popup.closed) {
        popup.location.href = profile.editorUrl
      } else {
        window.open(profile.editorUrl, '_blank', 'noopener,noreferrer')
      }

      setSynced((previous) => ({ ...previous, [id]: copyKeys[id] }))
      showToast(`已复制${profile.name}专属格式，正在打开官方发布页`, 'success')
    } catch (error) {
      popup?.close()
      showToast(error instanceof Error ? error.message : `${profile.name}接力失败`, 'error')
    } finally {
      setRelaying(null)
    }
  }

  const downloadSource = () => {
    const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'PrismPress-原稿.md'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="app-shell">
      <header className="product-header">
        <div className="flex items-center gap-2"><PrismMark /><div><p className="product-wordmark">PrismPress <span>棱镜发布台</span></p><p className="product-caption">Markdown 多平台发布助手</p></div></div>
        <button type="button" className="text-action" onClick={downloadSource} disabled={!markdown.trim()}>下载原稿</button>
      </header>
      <main className="workflow-main">
        <div className="workflow-intro">
          <p className="eyebrow">让内容抵达，少一点重复整理</p>
          <h1>写好一篇，适配不同平台。</h1>
          <p>导入 Markdown，预览平台排版，再带着正文、摘要与封面去发布。</p>
        </div>
        <div className="workspace-toolbar">
          <nav className="workspace-views" aria-label="工作区">
            <button type="button" aria-current={workflowStep !== 3 ? 'page' : undefined} onClick={() => setWorkflowStep(2)}>文章与平台预览</button>
            <button type="button" aria-current={workflowStep === 3 ? 'page' : undefined} disabled={!markdown.trim()} onClick={() => { setStageTab('passport'); setWorkflowStep(3) }}>准备发布 →</button>
          </nav>
          <input ref={importInput} type="file" multiple accept=".md,.markdown,.txt,image/*" className="hidden" onChange={(event) => { if (event.target.files) void handleImportFiles(event.target.files); event.target.value = '' }} />
          <button type="button" className="secondary-action" onClick={() => importInput.current?.click()}><PrismIcon name="upload" />导入文章</button>
        </div>
        {saveState === 'error' && <div className="save-warning" role="alert">当前浏览器未能保存草稿。请先<button type="button" onClick={downloadSource}>下载原稿备份</button>，避免刷新后丢失修改。</div>}
        {workflowStep !== 3 && <>
          <section className="platform-selection">
            <div><h2>切换平台，查看成品</h2><p>原稿修改后自动更新预览，发布前请在官方编辑器确认效果。</p></div>
            <nav className="platform-options" aria-label="选择发布平台">{PLATFORMS.map((item) => <button type="button" key={item.id} aria-pressed={item.id === platformId} onClick={() => { setPlatformId(item.id); setCopyState('idle') }}><PlatformIcon id={item.id} />{item.shortName}</button>)}</nav>
          </section>
          <div className="preview-caption"><span>{analysis.title || '未命名文章'} · {imageReport.total} 张原稿图片</span><button type="button" className="text-action" aria-expanded={editorOpen} onClick={() => setEditorOpen((open) => !open)}>{editorOpen ? '收起原稿' : '修改原稿 / 选择示例'}</button></div>
          <div className={`live-workspace ${editorOpen ? 'is-editing' : ''}`}>
          {editorOpen && <LeftWorkbench markdown={markdown} stats={analysis.stats} sanitize={sanitize} imageReport={imageReport}
            samples={SAMPLE_ARTICLES} activeSampleId={activeSampleId} localImages={localImageList} imageBusy={imageBusy} saveState={saveState}
            locateRequest={locateRequest} onMarkdownChange={handleMarkdownChange} onSelectSample={handleSelectSample}
            onImportFiles={handleImportFiles} onPicListUpload={handlePicListUpload} onInlineConvert={handleInlineConvert}
            onOpenGuide={() => setGuideOpen(true)} onRemoveImage={handleRemoveImage} />}
          <div className="live-preview">
          <CenterPreview platformId={platformId} platform={platform} themeId={themeId} theme={theme} result={displayResult} passport={passport}
            compiling={compiling} compileError={compileError} onThemeChange={(id) => { setThemeId(id); setCopyState('idle') }} onCopyText={handleCopyText} onLocate={handleLocate} onToast={showToast} />
          </div></div>
          <div className="step-actions"><p>{saveState === 'saved' ? '已保存在当前浏览器' : '保存失败，请下载原稿备份'} · 可随时切换平台</p><button type="button" className="primary-action" disabled={!displayResult || compiling} onClick={() => { setStageTab('passport'); setWorkflowStep(3) }}>准备发布 <span aria-hidden="true">→</span></button></div>
        </>}
        {workflowStep === 3 && <section className="publication-workspace">
          <div className="publication-header"><div className="flex items-center gap-3"><PlatformIcon id={platformId} /><div><h2>把文章交给{platform.shortName}</h2><p>{platform.format === 'deck' ? '图集请在预览页下载，这里准备配套文案和素材。' : '先复制适配后的正文，再按需要补齐发布资料。'}</p></div></div><button type="button" className="primary-action" disabled={!displayResult || compiling} onClick={handleCopy}><PrismIcon name="copy" />{copyState === 'copied' && synced[platformId] === copyKeys[platformId] ? '已复制当前内容' : platform.format === 'deck' ? '复制配套文案' : '复制正文'}</button></div>
          <nav className="publication-tabs" aria-label="发布准备选项">
            {([{ id: 'passport', label: '标题与摘要' }, { id: 'covers', label: '封面（可选）' }, { id: 'relay', label: '打开发布页' }] as const).map((item) => <button type="button" key={item.id} aria-current={stageTab === item.id ? 'page' : undefined} onClick={() => setStageTab(item.id)}>{item.label}</button>)}
          </nav>
          <RightPassport passport={passport} platform={platform} platforms={PLATFORMS} theme={theme} copyKeys={copyKeys} synced={synced} relaying={relaying}
            section={stageTab} onCopyText={handleCopyText} onRelay={handleRelay} onSelectPlatform={(id) => { setPlatformId(id); setCopyState('idle'); setWorkflowStep(2) }} onToast={showToast} />
          <div className="step-actions inside"><button type="button" className="text-action" onClick={() => setWorkflowStep(2)}>← 返回平台预览</button>{stageTab !== 'relay' && <button type="button" className="secondary-action" onClick={() => setStageTab('relay')}>继续：打开发布页 →</button>}</div>
        </section>}
        <footer className="product-footer"><span>本地处理 · 无需绑定平台账号</span><details><summary>使用与隐私说明</summary><p>原稿和复制记录保存在当前浏览器，清理浏览器数据会删除它们。请下载原稿备份。远程图片会请求对应图床；只有主动点击上传时才请求本机 PicList。PrismPress 不替你登录或发布，粘贴后的排版与图片仍需在官方编辑器确认。</p></details></footer>
      </main>

      <PicListGuideModal open={guideOpen} onClose={() => setGuideOpen(false)} onToast={showToast} />

      {toast && (
        <div
          key={toast.id}
          role="status"
          className={`prism-rise fixed bottom-5 left-1/2 z-[60] max-w-[90vw] -translate-x-1/2 rounded-full border px-4 py-2 text-xs font-medium shadow-[0_12px_36px_rgba(39,39,42,0.12)] backdrop-blur ${TOAST_STYLE[toast.tone]}`}
        >
          {toast.message}
        </div>
      )}
    </div>
  )
}

export default App
