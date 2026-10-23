import { ScanFace } from 'lucide-react'
import { type FormEvent, type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useUser } from '../../auth/AuthProvider'
import { signOutAndForgetDevice } from '../../lib/push'
import { supabase } from '../../lib/supabase'
import ui from '../../styles/ui.module.css'
import s from './Lock.module.css'
import { useFaceIdLockEnabled, verifyFaceId } from './appLock'

/** Coming back within this time doesn't ask for Face ID again. */
const GRACE_MS = 60_000

function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const { t } = useTranslation()
  const user = useUser()
  const [usePassword, setUsePassword] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const tryFaceId = useCallback(async () => {
    setError(null)
    if (await verifyFaceId(user.id)) onUnlock()
  }, [user.id, onUnlock])

  // Safari may refuse WebAuthn without a tap; the button below covers that case.
  useEffect(() => {
    void tryFaceId()
  }, [tryFaceId])

  const submitPassword = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.auth.signInWithPassword({ email: user.email ?? '', password })
    setBusy(false)
    if (err) setError(t('auth.invalidCredentials'))
    else onUnlock()
  }

  return (
    <div className={s.lock}>
      <img src={`${import.meta.env.BASE_URL}pwa-192x192.png`} alt="" className={s.logo} />
      <h1 className={s.title}>{t('lock.title')}</h1>
      {usePassword ? (
        <form className={s.form} onSubmit={submitPassword}>
          <input
            className={ui.textInput}
            type="password"
            autoComplete="current-password"
            placeholder={t('auth.password')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
          <button type="submit" className={ui.btnBlock} disabled={busy || !password}>
            {t('lock.unlockWithPassword')}
          </button>
        </form>
      ) : (
        <button type="button" className={ui.btnBlock} onClick={tryFaceId}>
          <ScanFace size={22} />
          {t('lock.unlock')}
        </button>
      )}
      {error ? <p className={ui.error}>{error}</p> : null}
      <div className={s.links}>
        {!usePassword ? (
          <button type="button" className={ui.btnPlain} onClick={() => setUsePassword(true)}>
            {t('lock.usePassword')}
          </button>
        ) : null}
        <button type="button" className={ui.btnPlain} onClick={() => void signOutAndForgetDevice(user.id)}>
          {t('lock.signOut')}
        </button>
      </div>
    </div>
  )
}

/**
 * Covers the app with the lock screen on launch and when returning after GRACE_MS,
 * if the user turned on the Face ID lock on this device.
 */
export function AppLockGate({ children }: { children: ReactNode }) {
  const user = useUser()
  const enabled = useFaceIdLockEnabled(user.id)
  const [locked, setLocked] = useState(enabled)
  // Hides content in the app switcher snapshot.
  const [covered, setCovered] = useState(false)
  const hiddenAt = useRef<number | null>(null)

  useEffect(() => {
    if (!enabled) {
      setLocked(false)
      setCovered(false)
      return
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = Date.now()
        setCovered(true)
      } else {
        if (hiddenAt.current && Date.now() - hiddenAt.current > GRACE_MS) setLocked(true)
        hiddenAt.current = null
        setCovered(false)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [enabled])

  const unlock = useCallback(() => setLocked(false), [])

  return (
    <>
      {children}
      {enabled && locked ? <LockScreen onUnlock={unlock} /> : null}
      {enabled && covered && !locked ? <div className={s.cover} /> : null}
    </>
  )
}
