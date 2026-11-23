import type { MetadataPassport, PlatformId, PlatformProfile, RichTheme } from '@/core'
import { extractPassport, passportState } from './passportState'
import { CoverStudio } from './CoverStudio'
import { PrismIcon } from './PrismIcon'

interface RightPassportProps {
  markdown: string
  aiLoading: boolean
  hasAi: boolean
  passport: MetadataPassport
  platform: PlatformProfile
  theme: RichTheme
  copyKeys: Record<PlatformId, string>
  synced: Partial<Record<PlatformId, string>>
  relaying: PlatformId | null
  relayMessage: string
  relayError: string
  onCancelRelay: () => void
  section: 'passport' | 'covers'
  checkSummary?: string
  onCopyText: (text: string, label: string) => void
  onRelay: (id: PlatformId) => void
  onToast: (message: string, tone?: 'success' | 'error' | 'info') => void
}

export function RightPassport({ markdown, aiLoading, hasAi, passport, platform, theme, copyKeys, synced, relaying, relayMessage, relayError, onCancelRelay,
  section, checkSummary, onCopyText, onRelay, onToast,
}: RightPassportProps) {
  const handleAiExtract = async () => {
    try {
      await extractPassport(markdown, passport.title)
      onToast(passportState(markdown).saved ? '发布资料已更新' : 'AI 提炼完成，但浏览器未能保存，请及时复制', passportState(markdown).saved ? 'success' : 'info')
    } catch (error) { onToast(error instanceof Error ? error.message : 'AI 提炼失败，请稍后重试', 'error') }
  }
  if (section === 'covers') {
    return <section className="publication-panel">
      <h2>为这篇文章准备封面</h2>
      <p className="section-description">选择风格和比例，生成文章封面。</p>
      <CoverStudio markdown={markdown} title={passport.title} theme={theme} category={passport.category.generic} onToast={onToast} />
    </section>
  }

  const isDeck = platform.format === 'deck'
  const isSocial = platform.id === 'xiaohongshu' || platform.id === 'douyin'
  const summary = !isDeck && (platform.id === 'wechat' || platform.id === 'juejin' || platform.id === 'csdn' || platform.id === 'douyin')
    ? passport.summaries[platform.id] : null
  const tags = passport.tags.slice(0, platform.id === 'juejin' || platform.id === 'zhihu' ? 3 : platform.id === 'bilibili' ? 6 : 5)
  const fields = [
    { label: isDeck ? '短标题（20 字内）' : '文章标题', value: isDeck ? passport.shortTitle20 : passport.title },
    ...(summary ? [{ label: '文章摘要', value: summary.text }] : []),
    { label: isSocial || platform.id === 'wechat' ? '话题' : '标签', value: isSocial || platform.id === 'wechat' ? tags.map(tag => `#${tag}`).join(' ') : tags.join(', ') },
    ...(platform.id === 'bilibili' ? [{ label: '评论区总结（可选）', value: passport.bilibiliSummary }] : []),
  ]
  const categoryLabel = platform.id === 'juejin'
    ? passport.category.juejin
    : passport.category.generic
  return <section className="publication-panel">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2>{platform.shortName}的发布资料</h2>
        <p className="section-description">
          {aiLoading ? '正在阅读整篇文章，提炼摘要与标签…' : hasAi ? '已根据全文提炼发布资料。' : '复制标题和正文，按需要补充发布资料。'}
        </p>
      </div>
      <button type="button" className="secondary-action shrink-0" disabled={aiLoading || !markdown.trim()} onClick={() => void handleAiExtract()}>
        <PrismIcon name="idea" /> {aiLoading ? 'AI 提炼中…' : hasAi ? '重新 AI 提炼' : 'AI 智能提炼'}
      </button>
    </div>
    {fields.slice(0, 1).map((field) => <div className="publication-field" key={field.label}>
      <div className="flex items-center justify-between gap-3"><h3>{field.label}</h3><button type="button" className="text-action" disabled={aiLoading && field.label === '文章摘要'} onClick={() => onCopyText(field.value, field.label)}><PrismIcon name="copy" size={20} /> 复制{field.label}</button></div>
      <p>{field.label === '文章摘要' && aiLoading ? '正在提炼全文摘要…' : field.value || '暂无内容，请先补充文章正文。'}</p>
      {field.label === '文章标题' && platform.titleMax && <small>{Array.from(field.value).length} / {platform.titleMax} 字{Array.from(field.value).length > platform.titleMax ? ' · 标题较长，请调整后发布' : ''}</small>}
      {field.label === '文章摘要' && summary && !aiLoading && <small>{Array.from(field.value).length} / {summary.max} 字{summary.min > 0 ? ` · 建议${summary.min}～${summary.max}字` : ''}</small>}
    </div>)}
    <div className="publication-field">
      <h3>{isDeck ? '发布文案' : '文章正文'}</h3>
      <p className="section-description">{checkSummary}。{isDeck ? '请先在预览页下载图集。' : '配图会自动准备，复制后在平台正文编辑区粘贴。'}</p>
      <button type="button" className="primary-action" disabled={relaying !== null} onClick={() => onRelay(platform.id)}>
        <PrismIcon name="publish" />{relaying === platform.id ? relayMessage : `复制${isDeck ? '文案' : '正文'}并打开${platform.shortName}`}
      </button>
      {relaying === platform.id && <button type="button" className="text-action ml-3" onClick={onCancelRelay}>取消等待</button>}
      {relayError && <p className="mt-3 text-sm" role="alert">{relayError}</p>}
      <p className="mt-3 text-sm text-[#71717A]" role="status">{relaying === platform.id ? relayMessage : synced[platform.id] === copyKeys[platform.id] ? `正文已复制，请在${platform.shortName}粘贴，标题需单独填写，检查图片后保存草稿。` : '标题单独复制，正文粘贴后由你检查并发布。'}</p>
      <a href={platform.editorUrl} target="_blank" rel="noopener noreferrer" className="text-sm underline text-[#71717A]">未自动打开？打开平台编辑器</a>
    </div>
    {fields.slice(1).map((field) => <div className="publication-field" key={field.label}>
      <div className="flex items-center justify-between gap-3"><h3>{field.label}</h3><button type="button" className="text-action" disabled={aiLoading && field.label === '文章摘要'} onClick={() => onCopyText(field.value, field.label)}><PrismIcon name="copy" size={20} /> 复制{field.label}</button></div>
      <p>{field.label === '文章摘要' && aiLoading ? '正在提炼全文摘要…' : field.value || '暂无内容，请先补充文章正文。'}</p>
      {field.label === '文章标题' && platform.titleMax && <small>{Array.from(field.value).length} / {platform.titleMax} 字{Array.from(field.value).length > platform.titleMax ? ' · 标题较长，请调整后发布' : ''}</small>}
      {field.label === '文章摘要' && summary && !aiLoading && <small>{Array.from(field.value).length} / {summary.max} 字{summary.min > 0 ? ` · 建议${summary.min}～${summary.max}字` : ''}</small>}
    </div>)}
    {(platform.id === 'juejin' || platform.id === 'csdn') && <p className="mt-5 text-xs text-[#71717A]">建议分类：{categoryLabel}</p>}
  </section>
}
