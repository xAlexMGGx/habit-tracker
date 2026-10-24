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

type ChoiceAction<T extends string> = { value: T; label: string; destructive?: boolean }

type ChooseOptions<T extends string> = {
  title: string
  message?: string
  /** Shown one under another, with "Cancel" at the bottom. */
  actions: ChoiceAction<T>[]
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>
type ChooseFn = <T extends string>(options: ChooseOptions<T>) => Promise<T | null>

const ChooseContext = createContext<ChooseFn | null>(null)

const OK = 'ok'

/**
 * iOS-style alert. `await confirm({...})` resolves to true when the user confirms;
 * `await choose({...})` resolves to the chosen action, or null on cancel.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const [options, setOptions] = useState<ChooseOptions<string> | null>(null)
  const [open, setOpen] = useState(false)
  const resolver = useRef<((value: string | null) => void) | null>(null)
  const { mounted, visible } = usePresence(open, 160)

  const choose = useCallback(<T extends string>(opts: ChooseOptions<T>) => {
    resolver.current?.(null)
    setOptions(opts)
    setOpen(true)
    return new Promise<T | null>((resolve) => {
      resolver.current = resolve as (value: string | null) => void
    })
  }, []) as ChooseFn

  const close = (value: string | null) => {
    resolver.current?.(value)
    resolver.current = null
    setOpen(false)
  }

  const stacked = (options?.actions.length ?? 0) > 1

  return (
    <ChooseContext value={choose}>
      {children}
      {mounted && options
        ? createPortal(
            <div className={`${s.root} ${visible ? s.visible : ''}`}>
              <div className={s.backdrop} onClick={() => close(null)} />
              <div className={s.alert} role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
                <div className={s.text}>
                  <h2 id="confirm-title" className={s.title}>
                    {options.title}
                  </h2>
                  {options.message ? <p className={s.message}>{options.message}</p> : null}
                </div>
                {stacked ? (
                  <div className={`${s.actions} ${s.stacked}`}>
                    {options.actions.map((a) => (
                      <button
                        key={a.value}
                        type="button"
                        className={`${s.action} ${a.destructive ? s.destructive : ''}`}
                        onClick={() => close(a.value)}
                      >
                        {a.label}
                      </button>
                    ))}
                    <button type="button" className={`${s.action} ${s.primary}`} onClick={() => close(null)}>
                      {t('common.cancel')}
                    </button>
                  </div>
                ) : (
                  <div className={s.actions}>
                    <button type="button" className={s.action} onClick={() => close(null)}>
                      {t('common.cancel')}
                    </button>
                    {options.actions.map((a) => (
                      <button
                        key={a.value}
                        type="button"
                        className={`${s.action} ${s.primary} ${a.destructive ? s.destructive : ''}`}
                        onClick={() => close(a.value)}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </ChooseContext>
  )
}

export function useChoose(): ChooseFn {
  const ctx = useContext(ChooseContext)
  if (!ctx) throw new Error('useChoose outside ConfirmProvider')
  return ctx
}

export function useConfirm(): ConfirmFn {
  const choose = useChoose()
  const { t } = useTranslation()
  return useCallback<ConfirmFn>(
    async ({ title, message, confirmLabel, destructive }) =>
      (await choose({ title, message, actions: [{ value: OK, label: confirmLabel ?? t('common.done'), destructive }] })) === OK,
    [choose, t],
  )
}
