import { Minus, Plus } from 'lucide-react'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from '../../components/BottomSheet'
import { useSetLogValue } from '../../data/logs'
import type { Habit } from '../../lib/database.types'
import type { DateStr } from '../../lib/dates'
import { formatNumber } from '../../lib/habitMeta'
import ui from '../../styles/ui.module.css'
import s from './Agenda.module.css'

type Props = {
  habit: Habit | null
  date: DateStr
  value: number
  onClose: () => void
}

function parse(text: string): number {
  const n = Number(text.replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** Type an exact amount (quantitative) or number of relapses (negative) for one day. */
export function ValueSheet({ habit: openHabit, date, value, onClose }: Props) {
  const last = useRef<Habit | null>(null)
  if (openHabit) last.current = openHabit
  const habit = openHabit ?? last.current

  const { t, i18n } = useTranslation()
  const setLog = useSetLogValue()
  const [text, setText] = useState('')

  useEffect(() => {
    if (openHabit) setText(value ? String(value) : '')
  }, [openHabit, value])

  if (!habit) return null

  const negative = habit.type === 'negative'
  const step = negative ? 1 : habit.quick_step
  const current = parse(text)
  const bump = (delta: number) => setText(String(Math.max(0, Math.round((current + delta) * 100) / 100)))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const next = negative ? Math.round(current) : current
    if (next !== value) setLog.mutate({ habitId: habit.id, date, value: next })
    onClose()
  }

  return (
    <BottomSheet
      open={openHabit != null}
      onClose={onClose}
      title={`${habit.icon} ${habit.name}`}
      subtitle={negative ? t('agenda.dayRelapses') : t('agenda.dayTotal')}
    >
      <form onSubmit={submit}>
        <div className={s.valueEditor}>
          <button type="button" className={s.valueBump} onClick={() => bump(-step)} aria-label={`−${step}`}>
            <Minus size={22} />
          </button>
          <div className={s.valueField}>
            <input
              className={s.valueInput}
              inputMode={negative ? 'numeric' : 'decimal'}
              value={text}
              placeholder="0"
              onChange={(e) => setText(e.target.value.replace(/[^\d.,]/g, ''))}
            />
            {!negative && habit.target != null ? (
              <span className={ui.muted}>
                / {formatNumber(habit.target, i18n.language)} {habit.unit ?? ''}
              </span>
            ) : null}
          </div>
          <button type="button" className={s.valueBump} onClick={() => bump(step)} aria-label={`+${step}`}>
            <Plus size={22} />
          </button>
        </div>
        <div className={s.sheetActions}>
          <button type="submit" className={ui.btnBlock}>
            {t('common.save')}
          </button>
        </div>
      </form>
    </BottomSheet>
  )
}
