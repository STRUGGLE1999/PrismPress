export type SummaryKey = 'wechat' | 'juejin' | 'csdn' | 'douyin'
export interface SummaryRule { key: SummaryKey; label: string; min: number; max: number; note: string }
export const SUMMARY_RULES: Record<SummaryKey, SummaryRule>
export function fitSummary(value: string, rule: SummaryRule): string
