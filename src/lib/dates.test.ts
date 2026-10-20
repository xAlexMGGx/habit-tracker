import { describe, expect, it } from 'vitest'
import { addDays, diffDays, isWithinEditWindow, isoWeekday, toDateStr, weekDates, weekStart } from './dates'

describe('dates', () => {
  it('formats local dates', () => {
    expect(toDateStr(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('adds days across month, year and DST boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30') // DST change in Europe
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('diffs days', () => {
    expect(diffDays('2026-10-20', '2026-10-06')).toBe(14)
    expect(diffDays('2026-10-06', '2026-10-20')).toBe(-14)
  })

  it('weeks start on Monday', () => {
    expect(isoWeekday('2026-10-19')).toBe(1) // Monday
    expect(isoWeekday('2026-10-25')).toBe(7) // Sunday
    expect(weekStart('2026-10-25')).toBe('2026-10-19')
    expect(weekStart('2026-10-19')).toBe('2026-10-19')
    expect(weekDates('2026-10-19')).toEqual([
      '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25',
    ])
  })

  it('edit window is today plus the 14 previous days, and the future', () => {
    const today = '2026-10-20'
    expect(isWithinEditWindow('2026-10-20', today)).toBe(true)
    expect(isWithinEditWindow('2026-10-06', today)).toBe(true)
    expect(isWithinEditWindow('2026-10-05', today)).toBe(false)
    expect(isWithinEditWindow('2026-10-30', today)).toBe(true)
  })
})
