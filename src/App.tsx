import { QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RouterProvider } from 'react-router'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import { LoginScreen } from './auth/LoginScreen'
import { ConfirmProvider } from './components/ConfirmProvider'
import { Spinner } from './components/controls'
import { Toaster } from './components/Toaster'
import { UpdateBanner } from './components/UpdateBanner'
import { queryClient } from './data/queryClient'
import { useSettings, useUpdateSettings } from './data/settings'
import { AppLockGate } from './features/lock/AppLockGate'
import { InstallGuide, shouldShowInstallGuide } from './features/welcome/InstallGuide'
import { TodayProvider } from './hooks/useToday'
import { applyLanguage, deviceLanguage } from './i18n'
import { deviceTimezone } from './lib/platform'
import { isSupabaseConfigured } from './lib/supabase'
import { router } from './router'
import ui from './styles/ui.module.css'

/** Loads the user's settings, applies the language and keeps the timezone in sync. */
function SettingsBootstrap({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const settings = useSettings()
  const update = useUpdateSettings()
  const data = settings.data

  useEffect(() => {
    if (!data) return
    const patch: { language?: 'es' | 'en'; timezone?: string } = {}
    // First launch: the account takes the iPhone's language.
    if (!data.language) patch.language = deviceLanguage()
    // The server (notifications, phase 4) needs the user's timezone.
    if (data.timezone !== deviceTimezone()) patch.timezone = deviceTimezone()
    applyLanguage(patch.language ?? data.language ?? deviceLanguage())
    if (Object.keys(patch).length) update.mutate(patch)
  }, [data?.language, data?.timezone])

  if (settings.isError) {
    return (
      <div className={ui.empty}>
        <p>{t('errors.loadFailed')}</p>
        <button type="button" className={ui.btnPlain} onClick={() => void settings.refetch()}>
          {t('common.retry')}
        </button>
      </div>
    )
  }
  if (!data) return <Spinner />
  return children
}

function Gate() {
  const { t } = useTranslation()
  const { session, loading, holdAuthScreen } = useAuth()
  const [installGuide, setInstallGuide] = useState(shouldShowInstallGuide)

  if (!isSupabaseConfigured) {
    return (
      <div className={ui.empty}>
        <h1>{t('config.title')}</h1>
        <p>{t('config.body')}</p>
      </div>
    )
  }
  if (installGuide) return <InstallGuide onContinue={() => setInstallGuide(false)} />
  if (loading) return <Spinner />
  if (!session || holdAuthScreen) return <LoginScreen />

  return (
    <AppLockGate key={session.user.id}>
      <SettingsBootstrap>
        <RouterProvider router={router} />
      </SettingsBootstrap>
    </AppLockGate>
  )
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TodayProvider>
        <AuthProvider>
          <ConfirmProvider>
            <Gate />
            <Toaster />
            <UpdateBanner />
          </ConfirmProvider>
        </AuthProvider>
      </TodayProvider>
    </QueryClientProvider>
  )
}
