import { useState } from 'react'
import { getVisualStyle, VISUAL_STYLES, type VisualStyleId } from '../../shared/visual-design.mjs'

const STYLE_PREFERENCE_KEY = 'prismpress:visual-style'
const DECK_STYLE_KEY = 'prismpress:deck-visual-style:v1'

export function useVisualStyle(deck = false) {
  return useState<VisualStyleId>(() => {
    try { const style = getVisualStyle(localStorage.getItem(deck ? DECK_STYLE_KEY : STYLE_PREFERENCE_KEY) ?? (deck ? 'brief' : 'editorial')).id; return !deck && style === 'brief' ? 'editorial' : style } catch { return deck ? 'brief' : 'editorial' }
  })
}

export function VisualStylePicker({ value, onChange, disabled = false, deck = false }: { deck?: boolean; value: VisualStyleId; onChange: (value: VisualStyleId) => void; disabled?: boolean }) {
  return <label className="text-sm">视觉风格 <select aria-label="视觉风格" value={value} disabled={disabled} className="rounded-lg border p-2" onChange={(event) => {
    const next = event.target.value as VisualStyleId
    onChange(next)
    try { localStorage.setItem(deck ? DECK_STYLE_KEY : STYLE_PREFERENCE_KEY, next) } catch {}
  }}>{VISUAL_STYLES.filter(style => deck || style.id !== 'brief').map(style => <option key={style.id} value={style.id}>{style.name}</option>)}</select></label>
}
