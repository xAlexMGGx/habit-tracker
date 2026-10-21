import { useTranslation } from 'react-i18next'
import { computeStats } from '../../lib/stats'
import type { VizProps } from './types'
import s from './viz.module.css'

/** Big number of clean days since the last relapse, with the record. */
export function DaysSince({ habit, logs, today, size }: VizProps) {
  const { t } = useTranslation()
  const { currentStreak, bestStreak } = computeStats(habit, logs, today)
  return (
    <div className={`${s.daysSince} ${s[`daysSince_${size}`]}`}>
      <span className={s.daysNumber}>{currentStreak}</span>
      <span className={s.daysLabel}>{t('viz.daysClean', { count: currentStreak })}</span>
      <span className={s.daysRecord}>🏆 {t('viz.record', { count: Math.max(bestStreak, currentStreak) })}</span>
    </div>
  )
}
