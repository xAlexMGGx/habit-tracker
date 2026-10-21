import { DndContext, type DragEndEvent, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy } from '@dnd-kit/sortable'
import { ArrowUpDown, Check, LayoutGrid, Square } from 'lucide-react'
import { type CSSProperties, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { BottomSheet } from '../../components/BottomSheet'
import { PageHeader } from '../../components/PageHeader'
import { Segmented, Spinner } from '../../components/controls'
import { useHabits, useReorderHabits } from '../../data/habits'
import { useHabitLogs, useLogIndex } from '../../data/logs'
import { useSettings, useUpdateSettings } from '../../data/settings'
import { useHabitStats } from '../../data/stats'
import { useToday } from '../../hooks/useToday'
import type { Habit, TrackerSort } from '../../lib/database.types'
import { countCompleted, habitsForDay, isCompletedOn, logsFor } from '../../lib/schedule'
import ui from '../../styles/ui.module.css'
import s from './Tracker.module.css'
import { TrackerCard } from './TrackerCard'
import { orderHabits } from './trackerOrder'

const SORTS: TrackerSort[] = ['manual', 'streak', 'completion', 'pending_first']

export function TrackerPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const today = useToday()
  const settings = useSettings().data
  const updateSettings = useUpdateSettings()
  const habitsQuery = useHabits()
  const logsQuery = useHabitLogs()
  const index = useLogIndex()
  const reorder = useReorderHabits()
  const [sortOpen, setSortOpen] = useState(false)
  // A long-press drag ends with a click; ignore it so the detail doesn't open.
  const lastDragEnd = useRef(0)

  const columns: 1 | 2 = settings?.tracker_columns === 1 ? 1 : 2
  const sort: TrackerSort = settings?.tracker_sort ?? 'manual'

  const all = habitsQuery.data
  const active = useMemo(() => (all ?? []).filter((h) => !h.archived_at), [all])
  const archivedIds = useMemo(() => (all ?? []).filter((h) => h.archived_at).map((h) => h.id), [all])
  const stats = useHabitStats(active, index, today)

  const { due, optional } = useMemo(() => habitsForDay(active, today, index), [active, today, index])
  const actionable = useMemo(() => new Set([...due, ...optional].map((h) => h.id)), [due, optional])
  const pendingToday = useMemo(
    () =>
      new Set(
        due.filter((h) => h.type !== 'negative' && !isCompletedOn(h, today, logsFor(index, h.id))).map((h) => h.id),
      ),
    [due, today, index],
  )
  const ordered = useMemo(() => orderHabits(active, sort, stats, pendingToday), [active, sort, stats, pendingToday])

  const done = countCompleted(due, today, index)
  const progress = due.length ? done / due.length : 0

  const sensors = useSensors(
    // Long press on iPhone (SPEC: like the Home Screen); a normal tap opens the detail.
    useSensor(TouchSensor, { activationConstraint: { delay: 350, tolerance: 8 } }),
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
  )

  const onDragEnd = ({ active: dragged, over }: DragEndEvent) => {
    lastDragEnd.current = Date.now()
    if (!over || dragged.id === over.id) return
    const ids = ordered.map((h) => h.id)
    const next = arrayMove(ids, ids.indexOf(String(dragged.id)), ids.indexOf(String(over.id)))
    reorder.mutate([...next, ...archivedIds])
  }

  const open = (habit: Habit) => {
    if (Date.now() - lastDragEnd.current < 400) return
    navigate(`/tracker/${habit.id}`)
  }

  const loading = habitsQuery.isPending || logsQuery.isPending
  const failed = habitsQuery.isError || logsQuery.isError

  return (
    <div className={`${ui.page} ${s.page}`}>
      <PageHeader title={t('titles.tracker')} showSettings />

      {failed ? (
        <div className={ui.empty}>
          <p>{t('errors.loadFailed')}</p>
          <button
            type="button"
            className={ui.btnPlain}
            onClick={() => {
              void habitsQuery.refetch()
              void logsQuery.refetch()
            }}
          >
            {t('common.retry')}
          </button>
        </div>
      ) : loading ? (
        <Spinner />
      ) : !active.length ? (
        <div className={ui.empty}>
          <p>{t('agenda.noHabitsYet')}</p>
          <p>
            <Link to="/habits/new">{t('agenda.createHabit')}</Link>
          </p>
        </div>
      ) : (
        <>
          <div className={s.progressBlock}>
            <div className={s.progressText}>
              <span>{t('tracker.progress', { done, total: due.length })}</span>
              {due.length && done === due.length ? <span aria-hidden>🎉</span> : null}
            </div>
            <div className={s.progressTrack} role="progressbar" aria-valuemin={0} aria-valuemax={due.length} aria-valuenow={done}>
              <span style={{ '--p': progress } as CSSProperties} />
            </div>
          </div>

          <div className={s.toolbar}>
            <button type="button" className={s.sortButton} onClick={() => setSortOpen(true)}>
              <ArrowUpDown size={16} />
              {t(`tracker.sort.${sort}`)}
            </button>
            <div className={s.columns}>
              <Segmented<'1' | '2'>
                value={String(columns) as '1' | '2'}
                ariaLabel={t('tracker.columns')}
                onChange={(v) => updateSettings.mutate({ tracker_columns: Number(v) })}
                options={[
                  { value: '1', label: <Square size={16} aria-label={t('tracker.oneColumn')} /> },
                  { value: '2', label: <LayoutGrid size={16} aria-label={t('tracker.twoColumns')} /> },
                ]}
              />
            </div>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={ordered.map((h) => h.id)} strategy={rectSortingStrategy}>
              <div className={`${s.grid} ${columns === 2 ? s.grid2 : ''}`}>
                {ordered.map((habit) => (
                  <TrackerCard
                    key={habit.id}
                    habit={habit}
                    logs={logsFor(index, habit.id)}
                    today={today}
                    stats={stats.get(habit.id)}
                    columns={columns}
                    actionable={actionable.has(habit.id)}
                    sortable={sort === 'manual'}
                    onOpen={open}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <p className={ui.sectionFooter}>{sort === 'manual' ? t('tracker.dragHint') : t('tracker.autoHint')}</p>
        </>
      )}

      <BottomSheet open={sortOpen} onClose={() => setSortOpen(false)} title={t('tracker.sortTitle')}>
        <div className={ui.group}>
          {SORTS.map((mode) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={mode === sort}
              className={ui.rowButton}
              onClick={() => {
                updateSettings.mutate({ tracker_sort: mode })
                setSortOpen(false)
              }}
            >
              <span className={ui.rowLabel}>{t(`tracker.sort.${mode}`)}</span>
              {mode === sort ? <Check size={20} className={s.sortCheck} /> : null}
            </button>
          ))}
        </div>
        <p className={ui.sectionFooter}>{t('tracker.sortHint')}</p>
      </BottomSheet>
    </div>
  )
}
