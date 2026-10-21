import { format } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDateLocale } from '../i18n'
import { type DateStr, fromDateStr, monthWeeks, shiftMonth, weekStart } from '../lib/dates'
import { capitalize } from '../lib/format'
import { BottomSheet } from './BottomSheet'
import s from './CalendarPicker.module.css'

type Props = {
  open: boolean
  /** Selected date; its week is highlighted with a grey pill. */
  value: DateStr
  today: DateStr
  title: string
  onSelect: (date: DateStr) => void
  onClose: () => void
}

/**
 * Month calendar to jump to a date. Replaces the native iOS picker, which can't show
 * which week is currently selected.
 */
export function CalendarPicker({ open, value, today, title, onSelect, onClose }: Props) {
  const { t } = useTranslation()
  const locale = useDateLocale()
  const [month, setMonth] = useState(value.slice(0, 7))
  const initials = t('weekdays.initials', { returnObjects: true }) as string[]
  const selectedWeek = weekStart(value)

  useEffect(() => {
    if (open) setMonth(value.slice(0, 7))
  }, [open, value])

  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <div className={s.picker}>
        <div className={s.header}>
          <button type="button" className={s.nav} aria-label={t('viz.prevMonth')} onClick={() => setMonth((m) => shiftMonth(m, -1))}>
            <ChevronLeft size={22} />
          </button>
          <span className={s.month}>{capitalize(format(fromDateStr(`${month}-01`), 'LLLL yyyy', { locale }))}</span>
          <button type="button" className={s.nav} aria-label={t('viz.nextMonth')} onClick={() => setMonth((m) => shiftMonth(m, 1))}>
            <ChevronRight size={22} />
          </button>
        </div>
        <div className={s.weekdays}>
          {initials.map((initial, i) => (
            <span key={i}>{initial}</span>
          ))}
        </div>
        {monthWeeks(month).map((row) => {
          const monday = weekStart(row.find((d) => d != null)!)
          return (
            <div key={monday} className={`${s.week} ${monday === selectedWeek ? s.weekSelected : ''}`}>
              {row.map((date, i) =>
                date ? (
                  <button
                    key={date}
                    type="button"
                    className={`${s.day} ${date === value ? s.daySelected : ''} ${date === today ? s.dayToday : ''}`}
                    aria-pressed={date === value}
                    aria-label={format(fromDateStr(date), t('formats.longDay'), { locale })}
                    onClick={() => onSelect(date)}
                  >
                    {Number(date.slice(8))}
                  </button>
                ) : (
                  <span key={`e${i}`} />
                ),
              )}
            </div>
          )
        })}
        <button type="button" className={s.todayButton} onClick={() => onSelect(today)}>
          {t('common.today')}
        </button>
      </div>
    </BottomSheet>
  )
}
