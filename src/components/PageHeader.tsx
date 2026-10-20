import { Settings } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import s from './PageHeader.module.css'

type Props = {
  title: string
  subtitle?: ReactNode
  left?: ReactNode
  right?: ReactNode
  /** Gear icon linking to Ajustes (top right on every tab). */
  showSettings?: boolean
  /** "inline" puts a small centered title in the bar (forms, modal-like pages). */
  variant?: 'large' | 'inline'
}

export function PageHeader({ title, subtitle, left, right, showSettings, variant = 'large' }: Props) {
  const { t } = useTranslation()
  const settings = showSettings ? (
    <Link to="/settings" className={s.gear} aria-label={t('common.settings')}>
      <Settings size={24} strokeWidth={1.8} />
    </Link>
  ) : null

  if (variant === 'inline') {
    return (
      <header className={`${s.header} ${s.inline}`}>
        <div className={s.bar}>
          <div className={s.left}>{left}</div>
          <h1 className={s.inlineTitle}>{title}</h1>
          <div className={s.right}>
            {right}
            {settings}
          </div>
        </div>
      </header>
    )
  }

  return (
    <header className={s.header}>
      <div className={s.bar}>
        <div className={s.left}>{left}</div>
        <div className={s.right}>
          {right}
          {settings}
        </div>
      </div>
      <h1 className={s.title}>{title}</h1>
      {subtitle ? <p className={s.subtitle}>{subtitle}</p> : null}
    </header>
  )
}
