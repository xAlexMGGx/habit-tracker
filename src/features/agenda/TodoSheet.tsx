import { CalendarDays, Sun, Sunrise, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from '../../components/BottomSheet'
import { useConfirm } from '../../components/ConfirmProvider'
import { useCreateTodo, useDeleteTodo, useUpdateTodo } from '../../data/todos'
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

/** Quick actions for a to-do: move to today / tomorrow / a date, rename, delete. */
export function TodoSheet({ todo: openTodo, onClose }: Props) {
  // Keep showing the last to-do while the sheet slides away.
  const last = useRef<Todo | null>(null)
  if (openTodo) last.current = openTodo
  const todo = openTodo ?? last.current
  const { t } = useTranslation()
  const locale = useDateLocale()
  const today = useToday()
  const confirm = useConfirm()
  const update = useUpdateTodo()
  const remove = useDeleteTodo()
  const create = useCreateTodo()
  const [title, setTitle] = useState('')

  useEffect(() => {
    if (openTodo) setTitle(openTodo.title)
  }, [openTodo])

  const tomorrow = addDays(today, 1)

  const move = (due_date: string) => {
    if (!todo) return
    if (due_date !== todo.due_date) update.mutate({ todo, patch: { due_date } })
    onClose()
  }

  const saveTitle = () => {
    if (!openTodo) return
    const next = title.trim()
    if (next && next !== openTodo.title) update.mutate({ todo: openTodo, patch: { title: next } })
    if (!next) setTitle(openTodo.title)
  }

  const onDelete = async () => {
    if (!todo) return
    const deleted = todo
    if (!(await confirm({ title: t('agenda.deleteTodoConfirm'), confirmLabel: t('common.delete'), destructive: true })))
      return
    remove.mutate(deleted)
    onClose()
    showToast({
      message: t('agenda.todoDeleted'),
      action: { label: t('common.undo'), run: () => create.mutate(deleted) },
    })
  }

  return (
    <BottomSheet
      open={openTodo != null}
      onClose={() => {
        saveTitle()
        onClose()
      }}
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
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
            />
          </div>

          <div className={ui.section}>
            <h3 className={ui.sectionTitle}>{t('agenda.moveTo')}</h3>
            <div className={s.moveActions}>
              <button type="button" className={s.moveAction} disabled={todo.due_date === today} onClick={() => move(today)}>
                <Sun size={22} />
                {t('common.today')}
              </button>
              <button
                type="button"
                className={s.moveAction}
                disabled={todo.due_date === tomorrow}
                onClick={() => move(tomorrow)}
              >
                <Sunrise size={22} />
                {t('common.tomorrow')}
              </button>
              <label className={s.moveAction}>
                <CalendarDays size={22} />
                {t('common.pickDate')}
                <input
                  type="date"
                  className={s.dateOverlay}
                  value={todo.due_date}
                  onChange={(e) => e.target.value && move(e.target.value)}
                />
              </label>
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
        </>
      ) : null}
    </BottomSheet>
  )
}
