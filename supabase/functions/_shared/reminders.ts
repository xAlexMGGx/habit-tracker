// Decides which reminders are due for one user right now. Pure: the Edge Function does the I/O.
import { type DateStr, isoWeekday } from './dates.ts'
import { type Lang, PRIORITY_EMOJI, messages } from './messages.ts'
import { type LogRow, type ScheduleHabit, buildLogIndex, isCompletedValue, isDueOn, logsFor } from './schedule.ts'

/** A reminder fires during this many minutes after its time (the cron runs every minute). */
export const REMINDER_WINDOW_MINUTES = 10

/** A reminder time and the ISO weekdays (1 = Monday) it rings on. */
export type HabitReminder = { time: string; days: number[] }

export type ReminderHabit = ScheduleHabit & {
  id: string
  name: string
  icon: string
  unit: string | null
  reminders: HabitReminder[]
  archived_at: string | null
}

export type ReminderTodo = {
  id: string
  title: string
  priority: keyof typeof PRIORITY_EMOJI
  due_date: DateStr
  completed_at: string | null
  reminder_time: string | null
}

export type LocalNow = { date: DateStr; minutes: number }

export type PushMessage = { title: string; body: string; tag: string; url: string }

export type PlannedReminder = { kind: 'habit' | 'todo'; itemId: string; time: string; message: PushMessage }

/** The user's local date and minute of the day in their timezone (UTC if it's not valid). */
export function localNow(timeZone: string, now: Date = new Date()): LocalNow {
  let parts: Intl.DateTimeFormatPart[]
  try {
    parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now)
  } catch {
    return timeZone === 'UTC' ? { date: now.toISOString().slice(0, 10), minutes: 0 } : localNow('UTC', now)
  }
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
  return { date: `${get('year')}-${get('month')}-${get('day')}`, minutes: Number(get('hour')) * 60 + Number(get('minute')) }
}

const hhmm = (time: string) => time.slice(0, 5)
const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))

function inWindow(time: string, now: LocalNow): boolean {
  const t = toMinutes(time)
  return t <= now.minutes && now.minutes - t < REMINDER_WINDOW_MINUTES
}

type Input = {
  habits: readonly ReminderHabit[]
  /** Logs of the current week (Monday → today), needed for "X times a week". */
  logs: readonly LogRow[]
  todos: readonly ReminderTodo[]
  now: LocalNow
  lang: Lang
}

/**
 * Habits: only on days they're due (SPEC §11) and if not done yet. Negative habits get an
 * encouragement instead, only while there's no relapse that day. To-dos: on their day, if not done.
 */
export function planReminders({ habits, logs, todos, now, lang }: Input): PlannedReminder[] {
  const m = messages(lang)
  const index = buildLogIndex(logs)
  const out: PlannedReminder[] = []

  for (const habit of habits) {
    if (habit.archived_at || now.date < habit.start_date) continue
    const weekday = isoWeekday(now.date)
    const times = [
      ...new Set(habit.reminders.filter((r) => r.days.includes(weekday) && inWindow(r.time, now)).map((r) => hhmm(r.time))),
    ]
    if (!times.length) continue
    const habitLogs = logsFor(index, habit.id)
    if (!isDueOn(habit, now.date, habitLogs)) continue
    const value = habitLogs.get(now.date) ?? 0

    let body: string
    if (habit.type === 'negative') {
      if (value > 0) continue
      body = m.habitClean
    } else {
      if (isCompletedValue(habit, value)) continue
      body = habit.type === 'quantitative' ? m.habitAmount(value, habit.target ?? 0, habit.unit) : m.habitPending
    }
    for (const time of times) {
      out.push({
        kind: 'habit',
        itemId: habit.id,
        time: hhmm(time),
        message: { title: `${habit.icon} ${habit.name}`, body, tag: `habit-${habit.id}`, url: '#/agenda' },
      })
    }
  }

  for (const todo of todos) {
    if (todo.completed_at || todo.due_date !== now.date || !todo.reminder_time || !inWindow(todo.reminder_time, now)) continue
    out.push({
      kind: 'todo',
      itemId: todo.id,
      time: hhmm(todo.reminder_time),
      message: { title: `${PRIORITY_EMOJI[todo.priority]} ${todo.title}`, body: m.todoBody, tag: `todo-${todo.id}`, url: '#/agenda' },
    })
  }

  return out
}
