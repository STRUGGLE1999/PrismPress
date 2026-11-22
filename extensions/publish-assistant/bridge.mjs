export const sourceOrigins = ['https://prismpress-sigma.vercel.app', 'http://127.0.0.1:5175', 'http://localhost:5175']
export const destinations = {
  xiaohongshu: 'https://creator.xiaohongshu.com/publish/publish?source=official&target=article',
  zhihu: 'https://zhuanlan.zhihu.com/write',
  csdn: 'https://mp.csdn.net/mp_blog/creation/editor',
  juejin: 'https://juejin.cn/editor/drafts/new',
  bilibili: 'https://member.bilibili.com/platform/upload/text/edit',
  douyin: 'https://creator.douyin.com/creator-micro/content/upload?default-tab=5',
}
export function trustedSource(url) {
  try { return sourceOrigins.includes(new URL(url).origin) } catch { return false }
}
