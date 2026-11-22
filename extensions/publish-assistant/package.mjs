export function validatePackage(value) {
  const fail = () => { throw new Error('交接文件无效，请从 PrismPress 重新导出') }
  if (!value || value.version !== 1 || !['xiaohongshu', 'douyin', 'zhihu', 'csdn', 'juejin', 'bilibili'].includes(value.platform) || typeof value.title !== 'string' || !value.title.trim() || Array.from(value.title).length > (value.platform === 'douyin' ? 30 : value.platform === 'xiaohongshu' ? 64 : 100) || !Array.isArray(value.parts) || !value.parts.length || value.parts.length > 201) fail()
  let bytes = 0
  let images = 0
  let text = 0
  const parts = value.parts.map(part => {
    if (part?.kind === 'html' && typeof part.html === 'string' && part.html.length <= 1000000) {
      bytes += part.html.length
      text += part.html.length
      return { kind: 'html', html: part.html }
    }
    if (part?.kind === 'image' && typeof part.data === 'string' && /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/.test(part.data) && part.data.length <= 6 * 1024 * 1024) {
      bytes += part.data.length
      images++
      return { kind: 'image', data: part.data }
    }
    fail()
  })
  if (bytes > 48 * 1024 * 1024 || images > 100 || !text) fail()
  if (value.platform === 'csdn' && /[\u{10000}-\u{10ffff}]/u.test(value.title)) fail()
  if (value.platform === 'bilibili' && /[\u{10000}-\u{10ffff}]/u.test(value.title + parts.filter(part => part.kind === 'html').map(part => part.html).join(''))) fail()
  let markdown
  if (value.platform === 'juejin') {
    if (typeof value.markdown !== 'string' || !value.markdown.trim() || value.markdown.length > 1000000) fail()
    markdown = value.markdown
    if (bytes + markdown.length > 48 * 1024 * 1024) fail()
    const tokens = [...markdown.matchAll(/PRISMPRESS_IMAGE_(\d+)_END/g)].map(match => Number(match[1]))
    if (tokens.length !== images || new Set(tokens).size !== images || tokens.some(index => index >= images)) fail()
  }
  return { ...(markdown ? { markdown } : {}), version: 1, platform: value.platform, title: value.title, parts }
}
