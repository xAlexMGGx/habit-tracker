import { describe, expect, it } from 'vitest'
import {
  type ReminderHabit,
  type ReminderTodo,
  localNow,
  planReminders,
} from '../../supabase/functions/_shared/reminders.ts'

// Wednesday 21 Oct 2026, 08:03 local
const NOW = { date: '2026-10-21', minutes: 8 * 60 + 3 }

const habit = (o: Partial<ReminderHabit> = {}): ReminderHabit => ({
  id: 'h1',
  name: 'Meditar',
  icon: '🧘',
  unit: null,
  type: 'boolean',
  target: null,
  frequency_type: 'daily',
  frequency_days: null,
  frequency_times: null,
  frequency_interval: null,
  start_date: '2026-10-01',
  reminder_times: ['08:00:00'],
  archived_at: null,
  ...o,
})

const todo = (o: Partial<ReminderTodo> = {}): ReminderTodo => ({
  id: 't1',
  title: 'Llamar al dentista',
  priority: 'high',
  due_date: '2026-10-21',
  completed_at: null,
  reminder_time: '08:00:00',
  ...o,
})

const plan = (habits: ReminderHabit[], logs: { habit_id: string; log_date: string; value: number }[] = [], todos: ReminderTodo[] = [], now = NOW) =>
  planReminders({ habits, logs, todos, now, lang: 'es' })

describe('planReminders: habits', () => {
  it('sends within the 10-minute window after the time, once per time', () => {
    expect(plan([habit()])).toEqual([
      {
        kind: 'habit',
        itemId: 'h1',
        time: '08:00',
        message: { title: '🧘 Meditar', body: 'Todavía no lo has marcado hoy.', tag: 'habit-h1', url: '#/agenda' },
      },
    ])
    expect(plan([habit()], [], [], { ...NOW, minutes: 7 * 60 + 59 })).toEqual([]) // too early
    expect(plan([habit()], [], [], { ...NOW, minutes: 8 * 60 + 10 })).toEqual([]) // window over
  })

  it('not when already done today', () => {
    expect(plan([habit()], [{ habit_id: 'h1', log_date: '2026-10-21', value: 1 }])).toEqual([])
  })

  it('only on due days', () => {
    // Mon/Fri habit on a Wednesday
    expect(plan([habit({ frequency_type: 'weekdays', frequency_days: [1, 5] })])).toEqual([])
  })

  it('times per week: not once the week is covered', () => {
    const h = habit({ frequency_type: 'times_per_week', frequency_times: 2, frequency_days: [1, 3] })
    expect(plan([h])).toHaveLength(1) // Wednesday is planned
    const logs = [
      { habit_id: 'h1', log_date: '2026-10-19', value: 1 },
      { habit_id: 'h1', log_date: '2026-10-20', value: 1 },
    ]
    expect(plan([h], logs)).toEqual([]) // done Mon + Tue → nothing due on Wednesday
  })

  it('quantitative shows the amount so far', () => {
    const h = habit({ type: 'quantitative', target: 8, unit: 'vasos' })
    const [r] = plan([h], [{ habit_id: 'h1', log_date: '2026-10-21', value: 3 }])
    expect(r.message.body).toBe('Llevas 3 de 8 vasos hoy.')
    expect(plan([h], [{ habit_id: 'h1', log_date: '2026-10-21', value: 8 }])).toEqual([])
  })

  it('negative: encouragement only while there is no relapse', () => {
    const h = habit({ type: 'negative', name: 'No fumar', icon: '🚭' })
    expect(plan([h])[0].message.body).toBe('Hoy vas limpio. ¡Sigue así!')
    expect(plan([h], [{ habit_id: 'h1', log_date: '2026-10-21', value: 1 }])).toEqual([])
  })

  it('skips archived habits and habits that have not started', () => {
    expect(plan([habit({ archived_at: '2026-10-10T00:00:00Z' }), habit({ id: 'h2', start_date: '2026-11-01' })])).toEqual([])
  })

  it('several times a day', () => {
    const h = habit({ reminder_times: ['08:00', '20:00'] })
    expect(plan([h]).map((r) => r.time)).toEqual(['08:00'])
    expect(plan([h], [], [], { ...NOW, minutes: 20 * 60 }).map((r) => r.time)).toEqual(['20:00'])
  })

  it('English texts', () => {
    const [r] = planReminders({ habits: [habit({ type: 'quantitative', target: 10000, unit: 'steps' })], logs: [], todos: [], now: NOW, lang: 'en' })
    expect(r.message.body).toBe('0 of 10,000 steps so far today.')
  })
})

describe('planReminders: several reminders, independent of the goal', () => {
  // "Lavarme los dientes": 3 times a day, reminders at 08:00, 14:00 and 22:00
  const teeth = habit({
    name: 'Lavarme los dientes',
    icon: '🦷',
    type: 'quantitative',
    target: 3,
    unit: 'veces',
    reminder_times: ['08:00', '14:00', '22:00'],
  })
  // "Beber agua": 8 glasses, no reminders at all
  const water = habit({ id: 'h2', name: 'Beber agua', icon: '💧', type: 'quantitative', target: 8, unit: 'vasos', reminder_times: [] })
  const at = (hh: number, mm = 0) => ({ ...NOW, minutes: hh * 60 + mm })
  const brushed = (n: number) => (n ? [{ habit_id: 'h1', log_date: '2026-10-21', value: n }] : [])

  it('each time sends its own reminder while the goal is not reached', () => {
    expect(plan([teeth, water], brushed(0), [], at(8, 2)).map((r) => [r.itemId, r.time, r.message.body])).toEqual([
      ['h1', '08:00', 'Llevas 0 de 3 veces hoy.'],
    ])
    expect(plan([teeth, water], brushed(1), [], at(14, 1)).map((r) => [r.time, r.message.body])).toEqual([
      ['14:00', 'Llevas 1 de 3 veces hoy.'],
    ])
    expect(plan([teeth, water], brushed(2), [], at(22, 5)).map((r) => r.time)).toEqual(['22:00'])
  })

  it('stops once the 3 are done', () => {
    expect(plan([teeth], brushed(3), [], at(22, 5))).toEqual([])
  })

  it('a habit without reminders never sends anything', () => {
    for (const t of [at(8), at(14), at(22), at(23, 59)]) expect(plan([water], [], [], t)).toEqual([])
  })
})

describe('planReminders: to-dos', () => {
  it('on its day, with the priority color', () => {
    expect(plan([], [], [todo()])).toEqual([
      {
        kind: 'todo',
        itemId: 't1',
        time: '08:00',
        message: { title: '🔴 Llamar al dentista', body: 'Tarea para hoy.', tag: 'todo-t1', url: '#/agenda' },
      },
    ])
  })

  it('not when done, without a reminder, or on another day', () => {
    expect(plan([], [], [todo({ completed_at: '2026-10-21T07:00:00Z' }), todo({ id: 't2', reminder_time: null }), todo({ id: 't3', due_date: '2026-10-22' })])).toEqual([])
  })
})

describe('localNow', () => {
  it('converts to the user timezone', () => {
    const utc = new Date('2026-10-21T22:30:00Z')
    expect(localNow('Europe/Madrid', utc)).toEqual({ date: '2026-10-22', minutes: 0 * 60 + 30 }) // CEST = UTC+2
    expect(localNow('America/New_York', utc)).toEqual({ date: '2026-10-21', minutes: 18 * 60 + 30 })
  })

  it('falls back to UTC for an invalid timezone', () => {
    expect(localNow('Not/AZone', new Date('2026-10-21T08:15:00Z'))).toEqual({ date: '2026-10-21', minutes: 8 * 60 + 15 })
  })
})
