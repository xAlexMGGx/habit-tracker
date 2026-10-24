// Phase 6: turns what the Atajos shortcut sends into daily values, and decides which habit
// days to fill in. Pure, so the `health` Edge Function only does the I/O.
//
// The shortcut sends one text per metric, one line per Health sample:
//   steps:    "start|value"                  (grouped by day in the shortcut)
//   sleep:    "start|end|stage|source"
//   workouts: "start|source"
// Dates are ISO 8601 ("2026-10-24T07:12:00+02:00"). Lines may carry more or fewer fields:
// dates are told apart from the rest by their shape.
import { type DateStr, addDays } from './dates.ts'
import { type Lang, healthTexts } from './messages.ts'
import { localNow } from './reminders.ts'
import { type ScheduleHabit, isPlannedOn } from './schedule.ts'

export type HealthMetric = 'steps' | 'sleep' | 'workouts'
export const HEALTH_METRICS: readonly HealthMetric[] = ['steps', 'sleep', 'workouts']

/** Days a sync may write: today and the two before. The shortcut sends 4 days so these are whole. */
export const SYNC_DAYS = 3

/** Sleep ending at or after this local time (minutes) belongs to the next day's night. */
const NIGHT_STARTS_AT = 18 * 60

/** Sleep stages that aren't sleep. Stage names arrive in the iPhone's language. */
const NOT_ASLEEP = /cama|bed|despiert|awake/i

/** Field names accepted in the request body, in English or Spanish. */
const FIELDS: Record<HealthMetric, readonly string[]> = {
  steps: ['steps', 'pasos'],
  sleep: ['sleep', 'sueno', 'sueño'],
  workouts: ['workouts', 'entrenamientos', 'entrenos'],
}

export type DayValues = Partial<Record<HealthMetric, number>>
export type HealthDays = Map<DateStr, DayValues>
export type HealthWarning = 'noTime'

export type ParsedHealth = {
  /** Values per local day, only for days inside the sync window. */
  days: HealthDays
  warnings: HealthWarning[]
  /** Lines received per metric, before filtering (for the reply). */
  received: Record<HealthMetric, number>
}

type Stamp = {
  date: DateStr
  /** Local minutes since midnight, or null when the date came without a time. */
  minutes: number | null
  /** For durations: the real instant when there was an offset, else the wall clock as UTC. */
  ms: number
}

const STAMP = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:[.,]\d+)?)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/i

/** Parses an ISO 8601 date as the user's local date and time. */
export function parseStamp(text: string, timeZone: string): Stamp | null {
  const m = STAMP.exec(text.trim())
  if (!m) return null
  const [, y, mo, d, h, mi, sec, offset] = m
  if (h == null) return { date: `${y}-${mo}-${d}`, minutes: null, ms: Date.UTC(+y, +mo - 1, +d) }
  if (offset) {
    const iso = `${y}-${mo}-${d}T${h}:${mi}:${sec ?? '00'}${offset.length === 5 ? `${offset.slice(0, 3)}:${offset.slice(3)}` : offset}`
    const ms = Date.parse(iso)
    if (Number.isNaN(ms)) return null
    const local = localNow(timeZone, new Date(ms))
    return { date: local.date, minutes: local.minutes, ms }
  }
  // No offset: the shortcut already wrote the iPhone's local time.
  return { date: `${y}-${mo}-${d}`, minutes: +h * 60 + +mi, ms: Date.UTC(+y, +mo - 1, +d, +h, +mi, +(sec ?? 0)) }
}

/**
 * A number as the iPhone may write it: "8432", "8.432" or "8,432" (thousands), "7,5" or "7.5",
 * "1.234,5", "8432 pasos". Null if there's no number.
 */
export function parseAmount(text: string): number | null {
  const s = text.replace(/[^\d.,-]/g, '')
  if (!/\d/.test(s) || s.includes('-')) return null
  let plain: string
  if (/^\d{1,3}([.,]\d{3})+$/.test(s)) {
    plain = s.replace(/[.,]/g, '')
  } else if (s.includes('.') && s.includes(',')) {
    const decimal = s.lastIndexOf('.') > s.lastIndexOf(',') ? '.' : ','
    plain = s.split(decimal === '.' ? ',' : '.').join('').replace(',', '.')
  } else {
    plain = s.replace(',', '.')
  }
  const n = Number(plain)
  return Number.isFinite(n) ? n : null
}

type Line = { stamps: Stamp[]; texts: string[]; hasUntimedDate: boolean }

function parseLines(text: unknown, timeZone: string): Line[] {
  if (typeof text !== 'string') return []
  const lines: Line[] = []
  for (const raw of text.split(/\r?\n/).slice(0, 5000)) {
    if (!raw.trim()) continue
    const line: Line = { stamps: [], texts: [], hasUntimedDate: false }
    for (const field of raw.split('|').map((f) => f.trim())) {
      const stamp = parseStamp(field, timeZone)
      if (stamp) {
        line.stamps.push(stamp)
        if (stamp.minutes == null) line.hasUntimedDate = true
      } else {
        line.texts.push(field)
      }
    }
    if (line.stamps.length) lines.push(line)
  }
  return lines
}

/** Per day, the largest per-source total: two sources counting the same thing aren't added up. */
function bestSource(totals: Map<string, number>): Map<DateStr, number> {
  const best = new Map<DateStr, number>()
  for (const [key, total] of totals) {
    const date = key.slice(0, 10)
    best.set(date, Math.max(best.get(date) ?? 0, total))
  }
  return best
}

function add(map: Map<string, number>, key: string, n: number) {
  map.set(key, (map.get(key) ?? 0) + n)
}

/** The sample's source is the last text field, when there is more than the value. */
const sourceOf = (texts: string[], valueFields: number) => (texts.length > valueFields ? texts[texts.length - 1] : '')

function steps(lines: Line[]): Map<DateStr, number> {
  const totals = new Map<string, number>()
  for (const { stamps, texts } of lines) {
    const value = texts.map(parseAmount).find((n) => n != null)
    if (value == null || value < 0) continue
    add(totals, `${stamps[0].date}|${sourceOf(texts, 1)}`, value)
  }
  return new Map([...bestSource(totals)].map(([d, n]) => [d, Math.round(n)]))
}

function sleep(lines: Line[], warnings: Set<HealthWarning>): Map<DateStr, number> {
  // Night → source → asleep intervals. Overlapping intervals are merged, not added.
  const intervals = new Map<string, [number, number][]>()
  for (const { stamps, texts, hasUntimedDate } of lines) {
    if (stamps.length < 2) continue
    if (hasUntimedDate) {
      warnings.add('noTime')
      continue
    }
    const [start, end] = stamps
    if (end.ms <= start.ms || (texts[0] && NOT_ASLEEP.test(texts[0]))) continue
    const night = end.minutes! >= NIGHT_STARTS_AT ? addDays(end.date, 1) : end.date
    const key = `${night}|${sourceOf(texts, 1)}`
    let list = intervals.get(key)
    if (!list) intervals.set(key, (list = []))
    list.push([start.ms, end.ms])
  }
  const totals = new Map<string, number>()
  for (const [key, list] of intervals) {
    list.sort((a, b) => a[0] - b[0])
    let total = 0
    let [from, to] = list[0]
    for (const [s, e] of list.slice(1)) {
      if (s > to) {
        total += to - from
        ;[from, to] = [s, e]
      } else if (e > to) {
        to = e
      }
    }
    total += to - from
    totals.set(key, total)
  }
  return new Map([...bestSource(totals)].map(([d, ms]) => [d, Math.round((ms / 3_600_000) * 100) / 100]))
}

function workouts(lines: Line[]): Map<DateStr, number> {
  const seen = new Set<string>()
  const totals = new Map<string, number>()
  for (const { stamps, texts } of lines) {
    const key = `${stamps[0].date}|${sourceOf(texts, 0)}`
    if (seen.has(`${key}|${stamps[0].ms}`)) continue
    seen.add(`${key}|${stamps[0].ms}`)
    add(totals, key, 1)
  }
  return bestSource(totals)
}

function field(body: Record<string, unknown>, metric: HealthMetric): unknown {
  for (const name of FIELDS[metric]) if (name in body) return body[name]
  return undefined
}

/** Daily values from the request body, limited to the last SYNC_DAYS days up to `today`. */
export function parseHealthBody(body: unknown, timeZone: string, today: DateStr): ParsedHealth {
  const fields = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  const warnings = new Set<HealthWarning>()
  const lines = {
    steps: parseLines(field(fields, 'steps'), timeZone),
    sleep: parseLines(field(fields, 'sleep'), timeZone),
    workouts: parseLines(field(fields, 'workouts'), timeZone),
  }
  const byMetric: Record<HealthMetric, Map<DateStr, number>> = {
    steps: steps(lines.steps),
    sleep: sleep(lines.sleep, warnings),
    workouts: workouts(lines.workouts),
  }

  const first = addDays(today, -(SYNC_DAYS - 1))
  const days: HealthDays = new Map()
  for (const metric of HEALTH_METRICS) {
    for (const [date, value] of byMetric[metric]) {
      if (date < first || date > today) continue
      const day = days.get(date) ?? {}
      day[metric] = value
      days.set(date, day)
    }
  }
  return {
    days: new Map([...days].sort(([a], [b]) => a.localeCompare(b))),
    warnings: [...warnings],
    received: { steps: lines.steps.length, sleep: lines.sleep.length, workouts: lines.workouts.length },
  }
}

export type HealthHabit = ScheduleHabit & {
  id: string
  health_metric: HealthMetric | null
  archived_at: string | null
}

export type HealthWrite = { habit_id: string; log_date: DateStr; value: number }

/**
 * Days a Health habit gets values: the days it shows up in the Agenda by plan. "X times a
 * week" habits can be done any day, so they get every day.
 */
export function receivesValueOn(habit: ScheduleHabit, date: DateStr): boolean {
  if (date < habit.start_date) return false
  return habit.frequency_type === 'times_per_week' || isPlannedOn(habit, date)
}

/** What to write: one row per Health habit and day with a value above 0. */
export function planHealthWrites(habits: readonly HealthHabit[], days: HealthDays): HealthWrite[] {
  const writes: HealthWrite[] = []
  for (const habit of habits) {
    if (!habit.health_metric || habit.archived_at) continue
    for (const [date, values] of days) {
      const value = values[habit.health_metric]
      if (value != null && value > 0 && receivesValueOn(habit, date)) {
        writes.push({ habit_id: habit.id, log_date: date, value })
      }
    }
  }
  return writes
}

/** What the last sync brought for its most recent day (stored in api_tokens.last_sync). */
export type LastSync = { date: DateStr } & DayValues

/** The reply the shortcut shows, and the summary for Ajustes. */
export function healthReply(
  parsed: ParsedHealth,
  healthHabits: number,
  today: DateStr,
  lang: Lang,
): { message: string; lastSync: LastSync | null } {
  const t = healthTexts(lang)
  const latest = [...parsed.days].at(-1)
  const lastSync = latest ? { date: latest[0], ...latest[1] } : null
  const warnings = parsed.warnings.map((w) => t[w])

  let message: string
  if (!healthHabits) {
    message = t.noHabits
  } else if (!latest) {
    message = t.noData
  } else {
    const [date, values] = latest
    const label =
      date === today
        ? t.today
        : date === addDays(today, -1)
          ? t.yesterday
          : new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))
    const parts = [
      values.steps != null ? t.steps(values.steps) : null,
      values.sleep != null ? t.sleep(values.sleep) : null,
      values.workouts != null ? t.workouts(values.workouts) : null,
    ].filter(Boolean)
    message = `Habit tracker ✓ ${label}: ${parts.join(' · ')}`
  }
  return { message: [message, ...warnings].join('\n'), lastSync }
}
