import { type DateStr, addDays } from './dates'
import type { HabitLogMap, ScheduleHabit } from './schedule'
import { dayStatusFn, isCounted } from './stats'

// --- Tuning (SPEC §7: easy to adjust) -----------------------------------------
/** Due days looked at to decide the phase. The % is always over this many days. */
export const PLANT_WINDOW = 14
/** Minimum completion over the window for sprout, young plant, plant and flower (3, 6, 9 and 12 of 14). */
export const PLANT_THRESHOLDS = [0.2, 0.4, 0.6, 0.8] as const
/** Consecutive missed due days that make it wilt. */
export const WILT_AFTER_MISSES = 3
// ------------------------------------------------------------------------------

export const PLANT_PHASES = ['seed', 'sprout', 'young', 'plant', 'flower'] as const
export type PlantPhase = (typeof PLANT_PHASES)[number]

export type PlantState = {
  phase: PlantPhase
  phaseIndex: number
  /** Completed days over PLANT_WINDOW. Days before the habit existed count as not done. */
  pct: number
  done: number
  /** Due days found in the window (less than PLANT_WINDOW for a new habit). */
  total: number
  /** Missed the last WILT_AFTER_MISSES due days. It never dies: one completion revives it. */
  wilted: boolean
  /** Completed days needed for the next phase, or null at the flower. */
  nextDays: number | null
}

/** Completed days out of PLANT_WINDOW that a phase threshold requires (0.2 → 3 of 14). */
export function daysForThreshold(threshold: number): number {
  return Math.ceil(threshold * PLANT_WINDOW - 1e-9)
}

/**
 * Recent consistency. Counts completions over the last 14 due days and always divides by 14,
 * so a new habit starts as a seed and grows day by day (a pending today doesn't count;
 * a quantitative day only counts if it reached the goal).
 */
export function plantState(habit: ScheduleHabit, logs: HabitLogMap, today: DateStr): PlantState {
  const status = dayStatusFn(habit, logs, today)
  const recent: boolean[] = [] // most recent first; true = done
  for (let d = today; d >= habit.start_date && recent.length < PLANT_WINDOW; d = addDays(d, -1)) {
    const s = status(d)
    if (isCounted(s)) recent.push(s === 'done')
  }
  const done = recent.filter(Boolean).length
  const phaseIndex = PLANT_THRESHOLDS.filter((t) => done >= daysForThreshold(t)).length
  const wilted = recent.length >= WILT_AFTER_MISSES && recent.slice(0, WILT_AFTER_MISSES).every((d) => !d)
  const next = PLANT_THRESHOLDS[phaseIndex]
  return {
    phase: PLANT_PHASES[phaseIndex],
    phaseIndex,
    pct: done / PLANT_WINDOW,
    done,
    total: recent.length,
    wilted,
    nextDays: next == null ? null : daysForThreshold(next),
  }
}
