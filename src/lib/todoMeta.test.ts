import { describe, expect, it } from 'vitest'
import type { Todo, TodoPriority } from './database.types'
import { groupByPriority, sortPending } from './todoMeta'

const todo = (title: string, priority: TodoPriority, due_date = '2026-10-21', created_at = '2026-10-01T00:00:00Z'): Todo => ({
  id: title,
  user_id: '',
  title,
  due_date,
  completed_at: null,
  reminder_time: null,
  priority,
  started_at: null,
  notes: null,
  created_at,
  updated_at: created_at,
})

describe('todo priority', () => {
  it('groups red, orange, green and skips empty groups', () => {
    const groups = groupByPriority([todo('a', 'low'), todo('b', 'high'), todo('c', 'low'), todo('d', 'high')])
    expect(groups.map((g) => [g.priority, g.todos.map((t) => t.title).join('')])).toEqual([
      ['high', 'bd'],
      ['low', 'ac'],
    ])
  })

  it('pending: priority first, then oldest date', () => {
    const list = sortPending([
      todo('green-old', 'low', '2026-10-01'),
      todo('red-new', 'high', '2026-10-20'),
      todo('red-old', 'high', '2026-10-05'),
      todo('orange', 'medium', '2026-10-02'),
    ])
    expect(list.map((t) => t.title)).toEqual(['red-old', 'red-new', 'orange', 'green-old'])
  })
})
