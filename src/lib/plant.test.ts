import { describe, expect, it } from 'vitest'
import { addDays } from './dates'
import { plantState } from './plant'
import type { ScheduleHabit } from './schedule'

const base: ScheduleHabit = {
  type: 'boolean',
  target: null,
  frequency_type: 'daily',
  frequency_days: null,
  frequency_times: null,
  frequency_interval: null,
  start_date: '2026-01-01',
}
const TODAY = '2026-10-21'
/** Done on the given days back from yesterday (1 = yesterday). */
const doneOn = (...daysBack: number[]) => new Map(daysBack.map((n) => [addDays(TODAY, -n), 1]))
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i)

describe('plantState', () => {
  it('phases by completion over the last 14 due days', () => {
    expect(plantState(base, doneOn(), TODAY).phase).toBe('seed') // 0 %
    expect(plantState(base, doneOn(...range(1, 3)), TODAY).phase).toBe('sprout') // 3/14 = 21 %
    expect(plantState(base, doneOn(...range(1, 6)), TODAY).phase).toBe('young') // 43 %
    expect(plantState(base, doneOn(...range(1, 9)), TODAY).phase).toBe('plant') // 64 %
    expect(plantState(base, doneOn(...range(1, 12)), TODAY).phase).toBe('flower') // 86 %
  })

  it('a pending today does not count; completing today does', () => {
    const l = doneOn(...range(1, 11)) // 11/14 = 79 %
    expect(plantState(base, l, TODAY).phase).toBe('plant')
    l.set(TODAY, 1) // window is now today + 13 previous days: 12/14
    expect(plantState(base, l, TODAY).phase).toBe('flower')
  })

  it('wilts after 3 missed due days in a row and revives with one completion', () => {
    const l = doneOn(...range(4, 14)) // missed the last 3 days
    const wilted = plantState(base, l, TODAY)
    expect(wilted.wilted).toBe(true)
    expect(wilted.phase).toBe('plant') // 11/14 still decides the phase
    l.set(TODAY, 1)
    expect(plantState(base, l, TODAY).wilted).toBe(false)
  })

  it('only due days count (weekdays habit)', () => {
    const h = { ...base, frequency_type: 'weekdays' as const, frequency_days: [1, 3, 5] }
    // Missing Tue/Thu/Sat/Sun is irrelevant: not due
    const l = new Map(['2026-10-19', '2026-10-16', '2026-10-14', '2026-10-12'].map((d) => [d, 1]))
    const st = plantState(h, l, TODAY)
    expect(st.wilted).toBe(false)
    expect(st.total).toBe(14)
  })

  it('quantitative counts only when the goal is reached', () => {
    const h = { ...base, type: 'quantitative' as const, target: 8 }
    const l = new Map(range(1, 14).map((n) => [addDays(TODAY, -n), 7]))
    expect(plantState(h, l, TODAY)).toMatchObject({ phase: 'seed', wilted: true })
  })

  it('a brand-new habit is a seed, not wilted', () => {
    expect(plantState({ ...base, start_date: TODAY }, new Map(), TODAY)).toMatchObject({ phase: 'seed', wilted: false, total: 0 })
  })

  it('a new habit completed today is still a seed: the % is always over 14', () => {
    const st = plantState({ ...base, start_date: TODAY }, new Map([[TODAY, 1]]), TODAY)
    expect(st).toMatchObject({ phase: 'seed', done: 1, total: 1, nextDays: 3 })
    expect(st.pct).toBeCloseTo(1 / 14)
  })

  it('a new habit grows with each completed day: 3 → sprout, 6 → young, 9 → plant, 12 → flower', () => {
    const grow = (n: number) => {
      const start = addDays(TODAY, -(n - 1))
      const l = new Map(Array.from({ length: n }, (_, i) => [addDays(start, i), 1]))
      return plantState({ ...base, start_date: start }, l, TODAY).phase
    }
    expect([1, 2, 3, 5, 6, 8, 9, 11, 12].map(grow)).toEqual([
      'seed', 'seed', 'sprout', 'sprout', 'young', 'young', 'plant', 'plant', 'flower',
    ])
  })
})
