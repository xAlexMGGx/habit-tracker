import { type DateStr, addDays } from './dates'
import type { HabitLogMap, ScheduleHabit } from './schedule'
import { dayStatusFn, isCounted } from './stats'

// --- Tuning (SPEC §7: easy to adjust) -----------------------------------------
/** Due days looked at to decide the phase. */
export const PLANT_WINDOW = 14
/** Minimum completion over the window for sprout, young plant, plant and flower. */
export const PLANT_THRESHOLDS = [0.2, 0.4, 0.6, 0.8] as const
/** Consecutive missed due days that make it wilt. */
export const WILT_AFTER_MISSES = 3
// ------------------------------------------------------------------------------

export const PLANT_PHASES = ['seed', 'sprout', 'young', 'plant', 'flower'] as const
export type PlantPhase = (typeof PLANT_PHASES)[number]

export type PlantState = {
  phase: PlantPhase
  phaseIndex: number
  /** Completion over the last PLANT_WINDOW due days (fewer if the habit is newer). */
  pct: number
  done: number
  total: number
  /** Missed the last WILT_AFTER_MISSES due days. It never dies: one completion revives it. */
  wilted: boolean
  /** Threshold of the next phase, or null at the flower. */
  next: number | null
}

/**
 * Recent consistency. Looks back over the last 14 due days (a pending today doesn't count;
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
  const pct = recent.length ? done / recent.length : 0
  const phaseIndex = PLANT_THRESHOLDS.filter((t) => pct >= t).length
  const wilted = recent.length >= WILT_AFTER_MISSES && recent.slice(0, WILT_AFTER_MISSES).every((d) => !d)
  return {
    phase: PLANT_PHASES[phaseIndex],
    phaseIndex,
    pct,
    done,
    total: recent.length,
    wilted,
    next: PLANT_THRESHOLDS[phaseIndex] ?? null,
  }
}
