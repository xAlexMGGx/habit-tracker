import type { Habit } from './database.types'
import { type DateStr, addDays, diffDays, weekStart } from './dates'
import { type HabitLogMap, isPlannedOn } from './schedule'

/**
 * Renewal period of the marble jar. Natural periods, like the rest of the stats.
 * 'day' (quantitative habits only): a jar per day, filled by that day's goal.
 */
export type JarPeriod = 'day' | 'week' | 'month' | 'quarter' | 'year'

/** 'all' = every due day (100 %), 'most' = 80 %, or a custom number of marbles. */
export type JarCapacity = 'all' | 'most' | number

export const MOST_RATIO = 0.8

export type JarConfig = {
  jarPeriod: JarPeriod
  jarCapacity: JarCapacity
  /** Quantitative habits: how much one marble is worth (null = the daily goal). */
  jarMarbleValue: number | null
}

type JarHabit = Pick<
  Habit,
  'type' | 'target' | 'frequency_type' | 'frequency_days' | 'frequency_times' | 'frequency_interval' | 'start_date'
>

export type Jar = {
  start: DateStr
  end: DateStr
  count: number
  capacity: number
  /** Marbles beyond the capacity (the jar filled up before the period ended). */
  extra: number
  /** Quantitative: progress towards the next marble, 0..1. */
  fraction: number
}

const MONTHS: Record<Exclude<JarPeriod, 'day' | 'week'>, number> = { month: 1, quarter: 3, year: 12 }

function firstOfMonth(year: number, month: number): DateStr {
  const d = new Date(Date.UTC(year, month - 1, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`
}

export function periodStart(date: DateStr, period: JarPeriod): DateStr {
  if (period === 'day') return date
  if (period === 'week') return weekStart(date)
  const y = Number(date.slice(0, 4))
  const m = Number(date.slice(5, 7))
  if (period === 'month') return firstOfMonth(y, m)
  if (period === 'quarter') return firstOfMonth(y, Math.floor((m - 1) / 3) * 3 + 1)
  return firstOfMonth(y, 1)
}

/** Start of the period n periods away from the one starting at `start`. */
export function shiftPeriod(start: DateStr, period: JarPeriod, n: number): DateStr {
  if (period === 'day') return addDays(start, n)
  if (period === 'week') return addDays(start, 7 * n)
  return firstOfMonth(Number(start.slice(0, 4)), Number(start.slice(5, 7)) + MONTHS[period] * n)
}

export function periodEnd(start: DateStr, period: JarPeriod): DateStr {
  return addDays(shiftPeriod(start, period, 1), -1)
}

/** Without a chosen value, a daily jar splits the goal into this many marbles. */
export const DAILY_JAR_MARBLES = 10

export function marbleValue(habit: Pick<JarHabit, 'type' | 'target'>, config: JarConfig): number {
  if (habit.type !== 'quantitative') return 1
  if (config.jarMarbleValue && config.jarMarbleValue > 0) return config.jarMarbleValue
  const goal = habit.target ?? 1
  // One marble per whole goal would leave a daily jar empty until the goal is met.
  return config.jarPeriod === 'day' ? goal / DAILY_JAR_MARBLES : goal
}

/** How many times the habit is expected in [start, end], counting only from its start date. */
export function expectedCompletions(habit: JarHabit, start: DateStr, end: DateStr): number {
  const from = start > habit.start_date ? start : habit.start_date
  if (from > end) return 0
  const days = diffDays(end, from) + 1
  switch (habit.frequency_type) {
    case 'daily':
      return days
    case 'times_per_week':
      return ((habit.frequency_times ?? 0) * days) / 7
    case 'weekdays':
    case 'every_n_days': {
      let n = 0
      for (let d = from; d <= end; d = addDays(d, 1)) if (isPlannedOn(habit, d)) n++
      return n
    }
  }
}

/** Suggested capacity for a given option (used by the form as well). */
export function suggestedCapacity(habit: JarHabit, config: JarConfig, start: DateStr, end: DateStr, option: 'all' | 'most') {
  const perCompletion = habit.type === 'quantitative' ? (habit.target ?? 1) / marbleValue(habit, config) : 1
  // A daily jar holds that day's goal, whatever the frequency.
  const base = (config.jarPeriod === 'day' ? 1 : expectedCompletions(habit, start, end)) * perCompletion
  return Math.max(1, Math.round(base * (option === 'most' ? MOST_RATIO : 1)))
}

export function jarCapacity(habit: JarHabit, config: JarConfig, start: DateStr, end: DateStr): number {
  if (config.jarPeriod === 'day') return suggestedCapacity(habit, config, start, end, 'all')
  if (typeof config.jarCapacity === 'number') return Math.max(1, Math.round(config.jarCapacity))
  return suggestedCapacity(habit, config, start, end, config.jarCapacity)
}

/**
 * Marbles collected in [start, end]. Yes/no: one per completed day. Quantitative: the amount
 * adds up across days (5.5 km + 2.5 km = 8 marbles at 1 km each). Misses never remove marbles.
 */
export function marblesIn(habit: JarHabit, config: JarConfig, logs: HabitLogMap, start: DateStr, end: DateStr) {
  let total = 0
  for (const [date, value] of logs) {
    if (date < start || date > end) continue
    total += habit.type === 'quantitative' ? value : value >= 1 ? 1 : 0
  }
  if (habit.type !== 'quantitative') return { count: total, fraction: 0 }
  const exact = total / marbleValue(habit, config)
  const count = Math.floor(exact + 1e-9)
  return { count, fraction: Math.max(0, exact - count) }
}

export function jarAt(habit: JarHabit, config: JarConfig, logs: HabitLogMap, start: DateStr): Jar {
  const end = periodEnd(start, config.jarPeriod)
  const capacity = jarCapacity(habit, config, start, end)
  const { count, fraction } = marblesIn(habit, config, logs, start, end)
  return { start, end, count, capacity, extra: Math.max(0, count - capacity), fraction }
}

/** The jar being filled now. */
export function currentJar(habit: JarHabit, config: JarConfig, logs: HabitLogMap, today: DateStr): Jar {
  return jarAt(habit, config, logs, periodStart(today, config.jarPeriod))
}

/**
 * The shelf: the last `n` finished periods, oldest first. Periods that ended before the habit
 * started are null (empty slots), so the 4×3 grid keeps its shape.
 */
export function shelfJars(habit: JarHabit, config: JarConfig, logs: HabitLogMap, today: DateStr, n = 12): (Jar | null)[] {
  const current = periodStart(today, config.jarPeriod)
  return Array.from({ length: n }, (_, i) => {
    const start = shiftPeriod(current, config.jarPeriod, i - n)
    return periodEnd(start, config.jarPeriod) < habit.start_date ? null : jarAt(habit, config, logs, start)
  })
}
