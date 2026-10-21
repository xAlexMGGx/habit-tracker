import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import type { TodoPriority } from '../lib/database.types'
import { PRIORITIES, PRIORITY_COLOR } from '../lib/todoMeta'
import s from './PriorityPicker.module.css'

type Props = {
  value: TodoPriority
  onChange: (priority: TodoPriority) => void
}

/** Traffic light: red (high) > orange (medium) > green (low). */
export function PriorityPicker({ value, onChange }: Props) {
  const { t } = useTranslation()
  return (
    <div className={s.picker} role="radiogroup" aria-label={t('agenda.priority')}>
      {PRIORITIES.map((p) => (
        <button
          key={p}
          type="button"
          role="radio"
          aria-checked={value === p}
          className={`${s.option} ${value === p ? s.on : ''}`}
          style={{ '--p': PRIORITY_COLOR[p] } as CSSProperties}
          onClick={() => onChange(p)}
        >
          <span className={s.dot} />
          <span>{t(`agenda.priorities.${p}`)}</span>
        </button>
      ))}
    </div>
  )
}
