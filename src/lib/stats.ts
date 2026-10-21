import { type DateStr, addDays, weekStart } from './dates'
import { type HabitLogMap, type ScheduleHabit, isCompletedValue, isPlannedOn, weeklyDueDates } from './schedule'

/**
 * How a single day looks for a habit.
 *  - inactive: before the habit's start date
 *  - future:   after today
 *  - not_due:  the habit didn't apply that day
 *  - pending:  today, due and not finished yet (a clean negative day is pending until it ends)
 *  - done / partial / missed: a due day that counts in streaks and percentages
 */
export type DayStatus = 'inactive' | 'future' | 'not_due' | 'pending' | 'done' | 'partial' | 'missed'

/** Builds a status lookup for one habit. Caches the weekly plan of times-per-week habits. */
export function dayStatusFn(habit: ScheduleHabit, logs: HabitLogMap, today: DateStr) {
  const weeks = new Map<DateStr, Set<DateStr>>()

  const isDue = (date: DateStr): boolean => {
    if (habit.frequency_type !== 'times_per_week') return isPlannedOn(habit, date)
    const monday = weekStart(date)
    let due = weeks.get(monday)
    if (!due) weeks.set(monday, (due = weeklyDueDates(habit, monday, logs)))
    return due.has(date)
  }

  return (date: DateStr): DayStatus => {
    if (date < habit.start_date) return 'inactive'
    if (date > today) return 'future'
    if (!isDue(date)) return 'not_due'
    const value = logs.get(date) ?? 0
    if (habit.type === 'negative') {
      if (value > 0) return 'missed'
      // SPEC §3: today only counts as clean once it is over.
      return date === today ? 'pending' : 'done'
    }
    if (isCompletedValue(habit, value)) return 'done'
    if (date === today) return 'pending'
    return value > 0 ? 'partial' : 'missed'
  }
}

/** Days that count in percentages (done, partial or missed). */
export function isCounted(status: DayStatus): boolean {
  return status === 'done' || status === 'partial' || status === 'missed'
}

/** 0..1 fill for heatmaps and calendars: quantitative habits fill in proportion to the target. */
export function intensity(habit: ScheduleHabit, value: number): number {
  if (habit.type === 'quantitative') return habit.target ? Math.min(1, value / habit.target) : 0
  if (habit.type === 'negative') return value > 0 ? 0 : 1
  return value >= 1 ? 1 : 0
}

export type Rate = { done: number; total: number; pct: number | null }

export type HabitStats = {
  /** Consecutive due days completed, up to today (a pending today doesn't break it). */
  currentStreak: number
  bestStreak: number
  /** Natural week (Monday → today). */
  week: Rate
  /** Natural month (day 1 → today). */
  month: Rate
  /** Since the habit's start date. */
  total: Rate
  /** Last 30 days, used for the automatic "% de cumplimiento" order. */
  last30: Rate
}

function rate(done: number, total: number): Rate {
  return { done, total, pct: total ? done / total : null }
}

/** Streaks and percentages, computed over the days the habit was due (SPEC §3). */
export function computeStats(habit: ScheduleHabit, logs: HabitLogMap, today: DateStr): HabitStats {
  const status = dayStatusFn(habit, logs, today)
  const weekFrom = weekStart(today)
  const monthFrom = `${today.slice(0, 7)}-01`
  const last30From = addDays(today, -29)

  const acc = { week: [0, 0], month: [0, 0], total: [0, 0], last30: [0, 0] }
  let run = 0
  let best = 0

  for (let d = habit.start_date; d <= today; d = addDays(d, 1)) {
    const s = status(d)
    if (s === 'done') {
      run += 1
      best = Math.max(best, run)
    } else if (s === 'partial' || s === 'missed') {
      run = 0
    }
    if (!isCounted(s)) continue
    const hit = s === 'done' ? 1 : 0
    acc.total[0] += hit
    acc.total[1] += 1
    if (d >= weekFrom) (acc.week[0] += hit), (acc.week[1] += 1)
    if (d >= monthFrom) (acc.month[0] += hit), (acc.month[1] += 1)
    if (d >= last30From) (acc.last30[0] += hit), (acc.last30[1] += 1)
  }

  return {
    currentStreak: run,
    bestStreak: best,
    week: rate(acc.week[0], acc.week[1]),
    month: rate(acc.month[0], acc.month[1]),
    total: rate(acc.total[0], acc.total[1]),
    last30: rate(acc.last30[0], acc.last30[1]),
  }
}

/** Completion rate of a natural period (for the ring). */
export function periodRate(
  habit: ScheduleHabit,
  logs: HabitLogMap,
  today: DateStr,
  period: 'week' | 'month',
): Rate {
  const status = dayStatusFn(habit, logs, today)
  let d = period === 'week' ? weekStart(today) : `${today.slice(0, 7)}-01`
  if (d < habit.start_date) d = habit.start_date
  let done = 0
  let total = 0
  for (; d <= today; d = addDays(d, 1)) {
    const s = status(d)
    if (!isCounted(s)) continue
    total += 1
    if (s === 'done') done += 1
  }
  return rate(done, total)
}
