import { useMemo } from 'react'
import type { Habit } from '../lib/database.types'
import type { DateStr } from '../lib/dates'
import { type LogIndex, logsFor } from '../lib/schedule'
import { type HabitStats, computeStats } from '../lib/stats'

/** Streaks and percentages for every habit, recomputed when logs or the day change. */
export function useHabitStats(habits: readonly Habit[], index: LogIndex, today: DateStr): Map<string, HabitStats> {
  return useMemo(
    () => new Map(habits.map((h) => [h.id, computeStats(h, logsFor(index, h.id), today)])),
    [habits, index, today],
  )
}
