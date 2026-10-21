import { ChevronLeft, Pencil } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { HabitQuickAction } from '../../components/HabitQuickAction'
import { PageHeader } from '../../components/PageHeader'
import { HabitIcon, Segmented, Spinner } from '../../components/controls'
import { useHabits } from '../../data/habits'
import { useHabitLogs, useLogIndex } from '../../data/logs'
import { useToday } from '../../hooks/useToday'
import { useDateLocale } from '../../i18n'
import type { Habit, VizType } from '../../lib/database.types'
import { frequencySummary, targetSummary } from '../../lib/format'
import type { JarPeriod } from '../../lib/jar'
import { formatPercent, habitColorStyle } from '../../lib/habitMeta'
import { habitsForDay, logsFor } from '../../lib/schedule'
import { type Rate, computeStats } from '../../lib/stats'
import { type BarsRange, type RingPeriod, availableViz, effectiveViz, readVizConfig } from '../../lib/vizConfig'
import ui from '../../styles/ui.module.css'
import { HabitViz } from '../viz/HabitViz'
import s from './Tracker.module.css'

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className={s.statTile}>
      <span className={s.statValue}>{value}</span>
      <span className={s.statLabel}>{label}</span>
      {sub ? <span className={s.statSub}>{sub}</span> : null}
    </div>
  )
}

function Detail({ habit }: { habit: Habit }) {
  const { t, i18n } = useTranslation()
  const locale = useDateLocale()
  const today = useToday()
  const index = useLogIndex()
  const logs = logsFor(index, habit.id)
  const stats = useMemo(() => computeStats(habit, logs, today), [habit, logs, today])
  const { due, optional } = useMemo(() => habitsForDay([habit], today, index), [habit, today, index])
  const actionable = due.length + optional.length > 0

  // Looking at other visualizations doesn't change the chosen one (SPEC §6).
  const chosen = effectiveViz(habit)
  const [viz, setViz] = useState<VizType>(chosen)
  const [config, setConfig] = useState(() => readVizConfig(habit.viz_config))

  const pct = (r: Rate) => (r.pct == null ? '—' : formatPercent(r.pct, i18n.language))
  const sub = (r: Rate) => (r.total ? t('viz.doneOf', { done: r.done, total: r.total }) : undefined)
  const summary = [targetSummary(habit, t, i18n.language), frequencySummary(habit, t, locale)].filter(Boolean).join(' · ')

  return (
    <div style={habitColorStyle(habit.color)}>
      <div className={s.hero}>
        <HabitIcon icon={habit.icon} color={habit.color} size="lg" />
        <div className={s.heroText}>
          <h2 className={s.heroName}>{habit.name}</h2>
          <p className={s.heroSummary}>{summary}</p>
        </div>
        {actionable ? <HabitQuickAction habit={habit} date={today} value={logs.get(today) ?? 0} /> : null}
      </div>

      <div className={s.detailCard}>
        <HabitViz habit={habit} logs={logs} today={today} size="full" config={config} viz={viz} />
        {viz === 'ring' ? (
          <div className={s.params}>
            <Segmented<RingPeriod>
              value={config.ringPeriod}
              onChange={(ringPeriod) => setConfig((c) => ({ ...c, ringPeriod }))}
              options={[
                { value: 'week', label: t('viz.thisWeek') },
                { value: 'month', label: t('viz.thisMonth') },
              ]}
            />
          </div>
        ) : null}
        {viz === 'bars' ? (
          <div className={s.params}>
            <Segmented<'7' | '30'>
              value={String(config.barsRange) as '7' | '30'}
              onChange={(v) => setConfig((c) => ({ ...c, barsRange: Number(v) as BarsRange }))}
              options={[
                { value: '7', label: t('viz.lastDays', { count: 7 }) },
                { value: '30', label: t('viz.lastDays', { count: 30 }) },
              ]}
            />
          </div>
        ) : null}
        {viz === 'marble_jar' ? (
          <div className={s.params}>
            <Segmented<JarPeriod>
              value={config.jarPeriod}
              onChange={(jarPeriod) => setConfig((c) => ({ ...c, jarPeriod }))}
              options={(['week', 'month', 'quarter', 'year'] as const).map((p) => ({
                value: p,
                label: t(`habits.fields.jarPeriods.${p}`),
              }))}
            />
          </div>
        ) : null}
      </div>

      <div className={ui.section}>
        <h3 className={ui.sectionTitle}>{t('tracker.viewAs')}</h3>
        <div className={s.vizChips} role="radiogroup">
          {availableViz(habit.type).map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={v === viz}
              className={`${s.vizChip} ${v === viz ? s.vizChipOn : ''}`}
              onClick={() => setViz(v)}
            >
              {t(`habits.viz.${v}`)}
              {v === chosen ? <span className={s.chosen}>★</span> : null}
            </button>
          ))}
        </div>
        <p className={ui.sectionFooter}>{t('tracker.viewAsHint')}</p>
      </div>

      <div className={ui.section}>
        <h3 className={ui.sectionTitle}>{t('stats.title')}</h3>
        <div className={s.statsGrid}>
          <StatTile
            label={habit.type === 'negative' ? t('stats.cleanStreak') : t('stats.currentStreak')}
            value={String(stats.currentStreak)}
          />
          <StatTile label={t('stats.bestStreak')} value={String(stats.bestStreak)} />
          <StatTile label={t('stats.week')} value={pct(stats.week)} sub={sub(stats.week)} />
          <StatTile label={t('stats.month')} value={pct(stats.month)} sub={sub(stats.month)} />
          <StatTile label={t('stats.total')} value={pct(stats.total)} sub={sub(stats.total)} />
        </div>
        <p className={ui.sectionFooter}>{t('stats.hint')}</p>
      </div>
    </div>
  )
}

export function HabitDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const habitsQuery = useHabits()
  const logsQuery = useHabitLogs()
  const habit = habitsQuery.data?.find((h) => h.id === id)

  return (
    <div className={`${ui.pageNoTabs} ${s.page}`}>
      <PageHeader
        variant="inline"
        title={habit?.name ?? ''}
        left={
          <button
            type="button"
            className={`${ui.btnPlain} ${s.back}`}
            onClick={() => (location.key === 'default' ? navigate('/tracker', { replace: true }) : navigate(-1))}
          >
            <ChevronLeft size={26} />
            {t('nav.tracker')}
          </button>
        }
        right={
          habit ? (
            <Link to={`/habits/${habit.id}`} className={ui.iconBtn} aria-label={t('habits.edit')}>
              <Pencil size={20} />
            </Link>
          ) : null
        }
      />
      {habitsQuery.isPending || logsQuery.isPending ? (
        <Spinner />
      ) : habit ? (
        <Detail key={habit.id} habit={habit} />
      ) : (
        <div className={ui.empty}>{t('habits.notFound')}</div>
      )}
    </div>
  )
}
