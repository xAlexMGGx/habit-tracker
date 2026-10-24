import { describe, expect, it } from 'vitest'
import { addDays } from './dates'
import type { ScheduleHabit } from './schedule'
import { configFor, readVizConfig } from './vizConfig'
import { computeStats, dayProgress, dayStatusFn, intensity, periodProgress } from './stats'

const base: ScheduleHabit = {
  type: 'boolean',
  target: null,
  frequency_type: 'daily',
  frequency_days: null,
  frequency_times: null,
  frequency_interval: null,
  start_date: '2026-10-01',
}

const TODAY = '2026-10-21' // Wednesday
const logs = (entries: Record<string, number>) => new Map(Object.entries(entries))
/** n consecutive days ending at `last`, all with value v */
const run = (last: string, n: number, v = 1) =>
  Object.fromEntries(Array.from({ length: n }, (_, i) => [addDays(last, -i), v]))

describe('dayStatusFn', () => {
  it('boolean', () => {
    const s = dayStatusFn(base, logs({ '2026-10-19': 1 }), TODAY)
    expect(s('2026-09-30')).toBe('inactive')
    expect(s('2026-10-19')).toBe('done')
    expect(s('2026-10-20')).toBe('missed')
    expect(s(TODAY)).toBe('pending')
    expect(s('2026-10-22')).toBe('future')
  })

  it('quantitative partial', () => {
    const h = { ...base, type: 'quantitative' as const, target: 8 }
    const s = dayStatusFn(h, logs({ '2026-10-19': 8, '2026-10-20': 3, [TODAY]: 2 }), TODAY)
    expect(s('2026-10-19')).toBe('done')
    expect(s('2026-10-20')).toBe('partial')
    expect(s(TODAY)).toBe('pending')
  })

  it('negative: clean today is pending, relapse today is missed', () => {
    const h = { ...base, type: 'negative' as const }
    expect(dayStatusFn(h, logs({}), TODAY)(TODAY)).toBe('pending')
    expect(dayStatusFn(h, logs({}), TODAY)('2026-10-20')).toBe('done')
    expect(dayStatusFn(h, logs({ [TODAY]: 1 }), TODAY)(TODAY)).toBe('missed')
  })

  it('weekdays: other days are not due', () => {
    const h = { ...base, frequency_type: 'weekdays' as const, frequency_days: [1, 3, 5] }
    expect(dayStatusFn(h, logs({}), TODAY)('2026-10-20')).toBe('not_due') // Tuesday
  })
})

describe('computeStats', () => {
  it('streak counts up to yesterday while today is pending', () => {
    const st = computeStats(base, logs(run('2026-10-20', 5)), TODAY)
    expect(st.currentStreak).toBe(5)
  })

  it('completing today extends the streak', () => {
    const st = computeStats(base, logs(run(TODAY, 6)), TODAY)
    expect(st.currentStreak).toBe(6)
  })

  it('a missed day breaks the streak; best streak is kept', () => {
    // done 1..10, missed 11, done 12..20
    const l = { ...run('2026-10-10', 10), ...run('2026-10-20', 9) }
    const st = computeStats(base, logs(l), TODAY)
    expect(st.currentStreak).toBe(9)
    expect(st.bestStreak).toBe(10)
  })

  it('a partial quantitative day breaks the streak', () => {
    const h = { ...base, type: 'quantitative' as const, target: 8 }
    const st = computeStats(h, logs({ ...run('2026-10-20', 3, 8), '2026-10-17': 4 }), TODAY)
    expect(st.currentStreak).toBe(3)
  })

  it('days that are not due do not break streaks', () => {
    // Mon/Wed/Fri habit, done every due day
    const h = { ...base, frequency_type: 'weekdays' as const, frequency_days: [1, 3, 5] }
    const done = ['2026-10-02', '2026-10-05', '2026-10-07', '2026-10-09', '2026-10-12', '2026-10-14', '2026-10-16', '2026-10-19']
    const st = computeStats(h, logs(Object.fromEntries(done.map((d) => [d, 1]))), TODAY)
    expect(st.currentStreak).toBe(8)
    expect(st.total).toEqual({ done: 8, total: 8, pct: 1 })
  })

  it('negative: streak = clean days up to yesterday; relapse today resets it', () => {
    const h = { ...base, type: 'negative' as const, start_date: '2026-10-11' }
    expect(computeStats(h, logs({}), TODAY).currentStreak).toBe(10) // 11..20
    expect(computeStats(h, logs({ '2026-10-15': 1 }), TODAY).currentStreak).toBe(5) // 16..20
    expect(computeStats(h, logs({ [TODAY]: 2 }), TODAY).currentStreak).toBe(0)
  })

  it('week and month are measured against the whole period', () => {
    // Week of Monday 19th: done Mon only → 1 of the 7 days of the week
    const st = computeStats(base, logs({ '2026-10-19': 1 }), TODAY)
    expect(st.week).toEqual({ done: 1, total: 7, pct: 1 / 7 })
    expect(st.month).toEqual({ done: 1, total: 31, pct: 1 / 31 })
    // Total stays "so far": 1 done out of the 20 due days before today
    expect(st.total).toEqual({ done: 1, total: 20, pct: 0.05 })
  })

  it('last30 window', () => {
    const h = { ...base, start_date: '2026-01-01' }
    const st = computeStats(h, logs(run('2026-10-20', 30)), TODAY)
    expect(st.last30.total).toBe(29) // today pending is not counted
    expect(st.last30.done).toBe(29)
  })

  it('times per week: off-plan completions count as due days', () => {
    // Plan Mon/Wed/Fri, 3 a week; week of 12th done Tue, Thu, Sat → 3/3 and the streak goes on
    const h = { ...base, frequency_type: 'times_per_week' as const, frequency_times: 3, frequency_days: [1, 3, 5], start_date: '2026-10-12' }
    const st = computeStats(h, logs({ '2026-10-13': 1, '2026-10-15': 1, '2026-10-17': 1, '2026-10-19': 1 }), TODAY)
    expect(st.currentStreak).toBe(4)
    expect(st.bestStreak).toBe(4)
  })

  it('a habit that starts in the future has no data', () => {
    const st = computeStats({ ...base, start_date: '2026-11-01' }, logs({}), TODAY)
    expect(st.currentStreak).toBe(0)
    expect(st.total.pct).toBeNull()
  })
})

describe('periodProgress (ring) & intensity', () => {
  it('daily: done so far over the whole week / month', () => {
    const l = logs({ '2026-10-19': 1, '2026-10-20': 1 })
    expect(periodProgress(base, l, TODAY, 'week')).toEqual({ done: 2, total: 7, pct: 2 / 7 })
    expect(periodProgress(base, l, TODAY, 'month').total).toBe(31)
  })

  it('X times a week only reaches 100 % with all X done', () => {
    // 4 a week, planned Mon–Thu; today is Wednesday
    const h = { ...base, frequency_type: 'times_per_week' as const, frequency_times: 4, frequency_days: [1, 2, 3, 4] }
    expect(periodProgress(h, logs({ '2026-10-19': 1, '2026-10-20': 1 }), TODAY, 'week')).toEqual({ done: 2, total: 4, pct: 0.5 })
    const all = logs({ '2026-10-19': 1, '2026-10-20': 1, [TODAY]: 1, '2026-10-17': 1 })
    expect(periodProgress(h, all, TODAY, 'week')).toEqual({ done: 3, total: 4, pct: 0.75 }) // the 17th is last week
    expect(periodProgress(h, logs({ '2026-10-19': 1, '2026-10-20': 1, [TODAY]: 1, '2026-10-22': 1 }), '2026-10-22', 'week').pct).toBe(1)
  })

  it('weekdays: only the due days of the week count', () => {
    const h = { ...base, frequency_type: 'weekdays' as const, frequency_days: [1, 3, 5] }
    expect(periodProgress(h, logs({ '2026-10-19': 1 }), TODAY, 'week')).toEqual({ done: 1, total: 3, pct: 1 / 3 })
  })

  it('negative: clean days so far over the whole week; today counts when it ends', () => {
    const h = { ...base, type: 'negative' as const }
    expect(periodProgress(h, logs({}), TODAY, 'week')).toEqual({ done: 2, total: 7, pct: 2 / 7 })
  })

  it('a habit that starts mid-week only counts from its start', () => {
    expect(periodProgress({ ...base, start_date: '2026-10-22' }, logs({}), TODAY, 'week').total).toBe(4)
  })

  it('intensity', () => {
    expect(intensity({ ...base, type: 'quantitative', target: 8 }, 4)).toBe(0.5)
    expect(intensity({ ...base, type: 'quantitative', target: 8 }, 12)).toBe(1)
    expect(intensity({ ...base, type: 'negative' }, 0)).toBe(1)
    expect(intensity(base, 1)).toBe(1)
  })
})

describe('daily ring (quantitative)', () => {
  it("today's amount over the daily goal, past 100 % too", () => {
    const steps = new Map([['2026-10-24', 8432]])
    expect(dayProgress({ target: 10000 }, steps, '2026-10-24')).toEqual({ value: 8432, target: 10000, pct: 0.8432 })
    expect(dayProgress({ target: 10000 }, new Map([['2026-10-24', 12000]]), '2026-10-24').pct).toBe(1.2)
    expect(dayProgress({ target: 10000 }, new Map(), '2026-10-24').pct).toBe(0)
  })

  it('a saved daily period only applies to quantitative habits', () => {
    const daily = readVizConfig({ ringPeriod: 'day', jarPeriod: 'day' })
    expect(configFor('quantitative', daily)).toMatchObject({ ringPeriod: 'day', jarPeriod: 'day' })
    expect(configFor('boolean', daily)).toMatchObject({ ringPeriod: 'week', jarPeriod: 'month' })
    expect(readVizConfig({ ringPeriod: 'year' }).ringPeriod).toBe('week')
  })
})
