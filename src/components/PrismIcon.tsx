import { memo, useEffect, useRef } from 'react'

export type IconName =
  | 'prism' | 'document' | 'edit' | 'upload' | 'shield' | 'image' | 'link'
  | 'preview' | 'passport' | 'copy' | 'publish' | 'refresh' | 'download'
  | 'palette' | 'phone' | 'desktop' | 'tag' | 'book' | 'music' | 'video'
  | 'chat' | 'idea' | 'chart' | 'formula'

declare global {
  interface Window {
    PrismIcons: {
      mount(host: HTMLElement, name: IconName, accent?: string): {
        hover(on: boolean): void
        destroy(): void
      }
    }
  }
}

export const PrismIcon = memo(function PrismIcon({
  name, size = 24, accent,
}: { name: IconName; size?: number; accent?: string }) {
  const hostRef = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const instance = window.PrismIcons.mount(host, name, accent)
    const target = host.closest('button, a') ?? host
    const enter = () => instance.hover(true)
    const leave = () => instance.hover(false)
    target.addEventListener('pointerenter', enter)
    target.addEventListener('pointerleave', leave)
    target.addEventListener('focus', enter)
    target.addEventListener('blur', leave)
    return () => {
      target.removeEventListener('pointerenter', enter)
      target.removeEventListener('pointerleave', leave)
      target.removeEventListener('focus', enter)
      target.removeEventListener('blur', leave)
      instance.destroy()
    }
  }, [name, accent])
  return <span ref={hostRef} className="prism-icon" style={{ width: size, height: size }} aria-hidden="true" />
})

const PLATFORM_ICONS = {
  wechat: 'wechat.png', zhihu: 'zhihu.ico', bilibili: 'bilibili.png',
  xiaohongshu: 'xiaohongshu.png', douyin: 'douyin.ico',
  juejin: 'juejin.png', csdn: 'csdn.ico',
} as const

export function PlatformIcon({ id }: { id: keyof typeof PLATFORM_ICONS }) {
  return <img src={`/platforms/${PLATFORM_ICONS[id]}`} alt="" aria-hidden="true" className={`h-6 w-6 shrink-0 object-contain ${id === 'xiaohongshu' ? 'rounded-md bg-[#FF2442] p-0.5' : ''}`} width={24} height={24} />
}
