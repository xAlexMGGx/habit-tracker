import { Bell, Check, MessageSquare } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { useUpdateTodo } from '../../data/todos'
import type { Todo } from '../../lib/database.types'
import { PRIORITY_COLOR, groupByPriority, sortPending } from '../../lib/todoMeta'
import ui from '../../styles/ui.module.css'
import s from './Agenda.module.css'

type RowProps = {
  todo: Todo
  /** Can be checked and opened. */
  editable: boolean
  subtitle?: string
  onOpen: (todo: Todo) => void
}

/** Check ring in the priority's color; half filled while in progress. */
export function TodoRow({ todo, editable, subtitle, onOpen }: RowProps) {
  const { t } = useTranslation()
  const update = useUpdateTodo()
  const done = todo.completed_at != null
  const started = !done && todo.started_at != null

  return (
    <div
      className={`${ui.row} ${s.todoRow} ${done ? s.todoDone : ''}`}
      style={{ '--p': PRIORITY_COLOR[todo.priority] } as CSSProperties}
    >
      <button
        type="button"
        className={`${s.check} ${done ? s.checkOn : ''} ${started ? s.checkStarted : ''}`}
        aria-label={`${done ? t('agenda.markUndone') : t('agenda.markDone')} · ${t(`agenda.priorities.${todo.priority}`)}${started ? ` · ${t('agenda.inProgress')}` : ''}`}
        aria-pressed={done}
        disabled={!editable}
        onClick={() => update.mutate({ todo, patch: { completed_at: done ? null : new Date().toISOString() } })}
      >
        {done ? <Check size={16} strokeWidth={3} /> : null}
      </button>
      <button type="button" className={s.todoBody} disabled={!editable} onClick={() => onOpen(todo)}>
        <span className={s.todoTitle}>
          {todo.title}
          {todo.notes?.trim() ? (
            <MessageSquare size={13} className={s.notesIcon} aria-label={t('agenda.hasNotes')} />
          ) : null}
          {todo.reminder_time && !done ? (
            <span className={s.reminderTag} aria-label={t('agenda.reminderAt', { time: todo.reminder_time.slice(0, 5) })}>
              <Bell size={12} />
              {todo.reminder_time.slice(0, 5)}
            </span>
          ) : null}
        </span>
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
        // Red first, then orange, then green; each priority in its own block.
        groupByPriority(todos).map(({ priority, todos: group }) => (
          <div
            key={priority}
            className={`${ui.section} ${s.prioritySection}`}
            style={{ '--p': PRIORITY_COLOR[priority] } as CSSProperties}
          >
            <h2 className={`${ui.sectionTitle} ${s.priorityTitle}`}>
              <span className={s.priorityDot} />
              {t(`agenda.prioritySection.${priority}`)}
            </h2>
            <div className={`${ui.group} ${s.priorityGroup}`}>
              {group.map((todo) => (
                <TodoRow key={todo.id} todo={todo} editable={editable} onOpen={onOpen} />
              ))}
            </div>
          </div>
        ))
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
            {sortPending(pending).map((todo) => (
              <TodoRow key={todo.id} todo={todo} editable subtitle={pendingLabel(todo)} onOpen={onOpen} />
            ))}
          </div>
        </div>
      ) : null}
    </>
  )
}
