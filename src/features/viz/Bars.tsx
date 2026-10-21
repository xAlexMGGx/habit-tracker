import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { useElementWidth } from '../../hooks/useElementWidth'
import { addDays, isoWeekday } from '../../lib/dates'
import { formatNumber } from '../../lib/habitMeta'
import { dayStatusFn } from '../../lib/stats'
import type { VizProps } from './types'
import s from './viz.module.css'

const HEIGHT = { compact: 84, regular: 112, full: 190 }

/** Amount per day for the last 7 (bars) or 30 days (line), with the goal as a reference line. */
export function Bars({ habit, logs, today, size, config }: VizProps) {
  const { t, i18n } = useTranslation()
  const [ref, width] = useElementWidth<HTMLDivElement>()
  const initials = t('weekdays.initials', { returnObjects: true }) as string[]
  const days = config.barsRange
  const target = habit.target ?? 1
  const status = dayStatusFn(habit, logs, today)
  const dates = Array.from({ length: days }, (_, i) => addDays(today, i - days + 1))
  const values = dates.map((d) => logs.get(d) ?? 0)
  const max = Math.max(target * 1.2, ...values) || 1

  const axis = size === 'compact' ? 0 : 16
  const labelW = size === 'full' ? 34 : 0
  const h = HEIGHT[size]
  const plotH = h - axis - 6
  const plotW = Math.max(0, width - labelW)
  const y = (v: number) => 6 + plotH - (v / max) * plotH
  const targetY = y(target)

  const content: ReactElement[] = []
  if (days === 7) {
    const slot = plotW / 7
    const barW = Math.min(slot * 0.62, 34)
    dates.forEach((date, i) => {
      const st = status(date)
      const v = values[i]
      const x = labelW + i * slot + (slot - barW) / 2
      const barH = Math.max(v > 0 ? 3 : 0, (v / max) * plotH)
      content.push(
        <rect key={`t${date}`} x={x} y={6} width={barW} height={plotH} rx={barW / 3} className={s.barTrack} />,
      )
      if (v > 0) {
        content.push(
          <rect
            key={date}
            x={x}
            y={6 + plotH - barH}
            width={barW}
            height={barH}
            rx={Math.min(barW / 3, barH / 2)}
            className={st === 'done' ? s.barDone : s.barPartial}
          />,
        )
      }
      if (axis) {
        content.push(
          <text key={`l${date}`} x={x + barW / 2} y={h - 2} textAnchor="middle" className={`${s.axisLabel} ${date === today ? s.axisToday : ''}`}>
            {initials[isoWeekday(date) - 1]}
          </text>,
        )
      }
    })
  } else {
    const stepX = plotW / (days - 1)
    // Today without a log yet isn't a zero: the line stops at yesterday.
    const shown = values[days - 1] > 0 ? values : values.slice(0, -1)
    const points = shown.map((v, i) => `${labelW + i * stepX},${y(v)}`)
    const endX = labelW + (shown.length - 1) * stepX
    content.push(
      <polygon key="area" className={s.lineArea} points={`${labelW},${6 + plotH} ${points.join(' ')} ${endX},${6 + plotH}`} />,
      <polyline key="line" className={s.line} points={points.join(' ')} />,
    )
    if (size !== 'compact') {
      values.forEach((v, i) => {
        if (status(dates[i]) === 'done') {
          content.push(<circle key={`p${i}`} cx={labelW + i * stepX} cy={y(v)} r={2.6} className={s.linePoint} />)
        }
      })
    }
    if (axis) {
      for (const i of [0, 7, 14, 21, 29]) {
        content.push(
          <text key={`l${i}`} x={labelW + i * stepX} y={h - 2} textAnchor={i === 0 ? 'start' : i === 29 ? 'end' : 'middle'} className={s.axisLabel}>
            {Number(dates[i].slice(8))}
          </text>,
        )
      }
    }
  }

  return (
    <div ref={ref} className={s.bars} style={{ height: h }}>
      {width > 0 ? (
        <svg width={width} height={h} role="img" aria-label={t('habits.viz.bars')}>
          {content}
          <line x1={labelW} x2={width} y1={targetY} y2={targetY} className={s.targetLine} />
          {size === 'full' ? (
            <text x={0} y={targetY + 4} className={s.axisLabel}>
              {formatNumber(target, i18n.language)}
            </text>
          ) : null}
        </svg>
      ) : null}
    </div>
  )
}
