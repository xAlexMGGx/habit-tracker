import type { Habit, HabitType, VizType } from './database.types'
import { type DateStr, addDays } from './dates'
import { DEFAULT_VIZ } from './habitMeta'
import { isPlannedOn } from './schedule'

/** Small deterministic PRNG, so previews and the guide look the same every time. */
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// A bit over a year, so the jar's shelf has a full row of past months.
const SAMPLE_DAYS = 380

/** A full habit row for previews: fills in the fields the visualizations don't care about. */
export function sampleHabit(today: DateStr, overrides: Partial<Habit>): Habit {
  const type: HabitType = overrides.type ?? 'boolean'
  return {
    id: 'sample',
    user_id: '',
    name: '',
    icon: '✅',
    color: 'blue',
    type,
    target: type === 'quantitative' ? 8 : null,
    unit: null,
    quick_step: 1,
    frequency_type: 'daily',
    frequency_days: null,
    frequency_times: null,
    frequency_interval: null,
    reminders: [],
    health_metric: null,
    viz_type: DEFAULT_VIZ[type],
    viz_config: {},
    sort_order: 0,
    archived_at: null,
    created_at: '',
    updated_at: '',
    ...overrides,
    // Always as old as the sample history, whatever the form says.
    start_date: addDays(today, -SAMPLE_DAYS),
  }
}

/**
 * Plausible history for a habit, ending today: mostly done, with a few gaps,
 * a recent good run and, for negative habits, the occasional relapse.
 */
export function sampleLogs(habit: Habit, today: DateStr, seed = 7): Map<DateStr, number> {
  const rand = mulberry32(seed)
  const logs = new Map<DateStr, number>()
  const start = addDays(today, -SAMPLE_DAYS)
  const target = habit.target ?? 1

  for (let i = 0; i <= SAMPLE_DAYS; i++) {
    const date = addDays(start, i)
    const recent = i > SAMPLE_DAYS - 12
    const r = rand()
    if (habit.type === 'negative') {
      // Relapses get rarer over time; none in the last 12 days.
      if (!recent && r < 0.09 - (i / SAMPLE_DAYS) * 0.06) logs.set(date, 1)
      continue
    }
    if (date === today) continue
    const planned = isPlannedOn({ ...habit, start_date: start }, date)
    // The recent good run only applies to planned days (a 3-times-a-week jar stays half full).
    const chance = planned ? (recent ? 0.95 : 0.78) : 0.08
    if (r > chance) {
      if (habit.type === 'quantitative' && r < chance + 0.12) logs.set(date, Math.max(1, Math.round(target * 0.5)))
      continue
    }
    if (habit.type === 'quantitative') {
      const amount = target * (0.85 + rand() * 0.5)
      logs.set(date, target >= 20 ? Math.round(amount / 100) * 100 : Math.round(amount))
    } else {
      logs.set(date, 1)
    }
  }
  return logs
}

/** Example habits used by the visualization guide (names come from the translation files). */
export const GUIDE_SAMPLES: Record<VizType, Partial<Habit>> = {
  heatmap: { type: 'boolean', icon: '🧘', color: 'purple' },
  calendar: { type: 'boolean', icon: '🧹', color: 'teal', frequency_type: 'weekdays', frequency_days: [2, 4, 6] },
  ring: { type: 'boolean', icon: '📚', color: 'green', frequency_type: 'weekdays', frequency_days: [1, 2, 3, 4, 5] },
  bars: { type: 'quantitative', icon: '💧', color: 'cyan', target: 8 },
  days_since: { type: 'negative', icon: '🚭', color: 'red' },
  // SPEC §8: "tarro a medio llenar de «Ir al gimnasio»"
  marble_jar: { type: 'boolean', icon: '🏋️', color: 'orange', frequency_type: 'times_per_week', frequency_times: 3, frequency_days: [1, 3, 5] },
  plant: { type: 'boolean', icon: '🎸', color: 'pink' },
}
