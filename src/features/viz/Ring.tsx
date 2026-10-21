import { useTranslation } from 'react-i18next'
import { formatPercent } from '../../lib/habitMeta'
import { periodProgress } from '../../lib/stats'
import type { VizProps } from './types'
import s from './viz.module.css'

const GEOMETRY = {
  compact: { box: 104, stroke: 11 },
  regular: { box: 128, stroke: 13 },
  full: { box: 188, stroke: 18 },
}

/** Progress towards everything due this week or month (SPEC §7, period set in the habit). */
export function Ring({ habit, logs, today, size, config }: VizProps) {
  const { t, i18n } = useTranslation()
  const { box, stroke } = GEOMETRY[size]
  const r = (box - stroke) / 2
  const circumference = 2 * Math.PI * r
  const { done, total, pct } = periodProgress(habit, logs, today, config.ringPeriod)

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
          strokeDasharray={`${(pct ?? 0) * circumference} ${circumference}`}
          transform={`rotate(-90 ${box / 2} ${box / 2})`}
        />
        <text x="50%" y="50%" className={`${s.ringPct} ${s[`ringPct_${size}`]}`} dominantBaseline="central" textAnchor="middle">
          {pct == null ? '—' : formatPercent(pct, i18n.language)}
        </text>
      </svg>
      <div className={s.ringCaption}>
        <span>{config.ringPeriod === 'week' ? t('viz.thisWeek') : t('viz.thisMonth')}</span>
        {total ? <span className={s.muted}>{t('viz.doneOf', { done, total })}</span> : null}
      </div>
    </div>
  )
}
