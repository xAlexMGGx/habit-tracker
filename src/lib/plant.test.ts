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
})
