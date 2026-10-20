import { describe, expect, it } from 'vitest'
import {
  type ScheduleHabit,
  habitsForDay,
  isCompletedValue,
  isDueOn,
  isPlannedOn,
  weekProgress,
  weeklyDueDates,
} from './schedule'

const base: ScheduleHabit = {
  type: 'boolean',
  target: null,
  frequency_type: 'daily',
  frequency_days: null,
  frequency_times: null,
  frequency_interval: null,
  start_date: '2026-10-01',
}

const logs = (...dates: string[]) => new Map(dates.map((d) => [d, 1]))

// Week of Monday 2026-10-19 … Sunday 2026-10-25
const MON = '2026-10-19'
const TUE = '2026-10-20'
const WED = '2026-10-21'
const THU = '2026-10-22'
const FRI = '2026-10-23'

describe('isCompletedValue', () => {
  it('boolean needs a log', () => {
    expect(isCompletedValue(base, 0)).toBe(false)
    expect(isCompletedValue(base, 1)).toBe(true)
  })
  it('quantitative needs the target', () => {
    const h = { type: 'quantitative' as const, target: 8 }
    expect(isCompletedValue(h, 7)).toBe(false)
    expect(isCompletedValue(h, 8)).toBe(true)
  })
  it('negative is completed while there is no relapse', () => {
    const h = { type: 'negative' as const, target: null }
    expect(isCompletedValue(h, 0)).toBe(true)
    expect(isCompletedValue(h, 1)).toBe(false)
  })
})

describe('fixed frequencies', () => {
  it('is never due before the start date', () => {
    expect(isDueOn(base, '2026-09-30', new Map())).toBe(false)
    expect(isDueOn(base, '2026-10-01', new Map())).toBe(true)
  })

  it('weekdays', () => {
    const h = { ...base, frequency_type: 'weekdays' as const, frequency_days: [1, 3, 5] }
    expect([MON, TUE, WED, THU, FRI].map((d) => isPlannedOn(h, d))).toEqual([true, false, true, false, true])
  })

  it('every N days is anchored at the start date', () => {
    const h = { ...base, frequency_type: 'every_n_days' as const, frequency_interval: 3, start_date: '2026-10-01' }
    expect(isPlannedOn(h, '2026-10-01')).toBe(true)
    expect(isPlannedOn(h, '2026-10-02')).toBe(false)
    expect(isPlannedOn(h, '2026-10-04')).toBe(true)
    expect(isPlannedOn(h, '2026-10-07')).toBe(true)
  })
})

describe('times per week (planned days that move)', () => {
  // 3 times a week, planned Monday, Wednesday, Friday
  const h: ScheduleHabit = { ...base, frequency_type: 'times_per_week', frequency_times: 3, frequency_days: [1, 3, 5] }

  it('follows the plan when nothing has been done off-plan', () => {
    expect([...weeklyDueDates(h, MON, logs(MON))].sort()).toEqual([MON, WED, FRI])
  })

  it('an off-plan completion replaces the next pending planned day', () => {
    // Done Monday and Tuesday → Wednesday is no longer due, Friday still is
    const l = logs(MON, TUE)
    expect([...weeklyDueDates(h, MON, l)].sort()).toEqual([MON, TUE, FRI])
    expect(isDueOn(h, WED, l)).toBe(false)
    expect(isDueOn(h, FRI, l)).toBe(true)
  })

  it('an off-plan completion first covers a missed planned day', () => {
    // Missed Monday, done Tuesday → Monday is covered; Wednesday and Friday remain
    const l = logs(TUE)
    expect([...weeklyDueDates(h, MON, l)].sort()).toEqual([TUE, WED, FRI])
    expect(isDueOn(h, MON, l)).toBe(false)
  })

  it('once the weekly goal is met, nothing else is due', () => {
    const l = logs(MON, TUE, THU)
    expect([...weeklyDueDates(h, MON, l)].sort()).toEqual([MON, TUE, THU])
    expect(isDueOn(h, FRI, l)).toBe(false)
    expect(weekProgress(h, FRI, l)).toEqual({ done: 3, goal: 3 })
  })

  it('shows off-plan days as optional while the goal is not met', () => {
    const habit = { ...h, id: 'a', archived_at: null }
    const index = new Map([['a', logs(MON)]])
    expect(habitsForDay([habit], TUE, index)).toEqual({ due: [], optional: [habit] })
    expect(habitsForDay([habit], WED, index)).toEqual({ due: [habit], optional: [] })
  })

  it('ignores days before the start date', () => {
    const late = { ...h, start_date: THU }
    // Only Friday is planned after the start; it stays due.
    expect([...weeklyDueDates(late, MON, new Map())]).toEqual([FRI])
  })
})

describe('habitsForDay', () => {
  it('skips archived habits and habits that have not started', () => {
    const active = { ...base, id: 'a', archived_at: null }
    const archived = { ...base, id: 'b', archived_at: '2026-10-10T00:00:00Z' }
    const future = { ...base, id: 'c', archived_at: null, start_date: '2026-11-01' }
    expect(habitsForDay([active, archived, future], TUE, new Map()).due).toEqual([active])
  })
})
