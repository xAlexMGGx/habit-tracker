import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Bell, Check, Menu, MessageSquare } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useReorderTodos, useUpdateTodo } from '../../data/todos'
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
  /** Drag to reorder (SortableTodoRow). */
  sortable?: { setNodeRef: (el: HTMLElement | null) => void; style: CSSProperties; dragging: boolean; handle: ReactNode }
}

/** Check ring in the priority's color; half filled while in progress. */
export function TodoRow({ todo, editable, subtitle, onOpen, sortable }: RowProps) {
  const { t } = useTranslation()
  const update = useUpdateTodo()
  const done = todo.completed_at != null
  const started = !done && todo.started_at != null

  return (
    <div
      ref={sortable?.setNodeRef}
      className={`${ui.row} ${s.todoRow} ${done ? s.todoDone : ''} ${sortable?.dragging ? s.todoDragging : ''}`}
      style={{ '--p': PRIORITY_COLOR[todo.priority], ...sortable?.style } as CSSProperties}
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
      {sortable?.handle}
    </div>
  )
}

/** A to-do of the day with a ≡ handle, like the habits in Mis hábitos. */
function SortableTodoRow(props: Omit<RowProps, 'subtitle' | 'sortable'>) {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: props.todo.id,
  })
  return (
    <TodoRow
      {...props}
      sortable={{
        setNodeRef,
        dragging: isDragging,
        style: { transform: CSS.Transform.toString(transform), transition },
        handle: (
          <button
            type="button"
            ref={setActivatorNodeRef}
            className={s.todoHandle}
            aria-label={t('habits.dragHandle')}
            {...attributes}
            {...listeners}
          >
            <Menu size={20} />
          </button>
        ),
      }}
    />
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
  const reorder = useReorderTodos()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const groups = groupByPriority(todos)

  // To-dos move only within their priority; the day's whole order is saved in one go.
  const onDragEnd =
    (group: Todo[]) =>
    ({ active, over }: DragEndEvent) => {
      if (!over || active.id === over.id) return
      const ids = group.map((td) => td.id)
      const moved = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)))
      reorder.mutate(groups.flatMap((g) => (g.todos === group ? moved : g.todos.map((td) => td.id))))
    }

  return (
    <>
      {todos.length ? (
        // Red first, then orange, then green; each priority in its own block.
        groups.map(({ priority, todos: group }) => (
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
              {editable && group.length > 1 ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                  onDragEnd={onDragEnd(group)}
                >
                  <SortableContext items={group.map((td) => td.id)} strategy={verticalListSortingStrategy}>
                    {group.map((todo) => (
                      <SortableTodoRow key={todo.id} todo={todo} editable={editable} onOpen={onOpen} />
                    ))}
                  </SortableContext>
                </DndContext>
              ) : (
                group.map((todo) => <TodoRow key={todo.id} todo={todo} editable={editable} onOpen={onOpen} />)
              )}
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
