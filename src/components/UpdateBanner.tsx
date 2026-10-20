import { useTranslation } from 'react-i18next'
import { useRegisterSW } from 'virtual:pwa-register/react'
import s from './UpdateBanner.module.css'

/** Offers to reload when a new version has been deployed (instead of reloading under the user's finger). */
export function UpdateBanner() {
  const { t } = useTranslation()
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Check for a new deploy every hour while the app stays open.
      if (registration) setInterval(() => void registration.update(), 60 * 60 * 1000)
    },
  })

  if (!needRefresh) return null
  return (
    <div className={s.banner} role="status">
      <span>{t('update.available')}</span>
      <button type="button" className={s.action} onClick={() => void updateServiceWorker(true)}>
        {t('update.reload')}
      </button>
    </div>
  )
}
