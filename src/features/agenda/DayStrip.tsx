import { format } from 'date-fns'
import { type PointerEvent, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDateLocale } from '../../i18n'
import { type DateStr, addDays, fromDateStr, weekDates, weekStart } from '../../lib/dates'
import s from './DayStrip.module.css'

type Props = {
  selected: DateStr
  today: DateStr
  /** Days that have to-dos get a dot. */
  marked: ReadonlySet<DateStr>
  onSelect: (date: DateStr) => void
}

const SWIPE_THRESHOLD = 0.22 // fraction of the width
const ANIMATION_MS = 220

/**
 * Week strip (Monday → Sunday). Swipe sideways to move a week; the selected
 * weekday stays the same so the content below always matches the strip.
 */
export function DayStrip({ selected, today, marked, onSelect }: Props) {
  const { t } = useTranslation()
  const locale = useDateLocale()
  const initials = t('weekdays.initials', { returnObjects: true }) as string[]
  const monday = weekStart(selected)
  const weeks = [addDays(monday, -7), monday, addDays(monday, 7)]

  const viewport = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; axis: 'x' | 'y' | null; moved: boolean } | null>(null)
  const [offset, setOffset] = useState(0)
  const [animating, setAnimating] = useState(false)

  const finish = (direction: -1 | 0 | 1) => {
    const width = viewport.current?.offsetWidth ?? 0
    setAnimating(true)
    setOffset(-direction * width)
    setTimeout(() => {
      setAnimating(false)
      setOffset(0)
      if (direction) onSelect(addDays(selected, 7 * direction))
    }, ANIMATION_MS)
  }

  const onPointerDown = (e: PointerEvent) => {
    if (animating) return
    drag.current = { x: e.clientX, y: e.clientY, axis: null, moved: false }
  }

  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (!d.axis && Math.hypot(dx, dy) > 8) {
      d.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      if (d.axis === 'x') (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    }
    if (d.axis === 'x') {
      d.moved = true
      setOffset(dx)
    }
  }

  const onPointerUp = (e: PointerEvent) => {
    const d = drag.current
    drag.current = null
    if (!d || d.axis !== 'x') return
    const width = viewport.current?.offsetWidth ?? 1
    const dx = e.clientX - d.x
    finish(Math.abs(dx) > width * SWIPE_THRESHOLD ? (dx < 0 ? 1 : -1) : 0)
    // Swallow the click that follows a swipe.
    const block = (ev: Event) => ev.stopPropagation()
    window.addEventListener('click', block, { capture: true, once: true })
    setTimeout(() => window.removeEventListener('click', block, { capture: true }), 0)
  }

  return (
    <div
      ref={viewport}
      className={s.viewport}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        drag.current = null
        finish(0)
      }}
    >
      <div
        className={s.track}
        style={{
          transform: `translateX(calc(-100% / 3 + ${offset}px))`,
          transition: animating ? `transform ${ANIMATION_MS}ms ease-out` : 'none',
        }}
      >
        {weeks.map((start) => (
          <div className={s.week} key={start} aria-hidden={start !== monday}>
            {weekDates(start).map((date, i) => {
              const isSelected = date === selected
              const isToday = date === today
              return (
                <button
                  key={date}
                  type="button"
                  className={`${s.day} ${isSelected ? s.selected : ''} ${isToday ? s.today : ''}`}
                  aria-current={isSelected ? 'date' : undefined}
                  aria-label={`${format(fromDateStr(date), t('formats.longDay'), { locale })}${marked.has(date) ? ` · ${t('agenda.hasTodos')}` : ''}`}
                  tabIndex={start === monday ? 0 : -1}
                  onClick={() => onSelect(date)}
                >
                  <span className={s.weekday}>{initials[i]}</span>
                  <span className={s.number}>{Number(date.slice(8))}</span>
                  <span className={`${s.dot} ${marked.has(date) ? s.dotOn : ''}`} />
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
