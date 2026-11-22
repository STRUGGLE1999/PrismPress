import { hostImageSources, prepareDouyinImageSources } from './components/hostImages'
import { withDeckDraft, type DeckDraft } from './components/deckDraft'
import { workspaceBackup } from './components/workspaceBackup'
import { loadSavedCovers } from './components/CoverStudio'
import { applyAiPassport, extractPassport, passportState, subscribePassport } from './components/passportState'
import { PlatformIcon, PrismIcon } from '@/components/PrismIcon'
import { useCallback, useEffect, useMemo, useSyncExternalStore, useRef, useState } from 'react'
import {
  DEFAULT_RICH_THEME_ID,
  PLATFORMS,
  analyzeMarkdown,
  compileArticle,
  compressImageToDataUrl,
  copyCompiledArticle,
  copyPlainText,
  generatePassport,
  getPublicationPlatform,
  getRichTheme,
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

type PublishTab = 'passport' | 'covers'
import { PicListGuideModal } from '@/components/PicListGuideModal'
import { detachInlineImages, imageSources, imageChangeKey, referencedImageNames, importedImageAssets } from '@/components/imageWorkspace'
import { resolveImageReport } from '@/core/images/radar'
import { loadImageAssets, saveImageAssets } from '@/components/imageStorage'
import type { LocalImageAsset } from '@/components/localImage'
import prismBrandImage from '../assets/brand/prismpress-brand-transparent.png'
import prismBrandAnimation from '../assets/brand/prismpress-logo-animated.gif'

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
  const [playing, setPlaying] = useState(false)
  return (
    <div className="flex h-14 w-20 shrink-0 items-center justify-center" onMouseEnter={() => setPlaying(true)} onMouseLeave={() => setPlaying(false)} title="PrismPress · 悬停查看动画">
      <picture className="h-full w-full">
        <source media="(prefers-reduced-motion: reduce)" srcSet={prismBrandImage} />
        <img src={playing ? prismBrandAnimation : prismBrandImage} alt="PrismPress 紫色棱镜与彩色纸张光束" className="h-full w-full object-contain" width={80} height={56} />
      </picture>
    </div>
  )
}

const STORAGE_KEY = 'prismpress:workspace:v2'

interface PersistedWorkspace {
  typographyVersion?: number
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
      themeId: parsed.typographyVersion === 1 ? parsed.themeId ?? DEFAULT_SAMPLE.themeId : DEFAULT_RICH_THEME_ID,
      synced: parsed.synced ?? {},
    }
  } catch {
    return null
  }
}

function App() {
  const initial = useMemo(() => loadWorkspace(), [])
  const recovered = useMemo(() => detachInlineImages(initial?.markdown ?? DEFAULT_SAMPLE.markdown), [initial])
  const [markdown, setMarkdown] = useState(recovered.markdown)
  const [activeSampleId, setActiveSampleId] = useState<string | null>(
    initial ? initial.activeSampleId : DEFAULT_SAMPLE.id,
  )
  const [deckDrafts, setDeckDrafts] = useState<Record<string, DeckDraft>>({})
  const deckMode = 'summary' as const
  const [selectedPublicationMode, setPublicationMode] = useState<'article' | 'deck'>('article')
  const [platformId, setPlatformId] = useState<PlatformId>(initial?.platformId ?? 'wechat')
  const publicationMode = platformId === 'xiaohongshu' ? 'deck' : selectedPublicationMode
  const [themeId, setThemeId] = useState<ThemePreset>(initial?.themeId ?? DEFAULT_SAMPLE.themeId)
  const [workflowStep, setWorkflowStep] = useState<2 | 3>(2)
  const [editorOpen, setEditorOpen] = useState(false)
  const importInput = useRef<HTMLInputElement>(null)
  const assetSave = useRef<Promise<void>>(Promise.resolve())
  const importToken = useRef(0)
  const [importProgress, setImportProgress] = useState<{ done: number; total: number; skipped: number } | null>(null)
  const folderInput = useRef<HTMLInputElement>(null)
  const [stageTab, setStageTab] = useState<PublishTab>('passport')
  const [backingUp, setBackingUp] = useState(false)
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'error'>('saving')
  const [result, setResult] = useState<CompileResult | null>(null)
  const [compiledContentKey, setCompiledContentKey] = useState('')
  const [compiledTheme, setCompiledTheme] = useState<ThemePreset>(initial?.themeId ?? DEFAULT_SAMPLE.themeId)
  const [compiling, setCompiling] = useState(true)
  const [compileError, setCompileError] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [localImages, setLocalImages] = useState<Record<string, LocalImageAsset>>(recovered.assets)
  const [assetsReady, setAssetsReady] = useState(false)
  const [imageBusy, setImageBusy] = useState<'piclist' | 'inline' | null>(null)
  const [guideOpen, setGuideOpen] = useState(false)
  const [synced, setSynced] = useState<Partial<Record<PlatformId, string>>>(Object.keys(recovered.assets).length ? {} : initial?.synced ?? {})
  const [relaying, setRelaying] = useState<PlatformId | null>(null)
  const [locateRequest, setLocateRequest] = useState<{ line: number; nonce: number } | null>(null)
  const locateNonce = useRef(0)
  const toastTimer = useRef<number | null>(null)

  const platform = getPublicationPlatform(platformId, publicationMode)
  const effectiveThemeId = platformId === 'wechat' ? themeId : DEFAULT_RICH_THEME_ID
  const theme = getRichTheme(effectiveThemeId)

  const sources = useMemo(() => imageSources(markdown, localImages), [markdown, localImages])
  const aiState = useSyncExternalStore(subscribePassport, () => passportState(markdown))
  const passport = useMemo(() => applyAiPassport(generatePassport(markdown), aiState.value), [markdown, aiState.value])
  const contentKey = useMemo(() => imageChangeKey(publicationMode + deckMode + markdown + Object.values(imageSources(markdown, localImages, true)).map(imageChangeKey).join('|') + JSON.stringify(aiState.value ?? null)), [markdown, localImages, aiState.value, deckMode, publicationMode])
  const sanitize = useMemo(() => sanitizeMarkdown(markdown), [markdown])
  const analysis = useMemo(() => analyzeMarkdown(sanitize.output), [sanitize.output])
  const imageReport = useMemo(
    () => resolveImageReport(scanImages(analysis.images, sanitize.output), sources),
    [analysis.images, sanitize.output, sources],
  )

  const totalFixes = useMemo(() => sanitize.counts.reduce((sum, item) => sum + item.count, 0), [sanitize.counts])
  const warnImages = platform.format === 'deck' ? 0 : imageReport.red + imageReport.yellow
  const checkSummary = `${totalFixes > 0 ? `已自动整理 ${totalFixes} 处格式` : '格式检查已通过'}${warnImages > 0 ? ` · ${warnImages} 张图片需关注` : imageReport.total > 0 ? ' · 图片链接已识别' : ''}`
  const localImageList = useMemo(() => Object.values(localImages), [localImages])
  const copyKeys = useMemo(() => Object.fromEntries(PLATFORMS.map((item) => [item.id, `${item.id === 'wechat' ? themeId : DEFAULT_RICH_THEME_ID}\n${contentKey}\n${imageChangeKey(JSON.stringify(deckDrafts[`${item.id}:${contentKey}`] ?? null))}`])) as Record<PlatformId, string>, [contentKey, themeId, deckDrafts])

  const showToast = useCallback((message: string, tone: ToastTone = 'info') => {
    setToast({ message, tone, id: Date.now() })
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 3400)
  }, [])

  useEffect(() => {
    let active = true
    void loadImageAssets().then((assets) => {
      if (active) setLocalImages((current) => ({ ...assets, ...current }))
    }).catch(() => { if (active) setSaveState('error') })
      .finally(() => { if (active) setAssetsReady(true) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (assetsReady) assetSave.current = saveImageAssets(localImages)
  }, [assetsReady, localImages])

  useEffect(() => {
    if (!assetsReady) return
    let active = true
    setSaveState('saving')
    const payload: PersistedWorkspace = { typographyVersion: 1, markdown, activeSampleId, platformId, themeId, synced }
    // Save pictures before replacing an older draft containing embedded data.
    void assetSave.current.then(() => {
      if (!active) return
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
      setSaveState('saved')
    }).catch(() => { if (active) setSaveState('error') })
    return () => { active = false }
  }, [assetsReady, markdown, activeSampleId, platformId, themeId, synced, localImages])

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current)
    }
  }, [])

  useEffect(() => {
    let alive = true
    setCompiling(true)
    setCompileError(null)

    const timer = window.setTimeout(() => {
      compileArticle(markdown, platformId, { publicationMode, deckMode, themeId: effectiveThemeId, imageSources: sources, passport: aiState.value ? passport : undefined })
        .then((compiled) => {
          if (!alive) return
          setResult(compiled)
          setCompiledTheme(effectiveThemeId)
          setCompiledContentKey(contentKey)
          setCompiling(false)
        })
        .catch((error: unknown) => {
          if (!alive) return
          setCompileError(error instanceof Error ? error.message : '暂时无法生成预览，请重试')
          setCompiling(false)
        })
    }, 150)

    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [markdown, sources, platformId, effectiveThemeId, contentKey, passport])

  const baseResult =
    result &&
    result.platform.id === platformId &&
    result.sanitize.input === markdown &&
    compiledTheme === effectiveThemeId && compiledContentKey === contentKey
      ? result
      : null
  const displayResult = withDeckDraft(baseResult, deckDrafts[`${platformId}:${contentKey}`])

  const handleMarkdownChange = (value: string) => {
    setMarkdown(value)
    setActiveSampleId(null)
  }

  const handleSelectSample = (sample: SampleArticle) => {
    setMarkdown(sample.markdown)
    setActiveSampleId(sample.id)
    setThemeId(sample.themeId)
    showToast(`已载入「${sample.name}」范文`, 'info')
  }

  const handleImportFiles = async (files: FileList | File[], imagesOnly = false) => {
    const list = Array.from(files)
    if (list.length === 0) return

    const token = ++importToken.current
    const markdownFiles = imagesOnly ? [] : list.filter(
      (file) => /\.(md|markdown|txt)$/i.test(file.name) || file.type === 'text/markdown',
    )
    const imageFiles = list.filter((file) => file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(file.name))

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

    const imagePath = (file: File) => file.webkitRelativePath || file.name
    if (token !== importToken.current) return
    const referenced = referencedImageNames(next, imageFiles.map(imagePath))
    const neededImages = imageFiles.filter((file) => referenced.has(imagePath(file)))
    const skipped = imageFiles.length - neededImages.length
    setImportProgress({ done: 0, total: neededImages.length, skipped })
    const additions: Record<string, LocalImageAsset> = {}
    for (const [index, file] of neededImages.entries()) {
      await new Promise((resolve) => window.setTimeout(resolve, 0))
      if (token !== importToken.current) return
      try {
        const compressed = await compressImageToDataUrl(file)
        if (token !== importToken.current) return
        const path = imagePath(file)
        additions[path] = {
          name: path,
          file,
          dataUrl: compressed.dataUrl,
          mime: compressed.mime,
          bytes: compressed.bytes,
          mode: 'inline',
        }
      } catch {
        showToast(`图片「${file.name}」处理失败`, 'error')
      }
      if (token !== importToken.current) return
      setImportProgress({ done: index + 1, total: neededImages.length, skipped })
    }
    if (token !== importToken.current) return
    setImportProgress(null)
    const nextAssets = importedImageAssets(localImages, additions, loadedMarkdown)
    setLocalImages(nextAssets)
    if (next !== markdown) {
      setMarkdown(next)
    }

    if (loadedMarkdown) {
      setWorkflowStep(2)
      setEditorOpen(false)
    }

    const readyImages = imageSources(next, nextAssets)
    const missing = resolveImageReport(scanImages(analyzeMarkdown(next).images, next), readyImages).findings.filter((item) => item.health === 'red')
    const processed = Object.keys(additions).length
    if (missing.length > 0) {
      showToast(`文章已导入，仍有 ${missing.length} 张图片未读入。请选择包含配图的文件夹。`, 'info')
    } else if (neededImages.length > processed) {
      showToast(`已处理 ${processed} 张图片，${neededImages.length - processed} 张处理失败，请检查文件。`, 'error')
    } else if (loadedMarkdown && imageFiles.length > 0) {
      showToast(`已导入 Markdown，并关联 ${processed} 张图片，跳过 ${skipped} 张无关图片`, 'success')
    } else if (loadedMarkdown) {
      showToast(`已导入「${markdownFiles[0]?.name ?? 'Markdown'}」`, 'success')
    } else if (imageFiles.length > 0) {
      showToast(`已关联 ${processed} 张图片，跳过 ${skipped} 张无关图片`, 'success')
    } else {
      showToast('未识别到可导入文件，请拖入 .md 或图片', 'error')
    }
  }

  const handlePicListUpload = async () => {
    const referenced = referencedImageNames(markdown, Object.keys(localImages))
    const assets = Object.entries(localImages).filter(([name]) => referenced.has(name)).map(([, asset]) => asset)
    if (assets.length === 0) {
      showToast('请先把本地图片拖进左栏，再上传到 PicList', 'info')
      return
    }

    setImageBusy('piclist')
    const updates: Record<string, LocalImageAsset> = {}
    const errors: string[] = []

    for (const asset of assets) {
      try {
        const url = await uploadToPicList(asset.file)
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

    if (errors.length > 0) {
      showToast(errors[0], 'error')
    } else {
      showToast(`已上传 ${Object.keys(updates).length} 张图片，预览和复制将使用图床链接`, 'success')
    }
    setImageBusy(null)
  }

  const handleInlineConvert = () => {
    const referenced = referencedImageNames(markdown, Object.keys(localImages))
    const assets = Object.entries(localImages).filter(([name]) => referenced.has(name)).map(([, asset]) => asset)
    if (assets.length === 0) {
      showToast('请先把本地图片拖进左栏', 'info')
      return
    }
    setImageBusy('inline')
    setLocalImages((previous) => {
      const merged = { ...previous }
      for (const asset of assets) {
        if (merged[asset.name]) merged[asset.name] = { ...asset, mode: 'inline' }
      }
      return merged
    })
    setImageBusy(null)
    showToast(`已使用导入的图片`, 'success')
  }

  const handleRemoveImage = (name: string) => {
    setLocalImages((previous) => {
      const next = { ...previous }
      delete next[name]
      return next
    })
  }

  const prepareCopy = async (id: PlatformId) => {
    const inlineSources = imageSources(markdown, localImages, true)
    const copySources = id === 'douyin' ? await prepareDouyinImageSources(inlineSources, imageReport.findings.map(image => image.url)) : id === 'xiaohongshu' ? sources : await hostImageSources(sources)
    const updates = new Map(Object.entries(sources).map(([key, value]) => [value, copySources[key]]))
    setLocalImages(previous => Object.fromEntries(Object.entries(previous).map(([name, asset]) => {
      const url = updates.get(asset.dataUrl)
      return [name, url && /^https:\/\//.test(url) && url !== asset.dataUrl ? { ...asset, mode: 'remote' as const, remoteUrl: url } : asset]
    })))
    return compileArticle(markdown, id, { publicationMode, deckMode, themeId: id === 'wechat' ? themeId : DEFAULT_RICH_THEME_ID, imageSources: copySources, passport: aiState.value ? passport : undefined })
  }

  const summaryAttempts = useRef(new Set<string>())
  useEffect(() => {
    if (workflowStep !== 3 || !markdown.trim() || aiState.value || aiState.loading) return
    const key = imageChangeKey(markdown)
    if (summaryAttempts.current.has(key)) return
    summaryAttempts.current.add(key)
    void extractPassport(markdown, passport.title).catch(error => showToast(error instanceof Error ? error.message : '摘要生成失败，请点击重新提炼', 'error'))
  }, [workflowStep, markdown, aiState.value, aiState.loading, passport.title, showToast])

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
  }, [])

  const handleRelay = async (id: PlatformId) => {
    if (relaying) return
    const profile = getPublicationPlatform(id, publicationMode)
    setRelaying(id)

    try {
      const compiled = profile.format === 'deck' ? await compileArticle(markdown, id, { publicationMode, deckMode, imageSources: sources }) : await prepareCopy(id)
      await copyCompiledArticle(withDeckDraft(compiled, deckDrafts[`${id}:${contentKey}`])!)

      window.open(profile.editorUrl, '_blank', 'noopener,noreferrer')

      setSynced((previous) => ({ ...previous, [id]: copyKeys[id] }))
      showToast(`正文已复制，请在${profile.shortName}正文编辑区粘贴，标题需单独填写。`, 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : `${profile.name}接力失败`, 'error')
    } finally {
      setRelaying(null)
    }
  }

  const downloadBackup = async () => {
    if (backingUp) return
    setBackingUp(true)
    try {
      let covers: Awaited<ReturnType<typeof loadSavedCovers>> = []
      let coversAvailable = true
      try { covers = await loadSavedCovers(markdown, passport.title) } catch { coversAvailable = false }
      const archive = await workspaceBackup(markdown, localImages, covers)
      const url = URL.createObjectURL(archive)
      const anchor = document.createElement('a')
      anchor.href = url; anchor.download = 'PrismPress-文章备份.zip'; anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      showToast(coversAvailable ? '已导出原稿、本地配图与已缓存封面；远程图片仍为链接' : '已导出原稿和本地配图；封面缓存读取失败，未包含封面', coversAvailable ? 'success' : 'info')
    } catch { showToast('完整备份失败，请下载原稿并保留原始配图', 'error') }
    finally { setBackingUp(false) }
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
        <div className="flex flex-wrap items-center gap-3"><button type="button" className="text-action" onClick={downloadSource} disabled={!markdown.trim()}>下载原稿</button><button type="button" className="text-action" onClick={() => void downloadBackup()} disabled={backingUp || !markdown.trim()}>{backingUp ? '正在打包…' : '完整备份'}</button></div>
      </header>
      <main className="workflow-main">
        <div className="workflow-intro">
          <p className="eyebrow">少一点重复整理，多一点创作时间</p>
          <h1 className="hero-title" aria-label="一篇文章 适配多个平台"><span>一篇文章</span><span>适配多个平台</span></h1>
          <p>导入 Markdown，预览各平台排版，自动生成摘要与标签，复制后前往发布。</p>
        </div>
        <div className="workspace-toolbar">
          <nav className="workspace-views" aria-label="工作区">
            <button type="button" aria-current={workflowStep !== 3 ? 'page' : undefined} onClick={() => setWorkflowStep(2)}>文章与平台预览</button>
            <button type="button" aria-current={workflowStep === 3 ? 'page' : undefined} disabled={!markdown.trim()} onClick={() => { setStageTab('passport'); setWorkflowStep(3) }}>准备发布 →</button>
          </nav>
          <input ref={importInput} type="file" multiple accept=".md,.markdown,.txt,image/*" className="hidden" onChange={(event) => { if (event.target.files) void handleImportFiles(event.target.files); event.target.value = '' }} />
          <input ref={folderInput} type="file" multiple {...{ webkitdirectory: '', directory: '' }} className="hidden" onChange={(event) => { if (event.target.files) void handleImportFiles(event.target.files, true); event.target.value = '' }} />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="secondary-action" onClick={() => importInput.current?.click()}><PrismIcon name="upload" />导入文章</button>
            <button type="button" className="secondary-action" onClick={() => folderInput.current?.click()}>导入配图文件夹</button>
          </div>
        </div>
        {importProgress && <div className="missing-images" role="status"><span>正在处理文章配图 {importProgress.done} / {importProgress.total}，已跳过 {importProgress.skipped} 张无关图片。</span><button type="button" className="text-action" onClick={() => { importToken.current += 1; setImportProgress(null); showToast('已取消导入，原稿和已保存配图未修改', 'info') }}>取消导入</button></div>}
        {saveState === 'error' && <div className="save-warning" role="alert">当前浏览器未能保存草稿。请先<button type="button" onClick={downloadSource}>下载原稿备份</button>并保留原始配图文件夹，避免刷新后丢失修改。</div>}
        {workflowStep !== 3 && <>
          <section className="platform-selection">
            <div><h2>切换平台，查看成品</h2><p>选择平台，查看适合的排版。</p></div>
            <nav className="platform-options" aria-label="选择发布平台">{PLATFORMS.map((item) => <button type="button" key={item.id} aria-pressed={item.id === platformId} onClick={() => { setPlatformId(item.id); }}><PlatformIcon id={item.id} />{item.shortName}</button>)}</nav>
          </section>
          {platformId === 'douyin' && <nav className="publication-mode" aria-label="内容形式">
            <button type="button" aria-pressed={publicationMode === 'article'} onClick={() => { setPublicationMode('article'); }}>发布文章</button>
            <button type="button" aria-pressed={publicationMode === 'deck'} onClick={() => { setPublicationMode('deck'); }}>生成图集</button>
          </nav>}
          <div className="preview-caption"><span className="preview-article-title" title={analysis.title || '未命名文章'}>{analysis.title || '未命名文章'}</span><span className="preview-article-status">{imageReport.total} 张图片 · {checkSummary}</span><button type="button" className="text-action" aria-expanded={editorOpen} onClick={() => setEditorOpen((open) => !open)}>{editorOpen ? '收起原稿' : '修改原稿 / 选择示例'}</button></div>
          {platform.format !== 'deck' && imageReport.red > 0 && <div className="missing-images" role="status">
            <div><strong>{imageReport.red} 张图片尚未就绪</strong><p>选择配图文件夹，自动补齐文章图片。</p>
              <ul>{imageReport.findings.filter((item) => item.health === 'red').map((item, index) => <li key={`${item.url}-${index}`}>{item.url} — {item.reason}</li>)}</ul>
            </div>
            <button type="button" className="secondary-action" onClick={() => folderInput.current?.click()}>读取配图文件夹</button>
          </div>}
          <div className={`live-workspace ${editorOpen ? 'is-editing' : ''}`}>
          {editorOpen && <LeftWorkbench markdown={markdown} stats={analysis.stats} sanitize={sanitize} imageReport={imageReport}
            samples={SAMPLE_ARTICLES} activeSampleId={activeSampleId} localImages={localImageList} imageBusy={imageBusy} saveState={saveState}
            locateRequest={locateRequest} onMarkdownChange={handleMarkdownChange} onSelectSample={handleSelectSample}
            onImportFiles={handleImportFiles} onPicListUpload={handlePicListUpload} onInlineConvert={handleInlineConvert}
            onOpenGuide={() => setGuideOpen(true)} onRemoveImage={handleRemoveImage} />}
          <div className="live-preview">
          <CenterPreview platformId={platformId} platform={platform} themeId={themeId} theme={theme} result={displayResult} passport={passport}
            compiling={compiling} deckKey={contentKey} onDeckDraftChange={(draft) => setDeckDrafts(previous => ({ ...previous, [`${platformId}:${contentKey}`]: draft }))} compileError={compileError} onThemeChange={(id) => { setThemeId(id); }} onCopyText={handleCopyText} onLocate={handleLocate} onToast={showToast} />
          </div></div>
          <div className="step-actions"><p>{saveState === 'saving' ? '正在保存原稿与配图…' : saveState === 'saved' ? '原稿与配图已保存' : '保存失败，请保留原稿与配图'}</p><button type="button" className="primary-action" disabled={!displayResult || compiling} onClick={() => { setStageTab('passport'); setWorkflowStep(3) }}>准备发布 <span aria-hidden="true">→</span></button></div>
        </>}
        {workflowStep === 3 && <section className="publication-workspace">
          <div className="publication-header"><div className="flex items-center gap-3"><PlatformIcon id={platformId} /><div><h2>把文章交给{platform.shortName}</h2><p>{platform.format === 'deck' ? '复制发布文案，上传图集。' : '复制正文，准备标题与摘要。'}</p></div></div></div>
          <nav className="publication-tabs" aria-label="发布准备选项">
            {([{ id: 'passport', label: '正文与标题' }, { id: 'covers', label: '封面（可选）' }] as const).map((item) => <button type="button" key={item.id} aria-current={stageTab === item.id ? 'page' : undefined} onClick={() => setStageTab(item.id)}>{item.label}</button>)}
          </nav>
          <RightPassport aiLoading={aiState.loading} hasAi={Boolean(aiState.value)} markdown={markdown} passport={passport} platform={platform} theme={theme} copyKeys={copyKeys} synced={synced} relaying={relaying}
            section={stageTab} checkSummary={checkSummary} onCopyText={handleCopyText} onRelay={handleRelay} onToast={showToast} />
          <div className="step-actions inside"><button type="button" className="text-action" onClick={() => setWorkflowStep(2)}>← 返回平台预览</button></div>
        </section>}
        <footer className="product-footer"><details><summary>使用与隐私说明</summary><p>草稿与素材保存在当前浏览器，不跨设备同步；清理浏览器数据会删除记录，可通过“完整备份”保存。加载远程图片会访问图片来源；复制正文时，部分平台的引用配图会上传至 PrismPress 的 Vercel Blob 公开存储，正文不上传。任何持有图片链接的人均可访问；清理浏览器不会删除云端图片。使用 PicList 上传会连接本机 PicList。首次进入准备发布时，标题与全文会发送至 aicodemirror.ai 提炼摘要和标签，同稿读取缓存不重复请求，可手动重新提炼。点击生成封面时，正文参考会发送至 AIArtMirror。图集模板排版不调用 AI 服务。发布由你在所选平台完成。</p></details></footer>
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
