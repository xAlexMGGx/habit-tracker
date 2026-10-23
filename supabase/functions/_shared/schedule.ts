// Shared by the app (src/lib/schedule.ts re-exports it) and the Edge Functions (Deno),
// so it only uses explicit `.ts` imports and no app types.
import { type DateStr, diffDays, isoWeekday, weekDates, weekStart } from './dates.ts'

/** Fields of a habit that decide when it is due and when it counts as done. */
export type ScheduleHabit = {
  type: 'boolean' | 'quantitative' | 'negative'
  target: number | null
  frequency_type: 'daily' | 'weekdays' | 'times_per_week' | 'every_n_days'
  frequency_days: number[] | null
  frequency_times: number | null
  frequency_interval: number | null
  start_date: DateStr
}

export type LogRow = { habit_id: string; log_date: DateStr; value: number }

/** Values logged for one habit, by date. A missing date means value 0. */
export type HabitLogMap = ReadonlyMap<DateStr, number>

/** habit_id → (date → value) */
export type LogIndex = Map<string, Map<DateStr, number>>

const EMPTY: HabitLogMap = new Map()

export function buildLogIndex(logs: readonly LogRow[]): LogIndex {
  const index: LogIndex = new Map()
  for (const log of logs) {
    let byDate = index.get(log.habit_id)
    if (!byDate) index.set(log.habit_id, (byDate = new Map()))
    byDate.set(log.log_date, Number(log.value))
  }
  return index
}

export function logsFor(index: LogIndex, habitId: string): HabitLogMap {
  return index.get(habitId) ?? EMPTY
}

/**
 * Whether a day's value means the habit was fulfilled:
 * yes/no → logged; quantitative → reached the target; negative → no relapse.
 */
export function isCompletedValue(habit: Pick<ScheduleHabit, 'type' | 'target'>, value: number): boolean {
  switch (habit.type) {
    case 'boolean':
      return value >= 1
    case 'quantitative':
      return habit.target != null && value >= habit.target
    case 'negative':
      return value === 0
  }
}

export function isCompletedOn(habit: ScheduleHabit, date: DateStr, logs: HabitLogMap): boolean {
  return isCompletedValue(habit, logs.get(date) ?? 0)
}

/** The habit's fixed plan, before the weekly adjustments of times_per_week. */
export function isPlannedOn(habit: ScheduleHabit, date: DateStr): boolean {
  if (date < habit.start_date) return false
  switch (habit.frequency_type) {
    case 'daily':
      return true
    case 'weekdays':
    case 'times_per_week':
      return (habit.frequency_days ?? []).includes(isoWeekday(date))
    case 'every_n_days': {
      const n = habit.frequency_interval ?? 1
      return diffDays(date, habit.start_date) % n === 0
    }
  }
}

/**
 * Days of the week (starting on `monday`) on which a times_per_week habit is due.
 *
 * The user plans X days. Completing it on any other day of that week replaces a
 * planned day that is still pending — the earliest ones first, so a missed day is
 * covered before an upcoming one. Completed days are always due (and done).
 */
export function weeklyDueDates(habit: ScheduleHabit, monday: DateStr, logs: HabitLogMap): Set<DateStr> {
  const days = weekDates(monday).filter((d) => d >= habit.start_date)
  const completed = days.filter((d) => isCompletedOn(habit, d, logs))
  const needed = Math.max(0, (habit.frequency_times ?? 0) - completed.length)
  const pendingPlanned = days.filter((d) => isPlannedOn(habit, d) && !completed.includes(d))
  const stillDue = needed > 0 ? pendingPlanned.slice(-needed) : []
  return new Set([...completed, ...stillDue])
}

export function isDueOn(habit: ScheduleHabit, date: DateStr, logs: HabitLogMap): boolean {
  if (date < habit.start_date) return false
  if (habit.frequency_type === 'times_per_week') {
    return weeklyDueDates(habit, weekStart(date), logs).has(date)
  }
  return isPlannedOn(habit, date)
}

/** "n/X this week" for times_per_week habits. */
export function weekProgress(habit: ScheduleHabit, date: DateStr, logs: HabitLogMap): { done: number; goal: number } {
  const done = weekDates(weekStart(date)).filter(
    (d) => d >= habit.start_date && isCompletedOn(habit, d, logs),
  ).length
  return { done, goal: habit.frequency_times ?? 0 }
}

export type DayHabits<H extends ScheduleHabit> = {
  /** Habits due that day: these make up the "Hábitos n/m" counter. */
  due: H[]
  /** times_per_week habits that are not due that day but can still be done. */
  optional: H[]
}

/** Splits active, already-started habits into due and optional for a given day. */
export function habitsForDay<H extends ScheduleHabit & { id: string; archived_at: string | null }>(
  habits: readonly H[],
  date: DateStr,
  index: LogIndex,
): DayHabits<H> {
  const due: H[] = []
  const optional: H[] = []
  for (const habit of habits) {
    if (habit.archived_at || date < habit.start_date) continue
    const logs = logsFor(index, habit.id)
    if (isDueOn(habit, date, logs)) {
      due.push(habit)
    } else if (habit.frequency_type === 'times_per_week') {
      const { done, goal } = weekProgress(habit, date, logs)
      if (done < goal || logs.has(date)) optional.push(habit)
    }
  }
  return { due, optional }
}

export function countCompleted<H extends ScheduleHabit & { id: string }>(
  habits: readonly H[],
  date: DateStr,
  index: LogIndex,
): number {
  return habits.filter((h) => isCompletedOn(h, date, logsFor(index, h.id))).length
}
