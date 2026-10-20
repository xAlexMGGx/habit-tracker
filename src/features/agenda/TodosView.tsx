import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useUpdateTodo } from '../../data/todos'
import type { Todo } from '../../lib/database.types'
import ui from '../../styles/ui.module.css'
import s from './Agenda.module.css'

type RowProps = {
  todo: Todo
  /** Can be checked and opened. */
  editable: boolean
  subtitle?: string
  onOpen: (todo: Todo) => void
}

export function TodoRow({ todo, editable, subtitle, onOpen }: RowProps) {
  const { t } = useTranslation()
  const update = useUpdateTodo()
  const done = todo.completed_at != null

  return (
    <div className={`${ui.row} ${s.todoRow} ${done ? s.todoDone : ''}`}>
      <button
        type="button"
        className={`${s.check} ${done ? s.checkOn : ''}`}
        aria-label={done ? t('agenda.markUndone') : t('agenda.markDone')}
        aria-pressed={done}
        disabled={!editable}
        onClick={() =>
          update.mutate({ todo, patch: { completed_at: done ? null : new Date().toISOString() } })
        }
      >
        {done ? <Check size={16} strokeWidth={3} /> : null}
      </button>
      <button type="button" className={s.todoBody} disabled={!editable} onClick={() => onOpen(todo)}>
        <span className={s.todoTitle}>{todo.title}</span>
        {subtitle ? <span className={s.todoSubtitle}>{subtitle}</span> : null}
      </button>
    </div>
  )
}

type ViewProps = {
  todos: Todo[]
  pending: Todo[] | null
  editable: boolean
  pendingLabel: (todo: Todo) => string
  onOpen: (todo: Todo) => void
}

export function TodosView({ todos, pending, editable, pendingLabel, onOpen }: ViewProps) {
  const { t } = useTranslation()
  return (
    <>
      {todos.length ? (
        <div className={ui.section}>
          <div className={ui.group}>
            {todos.map((todo) => (
              <TodoRow key={todo.id} todo={todo} editable={editable} onOpen={onOpen} />
            ))}
          </div>
        </div>
      ) : (
        <div className={ui.empty}>
          <p>{t('agenda.noTodos')}</p>
          {editable ? <p>{t('agenda.noTodosHint')}</p> : null}
        </div>
      )}

      {pending?.length ? (
        <div className={ui.section}>
          <h2 className={ui.sectionTitle}>{t('agenda.pending')}</h2>
          <div className={ui.group}>
            {/* Moving or completing a pending to-do is always allowed (SPEC §5). */}
            {pending.map((todo) => (
              <TodoRow key={todo.id} todo={todo} editable subtitle={pendingLabel(todo)} onOpen={onOpen} />
            ))}
          </div>
        </div>
      ) : null}
    </>
  )
}
