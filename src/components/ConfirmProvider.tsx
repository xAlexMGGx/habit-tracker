import { createContext, type ReactNode, useCallback, useContext, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import s from './ConfirmProvider.module.css'
import { usePresence } from './usePresence'

type ConfirmOptions = {
  title: string
  message?: string
  confirmLabel?: string
  destructive?: boolean
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

/** iOS-style alert. `await confirm({...})` resolves to true when the user confirms. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const [open, setOpen] = useState(false)
  const resolver = useRef<((ok: boolean) => void) | null>(null)
  const { mounted, visible } = usePresence(open, 160)

  const confirm = useCallback<ConfirmFn>((opts) => {
    resolver.current?.(false)
    setOptions(opts)
    setOpen(true)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const close = (ok: boolean) => {
    resolver.current?.(ok)
    resolver.current = null
    setOpen(false)
  }

  return (
    <ConfirmContext value={confirm}>
      {children}
      {mounted && options
        ? createPortal(
            <div className={`${s.root} ${visible ? s.visible : ''}`}>
              <div className={s.backdrop} onClick={() => close(false)} />
              <div className={s.alert} role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
                <div className={s.text}>
                  <h2 id="confirm-title" className={s.title}>
                    {options.title}
                  </h2>
                  {options.message ? <p className={s.message}>{options.message}</p> : null}
                </div>
                <div className={s.actions}>
                  <button type="button" className={s.action} onClick={() => close(false)}>
                    {t('common.cancel')}
                  </button>
                  <button
                    type="button"
                    className={`${s.action} ${s.primary} ${options.destructive ? s.destructive : ''}`}
                    onClick={() => close(true)}
                  >
                    {options.confirmLabel ?? t('common.done')}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </ConfirmContext>
  )
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm outside ConfirmProvider')
  return ctx
}
