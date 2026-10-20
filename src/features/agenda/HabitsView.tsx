import { Check } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { HabitIcon } from '../../components/controls'
import { useSetLogValue } from '../../data/logs'
import type { Habit } from '../../lib/database.types'
import type { DateStr } from '../../lib/dates'
import { formatNumber, habitColorStyle } from '../../lib/habitMeta'
import { type LogIndex, isCompletedValue, logsFor, weekProgress } from '../../lib/schedule'
import { showToast } from '../../lib/toast'
import ui from '../../styles/ui.module.css'
import s from './Agenda.module.css'

type RowProps = {
  habit: Habit
  date: DateStr
  value: number
  editable: boolean
  week?: { done: number; goal: number }
  onOpenValue: (habit: Habit) => void
}

function HabitRow({ habit, date, value, editable, week, onOpenValue }: RowProps) {
  const { t, i18n } = useTranslation()
  const setLog = useSetLogValue()
  const done = isCompletedValue(habit, value)
  const set = (next: number) => setLog.mutate({ habitId: habit.id, date, value: next })
  const num = (n: number) => formatNumber(n, i18n.language)

  let detail: string | null = null
  let control: ReactNode
  let progress: number | null = null

  switch (habit.type) {
    case 'boolean':
      control = (
        <button
          type="button"
          className={`${s.habitCheck} ${done ? s.habitCheckOn : ''}`}
          aria-pressed={done}
          aria-label={done ? t('agenda.markUndone') : t('agenda.markDone')}
          disabled={!editable}
          onClick={() => set(done ? 0 : 1)}
        >
          <Check size={22} strokeWidth={3} />
        </button>
      )
      break

    case 'quantitative': {
      const target = habit.target ?? 1
      detail = t('agenda.amount', { value: num(value), target: num(target), unit: habit.unit ?? '' }).trim()
      progress = Math.min(1, value / target)
      control = (
        <button
          type="button"
          className={`${s.habitPill} ${done ? s.habitPillDone : ''}`}
          disabled={!editable}
          onClick={() => set(value + habit.quick_step)}
        >
          {done ? <Check size={16} strokeWidth={3} /> : null}
          {t('agenda.addStep', { step: num(habit.quick_step) })}
        </button>
      )
      break
    }

    case 'negative':
      detail = value > 0 ? t('agenda.relapses', { count: value }) : t('agenda.clean')
      control = (
        <button
          type="button"
          className={`${s.habitPill} ${s.relapse}`}
          disabled={!editable}
          onClick={() => {
            const previous = value
            set(value + 1)
            showToast({
              message: t('agenda.relapseLogged'),
              action: { label: t('common.undo'), run: () => set(previous) },
            })
          }}
        >
          {t('agenda.relapse')}
        </button>
      )
      break
  }

  const weekText = week ? t('agenda.weekProgress', week) : null
  const canOpen = editable && habit.type !== 'boolean'

  return (
    // A clean negative habit is its normal state, so it isn't dimmed like a finished one.
    <div
      className={`${ui.row} ${s.habitRow} ${done && habit.type !== 'negative' ? s.habitDone : ''}`}
      style={habitColorStyle(habit.color)}
    >
      <HabitIcon icon={habit.icon} color={habit.color} />
      <button type="button" className={s.habitBody} disabled={!canOpen} onClick={() => onOpenValue(habit)}>
        <span className={s.habitName}>{habit.name}</span>
        {detail || weekText ? (
          <span className={`${s.habitDetail} ${habit.type === 'negative' && value > 0 ? ui.danger : ''}`}>
            {[detail, weekText].filter(Boolean).join(' · ')}
          </span>
        ) : null}
        {progress != null ? (
          <span className={s.progress} style={{ '--p': progress } as CSSProperties}>
            <span />
          </span>
        ) : null}
      </button>
      {control}
    </div>
  )
}

type ViewProps = {
  date: DateStr
  due: Habit[]
  optional: Habit[]
  index: LogIndex
  editable: boolean
  hasAnyHabit: boolean
  onOpenValue: (habit: Habit) => void
}

export function HabitsView({ date, due, optional, index, editable, hasAnyHabit, onOpenValue }: ViewProps) {
  const { t } = useTranslation()

  const row = (habit: Habit) => {
    const logs = logsFor(index, habit.id)
    return (
      <HabitRow
        key={habit.id}
        habit={habit}
        date={date}
        value={logs.get(date) ?? 0}
        editable={editable}
        week={habit.frequency_type === 'times_per_week' ? weekProgress(habit, date, logs) : undefined}
        onOpenValue={onOpenValue}
      />
    )
  }

  if (!hasAnyHabit) {
    return (
      <div className={ui.empty}>
        <p>{t('agenda.noHabitsYet')}</p>
        <p>
          <Link to="/habits/new">{t('agenda.createHabit')}</Link>
        </p>
      </div>
    )
  }

  return (
    <>
      {due.length ? (
        <div className={ui.section}>
          <div className={ui.group}>{due.map(row)}</div>
        </div>
      ) : (
        <div className={ui.empty}>
          <p>{t('agenda.noHabitsToday')}</p>
        </div>
      )}
      {optional.length ? (
        <div className={ui.section}>
          <h2 className={ui.sectionTitle}>{t('agenda.alsoThisWeek')}</h2>
          <div className={ui.group}>{optional.map(row)}</div>
        </div>
      ) : null}
    </>
  )
}
