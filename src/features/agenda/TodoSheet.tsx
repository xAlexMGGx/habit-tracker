import { CalendarDays, Sun, Sunrise, Timer, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from '../../components/BottomSheet'
import { CalendarPicker } from '../../components/CalendarPicker'
import { useConfirm } from '../../components/ConfirmProvider'
import { PriorityPicker } from '../../components/PriorityPicker'
import { Switch } from '../../components/controls'
import { type TodoPatch, useCreateTodo, useDeleteTodo, useUpdateTodo } from '../../data/todos'
import { useToday } from '../../hooks/useToday'
import { useDateLocale } from '../../i18n'
import type { Todo } from '../../lib/database.types'
import { addDays } from '../../lib/dates'
import { capitalize, relativeDay } from '../../lib/format'
import { showToast } from '../../lib/toast'
import ui from '../../styles/ui.module.css'
import s from './Agenda.module.css'

type Props = {
  todo: Todo | null
  onClose: () => void
}

/**
 * To-do details: title, priority, in progress, notes, move (today / tomorrow / a date) and delete.
 * Moving keeps the sheet open, so the priority can be changed in the same go.
 */
export function TodoSheet({ todo: openTodo, onClose }: Props) {
  const { t } = useTranslation()
  const locale = useDateLocale()
  const today = useToday()
  const confirm = useConfirm()
  const update = useUpdateTodo()
  const remove = useDeleteTodo()
  const create = useCreateTodo()

  // Local copy so the sheet shows its own changes; kept while the sheet slides away.
  const [current, setCurrent] = useState<Todo | null>(openTodo)
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [picking, setPicking] = useState(false)
  const last = useRef<Todo | null>(null)
  if (current) last.current = current
  const todo = current ?? last.current

  useEffect(() => {
    setCurrent(openTodo)
    if (openTodo) {
      setTitle(openTodo.title)
      setNotes(openTodo.notes ?? '')
    }
  }, [openTodo])

  const apply = (patch: TodoPatch) => {
    if (!current) return
    update.mutate({ todo: current, patch })
    setCurrent({ ...current, ...patch })
  }

  const saveText = () => {
    if (!current) return
    const nextTitle = title.trim()
    const nextNotes = notes.trim() || null
    const patch: TodoPatch = {}
    if (nextTitle && nextTitle !== current.title) patch.title = nextTitle
    if (!nextTitle) setTitle(current.title)
    if (nextNotes !== (current.notes ?? null)) patch.notes = nextNotes
    if (Object.keys(patch).length) apply(patch)
  }

  const close = () => {
    saveText()
    onClose()
  }

  const onDelete = async () => {
    if (!current) return
    const deleted = { ...current, title: title.trim() || current.title, notes: notes.trim() || null }
    if (!(await confirm({ title: t('agenda.deleteTodoConfirm'), confirmLabel: t('common.delete'), destructive: true })))
      return
    remove.mutate(deleted)
    onClose()
    showToast({
      message: t('agenda.todoDeleted'),
      action: { label: t('common.undo'), run: () => create.mutate(deleted) },
    })
  }

  const tomorrow = addDays(today, 1)
  const started = todo?.started_at != null

  return (
    <BottomSheet
      open={openTodo != null}
      onClose={close}
      title={t('agenda.todoTitle')}
      subtitle={todo ? capitalize(relativeDay(todo.due_date, today, t, locale)) : null}
    >
      {todo ? (
        <>
          <div className={ui.section}>
            <input
              className={s.sheetInput}
              value={title}
              maxLength={200}
              enterKeyHint="done"
              aria-label={t('agenda.todoTitle')}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveText}
              onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
            />
          </div>

          <div className={ui.section}>
            <h3 className={ui.sectionTitle}>{t('agenda.priority')}</h3>
            <div className={s.sheetBlock}>
              <PriorityPicker value={todo.priority} onChange={(priority) => apply({ priority })} />
            </div>
          </div>

          <div className={ui.section}>
            <div className={ui.group}>
              <div className={ui.row}>
                <Timer size={20} className={started ? s.startedIcon : ui.muted} />
                <span className={ui.rowLabel}>{t('agenda.inProgress')}</span>
                <Switch
                  checked={started}
                  label={t('agenda.inProgress')}
                  onChange={(on) => apply({ started_at: on ? new Date().toISOString() : null })}
                />
              </div>
            </div>
          </div>

          <div className={ui.section}>
            <h3 className={ui.sectionTitle}>{t('agenda.notes')}</h3>
            <textarea
              className={s.notesInput}
              value={notes}
              maxLength={2000}
              rows={3}
              placeholder={t('agenda.notesPlaceholder')}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={saveText}
            />
          </div>

          <div className={ui.section}>
            <h3 className={ui.sectionTitle}>{t('agenda.moveTo')}</h3>
            <div className={s.moveActions}>
              <button type="button" className={s.moveAction} disabled={todo.due_date === today} onClick={() => apply({ due_date: today })}>
                <Sun size={22} />
                {t('common.today')}
              </button>
              <button
                type="button"
                className={s.moveAction}
                disabled={todo.due_date === tomorrow}
                onClick={() => apply({ due_date: tomorrow })}
              >
                <Sunrise size={22} />
                {t('common.tomorrow')}
              </button>
              <button type="button" className={s.moveAction} onClick={() => setPicking(true)}>
                <CalendarDays size={22} />
                {t('common.pickDate')}
              </button>
            </div>
          </div>

          <div className={ui.section}>
            <div className={ui.group}>
              <button type="button" className={`${ui.rowButton} ${ui.danger}`} onClick={onDelete}>
                <Trash2 size={20} />
                <span className={ui.rowLabel}>{t('common.delete')}</span>
              </button>
            </div>
          </div>

          <CalendarPicker
            open={picking}
            value={todo.due_date}
            today={today}
            title={t('agenda.moveTo')}
            onClose={() => setPicking(false)}
            onSelect={(date) => {
              if (date !== todo.due_date) apply({ due_date: date })
              setPicking(false)
            }}
          />
        </>
      ) : null}
    </BottomSheet>
  )
}
