import { keepPreviousData, type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Todo, TodoPriority } from '../lib/database.types'
import type { DateStr } from '../lib/dates'
import { newId } from '../lib/platform'
import { fetchAllRows, supabase } from '../lib/supabase'

// Two kinds of cached lists: a date range (day strip + day view) and the
// "pendientes" (not completed, due before today).
type RangeKey = readonly ['todos', 'range', DateStr, DateStr]
type PendingKey = readonly ['todos', 'pending', DateStr]
type TodoKey = RangeKey | PendingKey

const rangeKey = (from: DateStr, to: DateStr): RangeKey => ['todos', 'range', from, to]
const pendingKey = (today: DateStr): PendingKey => ['todos', 'pending', today]

const byCreated = (a: Todo, b: Todo) => a.created_at.localeCompare(b.created_at)
const byOrder = (a: Todo, b: Todo) => a.sort_order - b.sort_order || byCreated(a, b)
const byDueThenCreated = (a: Todo, b: Todo) => a.due_date.localeCompare(b.due_date) || byCreated(a, b)

export function useTodosInRange(from: DateStr, to: DateStr) {
  return useQuery({
    queryKey: rangeKey(from, to),
    queryFn: () =>
      fetchAllRows<Todo>((f, t) =>
        supabase
          .from('todos')
          .select('*')
          .gte('due_date', from)
          .lte('due_date', to)
          .order('sort_order')
          .order('created_at')
          .range(f, t),
      ),
    placeholderData: keepPreviousData,
  })
}

export function usePendingTodos(today: DateStr) {
  return useQuery({
    queryKey: pendingKey(today),
    queryFn: () =>
      fetchAllRows<Todo>((f, t) =>
        supabase
          .from('todos')
          .select('*')
          .lt('due_date', today)
          .is('completed_at', null)
          .order('due_date')
          .order('created_at')
          .range(f, t),
      ),
  })
}

function belongs(todo: Todo, key: TodoKey): boolean {
  if (key[1] === 'range') return todo.due_date >= key[2] && todo.due_date <= key[3]
  return todo.due_date < key[2] && todo.completed_at == null
}

type Snapshot = [readonly unknown[], Todo[] | undefined][]

/** Applies one to-do change (next = null to remove) to every cached list it belongs to. */
async function patchCaches(qc: QueryClient, id: string, next: Todo | null): Promise<Snapshot> {
  await qc.cancelQueries({ queryKey: ['todos'] })
  const snapshot = qc.getQueriesData<Todo[]>({ queryKey: ['todos'] })
  for (const [key, list] of snapshot) {
    if (!list) continue
    const k = key as unknown as TodoKey
    const rest = list.filter((t) => t.id !== id)
    const updated = next && belongs(next, k) ? [...rest, next] : rest
    qc.setQueryData(key, updated.sort(k[1] === 'range' ? byOrder : byDueThenCreated))
  }
  return snapshot
}

function restore(qc: QueryClient, snapshot: Snapshot | undefined) {
  for (const [key, list] of snapshot ?? []) qc.setQueryData(key, list)
}

/** Refetch once the last pending to-do write has finished (avoids flicker between quick taps). */
function settle(qc: QueryClient) {
  if (qc.isMutating({ mutationKey: ['todos'] }) <= 1) void qc.invalidateQueries({ queryKey: ['todos'] })
}

export function useCreateTodo() {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ['todos'],
    scope: { id: 'todos' },
    mutationFn: async (todo: Todo) => {
      const { error } = await supabase.from('todos').insert({
        id: todo.id,
        title: todo.title,
        due_date: todo.due_date,
        completed_at: todo.completed_at,
        reminder_time: todo.reminder_time,
        priority: todo.priority,
        started_at: todo.started_at,
        notes: todo.notes,
        created_at: todo.created_at,
      })
      if (error) throw error
    },
    onMutate: (todo) => patchCaches(qc, todo.id, todo),
    onError: (_e, _v, snapshot) => restore(qc, snapshot),
    onSettled: () => settle(qc),
  })
}

/** Builds a new to-do row for useCreateTodo. New to-dos are green unless chosen otherwise. */
export function makeTodo(title: string, dueDate: DateStr, priority: TodoPriority = 'low'): Todo {
  const now = new Date().toISOString()
  return {
    id: newId(),
    user_id: '',
    title,
    due_date: dueDate,
    completed_at: null,
    reminder_time: null,
    priority,
    started_at: null,
    notes: null,
    // The database gives it the same kind of value (milliseconds now), so it goes last.
    sort_order: Date.now(),
    created_at: now,
    updated_at: now,
  }
}

export type TodoPatch = Partial<
  Pick<Todo, 'title' | 'due_date' | 'completed_at' | 'priority' | 'started_at' | 'notes' | 'reminder_time'>
>

/** A to-do moved to another day or priority goes last there. */
function withOrder(todo: Todo, patch: TodoPatch, now: number): TodoPatch & { sort_order?: number } {
  const moved = (patch.due_date != null && patch.due_date !== todo.due_date) || (patch.priority != null && patch.priority !== todo.priority)
  return moved ? { ...patch, sort_order: now } : patch
}

type UpdateVars = { todo: Todo; patch: TodoPatch; at?: number }

export function useUpdateTodo() {
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationKey: ['todos'],
    scope: { id: 'todos' },
    mutationFn: async ({ todo, patch, at = Date.now() }: UpdateVars) => {
      const { error } = await supabase.from('todos').update(withOrder(todo, patch, at)).eq('id', todo.id)
      if (error) throw error
    },
    onMutate: ({ todo, patch, at = Date.now() }) => patchCaches(qc, todo.id, { ...todo, ...withOrder(todo, patch, at) }),
    onError: (_e, _v, snapshot) => restore(qc, snapshot),
    onSettled: () => settle(qc),
  })
  // One timestamp per change, so the optimistic order and the saved one match.
  return {
    ...mutation,
    mutate: (vars: UpdateVars, options?: Parameters<typeof mutation.mutate>[1]) =>
      mutation.mutate({ ...vars, at: vars.at ?? Date.now() }, options),
  }
}

/** Saves the order of a day's to-dos (all of them, in display order). */
export function useReorderTodos() {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ['todos'],
    scope: { id: 'todos' },
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.rpc('reorder_todos', { todo_ids: ids })
      if (error) throw error
    },
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: ['todos'] })
      const snapshot = qc.getQueriesData<Todo[]>({ queryKey: ['todos'] })
      const order = new Map(ids.map((id, i) => [id, i + 1]))
      for (const [key, list] of snapshot) {
        if (!list || (key as unknown as TodoKey)[1] !== 'range') continue
        qc.setQueryData(key, list.map((t) => (order.has(t.id) ? { ...t, sort_order: order.get(t.id)! } : t)).sort(byOrder))
      }
      return snapshot
    },
    onError: (_e, _v, snapshot) => restore(qc, snapshot),
    onSettled: () => settle(qc),
  })
}

export function useDeleteTodo() {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ['todos'],
    scope: { id: 'todos' },
    mutationFn: async (todo: Todo) => {
      const { error } = await supabase.from('todos').delete().eq('id', todo.id)
      if (error) throw error
    },
    onMutate: (todo) => patchCaches(qc, todo.id, null),
    onError: (_e, _v, snapshot) => restore(qc, snapshot),
    onSettled: () => settle(qc),
  })
}
