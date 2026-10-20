import type { CSSProperties } from 'react'
import type { FrequencyType, HabitType, VizType } from './database.types'

/** Palette keys stored in habits.color. Actual colors live in styles/tokens.css (light + dark). */
export const HABIT_COLORS = [
  'red', 'orange', 'yellow', 'green', 'mint', 'teal', 'cyan', 'blue', 'indigo', 'purple', 'pink', 'brown',
] as const
export type HabitColor = (typeof HABIT_COLORS)[number]

export function habitColorVar(color: string): string {
  return (HABIT_COLORS as readonly string[]).includes(color) ? `var(--habit-${color})` : 'var(--habit-blue)'
}

/** Inline style that exposes the habit color as --c to CSS modules. */
export function habitColorStyle(color: string): CSSProperties {
  return { '--c': habitColorVar(color) } as CSSProperties
}

export const SUGGESTED_EMOJIS = [
  '✅', '🧘', '🏃', '🚶', '🏋️', '🚴', '🏊', '🧗', '⚽', '🎾', '🤸', '🧎',
  '💧', '🥗', '🍎', '🥦', '☕', '🍵', '💊', '🦷', '🧴', '🚿', '😴', '🌅',
  '📚', '📖', '✍️', '📝', '🧠', '💻', '🎸', '🎹', '🎨', '📷', '🗣️', '🌍',
  '🧹', '🧺', '🌱', '🪴', '🐶', '💰', '📵', '🚭', '🍷', '🍬', '🙏', '❤️',
]

export const HABIT_TYPES: HabitType[] = ['boolean', 'quantitative', 'negative']

export const FREQUENCY_TYPES: FrequencyType[] = ['daily', 'weekdays', 'times_per_week', 'every_n_days']

/** Frequencies that make sense for each type (times per week is not offered for negative habits). */
export function frequenciesFor(type: HabitType): FrequencyType[] {
  return type === 'negative' ? FREQUENCY_TYPES.filter((f) => f !== 'times_per_week') : FREQUENCY_TYPES
}

/** SPEC §7 compatibility table. Must match the habits_viz_compatible check in the migration. */
export const VIZ_BY_TYPE: Record<HabitType, VizType[]> = {
  boolean: ['heatmap', 'calendar', 'ring', 'marble_jar', 'plant'],
  quantitative: ['heatmap', 'calendar', 'ring', 'bars', 'marble_jar', 'plant'],
  negative: ['heatmap', 'calendar', 'ring', 'days_since'],
}

export const DEFAULT_VIZ: Record<HabitType, VizType> = {
  boolean: 'heatmap',
  quantitative: 'bars',
  negative: 'days_since',
}

/** Formats a number without trailing zeros, using the interface language. */
export function formatNumber(value: number, lang: string): string {
  return new Intl.NumberFormat(lang, { maximumFractionDigits: 2 }).format(value)
}
