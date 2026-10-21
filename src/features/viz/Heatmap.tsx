import { format } from 'date-fns'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { useElementWidth } from '../../hooks/useElementWidth'
import { useDateLocale } from '../../i18n'
import { addDays, fromDateStr, weekStart } from '../../lib/dates'
import { dayStatusFn, intensity } from '../../lib/stats'
import type { VizProps } from './types'
import s from './viz.module.css'

const GEOMETRY = {
  compact: { cell: 11, gap: 2.5, labels: false },
  regular: { cell: 13, gap: 3, labels: false },
  full: { cell: 14, gap: 3, labels: true },
}

/** One square per day (weeks as columns, Monday on top); more intensity = more fulfilled. */
export function Heatmap({ habit, logs, today, size }: VizProps) {
  const { t } = useTranslation()
  const locale = useDateLocale()
  const [ref, width] = useElementWidth<HTMLDivElement>()
  const { cell, gap, labels } = GEOMETRY[size]
  const left = labels ? 16 : 0
  const top = labels ? 16 : 0
  const step = cell + gap
  // As many recent weeks as fit (SPEC §7), up to a year.
  const weeks = Math.min(53, Math.max(4, Math.floor((width - left + gap) / step)))
  const height = top + 7 * step - gap
  const status = dayStatusFn(habit, logs, today)
  const firstMonday = addDays(weekStart(today), -(weeks - 1) * 7)
  const initials = t('weekdays.initials', { returnObjects: true }) as string[]

  const cells: ReactElement[] = []
  const months: ReactElement[] = []
  for (let w = 0; w < weeks; w++) {
    const monday = addDays(firstMonday, w * 7)
    for (let d = 0; d < 7; d++) {
      const date = addDays(monday, d)
      if (labels && date.endsWith('-01')) {
        months.push(
          <text key={`m${date}`} x={left + w * step} y={10} className={s.axisLabel}>
            {format(fromDateStr(date), 'MMM', { locale })}
          </text>,
        )
      }
      const st = status(date)
      if (st === 'future') continue
      const value = logs.get(date) ?? 0
      let className = s.cellEmpty
      let opacity = 1
      // Days before the habit started stay faint, so the grid keeps its full width.
      if (st === 'inactive') className = s.cellInactive
      else if (st === 'not_due') className = s.cellNotDue
      else if (st === 'missed') className = habit.type === 'negative' ? s.cellRelapse : s.cellEmpty
      else if (st === 'pending') {
        className = value > 0 ? s.cellToday : s.cellPending
        opacity = value > 0 ? 0.25 + 0.6 * intensity(habit, value) : 1
      } else {
        className = s.cellFilled
        opacity = st === 'done' ? 1 : 0.2 + 0.6 * intensity(habit, value)
      }
      cells.push(
        <rect
          key={date}
          x={left + w * step}
          y={top + d * step}
          width={cell}
          height={cell}
          rx={cell * 0.28}
          className={className}
          fillOpacity={opacity}
        />,
      )
    }
  }

  return (
    <div ref={ref} className={s.heatmap} style={{ height }}>
      {width > 0 ? (
        <svg width={left + weeks * step - gap} height={height} role="img" aria-label={t('habits.viz.heatmap')}>
          {months}
          {labels
            ? [0, 2, 4].map((d) => (
                <text key={d} x={0} y={top + d * step + cell - 2} className={s.axisLabel}>
                  {initials[d]}
                </text>
              ))
            : null}
          {cells}
        </svg>
      ) : null}
    </div>
  )
}
