import { Check, Minus, Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { HABIT_COLORS, SUGGESTED_EMOJIS, habitColorStyle } from '../lib/habitMeta'
import ui from '../styles/ui.module.css'
import s from './controls.module.css'

export function Spinner() {
  return (
    <div className={ui.spinnerWrap}>
      <div className={ui.spinner} role="status" />
    </div>
  )
}

type SegmentedProps<T extends string> = {
  value: T
  options: { value: T; label: ReactNode; disabled?: boolean }[]
  onChange: (value: T) => void
  disabled?: boolean
  ariaLabel?: string
}

export function Segmented<T extends string>({ value, options, onChange, disabled, ariaLabel }: SegmentedProps<T>) {
  return (
    <div className={s.segmented} role="tablist" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          className={`${s.segment} ${o.value === value ? s.segmentActive : ''}`}
          disabled={disabled || o.disabled}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

type SwitchProps = { checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean; label: string }

export function Switch({ checked, onChange, disabled, label }: SwitchProps) {
  return (
    <label className={s.switch}>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className={s.switchTrack} aria-hidden />
    </label>
  )
}

type StepperProps = { value: number; min: number; max: number; onChange: (value: number) => void; label?: string }

export function Stepper({ value, min, max, onChange, label }: StepperProps) {
  return (
    <div className={s.stepper} aria-label={label}>
      <button type="button" aria-label="−" disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>
        <Minus size={18} />
      </button>
      <span className={s.stepperValue}>{value}</span>
      <button type="button" aria-label="+" disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>
        <Plus size={18} />
      </button>
    </div>
  )
}

type WeekdayPickerProps = {
  value: number[]
  onChange: (days: number[]) => void
  /** Maximum number of selected days (times per week). */
  max?: number
}

/** Seven round toggles, Monday first. Values are ISO weekdays (1 = Monday). */
export function WeekdayPicker({ value, onChange, max }: WeekdayPickerProps) {
  const { t } = useTranslation()
  const initials = t('weekdays.initials', { returnObjects: true }) as string[]
  const full = max != null && value.length >= max
  return (
    <div className={s.weekdays}>
      {initials.map((initial, i) => {
        const day = i + 1
        const on = value.includes(day)
        return (
          <button
            key={day}
            type="button"
            aria-pressed={on}
            className={`${s.weekday} ${on ? s.weekdayOn : ''}`}
            disabled={!on && full}
            onClick={() => onChange(on ? value.filter((d) => d !== day) : [...value, day].sort((a, b) => a - b))}
          >
            {initial}
          </button>
        )
      })}
    </div>
  )
}

export function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const { t } = useTranslation()
  return (
    <div className={s.colors} role="radiogroup">
      {HABIT_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={c === value}
          aria-label={t(`colors.${c}`)}
          className={s.color}
          style={habitColorStyle(c)}
          onClick={() => onChange(c)}
        >
          {c === value ? <Check size={18} strokeWidth={3} /> : null}
        </button>
      ))}
    </div>
  )
}

function firstGrapheme(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return ''
  if ('Segmenter' in Intl) {
    const it = new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(trimmed)[Symbol.iterator]().next()
    return it.done ? '' : it.value.segment
  }
  return Array.from(trimmed)[0] ?? ''
}

export function EmojiPicker({ value, onChange }: { value: string; onChange: (emoji: string) => void }) {
  const { t } = useTranslation()
  const custom = SUGGESTED_EMOJIS.includes(value) ? '' : value
  return (
    <div>
      <div className={s.emojis}>
        {SUGGESTED_EMOJIS.map((e) => (
          <button
            key={e}
            type="button"
            aria-pressed={e === value}
            className={`${s.emoji} ${e === value ? s.emojiOn : ''}`}
            onClick={() => onChange(e)}
          >
            {e}
          </button>
        ))}
      </div>
      <label className={s.customEmoji}>
        <span>{t('habits.fields.customIcon')}</span>
        <input
          className={`${s.customEmojiInput} ${custom ? s.emojiOn : ''}`}
          value={custom}
          inputMode="text"
          enterKeyHint="done"
          onChange={(e) => {
            const g = firstGrapheme(e.target.value.replace(custom, '')) || firstGrapheme(e.target.value)
            if (g) onChange(g)
          }}
        />
      </label>
    </div>
  )
}

export function HabitIcon({ icon, color, size = 'md' }: { icon: string; color: string; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={`${s.habitIcon} ${s[size]}`} style={habitColorStyle(color)} aria-hidden>
      {icon}
    </span>
  )
}
