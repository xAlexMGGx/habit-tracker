import { type CSSProperties, type ReactNode, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import s from './BottomSheet.module.css'
import { useKeyboardInset, usePresence } from './usePresence'

type Props = {
  open: boolean
  onClose: () => void
  title?: ReactNode
  subtitle?: ReactNode
  children: ReactNode
}

export function BottomSheet({ open, onClose, title, subtitle, children }: Props) {
  const { t } = useTranslation()
  const { mounted, visible } = usePresence(open)
  const keyboard = useKeyboardInset(mounted)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [open, onClose])

  if (!mounted) return null

  return createPortal(
    <div className={`${s.root} ${visible ? s.visible : ''}`}>
      <div className={s.backdrop} onClick={onClose} />
      <div
        className={s.panel}
        role="dialog"
        aria-modal="true"
        style={{ '--kb': `${keyboard}px` } as CSSProperties}
      >
        <div className={s.grabber} />
        {title ? (
          <div className={s.head}>
            <div className={s.headText}>
              <h2 className={s.title}>{title}</h2>
              {subtitle ? <p className={s.subtitle}>{subtitle}</p> : null}
            </div>
            <button type="button" className={s.close} onClick={onClose}>
              {t('common.done')}
            </button>
          </div>
        ) : null}
        <div className={s.body}>{children}</div>
      </div>
    </div>,
    document.body,
  )
}
