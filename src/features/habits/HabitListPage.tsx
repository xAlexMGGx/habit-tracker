import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronDown, ChevronRight, CircleHelp, Menu, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useConfirm } from '../../components/ConfirmProvider'
import { PageHeader } from '../../components/PageHeader'
import { HabitIcon, Spinner } from '../../components/controls'
import { useDeleteHabit, useHabits, useReorderHabits, useSetArchived } from '../../data/habits'
import { useDateLocale } from '../../i18n'
import type { Habit } from '../../lib/database.types'
import { frequencySummary, targetSummary } from '../../lib/format'
import ui from '../../styles/ui.module.css'
import { VizGuide } from '../viz/VizGuide'
import s from './Habits.module.css'

function SortableHabitRow({ habit }: { habit: Habit }) {
  const { t, i18n } = useTranslation()
  const locale = useDateLocale()
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: habit.id,
  })
  const summary = [targetSummary(habit, t, i18n.language), frequencySummary(habit, t, locale)].filter(Boolean).join(' · ')

  return (
    <div
      ref={setNodeRef}
      className={`${ui.row} ${s.habitRow} ${isDragging ? s.dragging : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <Link to={`/habits/${habit.id}`} className={s.habitLink}>
        <HabitIcon icon={habit.icon} color={habit.color} />
        <span className={s.habitText}>
          <span className={s.habitName}>{habit.name}</span>
          <span className={s.habitSummary}>{summary}</span>
        </span>
      </Link>
      <button
        type="button"
        ref={setActivatorNodeRef}
        className={s.handle}
        aria-label={t('habits.dragHandle')}
        {...attributes}
        {...listeners}
      >
        <Menu size={22} />
      </button>
    </div>
  )
}

function ArchivedSection({ habits }: { habits: Habit[] }) {
  const { t } = useTranslation()
  const confirm = useConfirm()
  const setArchived = useSetArchived()
  const remove = useDeleteHabit()
  const [open, setOpen] = useState(false)

  const deleteForever = async (habit: Habit) => {
    // Double confirmation (SPEC §9).
    const first = await confirm({
      title: t('habits.deleteConfirmTitle', { name: habit.name }),
      message: t('habits.deleteConfirmBody'),
      confirmLabel: t('common.delete'),
      destructive: true,
    })
    if (!first) return
    const second = await confirm({
      title: t('habits.deleteConfirmTitle2'),
      message: t('habits.deleteConfirmBody2'),
      confirmLabel: t('habits.deleteConfirm2'),
      destructive: true,
    })
    if (second) remove.mutate(habit.id)
  }

  if (!habits.length) return null

  return (
    <div className={ui.section}>
      <button type="button" className={s.archivedToggle} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        {t('habits.archived')} ({habits.length})
      </button>
      {open ? (
        <div className={ui.group}>
          {habits.map((habit) => (
            <div key={habit.id} className={`${ui.row} ${s.archivedRow}`}>
              <HabitIcon icon={habit.icon} color={habit.color} size="sm" />
              <span className={`${ui.rowLabel} ${s.habitName}`}>{habit.name}</span>
              <button
                type="button"
                className={s.restore}
                onClick={() => setArchived.mutate({ id: habit.id, archived: false })}
              >
                {t('habits.restore')}
              </button>
              <button
                type="button"
                className={`${ui.iconBtn} ${ui.danger}`}
                aria-label={t('habits.deleteForever')}
                onClick={() => deleteForever(habit)}
              >
                <Trash2 size={19} />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function HabitListPage() {
  const { t } = useTranslation()
  const habitsQuery = useHabits()
  const reorder = useReorderHabits()
  const [guideOpen, setGuideOpen] = useState(false)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const all = habitsQuery.data
  const active = useMemo(() => (all ?? []).filter((h) => !h.archived_at), [all])
  const archived = useMemo(
    () => (all ?? []).filter((h) => h.archived_at).sort((a, b) => b.archived_at!.localeCompare(a.archived_at!)),
    [all],
  )

  const onDragEnd = ({ active: dragged, over }: DragEndEvent) => {
    if (!over || dragged.id === over.id) return
    const ids = active.map((h) => h.id)
    const next = arrayMove(ids, ids.indexOf(String(dragged.id)), ids.indexOf(String(over.id)))
    // Archived habits keep their place after the active ones.
    reorder.mutate([...next, ...archived.map((h) => h.id)])
  }

  return (
    <div className={ui.page}>
      <PageHeader
        title={t('titles.habits')}
        showSettings
        right={
          <>
            <button type="button" className={ui.iconBtn} onClick={() => setGuideOpen(true)} aria-label={t('guide.title')}>
              <CircleHelp size={23} strokeWidth={1.8} />
            </button>
            <Link to="/habits/new" className={ui.iconBtn} aria-label={t('habits.new')}>
              <Plus size={26} />
            </Link>
          </>
        }
      />

      {habitsQuery.isPending ? (
        <Spinner />
      ) : habitsQuery.isError ? (
        <div className={ui.empty}>
          <p>{t('errors.loadFailed')}</p>
          <button type="button" className={ui.btnPlain} onClick={() => void habitsQuery.refetch()}>
            {t('common.retry')}
          </button>
        </div>
      ) : (
        <>
          {active.length ? (
            <div className={ui.section}>
              <div className={ui.group}>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                  onDragEnd={onDragEnd}
                >
                  <SortableContext items={active.map((h) => h.id)} strategy={verticalListSortingStrategy}>
                    {active.map((habit) => (
                      <SortableHabitRow key={habit.id} habit={habit} />
                    ))}
                  </SortableContext>
                </DndContext>
              </div>
              {active.length > 1 ? <p className={ui.sectionFooter}>{t('habits.reorderHint')}</p> : null}
            </div>
          ) : (
            <div className={ui.empty}>
              <p>{t('habits.empty')}</p>
              <p>{t('habits.emptyHint')}</p>
            </div>
          )}
          <ArchivedSection habits={archived} />
        </>
      )}
      <VizGuide open={guideOpen} onClose={() => setGuideOpen(false)} />
    </div>
  )
}
