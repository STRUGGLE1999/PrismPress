import type { MetadataPassport, PlatformId, PlatformProfile, RichTheme } from '@/core'
import { CoverStudio, getCoverCollection } from './CoverStudio'
import { PlatformIcon, PrismIcon } from './PrismIcon'

interface RightPassportProps {
  passport: MetadataPassport
  platform: PlatformProfile
  platforms: PlatformProfile[]
  theme: RichTheme
  copyKeys: Record<PlatformId, string>
  synced: Partial<Record<PlatformId, string>>
  relaying: PlatformId | null
  section: 'passport' | 'covers' | 'relay'
  onCopyText: (text: string, label: string) => void
  onRelay: (id: PlatformId) => void
  onSelectPlatform: (id: PlatformId) => void
  onToast: (message: string, tone?: 'success' | 'error' | 'info') => void
}

export function RightPassport({ passport, platform, platforms, theme, copyKeys, synced, relaying,
  section, onCopyText, onRelay, onSelectPlatform, onToast,
}: RightPassportProps) {
  if (section === 'covers') {
    const collection = getCoverCollection(passport.title)
    return <section className="publication-panel">
      <h2>为这篇文章准备封面</h2>
      <p className="section-description">{collection ? `${collection.label} · 三种比例各自设计，可直接下载。` : '封面是可选素材，不影响正文复制。'}</p>
      <CoverStudio title={passport.title} theme={theme} category={passport.category.generic} onToast={onToast} />
    </section>
  }

  if (section === 'relay') {
    const current = synced[platform.id]
    return <section className="publication-panel">
      <h2>最后一步，在官方编辑器发布</h2>
      <p className="section-description">PrismPress 帮你整理和复制内容，实际发布由你在平台完成。</p>
      <ol className="handoff-list">
        <li><span>1</span><div><strong>复制内容，打开{platform.shortName}</strong><p>{platform.format === 'deck' ? '先下载需要的图集，随后复制配套文案。' : '点击下方按钮，复制适配后的正文并打开官方编辑器。'}</p></div></li>
        <li><span>2</span><div><strong>粘贴并检查</strong><p>粘贴正文，补充标题、摘要、标签与封面；尤其检查图片和公式。</p></div></li>
        <li><span>3</span><div><strong>在平台确认发布</strong><p>登录、原创声明及最终发布均在官方页面完成。本工具无法读取发布结果。</p></div></li>
      </ol>
      <button type="button" className="primary-action" disabled={relaying !== null} onClick={() => onRelay(platform.id)}>
        <PrismIcon name="publish" /> {relaying === platform.id ? '正在复制…' : `复制并打开${platform.shortName}`}
      </button>
      <p className="mt-3 text-sm text-[#71717A]" role="status">{current === copyKeys[platform.id] ? '已复制当前稿件，请到平台完成粘贴和发布。' : current ? '内容或排版已修改，需要重新复制。' : '尚未复制当前稿件。'}</p>
      <details className="advanced-tools mt-8"><summary>其他平台的复制记录</summary><div className="advanced-body">
        {platforms.map((item) => <button type="button" key={item.id} className="platform-record" onClick={() => onSelectPlatform(item.id)}>
          <PlatformIcon id={item.id} /><span>{item.shortName}</span><span className="ml-auto text-xs text-[#71717A]">{synced[item.id] === copyKeys[item.id] ? '已复制最新稿' : synced[item.id] ? '需重新复制' : '尚未复制'}</span>
        </button>)}
      </div></details>
    </section>
  }

  const isDeck = platform.format === 'deck'
  const summary = platform.id === 'juejin' ? passport.summaries.juejin.text
    : platform.id === 'wechat' ? passport.summaries.wechat.text
    : platform.id === 'csdn' ? passport.summaries.csdn.text
    : Array.from(passport.summaries.wechat.text).slice(0, 100).join('')
  const fields = [
    { label: isDeck ? '短标题（20 字内）' : '文章标题', value: isDeck ? passport.shortTitle20 : passport.title },
    ...(!isDeck ? [{ label: '参考摘要', value: summary }] : []),
    { label: isDeck || platform.id === 'wechat' ? '话题' : '标签', value: isDeck || platform.id === 'wechat' ? passport.hashtags : passport.tagsCsv },
    ...(platform.id === 'bilibili' ? [{ label: '评论区总结（可选）', value: passport.bilibiliSummary }] : []),
  ]
  return <section className="publication-panel">
    <h2>{platform.shortName}的发布资料</h2>
    <p className="section-description">根据正文整理，按需要复制到平台表单。请在发布前核对内容与平台要求。</p>
    {fields.map((field) => <div className="publication-field" key={field.label}>
      <div className="flex items-center justify-between gap-3"><h3>{field.label}</h3><button type="button" className="text-action" onClick={() => onCopyText(field.value, field.label)}><PrismIcon name="copy" size={20} /> 复制{field.label}</button></div>
      <p>{field.value || '暂无内容，请先补充文章正文。'}</p>
      {field.label === '参考摘要' && <small>{Array.from(field.value).length} 字 · {platform.summary.note}</small>}
    </div>)}
    <p className="mt-5 text-xs text-[#71717A]">分类建议：{platform.id === 'juejin' ? passport.category.juejin : passport.category.generic} · {platform.categoryRule}</p>
  </section>
}
