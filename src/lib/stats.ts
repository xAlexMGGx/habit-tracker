import { type DateStr, addDays, monthEnd, monthStart, weekStart } from './dates'
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

/** Whether the habit is due on a date (past or future). Caches the weekly plan of times-per-week habits. */
export function dueFn(habit: ScheduleHabit, logs: HabitLogMap) {
  const weeks = new Map<DateStr, Set<DateStr>>()
  return (date: DateStr): boolean => {
    if (date < habit.start_date) return false
    if (habit.frequency_type !== 'times_per_week') return isPlannedOn(habit, date)
    const monday = weekStart(date)
    let due = weeks.get(monday)
    if (!due) weeks.set(monday, (due = weeklyDueDates(habit, monday, logs)))
    return due.has(date)
  }
}

/** Builds a status lookup for one habit. */
export function dayStatusFn(habit: ScheduleHabit, logs: HabitLogMap, today: DateStr) {
  const isDue = dueFn(habit, logs)

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
  /** Done so far over every due day of this week (Monday → Sunday). */
  week: Rate
  /** Done so far over every due day of this month. */
  month: Rate
  /** Since the habit's start date, over the due days up to today. */
  total: Rate
  /** Last 30 days up to today, used for the automatic "% de cumplimiento" order. */
  last30: Rate
}

function rate(done: number, total: number): Rate {
  return { done, total, pct: total ? done / total : null }
}

/**
 * Progress over a whole natural period: days done so far out of every day the habit is due
 * in the period, future ones included. A 4-times-a-week habit with 2 done is at 2/4 (50 %)
 * whatever the day. Feeds the ring and the weekly/monthly stats.
 */
export function periodProgress(
  habit: ScheduleHabit,
  logs: HabitLogMap,
  today: DateStr,
  period: 'week' | 'month',
): Rate {
  const isDue = dueFn(habit, logs)
  const status = dayStatusFn(habit, logs, today)
  const from = period === 'week' ? weekStart(today) : monthStart(today)
  const to = period === 'week' ? addDays(from, 6) : monthEnd(today)
  let done = 0
  let total = 0
  for (let d = from < habit.start_date ? habit.start_date : from; d <= to; d = addDays(d, 1)) {
    if (!isDue(d)) continue
    total += 1
    if (d <= today && status(d) === 'done') done += 1
  }
  return rate(done, total)
}

/** Streaks and percentages, computed over the days the habit was due (SPEC §3). */
export function computeStats(habit: ScheduleHabit, logs: HabitLogMap, today: DateStr): HabitStats {
  const status = dayStatusFn(habit, logs, today)
  const last30From = addDays(today, -29)

  const acc = { total: [0, 0], last30: [0, 0] }
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
    if (d >= last30From) (acc.last30[0] += hit), (acc.last30[1] += 1)
  }

  return {
    currentStreak: run,
    bestStreak: best,
    week: periodProgress(habit, logs, today, 'week'),
    month: periodProgress(habit, logs, today, 'month'),
    total: rate(acc.total[0], acc.total[1]),
    last30: rate(acc.last30[0], acc.last30[1]),
  }
}
