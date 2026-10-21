import { Ban, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSetLogValue } from '../data/logs'
import type { Habit } from '../lib/database.types'
import type { DateStr } from '../lib/dates'
import { formatNumber, habitColorStyle } from '../lib/habitMeta'
import { isCompletedValue } from '../lib/schedule'
import { showToast } from '../lib/toast'
import s from './HabitQuickAction.module.css'

type Props = {
  habit: Habit
  date: DateStr
  value: number
  disabled?: boolean
  /** Smaller control for 2-column tracker cards. */
  compact?: boolean
}

/** One-tap logging: check (yes/no), "+N" (quantitative) or relapse with undo (negative). */
export function HabitQuickAction({ habit, date, value, disabled, compact }: Props) {
  const { t, i18n } = useTranslation()
  const setLog = useSetLogValue()
  const done = isCompletedValue(habit, value)
  const set = (next: number) => setLog.mutate({ habitId: habit.id, date, value: next })
  const size = compact ? s.compact : ''

  switch (habit.type) {
    case 'boolean':
      return (
        <button
          type="button"
          className={`${s.check} ${done ? s.checkOn : ''} ${size}`}
          style={habitColorStyle(habit.color)}
          aria-pressed={done}
          aria-label={done ? t('agenda.markUndone') : t('agenda.markDone')}
          disabled={disabled}
          onClick={() => set(done ? 0 : 1)}
        >
          <Check size={compact ? 18 : 22} strokeWidth={3} />
        </button>
      )

    case 'quantitative':
      return (
        <button
          type="button"
          className={`${s.pill} ${done ? s.pillDone : ''} ${size}`}
          style={habitColorStyle(habit.color)}
          disabled={disabled}
          onClick={() => set(value + habit.quick_step)}
        >
          {done && !compact ? <Check size={16} strokeWidth={3} /> : null}
          {t('agenda.addStep', { step: formatNumber(habit.quick_step, i18n.language) })}
        </button>
      )

    case 'negative':
      return (
        <button
          type="button"
          className={`${s.pill} ${s.relapse} ${size}`}
          aria-label={t('agenda.relapse')}
          disabled={disabled}
          onClick={() => {
            const previous = value
            set(value + 1)
            showToast({
              message: t('agenda.relapseLogged'),
              action: { label: t('common.undo'), run: () => set(previous) },
            })
          }}
        >
          {compact ? <Ban size={17} strokeWidth={2.4} /> : t('agenda.relapse')}
        </button>
      )
  }
}
