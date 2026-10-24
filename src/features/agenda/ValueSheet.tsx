import { Heart, Minus, Plus } from 'lucide-react'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from '../../components/BottomSheet'
import { useHealthLogInfo, useRevertToHealth, useSetLogValue } from '../../data/logs'
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
  const revert = useRevertToHealth()
  const healthInfo = useHealthLogInfo()
  const [text, setText] = useState('')

  useEffect(() => {
    if (openHabit) setText(value ? String(value) : '')
  }, [openHabit, value])

  if (!habit) return null

  const negative = habit.type === 'negative'
  const health = habit.health_metric != null
  const info = health ? healthInfo(habit.id, date) : undefined
  const step = negative ? 1 : habit.quick_step
  const current = parse(text)
  const bump = (delta: number) => setText(String(Math.max(0, Math.round((current + delta) * 100) / 100)))
  const amount = (n: number) => `${formatNumber(n, i18n.language)} ${habit.unit ?? ''}`.trim()

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const next = negative ? Math.round(current) : current
    if (next !== value) setLog.mutate({ habitId: habit.id, date, value: next, health })
    onClose()
  }

  const useHealthValue = () => {
    revert.mutate({ habitId: habit.id, date, healthValue: info?.health_value ?? null })
    onClose()
  }

  const healthNote = !health
    ? null
    : info?.manual
      ? info.health_value != null
        ? t('health.manualNote', { value: amount(info.health_value) })
        : t('health.manualNoData')
      : info?.health_value != null
        ? t('health.fromHealthNote')
        : t('health.noDataYet')

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
        {healthNote ? (
          <p className={s.healthNote}>
            <Heart size={14} fill="currentColor" strokeWidth={0} className={s.healthHeart} />
            {healthNote}
          </p>
        ) : null}
        <div className={s.sheetActions}>
          <button type="submit" className={ui.btnBlock}>
            {t('common.save')}
          </button>
          {info?.manual ? (
            <button type="button" className={ui.btnSecondary} onClick={useHealthValue}>
              {info.health_value != null
                ? t('health.useHealthValue', { value: amount(info.health_value) })
                : t('health.clearManual')}
            </button>
          ) : null}
        </div>
      </form>
    </BottomSheet>
  )
}
