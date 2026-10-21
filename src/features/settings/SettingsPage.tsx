import { ChevronLeft, ChevronRight, Download, KeyRound, LogOut, Smartphone } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router'
import { useUser } from '../../auth/AuthProvider'
import { BottomSheet } from '../../components/BottomSheet'
import { useConfirm } from '../../components/ConfirmProvider'
import { PageHeader } from '../../components/PageHeader'
import { Segmented, Switch } from '../../components/controls'
import { useSettings, useUpdateSettings } from '../../data/settings'
import { applyLanguage, currentLanguage } from '../../i18n'
import type { Language } from '../../lib/database.types'
import { buildCsvFiles, buildJsonFile, deliverFiles, fetchExportData } from '../../lib/export'
import { isStandalone } from '../../lib/platform'
import { supabase } from '../../lib/supabase'
import { type ThemePref, setThemePref, useThemePref } from '../../lib/theme'
import { showToast } from '../../lib/toast'
import ui from '../../styles/ui.module.css'
import { disableFaceIdLock, enableFaceIdLock, isFaceIdAvailable, useFaceIdLockEnabled } from '../lock/appLock'
import { InstallGuide } from '../welcome/InstallGuide'
import s from './Settings.module.css'

const MIN_PASSWORD = 8

function ChangePasswordSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setPassword('')
      setRepeat('')
      setError(null)
    }
  }, [open])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < MIN_PASSWORD) return setError(t('auth.passwordTooShort', { min: MIN_PASSWORD }))
    if (password !== repeat) return setError(t('auth.passwordsDontMatch'))
    setBusy(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (err) return setError(err.message || t('errors.generic'))
    showToast({ message: t('settings.passwordChanged') })
    onClose()
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={t('settings.changePassword')}>
      <form className={s.sheetForm} onSubmit={submit}>
        <input
          className={ui.textInput}
          type="password"
          autoComplete="new-password"
          placeholder={t('auth.newPassword')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <input
          className={ui.textInput}
          type="password"
          autoComplete="new-password"
          placeholder={t('auth.repeatPassword')}
          value={repeat}
          onChange={(e) => setRepeat(e.target.value)}
        />
        {error ? <p className={`${ui.error} ${s.flush}`}>{error}</p> : null}
        <button type="submit" className={ui.btnBlock} disabled={busy || !password}>
          {t('auth.setPassword')}
        </button>
      </form>
    </BottomSheet>
  )
}

function FaceIdRow() {
  const { t } = useTranslation()
  const user = useUser()
  const enabled = useFaceIdLockEnabled(user.id)
  const [available, setAvailable] = useState<boolean | null>(null)

  useEffect(() => {
    void isFaceIdAvailable().then(setAvailable)
  }, [])

  const toggle = async (on: boolean) => {
    if (!on) return disableFaceIdLock(user.id)
    try {
      await enableFaceIdLock(user.id, user.email ?? '')
    } catch {
      showToast({ message: t('settings.faceIdFailed'), tone: 'error' })
    }
  }

  return (
    <div className={ui.section}>
      <h2 className={ui.sectionTitle}>{t('settings.security')}</h2>
      <div className={ui.group}>
        <div className={ui.row}>
          <span className={ui.rowLabel}>{t('settings.faceIdLock')}</span>
          <Switch checked={enabled} disabled={!available} onChange={toggle} label={t('settings.faceIdLock')} />
        </div>
      </div>
      <p className={ui.sectionFooter}>
        {available === false ? t('settings.faceIdUnavailable') : t('settings.faceIdLockHint')}
      </p>
    </div>
  )
}

type Prepared = { kind: 'JSON' | 'CSV'; files: File[] }

function ExportSection() {
  const { t } = useTranslation()
  const user = useUser()
  const [busy, setBusy] = useState<'JSON' | 'CSV' | null>(null)
  const [prepared, setPrepared] = useState<Prepared | null>(null)

  // Step 1 fetches everything; step 2 (a second tap) opens the share sheet,
  // because iOS only allows sharing straight from a tap.
  const prepare = async (kind: 'JSON' | 'CSV') => {
    setBusy(kind)
    setPrepared(null)
    try {
      const data = await fetchExportData()
      setPrepared({ kind, files: kind === 'JSON' ? [buildJsonFile(data, user.email ?? '')] : buildCsvFiles(data) })
    } catch {
      showToast({ message: t('settings.exportFailed'), tone: 'error' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className={ui.section}>
      <h2 className={ui.sectionTitle}>{t('settings.export')}</h2>
      <div className={s.exportButtons}>
        {(['JSON', 'CSV'] as const).map((kind) =>
          prepared?.kind === kind ? (
            <button
              key={kind}
              type="button"
              className={ui.btn}
              onClick={() => {
                void deliverFiles(prepared.files)
                setPrepared(null)
              }}
            >
              <Download size={18} />
              {t('settings.saveFile', { kind })}
            </button>
          ) : (
            <button
              key={kind}
              type="button"
              className={ui.btnSecondary}
              disabled={busy != null}
              onClick={() => prepare(kind)}
            >
              {busy === kind ? t('settings.preparing') : kind === 'JSON' ? t('settings.exportJson') : t('settings.exportCsv')}
            </button>
          ),
        )}
      </div>
      <p className={ui.sectionFooter}>{t('settings.exportHint')}</p>
    </div>
  )
}

export function SettingsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const user = useUser()
  const confirm = useConfirm()
  const settings = useSettings().data
  const updateSettings = useUpdateSettings()
  const [changingPassword, setChangingPassword] = useState(false)
  const [showInstall, setShowInstall] = useState(false)
  const themePref = useThemePref()

  const language: Language = settings?.language ?? currentLanguage()

  const changeLanguage = (lang: Language) => {
    applyLanguage(lang)
    updateSettings.mutate({ language: lang })
  }

  const signOut = async () => {
    if (await confirm({ title: t('settings.signOutConfirm'), confirmLabel: t('settings.signOut'), destructive: true }))
      await supabase.auth.signOut()
  }

  return (
    <div className={ui.pageNoTabs}>
      <PageHeader
        variant="inline"
        title={t('titles.settings')}
        left={
          <button
            type="button"
            className={`${ui.btnPlain} ${s.back}`}
            onClick={() => (location.key === 'default' ? navigate('/agenda', { replace: true }) : navigate(-1))}
          >
            <ChevronLeft size={26} />
            {t('common.back')}
          </button>
        }
      />

      <div className={ui.section}>
        <h2 className={ui.sectionTitle}>{t('settings.account')}</h2>
        <div className={ui.group}>
          <div className={ui.row}>
            <span className={ui.rowLabel}>{t('settings.signedInAs')}</span>
            <span className={`${ui.rowValue} ${s.email}`}>{user.email}</span>
          </div>
          <button type="button" className={ui.rowButton} onClick={() => setChangingPassword(true)}>
            <KeyRound size={20} className={s.rowIcon} />
            <span className={ui.rowLabel}>{t('settings.changePassword')}</span>
            <ChevronRight size={18} className={ui.muted} />
          </button>
          <button type="button" className={`${ui.rowButton} ${ui.danger}`} onClick={signOut}>
            <LogOut size={20} />
            <span className={ui.rowLabel}>{t('settings.signOut')}</span>
          </button>
        </div>
      </div>

      <FaceIdRow />

      <div className={ui.section}>
        <h2 className={ui.sectionTitle}>{t('settings.language')}</h2>
        <div className={s.inset}>
          <Segmented<Language>
            value={language}
            onChange={changeLanguage}
            options={[
              { value: 'es', label: t('settings.languages.es') },
              { value: 'en', label: t('settings.languages.en') },
            ]}
          />
        </div>
      </div>

      <div className={ui.section}>
        <h2 className={ui.sectionTitle}>{t('settings.appearance')}</h2>
        <div className={s.inset}>
          <Segmented<ThemePref>
            value={themePref}
            onChange={setThemePref}
            options={[
              { value: 'system', label: t('settings.themes.system') },
              { value: 'light', label: t('settings.themes.light') },
              { value: 'dark', label: t('settings.themes.dark') },
            ]}
          />
        </div>
        <p className={ui.sectionFooter}>{t('settings.appearanceHint')}</p>
      </div>

      <ExportSection />

      {!isStandalone() ? (
        <div className={ui.section}>
          <div className={ui.group}>
            <button type="button" className={ui.rowButton} onClick={() => setShowInstall(true)}>
              <Smartphone size={20} className={s.rowIcon} />
              <span className={ui.rowLabel}>{t('install.settingsRow')}</span>
              <ChevronRight size={18} className={ui.muted} />
            </button>
          </div>
        </div>
      ) : null}

      <p className={s.version}>{t('settings.version', { version: __APP_VERSION__ })}</p>

      <ChangePasswordSheet open={changingPassword} onClose={() => setChangingPassword(false)} />
      {showInstall ? <InstallGuide onContinue={() => setShowInstall(false)} /> : null}
    </div>
  )
}
