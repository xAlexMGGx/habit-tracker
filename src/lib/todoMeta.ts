import type { Todo, TodoPriority } from './database.types'

/** Red → orange → green. */
export const PRIORITIES: TodoPriority[] = ['high', 'medium', 'low']

const RANK: Record<TodoPriority, number> = { high: 0, medium: 1, low: 2 }

/** CSS color variable of each priority (traffic light). */
export const PRIORITY_COLOR: Record<TodoPriority, string> = {
  high: 'var(--prio-high)',
  medium: 'var(--prio-medium)',
  low: 'var(--prio-low)',
}

/** Non-empty groups in priority order, keeping the list's order inside each group. */
export function groupByPriority(todos: readonly Todo[]): { priority: TodoPriority; todos: Todo[] }[] {
  return PRIORITIES.map((priority) => ({ priority, todos: todos.filter((t) => t.priority === priority) })).filter(
    (g) => g.todos.length > 0,
  )
}

/** Pending from previous days: most important first, then oldest first. */
export function sortPending(todos: readonly Todo[]): Todo[] {
  return [...todos].sort(
    (a, b) =>
      RANK[a.priority] - RANK[b.priority] ||
      a.due_date.localeCompare(b.due_date) ||
      a.created_at.localeCompare(b.created_at),
  )
}
