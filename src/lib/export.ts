import type { Habit, HabitLog, Todo, UserSettings } from './database.types'
import { fetchAllRows, supabase } from './supabase'

export type ExportData = {
  settings: UserSettings | null
  habits: Habit[]
  habit_logs: HabitLog[]
  todos: Todo[]
}

export async function fetchExportData(): Promise<ExportData> {
  const [settings, habits, habit_logs, todos] = await Promise.all([
    supabase.from('user_settings').select('*').maybeSingle(),
    fetchAllRows<Habit>((from, to) => supabase.from('habits').select('*').order('sort_order').range(from, to)),
    fetchAllRows<HabitLog>((from, to) =>
      supabase.from('habit_logs').select('*').order('log_date').order('habit_id').range(from, to),
    ),
    fetchAllRows<Todo>((from, to) => supabase.from('todos').select('*').order('due_date').order('created_at').range(from, to)),
  ])
  if (settings.error) throw settings.error
  return { settings: settings.data, habits, habit_logs, todos }
}

function stamp(now: Date): string {
  return now.toISOString().slice(0, 10)
}

export function buildJsonFile(data: ExportData, email: string, now = new Date()): File {
  const body = JSON.stringify({ app: 'habit-tracker', format: 1, exported_at: now.toISOString(), email, ...data }, null, 2)
  return new File([body], `habit-tracker-${stamp(now)}.json`, { type: 'application/json' })
}

function csvCell(value: unknown): string {
  if (value == null) return ''
  const s = Array.isArray(value) ? value.join('|') : typeof value === 'object' ? JSON.stringify(value) : String(value)
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv<T extends object>(rows: readonly T[], columns: readonly (keyof T & string)[]): string {
  const lines = [columns.join(','), ...rows.map((r) => columns.map((c) => csvCell(r[c])).join(','))]
  // BOM so Excel/Numbers open it as UTF-8 (accents, emojis).
  return '﻿' + lines.join('\r\n') + '\r\n'
}

export function buildCsvFiles(data: ExportData, now = new Date()): File[] {
  const names = new Map(data.habits.map((h) => [h.id, h.name]))
  const day = stamp(now)
  const csv = (name: string, content: string) => new File([content], `habit-tracker-${name}-${day}.csv`, { type: 'text/csv' })

  const habitColumns: (keyof Habit & string)[] = [
    'id', 'name', 'icon', 'color', 'type', 'target', 'unit', 'quick_step', 'frequency_type', 'frequency_days',
    'frequency_times', 'frequency_interval', 'start_date', 'reminder_times', 'viz_type', 'viz_config',
    'sort_order', 'archived_at', 'created_at',
  ]
  const logs = data.habit_logs.map((l) => ({ ...l, habit_name: names.get(l.habit_id) ?? '' }))

  return [
    csv('habits', toCsv(data.habits, habitColumns)),
    csv('habit-logs', toCsv(logs, ['log_date', 'habit_id', 'habit_name', 'value'])),
    csv('todos', toCsv(data.todos, ['id', 'title', 'due_date', 'completed_at', 'created_at'])),
  ]
}

/**
 * Hands the files to the user. On iPhone this opens the share sheet ("Guardar en Archivos");
 * elsewhere it downloads them. Must run inside a tap handler (share needs a user gesture).
 */
export async function deliverFiles(files: File[]): Promise<void> {
  const coarse = window.matchMedia('(pointer: coarse)').matches
  if (coarse && navigator.canShare?.({ files })) {
    try {
      await navigator.share({ files })
      return
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return
      // Fall through to a regular download.
    }
  }
  for (const file of files) {
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }
}
