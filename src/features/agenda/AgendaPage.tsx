import { CalendarSearch, Lock, Plus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarPicker } from '../../components/CalendarPicker'
import { useConfirm } from '../../components/ConfirmProvider'
import { PageHeader } from '../../components/PageHeader'
import { Segmented, Spinner } from '../../components/controls'
import { useHabits } from '../../data/habits'
import { useHabitLogs, useLogIndex } from '../../data/logs'
import { useSettings, useUpdateSettings } from '../../data/settings'
import { usePendingTodos, useTodosInRange } from '../../data/todos'
import { useToday } from '../../hooks/useToday'
import { useDateLocale } from '../../i18n'
import type { AgendaSubtab, Habit, Todo } from '../../lib/database.types'
import { type DateStr, addDays, isWithinEditWindow, weekStart } from '../../lib/dates'
import { capitalize, longDay, relativeDay } from '../../lib/format'
import { primeKeyboard } from '../../lib/platform'
import { countCompleted, habitsForDay, logsFor } from '../../lib/schedule'
import ui from '../../styles/ui.module.css'
import s from './Agenda.module.css'
import { DayStrip } from './DayStrip'
import { HabitsView } from './HabitsView'
import { QuickAddSheet } from './QuickAddSheet'
import { TodoSheet } from './TodoSheet'
import { TodosView } from './TodosView'
import { ValueSheet } from './ValueSheet'

export function AgendaPage() {
  const { t } = useTranslation()
  const locale = useDateLocale()
  const today = useToday()
  const confirm = useConfirm()

  // Always opens on today (SPEC §5).
  const [selected, setSelected] = useState<DateStr>(today)
  // A day older than the edit window, unlocked while the user stays on it.
  const [unlocked, setUnlocked] = useState<DateStr | null>(null)
  const [openTodo, setOpenTodo] = useState<Todo | null>(null)
  const [valueHabit, setValueHabit] = useState<Habit | null>(null)
  const [adding, setAdding] = useState(false)
  const [pickingDate, setPickingDate] = useState(false)

  // After midnight, follow the new "today" if the user was looking at the old one.
  const previousToday = useRef(today)
  useEffect(() => {
    const prev = previousToday.current
    previousToday.current = today
    if (prev !== today) setSelected((sel) => (sel === prev ? today : sel))
  }, [today])

  const select = (date: DateStr) => {
    setSelected(date)
    setUnlocked(null)
  }

  const settings = useSettings().data
  const updateSettings = useUpdateSettings()
  const isFutureDay = selected > today
  // Future days have no Hábitos subtab.
  const subtab: AgendaSubtab = isFutureDay ? 'todos' : (settings?.agenda_subtab ?? 'todos')
  const editable = isWithinEditWindow(selected, today) || unlocked === selected

  const monday = weekStart(selected)
  const todosQuery = useTodosInRange(addDays(monday, -7), addDays(monday, 13))
  const pendingQuery = usePendingTodos(today)
  const habitsQuery = useHabits()
  const logsQuery = useHabitLogs()
  const index = useLogIndex()

  const rangeTodos = todosQuery.data
  const dayTodos = useMemo(() => (rangeTodos ?? []).filter((td) => td.due_date === selected), [rangeTodos, selected])
  const marked = useMemo(() => new Set((rangeTodos ?? []).map((td) => td.due_date)), [rangeTodos])

  const habits = habitsQuery.data
  const activeHabits = useMemo(() => (habits ?? []).filter((h) => !h.archived_at), [habits])
  const { due, optional } = useMemo(
    () => (isFutureDay ? { due: [], optional: [] } : habitsForDay(activeHabits, selected, index)),
    [activeHabits, selected, index, isFutureDay],
  )

  const todosDone = dayTodos.filter((td) => td.completed_at).length
  const habitsDone = countCompleted(due, selected, index)

  const unlock = async () => {
    const ok = await confirm({
      title: t('agenda.unlockConfirmTitle'),
      message: t('agenda.unlockConfirmBody'),
      confirmLabel: t('agenda.unlockConfirm'),
    })
    if (ok) setUnlocked(selected)
  }

  const todosTab = `${t('agenda.todos')} ${t('agenda.counter', { done: todosDone, total: dayTodos.length })}`
  const habitsTab = `${t('agenda.habits')} ${t('agenda.counter', { done: habitsDone, total: due.length })}`

  const loading =
    subtab === 'todos' ? todosQuery.isPending : habitsQuery.isPending || logsQuery.isPending
  const failed = subtab === 'todos' ? todosQuery.isError : habitsQuery.isError || logsQuery.isError

  return (
    <div className={ui.page}>
      <PageHeader
        title={t('titles.agenda')}
        subtitle={longDay(selected, today, t, locale)}
        showSettings
        right={
          <>
            {selected !== today ? (
              <button type="button" className={s.todayBtn} onClick={() => select(today)}>
                {t('common.today')}
              </button>
            ) : null}
            <button type="button" className={ui.iconBtn} aria-label={t('agenda.jumpToDate')} onClick={() => setPickingDate(true)}>
              <CalendarSearch size={23} strokeWidth={1.8} />
            </button>
          </>
        }
      />

      <div className={s.sticky}>
        <DayStrip selected={selected} today={today} marked={marked} onSelect={select} />
        <div className={s.subtabs}>
          {isFutureDay ? (
            <p className={s.singleTab}>{todosTab}</p>
          ) : (
            <Segmented<AgendaSubtab>
              value={subtab}
              onChange={(v) => updateSettings.mutate({ agenda_subtab: v })}
              options={[
                { value: 'todos', label: todosTab },
                { value: 'habits', label: habitsTab },
              ]}
            />
          )}
        </div>
      </div>

      {!editable ? (
        <div className={s.banner}>
          <Lock size={18} />
          <span className={s.bannerText}>{t('agenda.lockedTitle')}</span>
          <button type="button" className={s.bannerAction} onClick={unlock}>
            {t('agenda.lockedAction')}
          </button>
        </div>
      ) : null}

      <div className={`${s.content} ${subtab === 'todos' && editable ? s.withFab : ''}`}>
        {failed ? (
          <div className={ui.empty}>
            <p>{t('errors.loadFailed')}</p>
            <button
              type="button"
              className={ui.btnPlain}
              onClick={() => {
                void todosQuery.refetch()
                void habitsQuery.refetch()
                void logsQuery.refetch()
              }}
            >
              {t('common.retry')}
            </button>
          </div>
        ) : loading ? (
          <Spinner />
        ) : subtab === 'todos' ? (
          <TodosView
            todos={dayTodos}
            pending={selected === today ? (pendingQuery.data ?? null) : null}
            editable={editable}
            pendingLabel={(td) => relativeDay(td.due_date, today, t, locale)}
            onOpen={setOpenTodo}
          />
        ) : (
          <HabitsView
            date={selected}
            due={due}
            optional={optional}
            index={index}
            editable={editable}
            hasAnyHabit={activeHabits.length > 0}
            onOpenValue={setValueHabit}
          />
        )}
      </div>

      {subtab === 'todos' && editable ? (
        <button
          type="button"
          className={s.fab}
          aria-label={t('agenda.newTodo')}
          onClick={() => {
            primeKeyboard()
            setAdding(true)
          }}
        >
          <Plus size={28} strokeWidth={2.4} />
        </button>
      ) : null}

      <QuickAddSheet
        open={adding}
        date={selected}
        dateLabel={capitalize(relativeDay(selected, today, t, locale))}
        onClose={() => setAdding(false)}
      />
      <TodoSheet todo={openTodo} onClose={() => setOpenTodo(null)} />
      <CalendarPicker
        open={pickingDate}
        value={selected}
        today={today}
        title={t('agenda.jumpToDate')}
        onClose={() => setPickingDate(false)}
        onSelect={(date) => {
          select(date)
          setPickingDate(false)
        }}
      />
      <ValueSheet
        habit={valueHabit}
        date={selected}
        value={valueHabit ? (logsFor(index, valueHabit.id).get(selected) ?? 0) : 0}
        onClose={() => setValueHabit(null)}
      />
    </div>
  )
}
