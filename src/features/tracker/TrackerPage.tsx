import { Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../../components/PageHeader'
import ui from '../../styles/ui.module.css'
import s from './Tracker.module.css'

/** Phase 2 brings the progress bar, cards and visualizations. */
export function TrackerPage() {
  const { t } = useTranslation()
  return (
    <div className={ui.page}>
      <PageHeader title={t('titles.tracker')} showSettings />
      <div className={s.soon}>
        <Sparkles size={40} className={s.icon} />
        <h2 className={s.title}>{t('tracker.comingSoon')}</h2>
        <p className={s.body}>{t('tracker.comingSoonBody')}</p>
      </div>
    </div>
  )
}
