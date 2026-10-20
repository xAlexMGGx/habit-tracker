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

type SetLog = { habitId: string; date: DateStr; value: number }

/** Sets a habit's value for a day. 0 deletes the row. Writes run one after another so fast taps never race. */
export function useSetLogValue() {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ['habit_logs'],
    scope: { id: 'habit_logs' },
    mutationFn: async ({ habitId, date, value }: SetLog) => {
      const { error } =
        value > 0
          ? await supabase
              .from('habit_logs')
              .upsert({ habit_id: habitId, log_date: date, value }, { onConflict: 'habit_id,log_date' })
          : await supabase.from('habit_logs').delete().eq('habit_id', habitId).eq('log_date', date)
      if (error) throw error
    },
    onMutate: async ({ habitId, date, value }) => {
      await qc.cancelQueries({ queryKey: KEY })
      const prev = qc.getQueryData<HabitLog[]>(KEY)
      qc.setQueryData<HabitLog[]>(KEY, (list = []) => {
        const rest = list.filter((l) => !(l.habit_id === habitId && l.log_date === date))
        if (value <= 0) return rest
        const old = list.find((l) => l.habit_id === habitId && l.log_date === date)
        const now = new Date().toISOString()
        return [
          ...rest,
          { habit_id: habitId, log_date: date, value, user_id: old?.user_id ?? '', created_at: old?.created_at ?? now, updated_at: now },
        ]
      })
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(KEY, ctx.prev)
    },
  })
}
