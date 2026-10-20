import { Share, SquarePlus, Smartphone } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { isIOS, isStandalone } from '../../lib/platform'
import ui from '../../styles/ui.module.css'
import s from './InstallGuide.module.css'

const DISMISSED_KEY = 'ht:install-guide-dismissed'

/** Show the guide on an iPhone/iPad opened in Safari, until the user continues once. */
export function shouldShowInstallGuide(): boolean {
  if (isStandalone() || !isIOS()) return false
  try {
    return localStorage.getItem(DISMISSED_KEY) !== '1'
  } catch {
    return true
  }
}

export function InstallGuide({ onContinue }: { onContinue: () => void }) {
  const { t } = useTranslation()

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, '1')
    } catch {
      // ignore
    }
    onContinue()
  }

  const steps = [
    { Icon: Share, text: t('install.step1') },
    { Icon: SquarePlus, text: t('install.step2') },
    { Icon: Smartphone, text: t('install.step3') },
  ]

  return createPortal(
    <div className={s.root}>
      <div className={s.content}>
        <img src={`${import.meta.env.BASE_URL}pwa-192x192.png`} alt="" className={s.logo} />
        <h1 className={s.title}>{t('install.title')}</h1>
        <p className={s.intro}>{t('install.intro')}</p>
        <ol className={s.steps}>
          {steps.map(({ Icon, text }, i) => (
            <li key={i} className={s.step}>
              <span className={s.stepIcon}>
                <Icon size={22} />
              </span>
              <span>{text}</span>
            </li>
          ))}
        </ol>
        <p className={s.note}>{t('install.safariOnly')}</p>
      </div>
      <button type="button" className={ui.btnPlain} onClick={dismiss}>
        {t('install.continueInBrowser')}
      </button>
    </div>,
    document.body,
  )
}
