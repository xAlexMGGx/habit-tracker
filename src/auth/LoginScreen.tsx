import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import ui from '../styles/ui.module.css'
import { useAuth } from './AuthProvider'
import s from './LoginScreen.module.css'

const MIN_PASSWORD = 8

function SignInForm({ onForgot }: { onForgot: (email: string) => void }) {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (err) setError(err.status === 400 ? t('auth.invalidCredentials') : t('errors.generic'))
  }

  return (
    <form className={s.form} onSubmit={submit}>
      {/* autocomplete attributes let iOS offer the iCloud Keychain password with Face ID */}
      <input
        className={ui.textInput}
        type="email"
        name="email"
        autoComplete="username"
        autoCapitalize="none"
        inputMode="email"
        placeholder={t('auth.email')}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        className={ui.textInput}
        type="password"
        name="password"
        autoComplete="current-password"
        placeholder={t('auth.password')}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      {error ? <p className={`${ui.error} ${s.flush}`}>{error}</p> : null}
      <button type="submit" className={ui.btnBlock} disabled={busy || !email || !password}>
        {busy ? t('auth.signingIn') : t('auth.signIn')}
      </button>
      <button type="button" className={ui.btnPlain} onClick={() => onForgot(email)}>
        {t('auth.forgotPassword')}
      </button>
      <p className={s.hint}>{t('auth.faceIdHint')}</p>
    </form>
  )
}

/**
 * Password reset with a 6-digit code typed into the app. An email link would open
 * Safari, which doesn't share the session with the installed PWA on iOS.
 */
function ResetForm({ initialEmail, onDone }: { initialEmail: string; onDone: () => void }) {
  const { t } = useTranslation()
  const { setHoldAuthScreen } = useAuth()
  const [email, setEmail] = useState(initialEmail)
  const [sent, setSent] = useState(false)
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const sendCode = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim())
    setBusy(false)
    if (err && err.status !== 429) return setError(t('errors.generic'))
    setSent(true)
  }

  const setNewPassword = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < MIN_PASSWORD) return setError(t('auth.passwordTooShort', { min: MIN_PASSWORD }))
    setBusy(true)
    setError(null)
    setHoldAuthScreen(true)
    try {
      const verified = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'recovery' })
      if (verified.error) return setError(t('auth.invalidCode'))
      const updated = await supabase.auth.updateUser({ password })
      if (updated.error) return setError(updated.error.message || t('errors.generic'))
      onDone()
    } finally {
      setBusy(false)
      setHoldAuthScreen(false)
    }
  }

  return (
    <div className={s.form}>
      <h2 className={s.resetTitle}>{t('auth.resetTitle')}</h2>
      {!sent ? (
        <form className={s.form} onSubmit={sendCode}>
          <p className={s.hint}>{t('auth.resetIntro')}</p>
          <input
            className={ui.textInput}
            type="email"
            autoComplete="username"
            autoCapitalize="none"
            inputMode="email"
            placeholder={t('auth.email')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          {error ? <p className={`${ui.error} ${s.flush}`}>{error}</p> : null}
          <button type="submit" className={ui.btnBlock} disabled={busy || !email}>
            {busy ? t('auth.sending') : t('auth.sendCode')}
          </button>
        </form>
      ) : (
        <form className={s.form} onSubmit={setNewPassword}>
          <p className={s.hint}>{t('auth.codeSent')}</p>
          <input
            className={ui.textInput}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder={t('auth.code')}
            value={code}
            maxLength={10}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            required
          />
          <input
            className={ui.textInput}
            type="password"
            autoComplete="new-password"
            placeholder={t('auth.newPassword')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error ? <p className={`${ui.error} ${s.flush}`}>{error}</p> : null}
          <button type="submit" className={ui.btnBlock} disabled={busy || code.length < 6 || !password}>
            {t('auth.setPassword')}
          </button>
        </form>
      )}
      <button type="button" className={ui.btnPlain} onClick={onDone}>
        {t('auth.backToLogin')}
      </button>
    </div>
  )
}

export function LoginScreen() {
  const { t } = useTranslation()
  const [resetEmail, setResetEmail] = useState<string | null>(null)

  return (
    <div className={s.root}>
      <div className={s.card}>
        <img src={`${import.meta.env.BASE_URL}pwa-192x192.png`} alt="" className={s.logo} />
        <h1 className={s.title}>{t('app.name')}</h1>
        {resetEmail == null ? (
          <>
            <p className={s.subtitle}>{t('auth.subtitle')}</p>
            <SignInForm onForgot={setResetEmail} />
          </>
        ) : (
          <ResetForm initialEmail={resetEmail} onDone={() => setResetEmail(null)} />
        )}
      </div>
    </div>
  )
}
