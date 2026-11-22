import type { Root } from 'mdast'
import type { CompileOptions, PlatformProfile, SlideCard } from '../../types'
import { buildFullDeck } from './full'
import { buildCoreDeck } from './core'

export interface DeckCompileResult { slides: SlideCard[]; caption: string }

export async function buildSlideDeck(root: Root, platform: PlatformProfile, lineMap?: number[], passport?: CompileOptions['passport'], mode: 'full' | 'summary' = 'summary'): Promise<DeckCompileResult> {
  if (mode === 'summary') return buildCoreDeck(root, platform, lineMap, passport)
  const slides = await buildFullDeck(root, lineMap, passport)
  const title = passport?.shortTitle20 ?? slides[0].title
  const tags = passport?.tags ?? ['知识分享', '创作笔记']
  return { slides, caption: [title, '', ...slides.filter(slide => slide.kind !== 'cover').flatMap(slide => [slide.title, ...slide.bullets, '']), tags.map(tag => `#${tag}`).join(' ')].join('\n') }
}
