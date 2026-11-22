import { useEffect } from 'react'
import { PICLIST_ENDPOINT } from '@/core'

interface PicListGuideModalProps {
  open: boolean
  onClose: () => void
  onToast: (message: string, tone?: 'success' | 'error' | 'info') => void
}

const STEPS = [
  {
    title: '安装并启动 PicList',
    body: '打开 PicList 桌面端，进入「设置 → Server」，开启 Server 服务，端口保持默认 36677。',
  },
  {
    title: '添加 Cloudflare R2 图床',
    body: '在「图床 → Cloudflare R2」中填入 Account ID、Access Key ID、Secret Access Key、Bucket 名称，以及公开访问域名（r2.dev 子域或自定义域名）。',
  },
  {
    title: '设为默认并测试上传',
    body: '把 R2 设为默认图床，上传一张测试图片。回到浏览器复制返回的 https 链接，确认无防盗链、可直接打开。',
  },
  {
    title: '回到 PrismPress 一键转链',
    body: '导入文章与配图，点击“上传到 PicList 默认图床”，文章中的图片地址会随之更新。',
  },
]

export function PicListGuideModal({ open, onClose, onToast }: PicListGuideModalProps) {
  useEffect(() => {
    if (!open) return
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const copyEndpoint = async () => {
    try {
      await navigator.clipboard.writeText(PICLIST_ENDPOINT)
      onToast('已复制 PicList 上传端点', 'success')
    } catch {
      onToast('复制失败，请手动选择端点文本', 'error')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#27272A]/35 p-4 backdrop-blur-xs"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-[#EAE4DC] bg-[#FDFCFA] shadow-[0_30px_90px_rgba(39,39,42,0.18)]"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="PicList 与 Cloudflare R2 配置指南"
      >
        <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-[#EAE4DC] bg-[#FDFCFA]/95 px-6 py-4 backdrop-blur">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FF5A5F]">
              Image Hub
            </p>
            <h2 className="mt-1 text-lg font-bold text-[#27272A]">
              PicList 与 R2 配置指南
            </h2>
            <p className="mt-1 text-xs text-[#71717A]">
              将图片上传至图床，用于需要公开图片链接的平台。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[#EAE4DC] bg-white px-3 py-1 text-xs font-medium text-[#52525B] transition hover:border-[#FF5A5F]/40 hover:text-[#FF5A5F]"
          >
            关闭
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="rounded-2xl border border-[#7C5CFF]/20 bg-[#F4F1FF] p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-medium text-[#6941C6]">本机上传端点</p>
                <code className="mt-0.5 block font-mono text-xs font-semibold text-[#53389E]">{PICLIST_ENDPOINT}</code>
              </div>
              <button
                type="button"
                onClick={copyEndpoint}
                className="rounded-full bg-[#7C5CFF] px-3 py-1.5 text-[11px] font-semibold text-white shadow-xs transition hover:opacity-90"
              >
                复制端点
              </button>
            </div>
          </div>

          <div className="space-y-2.5">
            {STEPS.map((step, index) => (
              <div key={step.title} className="flex gap-3 rounded-2xl border border-[#EAE4DC] bg-white p-3.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FFF2F2] text-xs font-bold text-[#FF5A5F]">
                  {index + 1}
                </span>
                <div>
                  <p className="text-xs font-bold text-[#27272A]">{step.title}</p>
                  <p className="mt-1 text-[11.5px] leading-5 text-[#52525B]">{step.body}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-[#EAE4DC] bg-[#FAF8F5] p-3.5">
            <p className="text-xs font-bold text-[#27272A]">R2 公开访问建议</p>
            <ul className="mt-1.5 space-y-1 text-[11px] leading-5 text-[#52525B]">
              <li>· Bucket 需要开启 Public Access，或绑定自定义域名。</li>
              <li>· 上传后打开图片链接，确认可正常访问。</li>
              <li>· Access Key 只保存在本机 PicList，不要填进任何网页。</li>
              <li>· 连接失败时，检查 PicList Server 是否开启并允许本站连接。</li>
            </ul>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-[#FF5A5F] px-5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#E6454B]"
            >
              我已了解
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
