import { PlatformIcon, PrismIcon } from './PrismIcon'
import { useState } from 'react'
import type { PlatformProfile, RichTheme, SlideCard } from '@/core'
import { copyPlainText } from '@/core'

interface SocialDeckSimulatorProps {
  platform: PlatformProfile
  theme: RichTheme
  slides: SlideCard[]
  caption: string
  onLocate: (line: number) => void
  onToast: (message: string, tone?: 'success' | 'error' | 'info') => void
}

function wrapCanvasLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const chars = Array.from(text.trim())
  const lines: string[] = []
  let line = ''
  for (const ch of chars) {
    const next = line + ch
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line)
      line = ch
      if (lines.length === maxLines) break
    } else {
      line = next
    }
  }
  if (line && lines.length < maxLines) lines.push(line)
  if (lines.length === maxLines && chars.join('') !== lines.join('')) {
    let last = lines[maxLines - 1]
    while (ctx.measureText(`${last}…`).width > maxWidth && last.length > 0) {
      last = last.slice(0, -1)
    }
    lines[maxLines - 1] = `${last}…`
  }
  return lines
}

async function renderSlideToCanvas(
  slide: SlideCard,
  platformId: string,
  theme: RichTheme,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas')
  const width = 1080
  const height = 1440
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('当前浏览器不支持图集导出')

  const isDouyin = platformId === 'douyin'

  // Background
  const bg = ctx.createLinearGradient(0, 0, width, height)
  if (isDouyin) {
    bg.addColorStop(0, '#070913')
    bg.addColorStop(0.55, '#111629')
    bg.addColorStop(1, '#1B102E')
  } else {
    bg.addColorStop(0, theme.paper)
    bg.addColorStop(0.7, '#FFF9F5')
    bg.addColorStop(1, theme.accentSoft)
  }
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, width, height)

  // Subtle decorative glow / grid
  ctx.save()
  if (isDouyin) {
    ctx.fillStyle = 'rgba(254, 44, 85, 0.14)'
    ctx.beginPath()
    ctx.arc(920, 220, 280, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(37, 244, 238, 0.12)'
    ctx.beginPath()
    ctx.arc(160, 1220, 260, 0, Math.PI * 2)
    ctx.fill()
  } else {
    ctx.fillStyle = 'rgba(255, 36, 66, 0.06)'
    ctx.beginPath()
    ctx.arc(920, 180, 240, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()

  // Top bar
  const pad = 76
  const primaryColor = isDouyin ? '#25F4EE' : '#FF2442'
  const titleColor = isDouyin ? '#FFFFFF' : '#1E293B'
  const bodyColor = isDouyin ? '#CBD5E1' : '#334155'
  const mutedColor = isDouyin ? '#64748B' : '#94A3B8'

  ctx.fillStyle = primaryColor
  ctx.font = '700 24px -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", Arial, sans-serif'
  ctx.fillText(slide.kicker, pad, 108)

  ctx.textAlign = 'right'
  ctx.fillStyle = mutedColor
  ctx.font = '700 28px "SFMono-Regular", Menlo, monospace'
  ctx.fillText(`${String(slide.index).padStart(2, '0')} / ${String(slide.total).padStart(2, '0')}`, width - pad, 108)
  ctx.textAlign = 'left'

  // Title
  ctx.fillStyle = titleColor
  ctx.font = `800 ${slide.kind === 'cover' ? 68 : 54}px -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", Arial, sans-serif`
  const titleLines = wrapCanvasLines(ctx, slide.title, width - pad * 2, 3)
  let y = 195
  for (const line of titleLines) {
    ctx.fillText(line, pad, y)
    y += slide.kind === 'cover' ? 88 : 72
  }

  // Accent divider
  y += 12
  ctx.fillStyle = isDouyin ? '#FE2C55' : '#FF2442'
  ctx.fillRect(pad, y, 110, 8)
  y += 52

  if (slide.subtitle) {
    ctx.fillStyle = isDouyin ? '#25F4EE' : '#E11D48'
    ctx.font = '600 32px -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", Arial, sans-serif'
    const subLines = wrapCanvasLines(ctx, slide.subtitle, width - pad * 2, 2)
    for (const line of subLines) {
      ctx.fillText(line, pad, y)
      y += 46
    }
    y += 22
  }

  const contentWidth = width - pad * 2
  ctx.font = '500 32px -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", Arial, sans-serif'
  const bulletLines = slide.bullets.map((bullet) => wrapCanvasLines(ctx, bullet, contentWidth - 84, 3))
  ctx.font = '600 30px -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", Arial, sans-serif'
  const quoteLines = slide.quote ? wrapCanvasLines(ctx, `“${slide.quote}”`, contentWidth - 56, 3) : []
  const highlightLines = slide.highlight ? wrapCanvasLines(ctx, slide.highlight, contentWidth - 56, 3) : []
  const rows = slide.tableRows ?? []
  const tableHeight = rows.length ? rows.length * 68 + 24 : 0
  const formulaHeight = slide.formulaSvg ? 180 : 0
  const quoteHeight = quoteLines.length ? quoteLines.length * 44 + 68 : 0
  const highlightHeight = highlightLines.length ? highlightLines.length * 44 + 68 : 0
  const contentHeight = bulletLines.reduce((sum, lines) => sum + lines.length * 48 + 66, 0)
    + tableHeight + formulaHeight + quoteHeight + highlightHeight

  let formulaImage: HTMLImageElement | null = null
  if (slide.formulaSvg) {
    const svg = slide.formulaSvg
      .replace(/<svg\b([^>]*)>/, (_match, attributes: string) =>
        `<svg${attributes.replace(/\s(?:width|height|style)="[^"]*"/g, '')} width="900" height="148">`)
      .replace(/currentColor/g, isDouyin ? '#A5F3FC' : '#1E293B')
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
    try {
      formulaImage = new Image()
      formulaImage.src = url
      await formulaImage.decode()
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  // Fit the complete content block above the footer; never silently drop a table or formula.
  const scale = Math.min(1, (height - 150 - y) / Math.max(1, contentHeight))
  ctx.save()
  ctx.translate((width - width * scale) / 2, y)
  ctx.scale(scale, scale)
  y = 0
  bulletLines.forEach((lines, index) => {
    const boxHeight = lines.length * 48 + 44
    ctx.fillStyle = isDouyin ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.88)'
    ctx.strokeStyle = isDouyin ? 'rgba(255,255,255,0.12)' : 'rgba(226,232,240,0.9)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.roundRect(pad, y, contentWidth, boxHeight, 24)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = primaryColor
    ctx.font = '800 30px "SFMono-Regular", Menlo, monospace'
    ctx.fillText(String(index + 1).padStart(2, '0'), pad + 26, y + 54)
    ctx.fillStyle = bodyColor
    ctx.font = '500 32px -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", Arial, sans-serif'
    lines.forEach((line, lineIndex) => ctx.fillText(line, pad + 82, y + 54 + lineIndex * 48))
    y += boxHeight + 22
  })

  if (rows.length) {
    const columns = Math.max(...rows.map((row) => row.length), 1)
    const columnWidth = contentWidth / columns
    rows.forEach((row, rowIndex) => {
      ctx.fillStyle = rowIndex === 0
        ? isDouyin ? '#164E63' : '#FFE4E6'
        : isDouyin ? '#172033' : '#FFFFFF'
      ctx.fillRect(pad, y, contentWidth, 68)
      ctx.strokeStyle = isDouyin ? '#334155' : '#E2E8F0'
      ctx.strokeRect(pad, y, contentWidth, 68)
      ctx.fillStyle = rowIndex === 0 ? primaryColor : bodyColor
      ctx.font = `${rowIndex === 0 ? 700 : 500} 26px -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", Arial, sans-serif`
      row.forEach((cell, columnIndex) => {
        const text = wrapCanvasLines(ctx, cell, columnWidth - 28, 1)[0] ?? ''
        ctx.fillText(text, pad + columnIndex * columnWidth + 14, y + 43)
      })
      y += 68
    })
    y += 24
  }

  if (formulaImage) {
    ctx.fillStyle = isDouyin ? '#0F172A' : '#FFFFFF'
    ctx.beginPath()
    ctx.roundRect(pad, y, contentWidth, 156, 20)
    ctx.fill()
    ctx.drawImage(formulaImage, pad + 14, y + 4, contentWidth - 28, 148)
    y += 180
  }

  for (const lines of [highlightLines, quoteLines]) {
    if (!lines.length) continue
    const boxHeight = lines.length * 44 + 44
    ctx.fillStyle = isDouyin ? 'rgba(37,244,238,0.10)' : 'rgba(255,36,66,0.08)'
    ctx.beginPath()
    ctx.roundRect(pad, y, contentWidth, boxHeight, 20)
    ctx.fill()
    ctx.fillStyle = isDouyin ? '#A5F3FC' : '#BE123C'
    ctx.font = '600 30px -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", Arial, sans-serif'
    lines.forEach((line, index) => ctx.fillText(line, pad + 28, y + 44 + index * 44))
    y += boxHeight + 24
  }
  ctx.restore()

  // Footer
  ctx.fillStyle = mutedColor
  ctx.font = '600 24px -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", Arial, sans-serif'
  ctx.fillText('PrismPress 棱镜发布台 · Lavenda', pad, height - 68)
  ctx.textAlign = 'right'
  ctx.fillStyle = primaryColor
  ctx.fillText(slide.index < slide.total ? '右划看下一张 →' : '章节回顾', width - pad, height - 68)
  ctx.textAlign = 'left'

  return canvas
}

export function SocialDeckSimulator({
  platform,
  theme,
  slides,
  caption,
  onLocate,
  onToast,
}: SocialDeckSimulatorProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const isDouyin = platform.id === 'douyin'
  const current = slides[Math.min(activeIndex, Math.max(0, slides.length - 1))] ?? slides[0]

  const [exporting, setExporting] = useState(false)

  const downloadSlidePng = async (slide: SlideCard) => {
    const canvas = await renderSlideToCanvas(slide, platform.id, theme)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) throw new Error('导出卡片失败')
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${platform.id}-slide-${String(slide.index).padStart(2, '0')}-3x4.png`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const exportSlides = async (selectedSlides: SlideCard[]) => {
    if (exporting) return
    setExporting(true)
    try {
      for (const slide of selectedSlides) await downloadSlidePng(slide)
      onToast(`已导出 ${selectedSlides.length} 张章节摘要卡片`, 'success')
    } catch {
      onToast('图集导出失败，请重试；公式或图片尚未准备好', 'error')
    } finally {
      setExporting(false)
    }
  }

  const handleCopyCaption = async () => {
    try {
      await copyPlainText(caption)
      onToast(`已复制${platform.name}章节摘要文案与 #话题标签`, 'success')
    } catch {
      onToast('复制失败，请检查剪贴板权限', 'error')
    }
  }

  if (!current) return null

  return (
    <div
      className="h-full overflow-y-auto p-4 sm:p-6"
      style={{
        background: isDouyin
          ? 'radial-gradient(circle at 20% 0%, rgba(254,44,85,0.16), transparent 50%), radial-gradient(circle at 80% 100%, rgba(37,244,238,0.14), transparent 50%), #070912'
          : 'linear-gradient(160deg, #FFF5F6 0%, #FDFBF9 55%, #F8F4F0 100%)',
      }}
    >
      {/* 顶部模式说明与一键导出栏 */}
      <div
        className={`mx-auto mb-5 flex max-w-[820px] flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 shadow-sm ${
          isDouyin
            ? 'border-white/15 bg-slate-900/90 text-slate-100'
            : 'border-rose-200/80 bg-white/95 text-slate-800'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center">
            <PlatformIcon id={isDouyin ? 'douyin' : 'xiaohongshu'} />
          </span>
          <div>
            <p className="text-xs font-bold">
              {isDouyin
                ? '抖音 · 章节摘要图集'
                : '小红书 · 章节摘要图集'}
            </p>
            <p className={`text-[10.5px] ${isDouyin ? 'text-slate-400' : 'text-slate-500'}`}>
              共 {slides.length} 张摘要卡，未包含原文的全部文字与配图。点击卡片可回到原稿。
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => exportSlides([current])}
            disabled={exporting}
            className={`rounded-xl border px-3 py-1.5 text-[11px] font-semibold transition ${
              isDouyin
                ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-300 hover:bg-cyan-400/20'
                : 'border-rose-300 bg-rose-50 text-rose-600 hover:bg-rose-100'
            }`}
          >
            <PrismIcon name="download" /> 导出当前卡 PNG (3:4)
          </button>
          <button
            type="button"
            onClick={() => exportSlides(slides)}
            disabled={exporting}
            className="rounded-xl px-3 py-1.5 text-[11px] font-semibold text-white shadow transition hover:opacity-95"
            style={{
              background: isDouyin
                ? 'linear-gradient(90deg, #FE2C55 0%, #00C4CC 100%)'
                : '#FF2442',
            }}
          >
            <PrismIcon name="image" /> 一键导出全套 {slides.length} 张图集
          </button>
        </div>
      </div>

      {/* 主体：左侧 3:4 手机真机卡片轮播 + 右侧摘要文案与缩略图轨 */}
      <div className="mx-auto grid max-w-[820px] grid-cols-1 gap-6 lg:grid-cols-12">
        {/* 左侧：3:4 手机屏幕仿真与卡片 */}
        <div className="flex flex-col items-center lg:col-span-7">
          <div
            className={`w-full max-w-[400px] overflow-hidden rounded-[32px] border-[6px] shadow-[0_28px_80px_rgba(15,23,42,0.28)] transition-all ${
              isDouyin
                ? 'border-slate-800 bg-[#0B0E1A] text-white'
                : 'border-slate-900/90 bg-white text-slate-900'
            }`}
          >
            {/* App 顶部导航栏仿真 */}
            <div
              className={`flex items-center justify-between border-b px-4 py-2.5 text-xs ${
                isDouyin ? 'border-white/10 bg-[#0B0E1A]' : 'border-slate-100 bg-white'
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ backgroundColor: isDouyin ? '#FE2C55' : '#FF2442' }}
                >
                  L
                </div>
                <span className="font-semibold">Lavenda · AI产品与技术</span>
              </div>
              <span
                className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold text-white"
                style={{ backgroundColor: isDouyin ? '#FE2C55' : '#FF2442' }}
              >
                + 关注
              </span>
            </div>

            {/* 3:4 黄金比例知识卡片舞台 */}
            <div
              onClick={() => onLocate(current.sourceLine)}
              title={`点击反查左侧 Markdown 第 ${current.sourceLine} 行`}
              className="relative flex aspect-[3/4] w-full cursor-pointer flex-col justify-between p-6 transition"
              style={{
                background: isDouyin
                  ? 'linear-gradient(155deg, #090D1A 0%, #131B33 60%, #24102C 100%)'
                  : 'linear-gradient(165deg, #FFFDFB 0%, #FFF6F7 65%, #FCE7EC 100%)',
              }}
            >
              {/* Kicker & 页码 */}
              <div>
                <div className="flex items-center justify-between">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider ${
                      isDouyin
                        ? 'bg-cyan-400/15 text-cyan-300 ring-1 ring-cyan-400/30'
                        : 'bg-rose-500/10 text-rose-600 ring-1 ring-rose-500/20'
                    }`}
                  >
                    {current.kicker}
                  </span>
                  <span className="font-mono text-xs font-bold opacity-60">
                    {String(current.index).padStart(2, '0')} / {String(current.total).padStart(2, '0')}
                  </span>
                </div>

                {/* 主标题 */}
                <h3
                  className={`mt-3.5 font-extrabold leading-snug tracking-tight ${
                    current.kind === 'cover' ? 'text-[22px]' : 'text-[19px]'
                  } ${isDouyin ? 'text-white' : 'text-slate-900'}`}
                >
                  {current.title}
                </h3>

                <div
                  className="mt-2.5 h-1 w-12 rounded-full"
                  style={{
                    background: isDouyin
                      ? 'linear-gradient(90deg, #FE2C55, #25F4EE)'
                      : '#FF2442',
                  }}
                />

                {current.subtitle && (
                  <p
                    className={`mt-2.5 text-[12px] font-medium leading-relaxed ${
                      isDouyin ? 'text-cyan-300' : 'text-rose-700'
                    }`}
                  >
                    {current.subtitle}
                  </p>
                )}

                {/* 核心知识要点列表 */}
                <div className="mt-3.5 space-y-2">
                  {current.bullets.map((bullet, idx) => (
                    <div
                      key={idx}
                      className={`flex items-start gap-2.5 rounded-xl border p-2.5 text-[12px] leading-relaxed ${
                        isDouyin
                          ? 'border-white/10 bg-white/[0.06] text-slate-200'
                          : 'border-rose-100 bg-white/90 text-slate-700 shadow-xs'
                      }`}
                    >
                      <span
                        className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full font-mono text-[9.5px] font-bold text-white"
                        style={{ backgroundColor: isDouyin ? '#FE2C55' : '#FF2442' }}
                      >
                        {idx + 1}
                      </span>
                      <span className="min-w-0 flex-1">{bullet}</span>
                    </div>
                  ))}
                </div>

                {/* 表格微缩预览 */}
                {current.tableRows && current.tableRows.length > 0 && (
                  <div
                    className={`mt-3 overflow-hidden rounded-xl border text-[10px] ${
                      isDouyin ? 'border-white/15 bg-black/30' : 'border-rose-200 bg-white'
                    }`}
                  >
                    {current.tableRows.map((row, rIdx) => (
                      <div
                        key={rIdx}
                        style={{ gridTemplateColumns: `repeat(${Math.max(...current.tableRows!.map((cells) => cells.length), 1)}, minmax(0, 1fr))` }}
                        className={`grid gap-1 px-2.5 py-1.5 ${
                          rIdx === 0
                            ? isDouyin
                              ? 'bg-cyan-500/20 font-bold text-cyan-200'
                              : 'bg-rose-50 font-bold text-rose-700'
                            : 'border-t border-white/10 opacity-90'
                        }`}
                      >
                        {row.map((cell, cIdx) => (
                          <span key={cIdx} className="truncate">
                            {cell}
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                )}

                {/* 公式 SVG 内嵌 */}
                {current.formulaSvg && (
                  <div
                    className={`mt-3 overflow-x-auto rounded-xl border p-2 text-center ${
                      isDouyin
                        ? 'border-cyan-400/25 bg-slate-900/90 text-cyan-200'
                        : 'border-rose-200 bg-white text-slate-800'
                    }`}
                    dangerouslySetInnerHTML={{ __html: current.formulaSvg }}
                  />
                )}

                {current.highlight && (
                  <pre className={`mt-3 whitespace-pre-wrap break-words rounded-xl p-3 text-[11px] ${isDouyin ? 'bg-slate-900 text-cyan-200' : 'bg-rose-50 text-slate-800'}`}>{current.highlight}</pre>
                )}

                {/* 金句高亮框 */}
                {current.quote && (
                  <div
                    className={`mt-3 rounded-xl border-l-4 px-3 py-2 text-[11px] font-medium italic ${
                      isDouyin
                        ? 'border-cyan-400 bg-cyan-400/10 text-cyan-200'
                        : 'border-rose-500 bg-rose-50/90 text-rose-800'
                    }`}
                  >
                    “{current.quote}”
                  </div>
                )}
              </div>

              {/* 卡片底部页脚 */}
              <div className="flex items-center justify-between border-t border-current/10 pt-2.5 text-[10px] opacity-75">
                <span>PrismPress · L{current.sourceLine} 点击定位源码</span>
                <span className="font-semibold">
                  {current.index < current.total ? '右划看下一张 →' : '章节回顾'}
                </span>
              </div>
            </div>

            {/* 轮播圆点与翻页控制栏 */}
            <div
              className={`flex items-center justify-between border-t px-4 py-2.5 ${
                isDouyin ? 'border-white/10 bg-[#0B0E1A]' : 'border-slate-100 bg-white'
              }`}
            >
              <button
                type="button"
                disabled={activeIndex === 0}
                onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
                className="rounded-lg border border-current/15 px-2.5 py-1 text-[11px] font-medium disabled:opacity-30"
              >
                ← 上一张
              </button>
              <div className="flex items-center gap-1.5">
                {slides.map((s, idx) => (
                  <button
                    key={s.index}
                    type="button"
                    onClick={() => setActiveIndex(idx)}
                    aria-label={`切换到第 ${idx + 1} 张卡片`}
                    className={`h-2 rounded-full transition-all ${
                      idx === activeIndex ? 'w-5' : 'w-2 opacity-35'
                    }`}
                    style={{
                      backgroundColor:
                        idx === activeIndex ? (isDouyin ? '#25F4EE' : '#FF2442') : 'currentColor',
                    }}
                  />
                ))}
              </div>
              <button
                type="button"
                disabled={activeIndex >= slides.length - 1}
                onClick={() => setActiveIndex((i) => Math.min(slides.length - 1, i + 1))}
                className="rounded-lg border border-current/15 px-2.5 py-1 text-[11px] font-medium disabled:opacity-30"
              >
                下一张 →
              </button>
            </div>
          </div>
        </div>

        {/* 右侧：全套卡片缩略图矩阵 + 20字内标题与种草文案 */}
        <div className="flex flex-col gap-4 lg:col-span-5">
          <div
            className={`rounded-2xl border p-3.5 ${
              isDouyin
                ? 'border-white/15 bg-slate-900/90 text-slate-100'
                : 'border-rose-200/80 bg-white/95 text-slate-800 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold">
                🗂️ 全套 {slides.length} 张图集流（点击切换）
              </span>
              <span className="font-mono text-[10px] opacity-60">3:4 · 1080×1440</span>
            </div>
            <div className="mt-2.5 grid grid-cols-3 gap-2">
              {slides.map((s, idx) => {
                const active = idx === activeIndex
                return (
                  <button
                    key={s.index}
                    type="button"
                    onClick={() => setActiveIndex(idx)}
                    className={`flex flex-col justify-between rounded-xl border p-2 text-left transition ${
                      active
                        ? isDouyin
                          ? 'border-cyan-400 bg-cyan-400/15'
                          : 'border-rose-500 bg-rose-50/90 ring-2 ring-rose-500/20'
                        : isDouyin
                          ? 'border-white/10 bg-white/[0.03] hover:border-white/25'
                          : 'border-slate-200 bg-slate-50/70 hover:border-rose-300'
                    }`}
                  >
                    <span className="font-mono text-[9.5px] font-bold opacity-70">
                      P0{s.index} · {s.kind === 'cover' ? '封面' : s.kind === 'outro' ? '尾卡' : '干货'}
                    </span>
                    <p className="mt-1 line-clamp-2 text-[10.5px] font-semibold leading-tight">
                      {s.title}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>

          <div
            className={`flex flex-1 flex-col rounded-2xl border p-3.5 ${
              isDouyin
                ? 'border-white/15 bg-slate-900/90 text-slate-100'
                : 'border-rose-200/80 bg-white/95 text-slate-800 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold">
                  <PrismIcon name={isDouyin ? 'music' : 'book'} />{isDouyin ? '抖音 · 短标题与章节摘要' : '小红书 · 短标题与章节摘要'}
                </p>
                <p className="text-[10px] opacity-60">按原稿整理，发布前请核对并调整。</p>
              </div>
              <button
                type="button"
                onClick={handleCopyCaption}
                className="shrink-0 rounded-lg px-2.5 py-1 text-[10.5px] font-semibold text-white shadow"
                style={{ backgroundColor: isDouyin ? '#FE2C55' : '#FF2442' }}
              >
                <PrismIcon name="copy" /> 复制文案
              </button>
            </div>

            <pre
              className={`mt-2.5 flex-1 overflow-y-auto whitespace-pre-wrap rounded-xl border p-3 font-sans text-[11.5px] leading-relaxed ${
                isDouyin
                  ? 'border-white/10 bg-black/40 text-slate-200'
                  : 'border-rose-100 bg-rose-50/40 text-slate-700'
              }`}
            >
              {caption}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}
