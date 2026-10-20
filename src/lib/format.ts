import { format, type Locale } from 'date-fns'
import type { TFunction } from 'i18next'
import type { Habit } from './database.types'
import { type DateStr, addDays, fromDateStr } from './dates'
import { formatNumber } from './habitMeta'

export function capitalize(s: string): string {
  return s.charAt(0).toLocaleUpperCase() + s.slice(1)
}

/** "Hoy", "Mañana", "Ayer" or a short date like "lun 12 oct" (with the year if it differs). */
export function relativeDay(date: DateStr, today: DateStr, t: TFunction, locale: Locale): string {
  if (date === today) return t('common.today')
  if (date === addDays(today, 1)) return t('common.tomorrow')
  if (date === addDays(today, -1)) return t('common.yesterday')
  const pattern = date.slice(0, 4) === today.slice(0, 4) ? t('formats.shortDay') : t('formats.shortDayYear')
  return format(fromDateStr(date), pattern, { locale })
}

export function longDay(date: DateStr, today: DateStr, t: TFunction, locale: Locale): string {
  const pattern = date.slice(0, 4) === today.slice(0, 4) ? t('formats.longDay') : t('formats.longDayYear')
  return capitalize(format(fromDateStr(date), pattern, { locale }))
}

/** One-line description of a habit's frequency, e.g. "Cada día", "lun, mié, vie", "3 veces por semana". */
export function frequencySummary(habit: Habit, t: TFunction, locale: Locale): string {
  switch (habit.frequency_type) {
    case 'daily':
      return t('habits.summary.daily')
    case 'weekdays': {
      // 2026-10-19 is a Monday; ISO weekday d → that Monday + (d − 1).
      const days = [...(habit.frequency_days ?? [])].sort((a, b) => a - b)
      return days.map((d) => format(fromDateStr(addDays('2026-10-19', d - 1)), t('formats.weekdayShort'), { locale })).join(', ')
    }
    case 'times_per_week':
      return t('habits.summary.times_per_week', { count: habit.frequency_times ?? 0 })
    case 'every_n_days':
      return t('habits.summary.every_n_days', { count: habit.frequency_interval ?? 0 })
  }
}

export function targetSummary(habit: Habit, t: TFunction, lang: string): string | null {
  if (habit.type !== 'quantitative' || habit.target == null) return null
  return t('habits.summary.target', { target: formatNumber(habit.target, lang), unit: habit.unit ?? '' }).trim()
}
