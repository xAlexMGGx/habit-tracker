import { describe, expect, it } from 'vitest'
import { addDays } from './dates'
import {
  type JarConfig,
  currentJar,
  expectedCompletions,
  jarCapacity,
  marblesIn,
  periodEnd,
  periodStart,
  shelfJars,
  shiftPeriod,
} from './jar'
import type { ScheduleHabit } from './schedule'

const base: ScheduleHabit = {
  type: 'boolean',
  target: null,
  frequency_type: 'daily',
  frequency_days: null,
  frequency_times: null,
  frequency_interval: null,
  start_date: '2025-01-01',
}
const monthly: JarConfig = { jarPeriod: 'month', jarCapacity: 'all', jarMarbleValue: null }
const logs = (entries: Record<string, number>) => new Map(Object.entries(entries))

describe('periods', () => {
  it('natural boundaries', () => {
    expect(periodStart('2026-10-21', 'week')).toBe('2026-10-19')
    expect(periodStart('2026-10-21', 'month')).toBe('2026-10-01')
    expect(periodStart('2026-10-21', 'quarter')).toBe('2026-10-01')
    expect(periodStart('2026-08-15', 'quarter')).toBe('2026-07-01')
    expect(periodStart('2026-10-21', 'year')).toBe('2026-01-01')
    expect(periodEnd('2026-02-01', 'month')).toBe('2026-02-28')
    expect(periodEnd('2026-10-01', 'quarter')).toBe('2026-12-31')
    expect(shiftPeriod('2026-01-01', 'month', -1)).toBe('2025-12-01')
    expect(shiftPeriod('2026-10-01', 'quarter', -4)).toBe('2025-10-01')
  })
})

describe('capacity (SPEC §7 examples)', () => {
  it('daily + monthly → days of the month (28 to 31)', () => {
    expect(jarCapacity(base, monthly, '2026-10-01', '2026-10-31')).toBe(31)
    expect(jarCapacity(base, monthly, '2026-02-01', '2026-02-28')).toBe(28)
  })
  it('daily + weekly → 7, daily + yearly → 365', () => {
    expect(jarCapacity(base, { ...monthly, jarPeriod: 'week' }, '2026-10-19', '2026-10-25')).toBe(7)
    expect(jarCapacity(base, { ...monthly, jarPeriod: 'year' }, '2026-01-01', '2026-12-31')).toBe(365)
  })
  it('3 times a week + monthly → about 13', () => {
    const h = { ...base, frequency_type: 'times_per_week' as const, frequency_times: 3, frequency_days: [1, 3, 5] }
    expect(jarCapacity(h, monthly, '2026-10-01', '2026-10-31')).toBe(13)
  })
  it('80 % option and custom number', () => {
    expect(jarCapacity(base, { ...monthly, jarCapacity: 'most' }, '2026-10-01', '2026-10-31')).toBe(25)
    expect(jarCapacity(base, { ...monthly, jarCapacity: 20 }, '2026-10-01', '2026-10-31')).toBe(20)
  })
  it('weekdays count exact due days', () => {
    const h = { ...base, frequency_type: 'weekdays' as const, frequency_days: [1, 3, 5] }
    expect(expectedCompletions(h, '2026-10-01', '2026-10-31')).toBe(13) // Oct 2026: 4 Mon, 4 Wed, 5 Fri
  })
  it('a habit that starts mid-period only expects the remaining days', () => {
    expect(jarCapacity({ ...base, start_date: '2026-10-22' }, monthly, '2026-10-01', '2026-10-31')).toBe(10)
  })
  it('quantitative: capacity in marbles of the chosen value', () => {
    const h = { ...base, type: 'quantitative' as const, target: 5 }
    expect(jarCapacity(h, monthly, '2026-10-01', '2026-10-31')).toBe(31) // 1 marble = goal (5 km)
    expect(jarCapacity(h, { ...monthly, jarMarbleValue: 1 }, '2026-10-01', '2026-10-31')).toBe(155) // 1 marble = 1 km
  })
})

describe('marbles', () => {
  it('yes/no: one per completed day, misses never subtract', () => {
    expect(marblesIn(base, monthly, logs({ '2026-10-01': 1, '2026-10-05': 1, '2026-09-30': 1 }), '2026-10-01', '2026-10-31').count).toBe(2)
  })
  it('quantitative: the amount adds up across days', () => {
    const h = { ...base, type: 'quantitative' as const, target: 5 }
    const m = marblesIn(h, { ...monthly, jarMarbleValue: 1 }, logs({ '2026-10-01': 5.5, '2026-10-02': 2.5 }), '2026-10-01', '2026-10-31')
    expect(m).toEqual({ count: 8, fraction: 0 })
    const partial = marblesIn(h, monthly, logs({ '2026-10-01': 3, '2026-10-02': 4 }), '2026-10-01', '2026-10-31')
    expect(partial.count).toBe(1)
    expect(partial.fraction).toBeCloseTo(0.4)
  })
  it('a full jar keeps counting extra marbles', () => {
    const l = logs(Object.fromEntries(Array.from({ length: 10 }, (_, i) => [addDays('2026-10-19', i % 7), 1])))
    const jar = currentJar(base, { ...monthly, jarPeriod: 'week', jarCapacity: 5 }, l, '2026-10-25')
    expect(jar).toMatchObject({ count: 7, capacity: 5, extra: 2 })
  })
})

describe('shelf', () => {
  it('last 12 finished periods, oldest first; before the start they are empty', () => {
    const h = { ...base, start_date: '2026-05-10' }
    const shelf = shelfJars(h, monthly, logs({ '2026-09-03': 1 }), '2026-10-21')
    expect(shelf).toHaveLength(12)
    expect(shelf[0]).toBeNull() // Oct 2025
    expect(shelf[6]).toBeNull() // Apr 2026, before the start
    expect(shelf[7]?.start).toBe('2026-05-01')
    expect(shelf[7]?.capacity).toBe(22) // 10..31 May
    expect(shelf[11]).toMatchObject({ start: '2026-09-01', count: 1, capacity: 30 })
  })
})

describe('daily jar (quantitative)', () => {
  // "Pasos": 10.000 a day, on weekdays only; 1 marble = 1.000 steps
  const steps: ScheduleHabit = { ...base, type: 'quantitative', target: 10000, frequency_type: 'weekdays', frequency_days: [1, 2, 3, 4, 5] }
  const daily: JarConfig = { jarPeriod: 'day', jarCapacity: 37, jarMarbleValue: 1000 }
  const stepLogs = logs({ '2026-10-23': 12500, '2026-10-24': 8432 })

  it('a period is one day', () => {
    expect(periodStart('2026-10-24', 'day')).toBe('2026-10-24')
    expect(periodEnd('2026-10-24', 'day')).toBe('2026-10-24')
    expect(shiftPeriod('2026-10-24', 'day', -3)).toBe('2026-10-21')
  })

  it("holds the day's goal, whatever the frequency or a saved custom capacity", () => {
    expect(jarCapacity(steps, daily, '2026-10-24', '2026-10-24')).toBe(10) // Saturday, not due
    expect(jarCapacity(steps, daily, '2026-10-23', '2026-10-23')).toBe(10)
    // Without a marble value, the daily goal is split into 10 marbles
    expect(jarCapacity(steps, { ...daily, jarMarbleValue: null }, '2026-10-23', '2026-10-23')).toBe(10)
    expect(currentJar(steps, { ...daily, jarMarbleValue: null }, stepLogs, '2026-10-24')).toMatchObject({ count: 8, capacity: 10 })
    // Other periods keep 1 marble = the daily goal
    expect(jarCapacity(steps, { ...daily, jarPeriod: 'week', jarCapacity: 'all', jarMarbleValue: null }, '2026-10-19', '2026-10-25')).toBe(5)
  })

  it("only today's amount goes in", () => {
    expect(currentJar(steps, daily, stepLogs, '2026-10-24')).toMatchObject({ count: 8, capacity: 10, extra: 0 })
    expect(currentJar(steps, daily, stepLogs, '2026-10-23')).toMatchObject({ count: 12, capacity: 10, extra: 2 })
  })

  it('the shelf shows the previous 12 days', () => {
    const shelf = shelfJars(steps, daily, stepLogs, '2026-10-24')
    expect(shelf).toHaveLength(12)
    expect(shelf.at(-1)).toMatchObject({ start: '2026-10-23', count: 12 })
    expect(shelf[0]?.start).toBe('2026-10-12')
  })
})
