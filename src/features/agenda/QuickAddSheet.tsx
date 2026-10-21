import { ArrowUp } from 'lucide-react'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from '../../components/BottomSheet'
import { PriorityPicker } from '../../components/PriorityPicker'
import { makeTodo, useCreateTodo } from '../../data/todos'
import type { TodoPriority } from '../../lib/database.types'
import type { DateStr } from '../../lib/dates'
import s from './Agenda.module.css'

type Props = {
  open: boolean
  date: DateStr
  dateLabel: string
  onClose: () => void
}

/** "+" button: add one or several to-dos to the selected day. Stays open for fast entry. */
export function QuickAddSheet({ open, date, dateLabel, onClose }: Props) {
  const { t } = useTranslation()
  const create = useCreateTodo()
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<TodoPriority>('low')
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setTitle('')
    setPriority('low')
    const timer = setTimeout(() => input.current?.focus({ preventScroll: true }), 60)
    return () => clearTimeout(timer)
  }, [open])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const value = title.trim()
    if (!value) return
    create.mutate(makeTodo(value, date, priority))
    // The chosen priority stays for the next one added in a row.
    setTitle('')
    input.current?.focus({ preventScroll: true })
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={t('agenda.newTodo')} subtitle={dateLabel}>
      <form className={s.quickAdd} onSubmit={submit}>
        <input
          ref={input}
          className={s.quickAddInput}
          value={title}
          maxLength={200}
          placeholder={t('agenda.newTodo')}
          enterKeyHint="send"
          autoComplete="off"
          onChange={(e) => setTitle(e.target.value)}
        />
        <button type="submit" className={s.quickAddButton} disabled={!title.trim()} aria-label={t('common.add')}>
          <ArrowUp size={20} strokeWidth={2.6} />
        </button>
      </form>
      <div className={s.quickAddPriority}>
        <PriorityPicker
          value={priority}
          onChange={(p) => {
            setPriority(p)
            input.current?.focus({ preventScroll: true })
          }}
        />
      </div>
    </BottomSheet>
  )
}
