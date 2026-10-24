import { useTranslation } from 'react-i18next'
import { formatNumber, formatPercent } from '../../lib/habitMeta'
import { dayProgress, periodProgress } from '../../lib/stats'
import type { VizProps } from './types'
import s from './viz.module.css'

const GEOMETRY = {
  compact: { box: 104, stroke: 11 },
  regular: { box: 128, stroke: 13 },
  full: { box: 188, stroke: 18 },
}

/**
 * Progress towards everything due this week or month (SPEC §7, period set in the habit),
 * or, for quantitative habits, today's amount towards the daily goal.
 */
export function Ring({ habit, logs, today, size, config }: VizProps) {
  const { t, i18n } = useTranslation()
  const { box, stroke } = GEOMETRY[size]
  const r = (box - stroke) / 2
  const circumference = 2 * Math.PI * r
  const num = (n: number) => formatNumber(n, i18n.language)

  let pct: number | null
  let caption: string
  let detail: string | null
  if (config.ringPeriod === 'day') {
    const day = dayProgress(habit, logs, today)
    pct = day.pct
    caption = t('common.today')
    detail = t('agenda.amount', { value: num(day.value), target: num(day.target), unit: habit.unit ?? '' }).trim()
  } else {
    const period = periodProgress(habit, logs, today, config.ringPeriod)
    pct = period.pct
    caption = config.ringPeriod === 'week' ? t('viz.thisWeek') : t('viz.thisMonth')
    detail = period.total ? t('viz.doneOf', { done: period.done, total: period.total }) : null
  }

  return (
    <div className={s.ring}>
      <svg width={box} height={box} viewBox={`0 0 ${box} ${box}`} role="img" aria-label={t('habits.viz.ring')}>
        <circle cx={box / 2} cy={box / 2} r={r} className={s.ringTrack} strokeWidth={stroke} />
        <circle
          cx={box / 2}
          cy={box / 2}
          r={r}
          className={s.ringValue}
          strokeWidth={stroke}
          strokeDasharray={`${Math.min(1, pct ?? 0) * circumference} ${circumference}`}
          transform={`rotate(-90 ${box / 2} ${box / 2})`}
        />
        <text x="50%" y="50%" className={`${s.ringPct} ${s[`ringPct_${size}`]}`} dominantBaseline="central" textAnchor="middle">
          {pct == null ? '—' : formatPercent(pct, i18n.language)}
        </text>
      </svg>
      <div className={s.ringCaption}>
        <span>{caption}</span>
        {detail ? <span className={s.muted}>{detail}</span> : null}
      </div>
    </div>
  )
}
