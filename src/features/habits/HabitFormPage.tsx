import { Archive, Bell, CircleHelp, Plus, X } from 'lucide-react'
import { type FormEvent, type ReactNode, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router'
import { useConfirm } from '../../components/ConfirmProvider'
import { PageHeader } from '../../components/PageHeader'
import { ColorPicker, EmojiPicker, HabitIcon, Segmented, Spinner, Stepper, WeekdayPicker } from '../../components/controls'
import { useUser } from '../../auth/AuthProvider'
import { useCreateHabit, useHabits, useSetArchived, useUpdateHabit } from '../../data/habits'
import { useToday } from '../../hooks/useToday'
import type { FrequencyType, Habit, HabitType, VizType } from '../../lib/database.types'
import { DEFAULT_VIZ, HABIT_TYPES, frequenciesFor } from '../../lib/habitMeta'
import { type JarPeriod, periodEnd, periodStart, suggestedCapacity } from '../../lib/jar'
import { newId } from '../../lib/platform'
import { usePush } from '../../lib/push'
import { sampleHabit, sampleLogs } from '../../lib/sampleData'
import { showToast } from '../../lib/toast'
import {
  type BarsRange,
  type RingPeriod,
  type VizConfig,
  availableViz,
  readVizConfig,
  writeVizConfig,
} from '../../lib/vizConfig'
import ui from '../../styles/ui.module.css'
import { HabitViz } from '../viz/HabitViz'
import { VizGuide } from '../viz/VizGuide'
import s from './Habits.module.css'

type FormState = {
  name: string
  icon: string
  color: string
  type: HabitType
  target: string
  unit: string
  quickStep: string
  frequency: FrequencyType
  weekdays: number[]
  times: number
  planned: number[]
  interval: number
  startDate: string
  /** Reminder times, 'HH:MM' */
  reminders: string[]
  viz: VizType
  /** Ring, bars and jar period. Jar capacity and marble value are edited as text below. */
  vizConfig: VizConfig
  capacityMode: 'all' | 'most' | 'custom'
  customCapacity: string
  marbleValue: string
}

type Errors = Partial<
  Record<'name' | 'icon' | 'target' | 'quickStep' | 'days' | 'interval' | 'startDate' | 'capacity', string>
>

const toNumber = (text: string) => Number(text.trim().replace(',', '.'))

const MAX_REMINDERS = 10
/** Times offered when adding a reminder (the first one not already used). */
const DEFAULT_TIMES = ['09:00', '14:00', '21:00', '07:00', '11:00', '17:00', '19:00', '23:00', '10:00', '16:00']

function jarFields(config: VizConfig): Pick<FormState, 'capacityMode' | 'customCapacity' | 'marbleValue'> {
  return {
    capacityMode: typeof config.jarCapacity === 'number' ? 'custom' : config.jarCapacity,
    customCapacity: typeof config.jarCapacity === 'number' ? String(config.jarCapacity) : '',
    marbleValue: config.jarMarbleValue != null ? String(config.jarMarbleValue) : '',
  }
}

/** The visualization parameters as they will be saved. */
function buildVizConfig(form: FormState): VizConfig {
  const custom = Math.round(toNumber(form.customCapacity))
  const value = toNumber(form.marbleValue)
  return {
    ...form.vizConfig,
    jarCapacity: form.capacityMode === 'custom' ? (custom >= 1 ? custom : 'all') : form.capacityMode,
    jarMarbleValue: form.type === 'quantitative' && value > 0 ? value : null,
  }
}

function initialState(habit: Habit | null, today: string): FormState {
  if (!habit) {
    const vizConfig = readVizConfig(null)
    return {
      name: '',
      icon: '✅',
      color: 'blue',
      type: 'boolean',
      target: '',
      unit: '',
      quickStep: '1',
      frequency: 'daily',
      weekdays: [1, 2, 3, 4, 5],
      times: 3,
      planned: [1, 3, 5],
      interval: 2,
      startDate: today,
      reminders: [],
      viz: DEFAULT_VIZ.boolean,
      vizConfig,
      ...jarFields(vizConfig),
    }
  }
  const vizConfig = readVizConfig(habit.viz_config)
  return {
    name: habit.name,
    icon: habit.icon,
    color: habit.color,
    type: habit.type,
    target: habit.target != null ? String(habit.target) : '',
    unit: habit.unit ?? '',
    quickStep: String(habit.quick_step),
    frequency: habit.frequency_type,
    weekdays: habit.frequency_type === 'weekdays' ? (habit.frequency_days ?? []) : [1, 2, 3, 4, 5],
    times: habit.frequency_times ?? 3,
    planned: habit.frequency_type === 'times_per_week' ? (habit.frequency_days ?? []) : [1, 3, 5],
    interval: habit.frequency_interval ?? 2,
    startDate: habit.start_date,
    reminders: habit.reminder_times.map((t) => t.slice(0, 5)),
    viz: habit.viz_type,
    vizConfig,
    ...jarFields(vizConfig),
  }
}

function Section({ title, footer, children }: { title?: string; footer?: ReactNode; children: ReactNode }) {
  return (
    <div className={ui.section}>
      {title ? <h2 className={ui.sectionTitle}>{title}</h2> : null}
      {children}
      {footer ? <p className={ui.sectionFooter}>{footer}</p> : null}
    </div>
  )
}

function HabitForm({ habit }: { habit: Habit | null }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const today = useToday()
  const confirm = useConfirm()
  const user = useUser()
  const push = usePush(user.id)
  const habits = useHabits().data ?? []
  const create = useCreateHabit()
  const update = useUpdateHabit()
  const setArchived = useSetArchived()

  const [form, setForm] = useState(() => initialState(habit, today))
  // Until the user picks a visualization, it follows the type's default.
  const [vizChosen, setVizChosen] = useState(habit != null)
  // Errors show after the first save attempt and then update as the user fixes them.
  const [attempted, setAttempted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [guideOpen, setGuideOpen] = useState(false)
  const saving = create.isPending || update.isPending
  const isNew = habit == null

  // Live preview of the chosen visualization with sample data shaped like this habit.
  const targetNumber = toNumber(form.target)
  const preview = useMemo(() => {
    const h = sampleHabit(today, {
      type: form.type,
      icon: form.icon,
      color: form.color,
      unit: form.unit || null,
      target: form.type === 'quantitative' ? (targetNumber > 0 ? targetNumber : 8) : null,
      frequency_type: form.frequency,
      frequency_days: form.frequency === 'weekdays' ? form.weekdays : form.frequency === 'times_per_week' ? form.planned : null,
      frequency_times: form.frequency === 'times_per_week' ? form.times : null,
      frequency_interval: form.frequency === 'every_n_days' ? form.interval : null,
    })
    return { habit: h, logs: sampleLogs(h, today) }
  }, [today, form.type, form.icon, form.color, form.unit, targetNumber, form.frequency, form.weekdays, form.planned, form.times, form.interval])

  const vizOptions = availableViz(form.type)
  const vizConfig = buildVizConfig(form)

  // Suggested jar capacities for a whole period (they adjust by themselves, e.g. 28–31 days).
  const jarSuggestions = useMemo(() => {
    const h = {
      ...preview.habit,
      target: form.type === 'quantitative' ? (targetNumber > 0 ? targetNumber : 1) : null,
      start_date: '2000-01-01',
    }
    const start = periodStart(today, vizConfig.jarPeriod)
    const end = periodEnd(start, vizConfig.jarPeriod)
    return {
      all: suggestedCapacity(h, vizConfig, start, end, 'all'),
      most: suggestedCapacity(h, vizConfig, start, end, 'most'),
    }
  }, [preview.habit, form.type, targetNumber, today, vizConfig])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }))

  const goBack = () => (location.key === 'default' ? navigate('/habits', { replace: true }) : navigate(-1))

  const changeType = (type: HabitType) =>
    setForm((f) => ({
      ...f,
      type,
      viz: vizChosen && availableViz(type).includes(f.viz) ? f.viz : DEFAULT_VIZ[type],
      frequency: frequenciesFor(type).includes(f.frequency) ? f.frequency : 'daily',
    }))

  const changeTimes = (times: number) =>
    setForm((f) => ({ ...f, times, planned: f.planned.slice(0, times) }))

  const validate = (): Errors => {
    const e: Errors = {}
    if (!form.name.trim()) e.name = t('habits.errors.nameRequired')
    if (!form.icon) e.icon = t('habits.errors.iconRequired')
    if (form.type === 'quantitative') {
      if (!(toNumber(form.target) > 0)) e.target = t('habits.errors.targetRequired')
      if (!(toNumber(form.quickStep) > 0)) e.quickStep = t('habits.errors.stepRequired')
    }
    if (form.frequency === 'weekdays' && !form.weekdays.length) e.days = t('habits.errors.daysRequired')
    if (form.frequency === 'times_per_week' && form.planned.length !== form.times)
      e.days = t('habits.errors.selectExactly', { count: form.times })
    if (form.frequency === 'every_n_days' && !(form.interval >= 2 && form.interval <= 365))
      e.interval = t('habits.errors.intervalRange')
    if (!form.startDate) e.startDate = t('habits.errors.startDateRequired')
    if (form.viz === 'marble_jar' && form.capacityMode === 'custom' && !(Math.round(toNumber(form.customCapacity)) >= 1))
      e.capacity = t('habits.errors.capacityRequired')
    return e
  }

  const errors: Errors = attempted ? validate() : {}

  const submit = async (event?: FormEvent) => {
    event?.preventDefault()
    setAttempted(true)
    setSubmitError(null)
    if (Object.keys(validate()).length) return

    const quantitative = form.type === 'quantitative'
    const values = {
      name: form.name.trim(),
      icon: form.icon,
      color: form.color,
      target: quantitative ? toNumber(form.target) : null,
      unit: quantitative ? form.unit.trim() || null : null,
      quick_step: quantitative ? toNumber(form.quickStep) : 1,
      frequency_type: form.frequency,
      frequency_days:
        form.frequency === 'weekdays' ? form.weekdays : form.frequency === 'times_per_week' ? form.planned : null,
      frequency_times: form.frequency === 'times_per_week' ? form.times : null,
      frequency_interval: form.frequency === 'every_n_days' ? form.interval : null,
      start_date: form.startDate,
      reminder_times: [...new Set(form.reminders.filter(Boolean))].sort(),
      viz_type: form.viz,
      viz_config: writeVizConfig(habit?.viz_config, vizConfig),
    }

    try {
      if (isNew) {
        const maxOrder = Math.max(0, ...habits.map((h) => h.sort_order))
        await create.mutateAsync({ ...values, id: newId(), type: form.type, sort_order: maxOrder + 1 })
      } else {
        await update.mutateAsync({ id: habit.id, patch: values })
      }
      goBack()
    } catch {
      setSubmitError(t('errors.saveFailed'))
    }
  }

  const archive = async () => {
    if (!habit) return
    const ok = await confirm({
      title: t('habits.archiveConfirmTitle', { name: habit.name }),
      message: t('habits.archiveConfirmBody'),
      confirmLabel: t('habits.archive'),
    })
    if (!ok) return
    setArchived.mutate({ id: habit.id, archived: true })
    showToast({ message: t('habits.archivedToast') })
    navigate('/habits', { replace: true })
  }

  return (
    <form className={ui.pageNoTabs} onSubmit={submit} noValidate>
      <PageHeader
        variant="inline"
        title={isNew ? t('habits.new') : t('habits.edit')}
        left={
          <button type="button" className={ui.btnPlain} onClick={goBack}>
            {t('common.cancel')}
          </button>
        }
        right={
          <button type="submit" className={`${ui.btnPlain} ${s.saveBtn}`} disabled={saving}>
            {t('common.save')}
          </button>
        }
      />

      <div className={s.preview}>
        <HabitIcon icon={form.icon || '·'} color={form.color} size="lg" />
        <span className={s.previewName}>{form.name.trim() || t('habits.fields.namePlaceholder')}</span>
      </div>

      <Section title={t('habits.fields.name')}>
        <div className={ui.group}>
          <div className={ui.row}>
            <input
              className={`${ui.rowInput} ${ui.left}`}
              value={form.name}
              maxLength={60}
              placeholder={t('habits.fields.namePlaceholder')}
              autoCapitalize="sentences"
              enterKeyHint="done"
              onChange={(e) => set('name', e.target.value)}
            />
          </div>
        </div>
        {errors.name ? <p className={ui.error}>{errors.name}</p> : null}
      </Section>

      <Section title={t('habits.fields.icon')}>
        <div className={`${ui.group} ${s.padded}`}>
          <EmojiPicker value={form.icon} onChange={(v) => set('icon', v)} />
        </div>
        {errors.icon ? <p className={ui.error}>{errors.icon}</p> : null}
      </Section>

      <Section title={t('habits.fields.color')}>
        <div className={`${ui.group} ${s.padded}`}>
          <ColorPicker value={form.color} onChange={(v) => set('color', v)} />
        </div>
      </Section>

      <Section
        title={t('habits.fields.type')}
        footer={isNew ? t(`habits.types.${form.type}Hint`) : t('habits.fields.typeLocked')}
      >
        <div className={s.inset}>
          <Segmented<HabitType>
            value={form.type}
            disabled={!isNew}
            onChange={changeType}
            options={HABIT_TYPES.map((type) => ({ value: type, label: t(`habits.types.${type}`) }))}
          />
        </div>
      </Section>

      {form.type === 'quantitative' ? (
        <Section>
          <div className={ui.group}>
            <label className={ui.row}>
              <span className={ui.rowLabel}>{t('habits.fields.target')}</span>
              <input
                className={ui.rowInput}
                inputMode="decimal"
                value={form.target}
                placeholder="8"
                onChange={(e) => set('target', e.target.value.replace(/[^\d.,]/g, ''))}
              />
            </label>
            <label className={ui.row}>
              <span className={ui.rowLabel}>{t('habits.fields.unit')}</span>
              <input
                className={ui.rowInput}
                value={form.unit}
                maxLength={20}
                placeholder={t('habits.fields.unitPlaceholder')}
                onChange={(e) => set('unit', e.target.value)}
              />
            </label>
            <label className={ui.row}>
              <span className={ui.rowLabel}>{t('habits.fields.quickStep')}</span>
              <input
                className={ui.rowInput}
                inputMode="decimal"
                value={form.quickStep}
                onChange={(e) => set('quickStep', e.target.value.replace(/[^\d.,]/g, ''))}
              />
            </label>
          </div>
          {errors.target ? <p className={ui.error}>{errors.target}</p> : null}
          {errors.quickStep ? <p className={ui.error}>{errors.quickStep}</p> : null}
        </Section>
      ) : null}

      <Section
        title={t('habits.fields.frequency')}
        footer={form.frequency === 'times_per_week' ? t('habits.fields.plannedDaysHint') : null}
      >
        <div className={s.frequencyOptions} role="radiogroup">
          {frequenciesFor(form.type).map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={form.frequency === f}
              className={`${s.chip} ${form.frequency === f ? s.chipOn : ''}`}
              onClick={() => set('frequency', f)}
            >
              {t(`habits.frequency.${f}`)}
            </button>
          ))}
        </div>

        {form.frequency === 'weekdays' ? (
          <div className={`${ui.group} ${s.padded} ${s.frequencyDetail}`}>
            <p className={s.fieldLabel}>{t('habits.fields.weekdays')}</p>
            <WeekdayPicker value={form.weekdays} onChange={(v) => set('weekdays', v)} />
          </div>
        ) : null}

        {form.frequency === 'times_per_week' ? (
          <div className={`${ui.group} ${s.frequencyDetail}`}>
            <div className={ui.row}>
              <span className={ui.rowLabel}>{t('habits.fields.timesPerWeek')}</span>
              <Stepper value={form.times} min={1} max={6} onChange={changeTimes} />
            </div>
            <div className={`${ui.row} ${s.column}`}>
              <p className={s.fieldLabel}>
                {t('habits.fields.plannedDays')} ({form.planned.length}/{form.times})
              </p>
              <WeekdayPicker value={form.planned} max={form.times} onChange={(v) => set('planned', v)} />
            </div>
          </div>
        ) : null}

        {form.frequency === 'every_n_days' ? (
          <div className={`${ui.group} ${s.frequencyDetail}`}>
            <div className={ui.row}>
              <span className={ui.rowLabel}>{t('habits.fields.interval')}</span>
              <Stepper value={form.interval} min={2} max={365} onChange={(v) => set('interval', v)} />
            </div>
          </div>
        ) : null}

        {errors.days ? <p className={ui.error}>{errors.days}</p> : null}
        {errors.interval ? <p className={ui.error}>{errors.interval}</p> : null}
      </Section>

      <Section
        title={t('habits.fields.reminders')}
        footer={[
          form.type === 'negative' ? t('habits.fields.remindersHintNegative') : t('habits.fields.remindersHint'),
          form.reminders.length && push.status !== 'on' && push.status !== 'loading' ? t('habits.fields.remindersOff') : '',
        ].join(' ')}
      >
        <div className={ui.group}>
          {form.reminders.map((time, i) => (
            <div key={i} className={ui.row}>
              <Bell size={18} className={ui.muted} />
              <input
                type="time"
                className={`${ui.rowInput} ${ui.left} ${s.timeInput}`}
                value={time}
                aria-label={t('habits.fields.reminders')}
                onChange={(e) => set('reminders', form.reminders.map((x, j) => (j === i ? e.target.value : x)))}
              />
              <button
                type="button"
                className={`${ui.iconBtn} ${ui.danger}`}
                aria-label={t('habits.fields.removeReminder')}
                onClick={() => set('reminders', form.reminders.filter((_, j) => j !== i))}
              >
                <X size={18} />
              </button>
            </div>
          ))}
          {form.reminders.length < MAX_REMINDERS ? (
            <button
              type="button"
              className={ui.rowButton}
              onClick={() => set('reminders', [...form.reminders, DEFAULT_TIMES.find((d) => !form.reminders.includes(d)) ?? '09:00'])}
            >
              <Plus size={18} className={s.addIcon} />
              <span className={`${ui.rowLabel} ${s.addLabel}`}>{t('habits.fields.addReminder')}</span>
            </button>
          ) : null}
        </div>
      </Section>

      <Section footer={t('habits.fields.startDateHint')}>
        <div className={ui.group}>
          <label className={ui.row}>
            <span className={ui.rowLabel}>{t('habits.fields.startDate')}</span>
            <input
              type="date"
              className={`${ui.rowInput} ${s.dateInput}`}
              value={form.startDate}
              onChange={(e) => set('startDate', e.target.value)}
            />
          </label>
        </div>
        {errors.startDate ? <p className={ui.error}>{errors.startDate}</p> : null}
      </Section>

      <div className={ui.section}>
        <div className={s.vizTitle}>
          <h2 className={ui.sectionTitle}>{t('habits.fields.viz')}</h2>
          <button type="button" className={s.helpBtn} onClick={() => setGuideOpen(true)} aria-label={t('guide.title')}>
            <CircleHelp size={22} />
          </button>
        </div>

        <div className={s.previewCard}>
          <span className={s.previewLabel}>{t('habits.fields.vizPreview')}</span>
          <HabitViz habit={preview.habit} logs={preview.logs} today={today} size="regular" config={vizConfig} viz={form.viz} />
        </div>

        <div className={ui.group} role="radiogroup">
          {vizOptions.map((viz) => (
            <button
              key={viz}
              type="button"
              role="radio"
              aria-checked={form.viz === viz}
              className={ui.rowButton}
              onClick={() => {
                setVizChosen(true)
                set('viz', viz)
              }}
            >
              <span className={ui.rowLabel}>{t(`habits.viz.${viz}`)}</span>
              <span className={`${s.radio} ${form.viz === viz ? s.radioOn : ''}`} />
            </button>
          ))}
        </div>

        {form.viz === 'ring' ? (
          <div className={`${ui.group} ${s.vizParams}`}>
            <div className={ui.row}>
              <span className={ui.rowLabel}>{t('habits.fields.ringPeriod')}</span>
              <div className={s.paramControl}>
                <Segmented<RingPeriod>
                  value={form.vizConfig.ringPeriod}
                  onChange={(ringPeriod) => set('vizConfig', { ...form.vizConfig, ringPeriod })}
                  options={[
                    { value: 'week', label: t('viz.week') },
                    { value: 'month', label: t('viz.month') },
                  ]}
                />
              </div>
            </div>
          </div>
        ) : null}
        {form.viz === 'bars' ? (
          <div className={`${ui.group} ${s.vizParams}`}>
            <div className={ui.row}>
              <span className={ui.rowLabel}>{t('habits.fields.barsRange')}</span>
              <div className={s.paramControl}>
                <Segmented<'7' | '30'>
                  value={String(form.vizConfig.barsRange) as '7' | '30'}
                  onChange={(v) => set('vizConfig', { ...form.vizConfig, barsRange: Number(v) as BarsRange })}
                  options={[
                    { value: '7', label: '7' },
                    { value: '30', label: '30' },
                  ]}
                />
              </div>
            </div>
          </div>
        ) : null}
        {form.viz === 'marble_jar' ? (
          <>
            <div className={`${ui.group} ${s.vizParams}`}>
              <div className={`${ui.row} ${s.column}`}>
                <p className={s.fieldLabel}>{t('habits.fields.jarPeriod')}</p>
                <Segmented<JarPeriod>
                  value={form.vizConfig.jarPeriod}
                  onChange={(jarPeriod) => set('vizConfig', { ...form.vizConfig, jarPeriod })}
                  options={(['week', 'month', 'quarter', 'year'] as const).map((p) => ({
                    value: p,
                    label: t(`habits.fields.jarPeriods.${p}`),
                  }))}
                />
              </div>
            </div>
            <h3 className={`${ui.sectionTitle} ${s.subTitle}`}>{t('habits.fields.jarCapacity')}</h3>
            <div className={ui.group} role="radiogroup">
              {(['all', 'most'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={form.capacityMode === mode}
                  className={ui.rowButton}
                  onClick={() => set('capacityMode', mode)}
                >
                  <span className={ui.rowLabel}>
                    {t(`habits.fields.capacity_${mode}`)}
                    <span className={s.capacityCount}>{t('habits.fields.marbles', { count: jarSuggestions[mode] })}</span>
                  </span>
                  <span className={`${s.radio} ${form.capacityMode === mode ? s.radioOn : ''}`} />
                </button>
              ))}
              <div
                role="radio"
                aria-checked={form.capacityMode === 'custom'}
                className={ui.row}
                onClick={() => form.capacityMode !== 'custom' && set('capacityMode', 'custom')}
              >
                <span className={ui.rowLabel}>{t('habits.fields.capacity_custom')}</span>
                <input
                  className={`${ui.rowInput} ${s.capacityInput}`}
                  inputMode="numeric"
                  value={form.customCapacity}
                  placeholder={String(jarSuggestions.all)}
                  aria-label={t('habits.fields.capacity_custom')}
                  onFocus={() => set('capacityMode', 'custom')}
                  onChange={(e) => set('customCapacity', e.target.value.replace(/\D/g, ''))}
                />
                <span className={`${s.radio} ${form.capacityMode === 'custom' ? s.radioOn : ''}`} />
              </div>
            </div>
            {errors.capacity ? <p className={ui.error}>{errors.capacity}</p> : null}
            {form.type === 'quantitative' ? (
              <div className={`${ui.group} ${s.vizParams}`}>
                <label className={ui.row}>
                  <span className={ui.rowLabel}>{t('habits.fields.jarMarbleValue')}</span>
                  <input
                    className={ui.rowInput}
                    inputMode="decimal"
                    value={form.marbleValue}
                    placeholder={targetNumber > 0 ? String(targetNumber) : '1'}
                    onChange={(e) => set('marbleValue', e.target.value.replace(/[^\d.,]/g, ''))}
                  />
                  {form.unit.trim() ? <span className={ui.muted}>{form.unit.trim()}</span> : null}
                </label>
              </div>
            ) : null}
            <p className={ui.sectionFooter}>
              {form.type === 'quantitative' ? `${t('habits.fields.jarMarbleHint')} ` : ''}
              {t('habits.fields.jarCapacityHint')}
            </p>
          </>
        ) : null}
        <p className={ui.sectionFooter}>{t('habits.fields.vizHint')}</p>
      </div>

      <VizGuide open={guideOpen} initial={form.viz} onClose={() => setGuideOpen(false)} />

      {submitError ? <p className={ui.error}>{submitError}</p> : null}

      {!isNew ? (
        <Section>
          <div className={ui.group}>
            <button type="button" className={`${ui.rowButton} ${ui.danger}`} onClick={archive}>
              <Archive size={20} />
              <span className={ui.rowLabel}>{t('habits.archive')}</span>
            </button>
          </div>
        </Section>
      ) : null}
    </form>
  )
}

export function HabitFormPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const habitsQuery = useHabits()

  if (!id) return <HabitForm key="new" habit={null} />
  if (habitsQuery.isPending) return <Spinner />
  const habit = habitsQuery.data?.find((h) => h.id === id)
  if (!habit) return <div className={ui.empty}>{t('habits.notFound')}</div>
  return <HabitForm key={habit.id} habit={habit} />
}
