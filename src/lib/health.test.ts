import { describe, expect, it } from 'vitest'
import {
  type HealthHabit,
  healthReply,
  parseAmount,
  parseHealthBody,
  parseStamp,
  planHealthWrites,
} from '../../supabase/functions/_shared/health.ts'
import { bearerToken, generateToken, sha256Hex, tokenPrefix } from '../../supabase/functions/_shared/tokens.ts'

// Saturday 24 Oct 2026. Madrid is UTC+2 until the 25th.
const TODAY = '2026-10-24'
const TZ = 'Europe/Madrid'
const parse = (body: unknown) => parseHealthBody(body, TZ, TODAY)

describe('parseAmount', () => {
  it.each([
    ['8432', 8432],
    ['8.432', 8432],
    ['8,432', 8432],
    ['12.345.678', 12345678],
    ['7,5', 7.5],
    ['7.5', 7.5],
    ['1.234,5', 1234.5],
    ['1,234.5', 1234.5],
    ['8432 pasos', 8432],
    ['8 432', 8432],
    ['', null],
    ['Fitbit', null],
    ['-3', null],
  ])('%s → %s', (text, expected) => {
    expect(parseAmount(text)).toBe(expected)
  })
})

describe('parseStamp', () => {
  it('converts an instant to the local date and time', () => {
    expect(parseStamp('2026-10-23T23:30:00Z', TZ)).toMatchObject({ date: '2026-10-24', minutes: 90 })
    expect(parseStamp('2026-10-24T07:12:00+02:00', TZ)).toMatchObject({ date: '2026-10-24', minutes: 432 })
    expect(parseStamp('2026-10-24T07:12:00+0200', TZ)).toMatchObject({ date: '2026-10-24', minutes: 432 })
  })
  it('keeps a time without offset as local time', () => {
    expect(parseStamp('2026-10-24 07:12', TZ)).toMatchObject({ date: '2026-10-24', minutes: 432 })
  })
  it('accepts a date without time', () => {
    expect(parseStamp('2026-10-24', TZ)).toMatchObject({ date: '2026-10-24', minutes: null })
  })
  it('rejects anything else', () => {
    expect(parseStamp('24 oct 2026', TZ)).toBeNull()
    expect(parseStamp('8432', TZ)).toBeNull()
  })
})

describe('parseHealthBody: steps', () => {
  it('reads one line per day and keeps only the last 3 days', () => {
    const { days, received } = parse({
      steps: [
        '2026-10-21T00:00:00+02:00|300', // partial first day of the 4 → ignored
        '2026-10-22T00:00:00+02:00|9.876',
        '2026-10-23T00:00:00+02:00|12.034',
        '2026-10-24T00:00:00+02:00|4.120',
      ].join('\n'),
    })
    expect(received.steps).toBe(4)
    expect(Object.fromEntries(days)).toEqual({
      '2026-10-22': { steps: 9876 },
      '2026-10-23': { steps: 12034 },
      '2026-10-24': { steps: 4120 },
    })
  })

  it('adds up samples of a source, but takes the larger source when two count the same day', () => {
    const { days } = parse({
      steps: [
        '2026-10-24T08:00:00+02:00|2000|iPhone',
        '2026-10-24T12:00:00+02:00|1500|iPhone',
        '2026-10-24T08:00:00+02:00|2500|Fitbit',
        '2026-10-24T13:00:00+02:00|1800|Fitbit',
      ].join('\r\n'),
    })
    expect(days.get(TODAY)).toEqual({ steps: 4300 })
  })

  it('accepts the Spanish field name and ignores blank or broken lines', () => {
    const { days } = parse({ pasos: '\n2026-10-24|8432\nbasura\n\n' })
    expect(days.get(TODAY)).toEqual({ steps: 8432 })
  })
})

describe('parseHealthBody: sleep', () => {
  it('counts a night for the day you wake up and leaves out awake and in-bed time', () => {
    const { days } = parse({
      sleep: [
        // Night 23 → 24: in bed 23:00–07:30, asleep 23:20–07:10 with a 10 min awake gap
        '2026-10-23T23:00:00+02:00|2026-10-24T07:30:00+02:00|En cama|Fitbit',
        '2026-10-23T23:20:00+02:00|2026-10-24T03:00:00+02:00|Núcleo|Fitbit',
        '2026-10-24T03:00:00+02:00|2026-10-24T03:10:00+02:00|Despierto|Fitbit',
        '2026-10-24T03:10:00+02:00|2026-10-24T07:10:00+02:00|Profundo|Fitbit',
        // Night 22 → 23 ends at 07:00 on the 23rd
        '2026-10-22T23:30:00+02:00|2026-10-23T07:00:00+02:00|Asleep|Fitbit',
      ].join('\n'),
    })
    expect(days.get('2026-10-24')).toEqual({ sleep: 7.67 }) // 3 h 40 + 4 h = 7 h 40
    expect(days.get('2026-10-23')).toEqual({ sleep: 7.5 })
  })

  it('a stretch that ends before midnight already belongs to the next day', () => {
    const { days } = parse({
      sleep: ['2026-10-22T22:30:00+02:00|2026-10-22T23:45:00+02:00|Dormido|Fitbit', '2026-10-23T00:15:00+02:00|2026-10-23T06:45:00+02:00|Dormido|Fitbit'].join('\n'),
    })
    expect(days.get('2026-10-23')).toEqual({ sleep: 7.75 })
    expect(days.has('2026-10-22')).toBe(false)
  })

  it('an afternoon nap counts for that same day', () => {
    const { days } = parse({ sleep: '2026-10-24T15:00:00+02:00|2026-10-24T15:30:00+02:00|Dormido|Fitbit' })
    expect(days.get(TODAY)).toEqual({ sleep: 0.5 })
  })

  it('merges overlapping stretches and takes the larger source', () => {
    const { days } = parse({
      sleep: [
        '2026-10-24T00:00:00+02:00|2026-10-24T06:00:00+02:00|Dormido|Fitbit',
        '2026-10-24T05:00:00+02:00|2026-10-24T07:00:00+02:00|REM|Fitbit', // overlaps 1 h
        '2026-10-24T00:30:00+02:00|2026-10-24T05:30:00+02:00|Dormido|iPhone',
      ].join('\n'),
    })
    expect(days.get(TODAY)).toEqual({ sleep: 7 })
  })

  it('warns and skips lines whose dates have no time', () => {
    const { days, warnings } = parse({ sleep: '2026-10-23|2026-10-24|Dormido|Fitbit' })
    expect(days.size).toBe(0)
    expect(warnings).toEqual(['noTime'])
  })
})

describe('parseHealthBody: workouts', () => {
  it('counts workouts per day, once each, without adding up two sources', () => {
    const { days } = parse({
      entrenamientos: [
        '2026-10-24T08:00:00+02:00|Fitbit',
        '2026-10-24T08:00:00+02:00|Fitbit', // same workout twice
        '2026-10-24T19:00:00+02:00|Fitbit',
        '2026-10-24T19:05:00+02:00|iPhone',
        '2026-10-23T18:00:00+02:00|2026-10-23T19:00:00+02:00|Correr|Fitbit',
      ].join('\n'),
    })
    expect(days.get(TODAY)).toEqual({ workouts: 2 })
    expect(days.get('2026-10-23')).toEqual({ workouts: 1 })
  })

  it('combines the three metrics per day', () => {
    const { days } = parse({
      steps: '2026-10-24T00:00:00+02:00|8432',
      sleep: '2026-10-23T23:00:00+02:00|2026-10-24T06:15:00+02:00|Dormido|Fitbit',
      workouts: '2026-10-24T08:00:00+02:00|Fitbit',
    })
    expect(days.get(TODAY)).toEqual({ steps: 8432, sleep: 7.25, workouts: 1 })
  })

  it('ignores anything that is not an object of texts', () => {
    expect(parse(null).days.size).toBe(0)
    expect(parse('steps').days.size).toBe(0)
    expect(parse({ steps: 42 }).days.size).toBe(0)
  })
})

describe('planHealthWrites', () => {
  const habit = (o: Partial<HealthHabit> = {}): HealthHabit => ({
    id: 'h',
    type: 'quantitative',
    target: 10000,
    health_metric: 'steps',
    frequency_type: 'daily',
    frequency_days: null,
    frequency_times: null,
    frequency_interval: null,
    start_date: '2026-10-01',
    archived_at: null,
    ...o,
  })
  // Thu 22, Fri 23, Sat 24
  const days = new Map([
    ['2026-10-22', { steps: 9000, sleep: 7.5 }],
    ['2026-10-23', { steps: 11000, workouts: 1 }],
    ['2026-10-24', { steps: 4000, sleep: 6.25 }],
  ])
  const dates = (h: HealthHabit) => planHealthWrites([h], days).map((w) => w.log_date)

  it('writes the metric of each Health habit', () => {
    expect(planHealthWrites([habit(), habit({ id: 's', health_metric: 'sleep', target: 7 })], days)).toEqual([
      { habit_id: 'h', log_date: '2026-10-22', value: 9000 },
      { habit_id: 'h', log_date: '2026-10-23', value: 11000 },
      { habit_id: 'h', log_date: '2026-10-24', value: 4000 },
      { habit_id: 's', log_date: '2026-10-22', value: 7.5 },
      { habit_id: 's', log_date: '2026-10-24', value: 6.25 },
    ])
  })

  it('only on the days the habit shows up in the Agenda', () => {
    expect(dates(habit({ frequency_type: 'weekdays', frequency_days: [1, 2, 3, 4, 5] }))).toEqual(['2026-10-22', '2026-10-23'])
    expect(dates(habit({ frequency_type: 'every_n_days', frequency_interval: 2, start_date: '2026-10-20' }))).toEqual([
      '2026-10-22',
      '2026-10-24',
    ])
    expect(dates(habit({ frequency_type: 'times_per_week', frequency_times: 2, frequency_days: [1, 3] }))).toEqual([
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
    ])
    expect(dates(habit({ start_date: '2026-10-23' }))).toEqual(['2026-10-23', '2026-10-24'])
  })

  it('skips manual and archived habits and days without a value', () => {
    expect(dates(habit({ health_metric: null }))).toEqual([])
    expect(dates(habit({ archived_at: '2026-10-20T10:00:00Z' }))).toEqual([])
    expect(dates(habit({ health_metric: 'workouts', target: 1 }))).toEqual(['2026-10-23'])
  })
})

describe('healthReply', () => {
  const body = {
    steps: '2026-10-23T00:00:00+02:00|12034\n2026-10-24T00:00:00+02:00|8432',
    sleep: '2026-10-23T23:00:00+02:00|2026-10-24T06:15:00+02:00|Dormido|Fitbit',
    workouts: '2026-10-24T08:00:00+02:00|Fitbit',
  }

  it('summarizes the latest day in the user language', () => {
    const parsed = parse(body)
    expect(healthReply(parsed, 2, TODAY, 'es')).toEqual({
      message: 'Habit tracker ✓ Hoy: 8432 pasos · 7 h 15 min de sueño · 1 entrenamiento',
      lastSync: { date: TODAY, steps: 8432, sleep: 7.25, workouts: 1 },
    })
    expect(healthReply(parsed, 2, TODAY, 'en').message).toBe('Habit tracker ✓ Today: 8,432 steps · 7 h 15 min of sleep · 1 workout')
  })

  it('names yesterday or the date when today has nothing yet', () => {
    const parsed = parse({ steps: '2026-10-23T00:00:00+02:00|12034' })
    expect(healthReply(parsed, 1, TODAY, 'es').message).toBe('Habit tracker ✓ Ayer: 12.034 pasos')
    expect(healthReply(parse({ steps: '2026-10-22|500' }), 1, TODAY, 'es').message).toBe('Habit tracker ✓ 22 oct: 500 pasos')
  })

  it('explains when there are no Health habits or no data, and adds warnings', () => {
    expect(healthReply(parse(body), 0, TODAY, 'es').message).toMatch(/no tienes hábitos que usen Salud/)
    const empty = parse({ sleep: '2026-10-23|2026-10-24|Dormido|Fitbit' })
    expect(healthReply(empty, 1, TODAY, 'es')).toEqual({
      message: expect.stringMatching(/no ha llegado ningún dato[\s\S]*activa «Hora»/),
      lastSync: null,
    })
  })
})

describe('personal keys', () => {
  it('look like ht_ + 43 base64url characters and are told apart by their prefix', () => {
    const token = generateToken()
    expect(token).toMatch(/^ht_[A-Za-z0-9_-]{43}$/)
    expect(tokenPrefix(token)).toBe(token.slice(0, 8))
    expect(generateToken()).not.toBe(token)
  })

  it('hash with SHA-256', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('come from a Bearer header', () => {
    const token = 'ht_' + 'A'.repeat(43)
    expect(bearerToken(`Bearer ${token}`)).toBe(token)
    expect(bearerToken(`bearer   ${token} `)).toBe(token)
    expect(bearerToken('Bearer eyJhbGciOi...')).toBeNull()
    expect(bearerToken(null)).toBeNull()
  })
})
