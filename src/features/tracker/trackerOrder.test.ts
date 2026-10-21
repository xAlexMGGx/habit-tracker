import { describe, expect, it } from 'vitest'
import type { HabitStats } from '../../lib/stats'
import { orderHabits } from './trackerOrder'

const h = (id: string, sort_order: number) => ({ id, sort_order, created_at: '2026-10-01' })
const habits = [h('c', 3), h('a', 1), h('b', 2), h('d', 4)]

const stats = (streak: number, pct: number | null): HabitStats => {
  const rate = { done: 0, total: 0, pct }
  return { currentStreak: streak, bestStreak: streak, week: rate, month: rate, total: rate, last30: rate }
}

const statsMap = new Map([
  ['a', stats(2, 0.5)],
  ['b', stats(9, null)],
  ['c', stats(2, 0.9)],
  ['d', stats(0, 0.5)],
])

const ids = (list: { id: string }[]) => list.map((x) => x.id).join('')

describe('orderHabits', () => {
  it('manual follows sort_order', () => {
    expect(ids(orderHabits(habits, 'manual', statsMap, new Set()))).toBe('abcd')
  })

  it('streak, ties in manual order', () => {
    expect(ids(orderHabits(habits, 'streak', statsMap, new Set()))).toBe('bacd')
  })

  it('completion (last 30 days), no data last', () => {
    expect(ids(orderHabits(habits, 'completion', statsMap, new Set()))).toBe('cadb')
  })

  it('pending today first', () => {
    expect(ids(orderHabits(habits, 'pending_first', statsMap, new Set(['d', 'b'])))).toBe('bdac')
  })

  it('does not mutate the input', () => {
    orderHabits(habits, 'streak', statsMap, new Set())
    expect(ids(habits)).toBe('cabd')
  })
})
