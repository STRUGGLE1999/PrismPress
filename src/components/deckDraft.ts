import type { CompileResult, SlideCard } from '@/core'
export interface DeckDraft { slides: SlideCard[]; caption: string }
export function withDeckDraft(result: CompileResult | null, draft?: DeckDraft): CompileResult | null {
  return result?.format === 'deck' && draft ? { ...result, slides: draft.slides, body: draft.caption, plainText: draft.caption } : result
}
