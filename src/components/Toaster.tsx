import { dismissToast, useToasts } from '../lib/toast'
import s from './Toaster.module.css'

export function Toaster() {
  const toasts = useToasts()
  return (
    <div className={s.root} aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`${s.toast} ${toast.tone === 'error' ? s.error : ''}`}>
          <span className={s.message}>{toast.message}</span>
          {toast.action ? (
            <button
              type="button"
              className={s.action}
              onClick={() => {
                toast.action!.run()
                dismissToast(toast.id)
              }}
            >
              {toast.action.label}
            </button>
          ) : null}
        </div>
      ))}
    </div>
  )
}
