import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Habit, HabitInsert, HabitLog, HabitUpdate } from '../lib/database.types'
import { fetchAllRows, supabase } from '../lib/supabase'

const KEY = ['habits'] as const
const LOGS_KEY = ['habit_logs'] as const

function sortHabits(list: Habit[]): Habit[] {
  return [...list].sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at))
}

/** All habits, archived included, in manual order. */
export function useHabits() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () =>
      sortHabits(await fetchAllRows<Habit>((from, to) => supabase.from('habits').select('*').range(from, to))),
  })
}

export function useCreateHabit() {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ['habits'],
    meta: { silent: true }, // the form shows its own error
    mutationFn: async (values: HabitInsert) => {
      const { data, error } = await supabase.from('habits').insert(values).select().single()
      if (error) throw error
      return data
    },
    onSuccess: (habit) => {
      qc.setQueryData<Habit[]>(KEY, (list) => sortHabits([...(list ?? []).filter((h) => h.id !== habit.id), habit]))
    },
  })
}

export function useUpdateHabit() {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ['habits'],
    meta: { silent: true },
    mutationFn: async ({ id, patch }: { id: string; patch: HabitUpdate }) => {
      const { data, error } = await supabase.from('habits').update(patch).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: (habit) => {
      qc.setQueryData<Habit[]>(KEY, (list) => sortHabits((list ?? []).map((h) => (h.id === habit.id ? habit : h))))
    },
  })
}

/** Archive (archived = true) or restore a habit. Optimistic. */
export function useSetArchived() {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ['habits'],
    scope: { id: 'habits' },
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      const { error } = await supabase
        .from('habits')
        .update({ archived_at: archived ? new Date().toISOString() : null })
        .eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id, archived }) => {
      await qc.cancelQueries({ queryKey: KEY })
      const prev = qc.getQueryData<Habit[]>(KEY)
      qc.setQueryData<Habit[]>(KEY, (list) =>
        list?.map((h) => (h.id === id ? { ...h, archived_at: archived ? new Date().toISOString() : null } : h)),
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(KEY, ctx.prev)
    },
  })
}

/** Deletes a habit and (by cascade) all its logs. */
export function useDeleteHabit() {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ['habits'],
    scope: { id: 'habits' },
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('habits').delete().eq('id', id)
      if (error) throw error
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: KEY })
      const prev = qc.getQueryData<Habit[]>(KEY)
      qc.setQueryData<Habit[]>(KEY, (list) => list?.filter((h) => h.id !== id))
      return { prev }
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(KEY, ctx.prev)
    },
    onSuccess: (_d, id) => {
      qc.setQueryData<HabitLog[]>(LOGS_KEY, (logs) => logs?.filter((l) => l.habit_id !== id))
    },
  })
}

/** Saves the manual order (SPEC: shared by Mis hábitos and the tracker). */
export function useReorderHabits() {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ['habits'],
    scope: { id: 'habits' },
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.rpc('reorder_habits', { habit_ids: ids })
      if (error) throw error
    },
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: KEY })
      const prev = qc.getQueryData<Habit[]>(KEY)
      const order = new Map(ids.map((id, i) => [id, i + 1]))
      qc.setQueryData<Habit[]>(KEY, (list) =>
        list && sortHabits(list.map((h) => (order.has(h.id) ? { ...h, sort_order: order.get(h.id)! } : h))),
      )
      return { prev }
    },
    onError: (_e, _ids, ctx) => {
      if (ctx?.prev) qc.setQueryData(KEY, ctx.prev)
    },
  })
}
