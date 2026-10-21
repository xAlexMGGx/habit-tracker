import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { KeyboardEvent, SyntheticEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { HabitQuickAction } from '../../components/HabitQuickAction'
import { HabitIcon } from '../../components/controls'
import type { Habit } from '../../lib/database.types'
import type { DateStr } from '../../lib/dates'
import { habitColorStyle } from '../../lib/habitMeta'
import type { HabitLogMap } from '../../lib/schedule'
import type { HabitStats } from '../../lib/stats'
import { readVizConfig } from '../../lib/vizConfig'
import { HabitViz } from '../viz/HabitViz'
import s from './Tracker.module.css'

export type CardProps = {
  habit: Habit
  logs: HabitLogMap
  today: DateStr
  stats: HabitStats | undefined
  columns: 1 | 2
  /** Today it can be logged from the card (due or optional this week). */
  actionable: boolean
  /** Can be dragged (manual order). */
  sortable: boolean
  onOpen: (habit: Habit) => void
}

export function TrackerCard({ habit, logs, today, stats, columns, actionable, sortable, onOpen }: CardProps) {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: habit.id,
    disabled: !sortable,
  })
  const compact = columns === 2

  const open = () => onOpen(habit)
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && e.target === e.currentTarget) open()
  }
  // The quick action logs today without opening the detail or starting a drag.
  const stop = (e: SyntheticEvent) => e.stopPropagation()

  return (
    <div
      ref={setNodeRef}
      className={`${s.card} ${isDragging ? s.dragging : ''}`}
      style={{ ...habitColorStyle(habit.color), transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      aria-roledescription={sortable ? t('tracker.sortableCard') : undefined}
      aria-label={habit.name}
      onClick={open}
      onKeyDown={onKeyDown}
    >
      <div className={s.cardHead}>
        <HabitIcon icon={habit.icon} color={habit.color} size={compact ? 'sm' : 'md'} />
        <span className={s.cardName}>{habit.name}</span>
        {actionable ? (
          <span className={s.cardAction} onClick={stop} onTouchStart={stop} onMouseDown={stop} onKeyDown={stop}>
            <HabitQuickAction habit={habit} date={today} value={logs.get(today) ?? 0} compact={compact} />
          </span>
        ) : null}
      </div>
      <div className={s.cardViz}>
        <HabitViz
          habit={habit}
          logs={logs}
          today={today}
          size={compact ? 'compact' : 'regular'}
          config={readVizConfig(habit.viz_config)}
        />
      </div>
      <div className={s.cardFoot}>
        {habit.type === 'negative' ? null : (
          <span className={s.streak} title={t('stats.currentStreak')}>
            🔥 {stats?.currentStreak ?? 0}
          </span>
        )}
        {actionable ? null : <span className={s.notToday}>{t('tracker.notDueToday')}</span>}
      </div>
    </div>
  )
}
