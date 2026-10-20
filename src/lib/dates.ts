/** Local calendar date as 'YYYY-MM-DD'. Strings compare correctly with < and >. */
export type DateStr = string

/** Today and the previous 14 days are editable; older days are read-only unless unlocked. */
export const EDIT_WINDOW_DAYS = 14

const pad = (n: number) => String(n).padStart(2, '0')

export function toDateStr(d: Date): DateStr {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Local midnight of the given date. */
export function fromDateStr(s: DateStr): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayStr(now: Date = new Date()): DateStr {
  return toDateStr(now)
}

function toUtcDays(s: DateStr): number {
  const [y, m, d] = s.split('-').map(Number)
  return Date.UTC(y, m - 1, d) / 86_400_000
}

function fromUtcDays(days: number): DateStr {
  const d = new Date(days * 86_400_000)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

export function addDays(s: DateStr, n: number): DateStr {
  return fromUtcDays(toUtcDays(s) + n)
}

/** Calendar days from b to a (a − b). DST-safe. */
export function diffDays(a: DateStr, b: DateStr): number {
  return Math.round(toUtcDays(a) - toUtcDays(b))
}

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export function isoWeekday(s: DateStr): number {
  const dow = new Date(toUtcDays(s) * 86_400_000).getUTCDay()
  return dow === 0 ? 7 : dow
}

/** Monday of the week containing s (weeks start on Monday). */
export function weekStart(s: DateStr): DateStr {
  return addDays(s, 1 - isoWeekday(s))
}

export function weekDates(monday: DateStr): DateStr[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

export function isFuture(date: DateStr, today: DateStr): boolean {
  return date > today
}

/** True for future days and for today and the 14 days before it. */
export function isWithinEditWindow(date: DateStr, today: DateStr): boolean {
  return date >= addDays(today, -EDIT_WINDOW_DAYS)
}
