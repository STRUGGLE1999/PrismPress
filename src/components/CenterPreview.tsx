import { PrismIcon } from '@/components/PrismIcon'
import { useState } from 'react'
import type { MouseEvent } from 'react'
import type {
  ClipboardMime,
  CompileResult,
  MetadataPassport,
  PlatformId,
  PlatformProfile,
  RichTheme,
  ThemePreset,
} from '@/core'
import { RICH_THEMES } from '@/core'
import { SocialDeckSimulator } from './SocialDeckSimulator'

interface CenterPreviewProps {
  platformId: PlatformId
  platform: PlatformProfile
  themeId: ThemePreset
  theme: RichTheme
  result: CompileResult | null
  passport: MetadataPassport
  compiling: boolean
  compileError: string | null
  onThemeChange: (id: ThemePreset) => void
  onCopyText: (text: string, label: string) => void
  onLocate: (line: number) => void
  onToast: (message: string, tone?: 'success' | 'error' | 'info') => void
}

function formatClipboard(mime: ClipboardMime, format: string): string {
  if (format === 'deck') return '章节摘要图集 · 3:4'
  return mime === 'text/html' ? '适配富文本编辑器' : '适配 Markdown 编辑器'
}

export function CenterPreview({
  platformId,
  platform,
  themeId,
  theme,
  result,
  passport,
  compiling,
  compileError,
  onThemeChange,
  onCopyText,
  onLocate,
  onToast,
}: CenterPreviewProps) {
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop')
  const [markdownTab, setMarkdownTab] = useState<'rendered' | 'raw'>('rendered')

  const previewHtml =
    result?.format === 'html'
      ? result.body.replace(/^(\s*<section[^>]*>)?\s*<h[12][^>]*>[\s\S]*?<\/h[12]>\s*/i, '$1')
      : ''

  const handlePreviewClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    if (target.closest('a')) return
    const block = target.closest<HTMLElement>('[data-source-line]')
    if (!block) return
    const line = Number(block.dataset.sourceLine)
    if (Number.isFinite(line) && line > 0) onLocate(line)
  }


  return (
    <div className="preview-panel flex min-h-[620px] flex-col overflow-hidden rounded-[22px] border border-[#EAE4DC] bg-white/90 shadow-[0_14px_40px_rgba(39,39,42,0.05)] backdrop-blur-md lg:h-[760px]">
      <div className="flex items-center justify-between gap-3 border-b border-[#EAE4DC] px-5 py-3">
        <h2 className="text-sm font-bold">{platform.name} · 排版预览</h2>
        <span className="text-xs text-[#71717A]">{formatClipboard(platform.clipboard, platform.format)}</span>
      </div>
      <>
          {platformId === 'wechat' && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EAE4DC] bg-[#FAF8F5] px-4 py-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-semibold text-[#71717A]">公众号模板：</span>
                {RICH_THEMES.map((item) => {
                  const active = item.id === themeId
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onThemeChange(item.id)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-semibold transition ${
                        active
                          ? 'bg-white text-[#27272A] shadow-2xs'
                          : 'border-transparent text-[#71717A] hover:bg-white/70 hover:text-[#27272A]'
                      }`}
                      style={active ? { borderColor: `${item.accent}77` } : undefined}
                      title={item.description}
                    >
                      <span className="flex -space-x-0.5">
                        <span className="h-2.5 w-2.5 rounded-full border border-white" style={{ backgroundColor: item.accent }} />
                        <span className="h-2.5 w-2.5 rounded-full border border-white" style={{ backgroundColor: item.paper }} />
                      </span>
                      {item.name.split(' · ')[1] ?? item.name}
                    </button>
                  )
                })}
              </div>

              <div className="inline-flex rounded-full border border-[#EAE4DC] bg-white p-0.5 text-[10px]">
                <button
                  type="button"
                  onClick={() => setViewport('desktop')}
                  className={`rounded-full px-2.5 py-0.5 font-semibold transition ${
                    viewport === 'desktop' ? 'bg-[#27272A] text-white' : 'text-[#71717A]'
                  }`}
                >
                  <PrismIcon name="desktop" /> 宽屏
                </button>
                <button
                  type="button"
                  onClick={() => setViewport('mobile')}
                  className={`rounded-full px-2.5 py-0.5 font-semibold transition ${
                    viewport === 'mobile' ? 'bg-[#27272A] text-white' : 'text-[#71717A]'
                  }`}
                >
                  <PrismIcon name="phone" /> 375px 手机
                </button>
              </div>
            </div>
          )}

          {result?.format === 'markdown' && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EAE4DC] bg-[#FAF8F5] px-4 py-2">
              <span className="text-[11px] text-[#52525B]">{platform.protocolNote}</span>
              <div className="inline-flex rounded-full border border-[#EAE4DC] bg-white p-0.5 text-[10px]">
                <button
                  type="button"
                  onClick={() => setMarkdownTab('rendered')}
                  className={`rounded-full px-2.5 py-0.5 font-semibold transition ${
                    markdownTab === 'rendered' ? 'bg-[#27272A] text-white' : 'text-[#71717A]'
                  }`}
                >
                  <PrismIcon name="palette" /> 文章视图
                </button>
                <button
                  type="button"
                  onClick={() => setMarkdownTab('raw')}
                  className={`rounded-full px-2.5 py-0.5 font-semibold transition ${
                    markdownTab === 'raw' ? 'bg-[#27272A] text-white' : 'text-[#71717A]'
                  }`}
                >
                  <PrismIcon name="document" /> Markdown 源码
                </button>
              </div>
            </div>
          )}

          {result && result.diagnostics.length > 0 && <details className="preview-diagnostics">
            <summary>查看适配说明 · {result.diagnostics.length} 项{result.images.red + result.images.yellow > 0 ? '，图片地址需关注' : ''}</summary>
            <ul>{result.diagnostics.map((diag, index) => <li key={`${diag.code}-${index}`}>{diag.message}</li>)}</ul>
          </details>}

      </>

      {/* 主内容视口 */}
      <div className="relative flex-1 overflow-hidden">
        {compiling && <div className="prism-loading absolute inset-x-0 top-0 z-20 h-0.5" />}

        {compileError ? (
          <div className="flex h-full items-center justify-center p-6">
            <div className="max-w-sm rounded-2xl border border-rose-200 bg-rose-50 p-5 text-center">
              <p className="text-xs font-bold text-rose-700">编译链路中断</p>
              <p className="mt-1 text-[11px] leading-5 text-rose-600">{compileError}</p>
            </div>
          </div>
        ) : !result ? (
          <div className="flex h-full flex-col gap-3 p-6">
            {[72, 88, 64, 92, 56, 78].map((width) => (
              <div
                key={width}
                className="h-3 animate-pulse rounded-full bg-[#F3EFE8]"
                style={{ width: `${width}%` }}
              />
            ))}
          </div>
        ) : result.format === 'deck' && result.slides ? (
          /* 1. 小红书 / 抖音 3:4 视觉图集真机模拟器 */
          <SocialDeckSimulator
            key={platformId}
            platform={platform}
            theme={theme}
            slides={result.slides}
            caption={result.body}
            onLocate={onLocate}
            onToast={onToast}
          />
        ) : platformId === 'zhihu' ? (
          /* 2. 知乎专栏蓝白真机外壳 */
          <div className="h-full overflow-y-auto bg-[#F6F6F6] text-[#121212]">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-2.5 shadow-2xs">
              <div className="flex items-center gap-3">
                <span className="text-lg font-black tracking-tight text-[#0066FF]">知乎</span>
                <span className="h-4 w-px bg-slate-200" />
                <span className="text-xs font-semibold text-slate-600">专栏 · 写文章预览</span>
              </div>
              <div className="flex items-center gap-1.5">
                {passport.zhihuTopics.map((topic) => (
                  <span
                    key={topic}
                    className="rounded-full bg-[#0066FF]/10 px-2.5 py-0.5 text-[10.5px] font-medium text-[#0066FF]"
                  >
                    #{topic}
                  </span>
                ))}
              </div>
            </div>

            <div className="mx-auto max-w-[690px] bg-white px-6 py-8 shadow-xs sm:my-5 sm:rounded-xl sm:px-10">
              <h1 className="text-[24px] font-bold leading-snug text-[#121212]">
                {passport.title}
              </h1>
              <div className="mt-4 flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0066FF] text-xs font-bold text-white">
                    L
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">Lavenda</p>
                    <p className="text-[11px] text-slate-400">
                      AI 产品与解决方案 · H3/H4 已自动降维，标题已转换
                    </p>
                  </div>
                </div>
                <span className="rounded-md bg-[#0066FF]/10 px-2.5 py-1 text-[11px] font-semibold text-[#0066FF]">
                  排版预览
                </span>
              </div>

              <div
                className="rich-preview mt-6 text-[16px] leading-[1.8]"
                onClick={handlePreviewClick}
                dangerouslySetInnerHTML={{ __html: previewHtml || result.body }}
              />

              <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-xs text-slate-500">
                <div className="flex items-center gap-3">
                  <span className="rounded bg-[#0066FF]/10 px-3 py-1.5 font-semibold text-[#0066FF]">
                    赞同
                  </span>
                  <span>评论</span>
                  <span>⭐ 收藏</span>
                  <span>❤️ 喜欢</span>
                </div>
                <span className="text-[11px] text-slate-400">知乎专栏样式预览</span>
              </div>
            </div>
          </div>
        ) : platformId === 'bilibili' ? (
          /* 3. B站专栏次元粉白卡片 + 置顶课代表评论框 */
          <div className="h-full overflow-y-auto bg-[#F1F2F3] text-[#18191C]">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-pink-100 bg-white px-6 py-2.5">
              <div className="flex items-center gap-2.5">
                <span className="rounded-md bg-[#FB7299] px-2 py-0.5 text-xs font-extrabold text-white">
                  bilibili 专栏
                </span>
                <span className="text-xs font-medium text-slate-500">
                  科技 / 野生技术协会 · H3/H4 已转 ◆ 章节高亮
                </span>
              </div>
              <span className="rounded-full bg-pink-50 px-2.5 py-0.5 text-[11px] font-semibold text-[#FB7299]">
                一键三连 ⚡
              </span>
            </div>

            <div className="mx-auto max-w-[720px] bg-white px-6 py-8 shadow-xs sm:my-5 sm:rounded-2xl sm:px-10">
              <h1 className="text-[23px] font-extrabold leading-snug text-[#18191C]">
                {passport.title}
              </h1>
              <div className="mt-3 flex items-center justify-between rounded-xl bg-[#F6F7F8] px-4 py-2.5 text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FB7299] font-bold text-white">
                    UP
                  </div>
                  <div>
                    <p className="font-bold text-[#FB7299]">Lavenda</p>
                    <p className="text-[10.5px] text-slate-400">阅读 {passport.readingMinutes} 分钟 · 专栏原声排版</p>
                  </div>
                </div>
                <span className="rounded-full bg-[#FB7299] px-3 py-1 text-[11px] font-semibold text-white">
                  + 关注 UP 主
                </span>
              </div>

              <div className="mt-5 rounded-xl border border-pink-200 bg-pink-50/70 p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#FB7299]">
                    📌 评论区置顶 · 课代表省流总结
                  </span>
                  <button
                    type="button"
                    onClick={() => onCopyText(passport.bilibiliSummary, 'B站省流总结')}
                    className="rounded-full bg-[#FB7299] px-2.5 py-0.5 text-[10px] font-semibold text-white"
                  >
                    复制省流
                  </button>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-700">
                  {passport.bilibiliSummary}
                </p>
              </div>

              <div
                className="rich-preview mt-6"
                onClick={handlePreviewClick}
                dangerouslySetInnerHTML={{ __html: previewHtml || result.body }}
              />
            </div>
          </div>
        ) : platformId === 'wechat' ? (
          /* 4. 微信公众号高定模板真机视口 */
          <div
            className="h-full overflow-y-auto p-4 sm:p-6"
            style={{ backgroundColor: theme.dark ? '#111827' : '#F3F0EA' }}
          >
            <div
              key={`${platformId}-${themeId}-${viewport}`}
              className={`prism-rise mx-auto min-h-full overflow-hidden shadow-[0_20px_60px_rgba(39,39,42,0.12)] transition-all duration-300 ${
                viewport === 'mobile'
                  ? 'max-w-[389px] rounded-[36px] border-[7px] border-[#27272A]'
                  : 'max-w-[690px] rounded-2xl'
              }`}
              style={{
                backgroundColor: theme.paper,
                color: theme.text,
              }}
            >
              <div
                className={`border-b pb-4 pt-6 ${viewport === 'mobile' ? 'px-4' : 'px-5 sm:px-8'}`}
                style={{ borderColor: `${theme.border}88` }}
              >
                <h1
                  className="text-[21px] font-bold leading-snug"
                  style={{ color: theme.heading, fontFamily: theme.headingFontFamily }}
                >
                  {passport.title}
                </h1>
                <div className="mt-2.5 flex flex-wrap items-center gap-2.5 text-[12px]" style={{ color: theme.muted }}>
                  <span
                    className="rounded px-1.5 py-0.5 text-[10.5px] font-medium"
                    style={{ backgroundColor: theme.accentSoft, color: theme.accent }}
                  >
                    原创
                  </span>
                  <span>Lavenda</span>
                  <span className="font-semibold" style={{ color: theme.accent }}>
                    PrismPress 棱镜专栏
                  </span>
                  <span>· {theme.name}</span>
                </div>
              </div>

              <div
                className={`rich-preview py-6 ${viewport === 'mobile' ? 'px-4' : 'px-5 sm:px-8'}`}
                onClick={handlePreviewClick}
                dangerouslySetInnerHTML={{ __html: previewHtml || result.body }}
              />

              <div
                className="flex items-center justify-between border-t px-5 py-3.5 text-[12px] sm:px-8"
                style={{ borderColor: `${theme.border}88`, color: theme.muted }}
              >
                <span>文章预览</span>
                <div className="flex items-center gap-4">
                  <span>点赞</span>
                  <span>在看</span>
                  <span>💬 写留言</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* 5. 开发者社区（掘金 / CSDN）双视图：文章视图 vs 净化源码行号视图 */
          <div className="h-full overflow-y-auto bg-[#F4F5F7] text-slate-900">
            <div
              className="sticky top-0 z-10 flex items-center justify-between border-b px-5 py-2.5 text-xs shadow-2xs"
              style={{
                backgroundColor: platformId === 'juejin' ? '#FFFFFF' : '#FFF8F6',
                borderColor: `${platform.accent}33`,
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="rounded px-2 py-0.5 text-[11px] font-extrabold text-white"
                  style={{ backgroundColor: platform.accent }}
                >
                  {platform.name}
                </span>
                <span className="text-[11px] text-slate-600">
                  {platformId === 'juejin'
                    ? `分类：${passport.category.juejin} · 摘要硬卡点 ${passport.summaries.juejin.length}/100 字 ✅`
                    : '已自动注入 @[TOC](文章目录) · 原创专栏排版'}
                </span>
              </div>
              <span className="font-mono text-[10.5px] font-semibold" style={{ color: platform.accent }}>
                {markdownTab === 'rendered' ? '文章结构预览' : 'text/plain 源码视图'}
              </span>
            </div>

            {markdownTab === 'raw' ? (
              <div className="min-h-full bg-[#FAF8F5] p-4 font-mono text-[12.5px] leading-6 text-[#27272A]">
                {result.body.split('\n').map((lineText, idx) => {
                  const mappedLine = result.sanitize.lineMap[idx] ?? idx + 1
                  return (
                    <div
                      key={idx}
                      onClick={() => onLocate(mappedLine)}
                      className="group flex cursor-pointer items-start gap-3 rounded px-2 py-0.5 transition hover:bg-[#FFF2F2]"
                      title={`点击定位到左侧源码第 ${mappedLine} 行`}
                    >
                      <span className="w-8 shrink-0 select-none text-right text-[10px] text-[#A1A1AA] group-hover:text-[#FF5A5F]">
                        {idx + 1}
                      </span>
                      <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">
                        {lineText || ' '}
                      </span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="mx-auto max-w-[780px] p-4 sm:p-6">
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
                  <div className="border-b border-slate-100 px-6 py-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="rounded px-2 py-0.5 text-[10.5px] font-bold text-white"
                        style={{ backgroundColor: platform.accent }}
                      >
                        原创
                      </span>
                      <h1 className="text-xl font-bold text-slate-900">{passport.title}</h1>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                      <span>作者：Lavenda</span>
                      <span>·</span>
                      <span>阅读 {passport.readingMinutes} 分钟</span>
                      <span>·</span>
                      <span>标签：</span>
                      {passport.tags.slice(0, 4).map((t) => (
                        <span
                          key={t}
                          className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                          style={{
                            backgroundColor: `${platform.accent}15`,
                            color: platform.accent,
                          }}
                        >
                          {t}
                        </span>
                      ))}
                    </div>

                    <div
                      className="mt-3 rounded-xl border-l-4 p-3 text-xs leading-relaxed text-slate-600"
                      style={{
                        borderColor: platform.accent,
                        backgroundColor: `${platform.accent}09`,
                      }}
                    >
                      <strong className="mr-1.5" style={{ color: platform.accent }}>
                        [{platform.name}专属卡点摘要]
                      </strong>
                      {platformId === 'juejin'
                        ? passport.summaries.juejin.text
                        : passport.summaries.csdn.text}
                    </div>
                  </div>

                  {platformId === 'csdn' && (
                    <div className="border-b border-orange-100 bg-orange-50/50 px-6 py-3 text-xs text-orange-900">
                      <span className="font-bold text-[#FC5531]">📑 @[TOC](文章目录) 已自动注入顶部</span>
                      <span className="ml-2 text-[11px] text-slate-500">
                        粘贴至 CSDN Markdown 编辑器后将自动生成侧边悬浮目录树
                      </span>
                    </div>
                  )}

                  <div className="divide-y divide-slate-100 px-6 py-4 font-mono text-[12.5px] leading-7 text-slate-800">
                    {result.body.split('\n').map((lineText, idx) => {
                      const mappedLine = result.sanitize.lineMap[idx] ?? idx + 1
                      const isHeading = /^#{1,6}\s/.test(lineText)
                      const isToc = /^@\[TOC\]/.test(lineText)
                      return (
                        <div
                          key={idx}
                          onClick={() => onLocate(mappedLine)}
                          className={`group flex cursor-pointer items-baseline gap-3 border-none py-0.5 transition hover:bg-slate-100/90 ${
                            isHeading ? 'py-1.5 font-sans text-[15px] font-bold text-slate-900' : ''
                          } ${isToc ? 'font-bold text-[#FC5531]' : ''}`}
                          title={`点击定位到左侧源码第 ${mappedLine} 行`}
                        >
                          <span className="w-7 shrink-0 select-none text-right font-mono text-[10px] text-slate-400 group-hover:text-slate-700">
                            L{idx + 1}
                          </span>
                          <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">
                            {lineText || ' '}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-[#EAE4DC] px-5 py-3 text-xs text-[#71717A]">排版效果仅供预览，请在官方编辑器粘贴后检查。点击正文可返回原稿对应位置。</div>
    </div>
  )
}
