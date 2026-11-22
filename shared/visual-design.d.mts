export type VisualStyleId = 'editorial' | 'notes' | 'signal' | 'brief'
export interface VisualStyle {
  id: VisualStyleId; name: string; paper: string; ink: string; accent: string
  tint: string; muted: string; serif: boolean; direction: string
}
export const VISUAL_DESIGN_VERSION: string
export const VISUAL_STYLES: VisualStyle[]
export function getVisualStyle(id?: string): VisualStyle
export function buildVisualPrompt(input: { title: string; article: string; ratio: string; safe: string; style?: string; purpose?: 'cover' | 'illustration' }): string
