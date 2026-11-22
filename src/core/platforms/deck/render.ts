import type { SlideCard } from '../../types'
import { getVisualStyle, type VisualStyleId } from '../../../../shared/visual-design.mjs'

type Page = Omit<SlideCard, 'index' | 'total'>
const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]!)
const units = (text: string) => Array.from(text).reduce((n, char) => n + (/[\x00-\xff]/.test(char) ? 0.62 : 1), 0)

/** Conservative fixed-size wrapping, shared by pagination, preview and export. */
export function wrapText(text: string, width: number, font: number): string[] {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    let line = ''
    for (const char of Array.from(paragraph)) {
      if (line && units(line + char) * font * 1.04 > width) { lines.push(line); line = '' }
      line += char
    }
    lines.push(line)
  }
  return lines
}

function splitText(text: string, width: number, font: number, maxLines: number): string[] {
  const chunks: string[] = []
  let chunk = '', line = '', rows = 1
  for (const char of Array.from(text)) {
    if (char === '\n' || (line && units(line + char) * font * 1.04 > width)) {
      if (rows === maxLines) { chunks.push(chunk); chunk = ''; rows = 1 } else rows += 1
      line = ''
    }
    chunk += char
    if (char !== '\n') line += char
  }
  if (chunk) chunks.push(chunk)
  return chunks
}

/** Reference-derived brief: typography and information cards, with no external assets. */
function briefLayout(slide: Page, platform: string) {
  if (slide.kicker !== '核心图集' || slide.image || slide.formulaSvg || slide.tableRows || slide.highlight || slide.quote) return undefined
  const style = getVisualStyle('brief')
  const family = 'PingFang SC,Microsoft YaHei,sans-serif'
  let out = `<rect width="1080" height="1440" fill="${style.paper}"/>`
  const text = (value: string, x: number, top: number, font: number, color = style.ink, weight = 400, width = 820) => {
    const lines = wrapText(value, width, font)
    out += lines.map((line, i) => `<text x="${x}" y="${top + i * font * 1.5}" font-family="${family}" font-size="${font}" font-weight="${weight}" fill="${color}">${escape(line)}</text>`).join('')
    return lines.length * font * 1.5
  }
  const cover = slide.kind === 'cover'
  out += `<rect x="80" y="76" width="280" height="58" rx="29" fill="${cover ? style.accent : style.tint}"/>`
  text(platform === 'douyin' ? '图文 · 核心精选' : '阅读 · 核心精选', 108, 115, 25, cover ? '#FFFFFF' : style.accent, 600)
  if (cover) out += `<g opacity=".35" stroke="#C4AFDF" fill="none"><circle cx="948" cy="190" r="144" fill="#E8DDF7" stroke="none"/><circle cx="948" cy="190" r="95" stroke-width="2"/><path d="M818 190h260M948 60v260"/></g>`
  let y = cover ? 330 : 220
  y += text(slide.title, 80, y, cover ? 76 : 58, style.ink, 700, 900)
  if (slide.subtitle) y += text(slide.subtitle, 80, y + 20, 32, style.accent, 600, 900) + 26
  if (cover) { out += `<path d="M86 ${y + 8}H492" stroke="#EDCC6D" stroke-width="12" stroke-linecap="round"/>`; y += 90 }
  else y += 45
  const gap = 28
  const bodyFont = cover ? 30 : 38
  const heights = slide.bullets.map(point => wrapText(point, 824, bodyFont).length * bodyFont * 1.5 + (cover ? 52 : 92))
  const minimum = heights.reduce((sum, height) => sum + height, 0) + Math.max(0, heights.length - 1) * gap
  const available = 1255 - y
  if (minimum > available) return { out, end: 1286, family }
  const extra = heights.length ? Math.min(85, Math.max(0, (available - minimum) / heights.length)) : 0
  if (cover && heights.length) y = Math.max(y, 1255 - minimum - extra * heights.length)
  slide.bullets.forEach((point, index) => {
    const height = heights[index] + extra
    const last = index === slide.bullets.length - 1
    out += `<rect x="76" y="${y}" width="928" height="${height}" rx="32" fill="${last && slide.bullets.length > 1 ? style.tint : '#FFFFFF'}"/>`
    // Emphasize a source-provided short label; never invent a headline or statistic.
    const match = !cover && point.match(/^(.{2,18}?[：:])(.+)$/u)
    if (match) {
      text(match[1], 120, y + 64, 38, style.accent, 600, 824)
      text(match[2], 120, y + 124, 36, style.muted, 400, 824)
    } else text(point, 120, y + (cover ? 45 : 64), bodyFont, index === 0 ? style.ink : style.accent, 500, 824)
    y += height + gap
  })
  return { out, end: Math.min(1285, y), family }
}

const comicStyle = (id: VisualStyleId) => ({
  ...getVisualStyle(id),
  ...(id === 'signal' ? { paper: '#EEF2FF', ink: '#243562', accent: '#2E4391', tint: '#DCE2FF', muted: '#59658A' } : {}),
})

function comicIcon(x: number, y: number, index: number, color: string, size = 64) {
  const paths = [
    '<path d="M12 49V8m0 2c12-10 20 10 34 0v24c-14 10-22-10-34 0"/>',
    '<circle cx="28" cy="28" r="21"/><path d="M28 13v16l11 7"/>',
    '<rect x="7" y="7" width="42" height="42" rx="10"/><path d="m16 28 8 8 17-20"/>',
  ]
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 56 56" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[index % paths.length]}</svg>`
}

/** Social cards use the whole reading area, with content-sized panels rather than top-aligned paragraphs. */
function socialLayout(slide: Page, styleId: VisualStyleId, platform: string) {
  if (slide.kicker !== '核心图集' || slide.tableRows || slide.formulaSvg || slide.highlight || slide.quote) return undefined
  if ((slide.kind === 'cover' && slide.bullets.length > 3) || (slide.image && slide.bullets.length > 1)) return undefined
  const style = comicStyle(styleId)
  const family = style.serif ? 'Songti SC,SimSun,serif' : 'PingFang SC,Microsoft YaHei,sans-serif'
  let out = `<rect width="1080" height="1440" fill="${style.paper}"/>`
  const label = (value: string, x: number, y: number, size: number, color = style.ink, weight = 400, width = 900) => {
    const lines = wrapText(value, width, size)
    out += lines.map((line, i) => `<text x="${x}" y="${y + i * size * 1.48}" font-size="${size}" font-weight="${weight}" fill="${color}">${escape(line)}</text>`).join('')
    return lines.length * size * 1.48
  }
  const headingSize = slide.kind === 'cover' ? 76 : 58
  const headingLines = wrapText(slide.title, 880, headingSize)
  if (headingLines.length > 4) return undefined
  const headingEnd = 200 + headingLines.length * headingSize * 1.48
  label(platform === 'douyin' ? '图文 · 精选' : '阅读 · 精选', 80, 94, 24, style.accent, 600)
  if (styleId === 'signal') out += `<rect x="80" y="130" width="124" height="10" fill="${style.accent}"/>`
  label(slide.title, 80, 220, headingSize, style.ink, 700, 880)
  if (styleId === 'notes') out += `<path d="M80 ${headingEnd + 20} Q310 ${headingEnd + 5} 570 ${headingEnd + 22}" fill="none" stroke="${style.accent}" stroke-width="8" stroke-linecap="round"/>`
  if (slide.kind === 'cover' && !slide.image) {
    const items = slide.bullets.slice(0, 3)
    const top = Math.max(headingEnd + 140, 820)
    if (top + items.length * 120 > 1270 || items.some(item => wrapText(item, 740, 34).length > 2)) return undefined
    if (styleId === 'signal') out += `<path d="M80 ${top - 100}H1000" stroke="${style.accent}" stroke-width="12"/>`
    items.forEach((item, index) => {
      const y = top + index * 120
      out += `<rect x="80" y="${y - 58}" width="920" height="106" rx="30" fill="${styleId === 'signal' && index === 2 ? '#DFFD84' : style.tint}" stroke="${style.ink}" stroke-width="2"/>`
      out += comicIcon(102, y - 40, index, style.ink, 55)
      
      label(item, 194, y, 34, style.ink, 500, 740)
    })
    return { out, end: 1270, family }
  }
  const start = Math.max(headingEnd + 90, 430)
  const bottom = 1255
  if (slide.image) {
    const description = slide.bullets[0] ?? ''
    const lines = wrapText(description, 880, 36)
    const captionHeight = description ? lines.length * 54 + 40 : 0
    const height = bottom - start - captionHeight
    if (height < 360) return undefined
    out += `<rect x="76" y="${start}" width="928" height="${height}" rx="${styleId === 'notes' ? 24 : 0}" fill="${style.tint}"/>`
    if (/^data:image\/(?:png|jpe?g|webp|gif);base64,/i.test(slide.image.src)) out += `<image href="${escape(slide.image.src)}" x="96" y="${start + 20}" width="888" height="${height - 40}" preserveAspectRatio="xMidYMid meet"/>`
    if (styleId === 'notes') out += `<rect x="440" y="${start - 14}" width="200" height="34" fill="#E1CFA8" opacity=".8" transform="rotate(-4 540 ${start})"/>`
    if (styleId === 'signal') out += `<path d="M76 ${start}V${start + height}" stroke="${style.accent}" stroke-width="10"/>`
    if (description) label(description, 90, start + height + 60, 36, style.ink, 400, 880)
  } else {
    const points = slide.bullets
    if (!points.length) return undefined
    const gap = 34
    const panelHeight = (bottom - start - gap * (points.length - 1)) / points.length
    const columns = slide.layout === 'comparison' && points.length === 2
    const width = columns ? 442 : 920
    const availableHeight = columns ? bottom - start : panelHeight
    const bodyWidth = width - 140
    if (points.some(point => wrapText(point, bodyWidth, 38).length * 57 + 110 > availableHeight)) return { out, end: 1286, family }
    points.forEach((point, index) => {
      const x = columns ? 80 + index * 478 : 80
      const y = columns ? start : start + index * (panelHeight + gap)
      const number = String(index + 1).padStart(2, '0')
      const fill = styleId === 'signal' && index === points.length - 1 ? '#DFFD84' : styleId === 'notes' ? (index % 2 ? '#DDEBDF' : '#F8EAC7') : index % 2 ? style.paper : style.tint
      out += `<rect x="${x}" y="${y}" width="${width}" height="${availableHeight - 14}" rx="${styleId === 'editorial' ? 24 : 38}" fill="${fill}" stroke="${style.ink}" stroke-width="3"/>`
      out += `<path d="M${x + 52} ${y + availableHeight - 14}l16 16 16-16" fill="${fill}" stroke="${style.ink}" stroke-width="3"/>`
      if (styleId === 'notes') out += `<rect x="${x + width / 2 - 65}" y="${y - 14}" width="130" height="28" fill="#DCC7A0" opacity=".8" transform="rotate(-4 ${x + width / 2} ${y})"/>`
      out += comicIcon(x + 30, y + 26, index, style.ink)
      label(number, x + width - 85, y + 65, 26, style.accent, 600, 60)
      const lines = wrapText(point, bodyWidth, 38)
      const textX = x + (styleId === 'signal' ? 108 : 48)
      const textY = y + Math.max(120, (availableHeight - lines.length * 57) / 2 + 38)
      label(point, textX, textY, 38, style.ink, styleId === 'signal' ? 600 : 400, bodyWidth)
      if (slide.layout === 'steps' && index < points.length - 1 && !columns) out += `<path d="M540 ${y + availableHeight + 5}v20m-9-9 9 9 9-9" fill="none" stroke="${style.accent}" stroke-width="3"/>`
    })
  }
  return { out, end: bottom, family }
}

function layout(slide: Page, styleId: VisualStyleId, platform: string) {
  if (styleId === 'brief') { const brief = briefLayout(slide, platform); if (brief) return brief }
  const social = socialLayout(slide, styleId, platform)
  if (social) return social
  const style = slide.kicker === '核心图集' ? comicStyle(styleId) : getVisualStyle(styleId)
  const family = style.serif ? 'Songti SC,SimSun,serif' : 'PingFang SC,Microsoft YaHei,sans-serif'
  let out = ''
  let y = 188
  const text = (value: string, x: number, top: number, size: number, color = style.ink, weight = 400, width = 928) => {
    const lines = wrapText(value, width, size)
    lines.forEach((line, i) => { out += `<text x="${x}" y="${top + i * size * 1.48}" fill="${color}" font-size="${size}" font-weight="${weight}">${escape(line)}</text>` })
    return lines.length * size * 1.48
  }
  const box = (x: number, top: number, width: number, height: number) => {
    out += `<rect x="${x}" y="${top}" width="${width}" height="${height}" rx="18" fill="${style.tint}"/>`
  }
  out += `<rect width="1080" height="1440" fill="${style.paper}"/>`
  text(slide.kicker, 76, 88, 22, style.accent, 600)
  out += `<path d="M76 115H1004" stroke="${style.muted}" opacity=".3"/>`
  y += text(slide.title, 76, y, slide.kind === 'cover' ? 68 : 54, style.ink, 700)
  y += 24
  if (slide.subtitle) { y += text(slide.subtitle, 76, y, 30, style.muted); y += 22 }
  if (slide.kind === 'cover') {
    out += `<path d="M76 ${y + 20}H270" stroke="${style.accent}" stroke-width="8"/>`
    y += 80
  }
  const comparison = slide.layout === 'comparison' && slide.bullets.length >= 2
  if (comparison) {
    for (let i = 0; i < slide.bullets.length; i += 2) {
      const pair = slide.bullets.slice(i, i + 2)
      const width = pair.length === 1 ? 928 : 452
      const height = Math.max(...pair.map(p => wrapText(p, width - 70, 40).length)) * 60 + 60
      pair.forEach((point, col) => { box(76 + col * 476, y - 30, width, height); text(point, 108 + col * 476, y + 12, 40, style.ink, 400, width - 70) })
      y += height + 24
    }
  } else {
    slide.bullets.forEach((point, index) => {
      const height = wrapText(point, 830, 44).length * 66
      if (slide.layout === 'steps') out += `<circle cx="102" cy="${y - 12}" r="25" fill="${style.accent}"/>`
      text(String(index + 1).padStart(2, '0'), slide.layout === 'steps' ? 86 : 76, y, 24, slide.layout === 'steps' ? style.paper : style.accent, 600, 58)
      text(point, 160, y, 44, style.ink, 400, 830)
      y += height + 28
    })
  }
  if (slide.tableRows?.length) {
    const count = Math.max(...slide.tableRows.map(row => row.length))
    const width = 928 / count
    slide.tableRows.forEach((row, index) => {
      const height = Math.max(...row.map(cell => wrapText(cell, Math.max(20, width - 28), 28).length)) * 42 + 28
      out += `<rect x="76" y="${y - 24}" width="928" height="${height}" fill="${index % 2 ? style.paper : style.tint}" stroke="${style.muted}" stroke-opacity=".25"/>`
      row.forEach((cell, col) => text(cell, 90 + col * width, y + 6, 28, style.ink, 400, Math.max(20, width - 28)))
      y += height
    })
    y += 26
  }
  if (slide.formulaSvg) {
    const inner = slide.formulaSvg.replace(/<svg\b[^>]*>/, match => match.replace(/\s(?:width|height|style)="[^"]*"/g, '').replace('>', ` x="90" y="${y}" width="900" height="170">`)).replace(/currentColor/g, style.ink)
    out += inner
    y += 200
  }
  for (const content of [slide.highlight, slide.quote]) {
    if (!content) continue
    const height = wrapText(content, 864, 30).length * 45 + 50
    box(76, y - 24, 928, height)
    text(content, 108, y + 12, 30, style.ink, 400, 864)
    y += height + 20
  }
  if (slide.image) {
    const src = slide.image.src
    // Exportable images are embedded raster bytes; never inject remote markup into SVG.
    if (/^data:image\/(?:png|jpe?g|webp|gif);base64,/i.test(src)) out += `<image href="${escape(src)}" x="76" y="${y}" width="928" height="660" preserveAspectRatio="xMidYMid meet" aria-label="${escape(slide.image.alt)}"/>`
    else out += `<rect x="76" y="${y}" width="928" height="660" fill="${style.tint}"/>`
    y += 690
  }
  out += `<path d="M76 1332H1004" stroke="${style.muted}" opacity=".3"/>`
  text(platform === 'douyin' ? '图文阅读' : '文章图集', 76, 1380, 22, style.muted)
  return { out, end: y, family }
}

export function renderSlideSvg(slide: SlideCard, style: VisualStyleId, platform: string): string {
  const result = layout(slide, style, platform)
  if (result.end > 1285) throw new Error('这页内容过多，请拆页后再导出')
  return `<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" width="1080" height="1440" viewBox="0 0 1080 1440" font-family="${result.family}">${result.out}<text x="1004" y="1380" text-anchor="end" fill="${(slide.kicker === '核心图集' ? comicStyle(style) : getVisualStyle(style)).muted}" font-size="22">${slide.index} / ${slide.total}</text></svg>`
}

/** Pack complete chunks until the same renderer reaches its footer safe area. */
const measuredEnd = (slide: Page) => Math.max(layout(slide, 'editorial', '').end, layout(slide, 'brief', '').end)

export function paginateSlide(slide: Page): Page[] {
  if (measuredEnd(slide) <= 1285) return [slide]
  const chunks: Partial<Page>[] = []
  for (const bullet of slide.bullets) {
    for (const piece of splitText(bullet, 830, 44, 3)) chunks.push({ bullets: [piece] })
  }
  if (slide.tableRows) {
    const count = Math.max(...slide.tableRows.map(row => row.length))
    for (const row of slide.tableRows) {
      const columns = row.map(cell => splitText(cell, Math.max(20, 928 / count - 28), 28, 4))
      const max = Math.max(...columns.map(lines => lines.length))
      for (let i = 0; i < max; i += 1) chunks.push({ tableRows: [columns.map(parts => parts[i] ?? '')] })
    }
  }
  if (slide.formulaSvg) chunks.push({ formulaSvg: slide.formulaSvg })
  for (const field of ['highlight', 'quote'] as const) {
    if (!slide[field]) continue
    for (const piece of splitText(slide[field]!, 864, 30, 8)) chunks.push({ [field]: piece })
  }
  if (slide.image) chunks.push({ image: slide.image })
  const empty = (): Page => ({ ...slide, bullets: [], tableRows: undefined, formulaSvg: undefined, quote: undefined, highlight: undefined, image: undefined, layout: 'points' })
  const pages: Page[] = []
  let current = empty()
  for (const chunk of chunks) {
    if ((chunk.quote && current.quote) || (chunk.highlight && current.highlight)) { pages.push(current); current = empty() }
    const next = { ...current, ...chunk, bullets: [...current.bullets, ...(chunk.bullets ?? [])], tableRows: chunk.tableRows ? [...(current.tableRows ?? []), ...chunk.tableRows] : current.tableRows }
    if (measuredEnd(next) > 1285) {
      if (measuredEnd({ ...empty(), ...chunk }) > 1285) throw new Error('标题或内容过长，请在原稿拆分后重试')
      pages.push(current)
      current = { ...empty(), ...chunk }
    } else current = next
  }
  pages.push(current)
  return pages
}
