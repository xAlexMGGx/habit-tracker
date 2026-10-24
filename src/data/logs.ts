import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { HabitLog } from '../lib/database.types'
import type { DateStr } from '../lib/dates'
import { buildLogIndex, type LogIndex } from '../lib/schedule'
import { fetchAllRows, supabase } from '../lib/supabase'

const KEY = ['habit_logs'] as const

/**
 * Every log of the user. Streaks, weekly counters and (from phase 2) stats need the
 * whole history; for 2-3 people this stays small.
 */
export function useHabitLogs() {
  return useQuery({
    queryKey: KEY,
    queryFn: () =>
      fetchAllRows<HabitLog>((from, to) =>
        supabase.from('habit_logs').select('*').order('log_date').order('habit_id').range(from, to),
      ),
  })
}

export function useLogIndex(): LogIndex {
  const { data } = useHabitLogs()
  return useMemo(() => buildLogIndex(data ?? []), [data])
}

/** What Health sent for a day and whether the user changed it by hand (phase 6). */
export type HealthLogInfo = Pick<HabitLog, 'health_value' | 'manual'>

const healthKey = (habitId: string, date: DateStr) => `${habitId}|${date}`

/** Health info of the days that have any, by "habitId|date". */
export function useHealthLogInfo(): (habitId: string, date: DateStr) => HealthLogInfo | undefined {
  const { data } = useHabitLogs()
  const map = useMemo(() => {
    const m = new Map<string, HealthLogInfo>()
    for (const l of data ?? []) {
      if (l.manual || l.health_value != null) m.set(healthKey(l.habit_id, l.log_date), l)
    }
    return m
  }, [data])
  return (habitId, date) => map.get(healthKey(habitId, date))
}

type SetLog = {
  habitId: string
  date: DateStr
  value: number
  /**
   * The habit is filled in from Health: the value is marked as set by hand, so the sync
   * leaves it alone, and 0 is kept as a row instead of deleting it.
   */
  health?: boolean
}

type LogWrite =
  | { habitId: string; date: DateStr; value: number; manual?: boolean }
  | { habitId: string; date: DateStr; remove: true }

async function writeLog(w: LogWrite) {
  const { error } =
    'remove' in w
      ? await supabase.from('habit_logs').delete().eq('habit_id', w.habitId).eq('log_date', w.date)
      : await supabase.from('habit_logs').upsert(
          // `manual` only goes out for Health habits, so other habits work the same as before phase 6.
          { habit_id: w.habitId, log_date: w.date, value: w.value, ...(w.manual != null ? { manual: w.manual } : {}) },
          { onConflict: 'habit_id,log_date' },
        )
  if (error) throw error
}

/** Shared optimistic update for the two mutations below. Writes run one after another so fast taps never race. */
function useLogMutation<V>(toWrite: (vars: V) => LogWrite) {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ['habit_logs'],
    scope: { id: 'habit_logs' },
    mutationFn: (vars: V) => writeLog(toWrite(vars)),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: KEY })
      const prev = qc.getQueryData<HabitLog[]>(KEY)
      const w = toWrite(vars)
      qc.setQueryData<HabitLog[]>(KEY, (list = []) => {
        const old = list.find((l) => l.habit_id === w.habitId && l.log_date === w.date)
        const rest = list.filter((l) => l !== old)
        if ('remove' in w) return rest
        const now = new Date().toISOString()
        return [
          ...rest,
          {
            habit_id: w.habitId,
            log_date: w.date,
            value: w.value,
            manual: w.manual ?? old?.manual ?? false,
            health_value: old?.health_value ?? null,
            user_id: old?.user_id ?? '',
            created_at: old?.created_at ?? now,
            updated_at: now,
          },
        ]
      })
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(KEY, ctx.prev)
    },
  })
}

/** Sets a habit's value for a day. 0 deletes the row (except on Health habits, see `health`). */
export function useSetLogValue() {
  return useLogMutation<SetLog>(({ habitId, date, value, health }) =>
    health
      ? { habitId, date, value: Math.max(0, value), manual: true }
      : value > 0
        ? { habitId, date, value }
        : { habitId, date, remove: true },
  )
}

type UseHealth = { habitId: string; date: DateStr; healthValue: number | null }

/** Drops a manual value of a Health habit: back to what Health sent, or empty until the next sync. */
export function useRevertToHealth() {
  return useLogMutation<UseHealth>(({ habitId, date, healthValue }) =>
    healthValue ? { habitId, date, value: healthValue, manual: false } : { habitId, date, remove: true },
  )
}
