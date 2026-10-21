import { format } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { type CSSProperties, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDateLocale } from '../../i18n'
import { fromDateStr, monthWeeks, shiftMonth } from '../../lib/dates'
import { capitalize } from '../../lib/format'
import { type DayStatus, dayStatusFn, intensity } from '../../lib/stats'
import type { VizProps } from './types'
import s from './viz.module.css'

const CLASS: Record<DayStatus, string> = {
  done: s.calDone,
  partial: s.calPartial,
  missed: s.calMissed,
  pending: s.calPending,
  not_due: s.calNotDue,
  future: s.calFuture,
  inactive: s.calFuture,
}

/** Month view: each day marked as done, partial, missed or not due. Navigable in the detail view. */
export function MonthCalendar({ habit, logs, today, size }: VizProps) {
  const { t } = useTranslation()
  const locale = useDateLocale()
  const [month, setMonth] = useState(today.slice(0, 7))
  const status = dayStatusFn(habit, logs, today)
  const initials = t('weekdays.initials', { returnObjects: true }) as string[]
  const navigable = size === 'full'
  const showNumbers = size !== 'compact'
  const title = capitalize(format(fromDateStr(`${month}-01`), 'LLLL yyyy', { locale }))

  return (
    <div className={`${s.calendar} ${s[`cal_${size}`]}`}>
      {navigable ? (
        <div className={s.calHeader}>
          <button type="button" className={s.calNav} aria-label={t('viz.prevMonth')} onClick={() => setMonth((m) => shiftMonth(m, -1))}>
            <ChevronLeft size={22} />
          </button>
          <span className={s.calTitle}>{title}</span>
          <button
            type="button"
            className={s.calNav}
            aria-label={t('viz.nextMonth')}
            disabled={month >= today.slice(0, 7)}
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
          >
            <ChevronRight size={22} />
          </button>
        </div>
      ) : (
        <div className={s.calCaption}>{title}</div>
      )}
      <div className={s.calGrid} role="grid" aria-label={title}>
        {showNumbers
          ? initials.map((initial, i) => (
              <span key={`h${i}`} className={s.calWeekday}>
                {initial}
              </span>
            ))
          : null}
        {monthWeeks(month).flat().map((date, i) => {
          if (!date) return <span key={`e${i}`} />
          const st = status(date)
          const value = logs.get(date) ?? 0
          return (
            <span
              key={date}
              role="gridcell"
              aria-label={`${date}: ${t(`viz.status.${st}`)}`}
              className={`${s.calDay} ${CLASS[st]} ${date === today ? s.calToday : ''}`}
              style={st === 'partial' ? ({ '--i': intensity(habit, value) } as CSSProperties) : undefined}
            >
              {showNumbers ? Number(date.slice(8)) : null}
            </span>
          )
        })}
      </div>
      {size === 'full' ? (
        <div className={s.legend}>
          {(['done', habit.type === 'quantitative' ? 'partial' : null, 'missed', 'not_due'] as const)
            .filter((k): k is 'done' | 'partial' | 'missed' | 'not_due' => k != null)
            .map((k) => (
              <span key={k} className={s.legendItem}>
                <span className={`${s.legendSwatch} ${CLASS[k]}`} />
                {t(`viz.status.${k}`)}
              </span>
            ))}
        </div>
      ) : null}
    </div>
  )
}
