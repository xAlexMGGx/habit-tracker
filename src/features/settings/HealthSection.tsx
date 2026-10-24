import { useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { BookOpen, Check, Copy, KeyRound, RefreshCw } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from '../../components/BottomSheet'
import { useConfirm } from '../../components/ConfirmProvider'
import { useApiTokens, useCreateApiToken, useRevokeApiToken } from '../../data/apiTokens'
import { useToday } from '../../hooks/useToday'
import { useDateLocale } from '../../i18n'
import type { ApiToken } from '../../lib/database.types'
import { addDays } from '../../lib/dates'
import { formatNumber } from '../../lib/habitMeta'
import { functionsUrl } from '../../lib/supabase'
import { showToast } from '../../lib/toast'
import ui from '../../styles/ui.module.css'
import s from './Settings.module.css'

const MAX_NAME = 40
/** The guide asks to give the shortcut exactly this name, so the app can run it. */
const SHORTCUT_NAME = 'Habit tracker'
const RUN_SHORTCUT_URL = `shortcuts://run-shortcut?name=${encodeURIComponent(SHORTCUT_NAME)}`
const HEALTH_URL = `${functionsUrl}/health`

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/** `like this` → <code>like this</code>, for names the user has to type exactly. */
function CodeText({ text }: { text: string }) {
  return (
    <>
      {text.split('`').map((part, i) => (i % 2 ? <code key={i}>{part}</code> : part))}
    </>
  )
}

/** A value to paste somewhere else, with its copy button. */
function CopyBox({ label, value, onCopied }: { label: string; value: string; onCopied?: () => void }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    if (await copyText(value)) {
      setCopied(true)
      onCopied?.()
    } else {
      showToast({ message: t('health.copyFailed'), tone: 'error' })
    }
  }
  return (
    <div className={s.copyBox}>
      <input className={s.copyValue} readOnly value={value} aria-label={label} onFocus={(e) => e.currentTarget.select()} />
      <button type="button" className={ui.btnSecondary} onClick={copy}>
        {copied ? <Check size={18} /> : <Copy size={18} />}
        {copied ? t('health.copied') : t('health.copy')}
      </button>
    </div>
  )
}

function Steps({ items, start = 1 }: { items: string[]; start?: number }) {
  return (
    <ol className={s.steps} start={start}>
      {items.map((item, i) => (
        <li key={i}>
          <CodeText text={item} />
        </li>
      ))}
    </ol>
  )
}

/** Step-by-step: building the Atajos shortcut and its automation. */
function GuideSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const list = (key: 'before' | 'create' | 'request' | 'test' | 'automate' | 'habits') =>
    t(`health.guide.${key}`, { returnObjects: true }) as string[]
  const create = list('create')
  return (
    <BottomSheet open={open} onClose={onClose} title={t('health.guide.title')}>
      <div className={s.sheetForm}>
        <h3 className={s.stepsTitle}>{t('health.guide.beforeTitle')}</h3>
        <Steps items={list('before')} />
        <h3 className={s.stepsTitle}>{t('health.guide.createTitle')}</h3>
        <Steps items={create} />
        <Steps items={list('request')} start={create.length + 1} />
        <CopyBox label={t('health.urlLabel')} value={HEALTH_URL} />
        <h3 className={s.stepsTitle}>{t('health.guide.testTitle')}</h3>
        <Steps items={list('test')} />
        <h3 className={s.stepsTitle}>{t('health.guide.automateTitle')}</h3>
        <Steps items={list('automate')} />
        <h3 className={s.stepsTitle}>{t('health.guide.habitsTitle')}</h3>
        <Steps items={list('habits')} />
      </div>
    </BottomSheet>
  )
}

/** Creates a key and shows it once. */
function KeySheet({ open, onClose, onShowGuide }: { open: boolean; onClose: () => void; onShowGuide: () => void }) {
  const { t } = useTranslation()
  const confirm = useConfirm()
  const create = useCreateApiToken()
  const [name, setName] = useState('')
  const [token, setToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const reset = () => {
    setName('')
    setToken(null)
    setCopied(false)
    create.reset()
  }

  // The key only exists in this sheet: closing without copying throws it away.
  const close = async (then?: () => void) => {
    if (token && !copied) {
      const ok = await confirm({
        title: t('health.closeConfirm'),
        message: t('health.closeConfirmBody'),
        confirmLabel: t('health.closeAnyway'),
        destructive: true,
      })
      if (!ok) return
    }
    onClose()
    reset()
    then?.()
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    create.mutate(name.trim() || t('health.defaultName'), { onSuccess: setToken })
  }

  return (
    <BottomSheet open={open} onClose={() => void close()} title={t('health.keyTitle')}>
      {token == null ? (
        <form className={s.sheetForm} onSubmit={submit}>
          <p className={s.sheetText}>{t('health.keyIntro')}</p>
          <input
            className={ui.textInput}
            maxLength={MAX_NAME}
            placeholder={t('health.defaultName')}
            aria-label={t('health.keyName')}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {create.isError ? <p className={`${ui.error} ${s.flush}`}>{t('health.createFailed')}</p> : null}
          <button type="submit" className={ui.btnBlock} disabled={create.isPending}>
            {create.isPending ? t('health.creating') : t('health.createKey')}
          </button>
        </form>
      ) : (
        <div className={s.sheetForm}>
          <p className={s.warning}>{t('health.copyNow')}</p>
          <CopyBox label={t('health.keyLabel')} value={token} onCopied={() => setCopied(true)} />
          <button type="button" className={ui.btnBlock} onClick={() => void close(onShowGuide)}>
            <BookOpen size={18} />
            {t('health.nextGuide')}
          </button>
        </div>
      )}
    </BottomSheet>
  )
}

function TokenRow({ token }: { token: ApiToken }) {
  const { t, i18n } = useTranslation()
  const locale = useDateLocale()
  const today = useToday()
  const confirm = useConfirm()
  const revoke = useRevokeApiToken()

  const onRevoke = async () => {
    const ok = await confirm({
      title: t('health.revokeConfirm', { name: token.name }),
      message: t('health.revokeConfirmBody'),
      confirmLabel: t('health.revoke'),
      destructive: true,
    })
    if (ok) revoke.mutate(token.id, { onSuccess: () => showToast({ message: t('health.revoked') }) })
  }

  const used = token.last_used_at
    ? t('health.lastSync', { when: formatDistanceToNow(new Date(token.last_used_at), { addSuffix: true, locale }) })
    : t('health.neverSynced')

  // What the last sync brought for its latest day.
  const sync = token.last_sync as { date?: string; steps?: number; sleep?: number; workouts?: number } | null
  const num = (n: number) => formatNumber(n, i18n.language)
  const parts = sync
    ? [
        sync.steps != null ? t('health.summary.steps', { value: num(sync.steps) }) : null,
        sync.sleep != null ? t('health.summary.sleep', { value: num(sync.sleep) }) : null,
        sync.workouts != null ? t('health.summary.workouts', { count: sync.workouts }) : null,
      ].filter(Boolean)
    : []
  const day = sync?.date === today ? t('common.today') : sync?.date === addDays(today, -1) ? t('common.yesterday') : sync?.date

  return (
    <div className={ui.row}>
      <span className={s.tokenText}>
        <span className={s.tokenName}>{token.name}</span>
        <span className={s.tokenMeta}>
          <code>{token.token_prefix}…</code> · {used}
        </span>
        {parts.length ? (
          <span className={s.tokenMeta}>
            {day}: {parts.join(' · ')}
          </span>
        ) : null}
      </span>
      <button type="button" className={`${ui.btnPlain} ${s.revoke}`} onClick={onRevoke}>
        {t('health.revoke')}
      </button>
    </div>
  )
}

export function HealthSection() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const tokens = useApiTokens()
  const [keyOpen, setKeyOpen] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const list = tokens.data ?? []

  // Back from Atajos a few seconds later: show what the shortcut just sent.
  const refreshOnReturn = () => {
    const refresh = () => {
      if (document.visibilityState !== 'visible') return
      document.removeEventListener('visibilitychange', refresh)
      void qc.invalidateQueries({ queryKey: ['habit_logs'] })
      void qc.invalidateQueries({ queryKey: ['api_tokens'] })
    }
    document.addEventListener('visibilitychange', refresh)
  }

  return (
    <div className={ui.section}>
      <h2 className={ui.sectionTitle}>{t('health.title')}</h2>
      <div className={ui.group}>
        <button type="button" className={ui.rowButton} onClick={() => setKeyOpen(true)}>
          <KeyRound size={20} className={s.rowIcon} />
          <span className={ui.rowLabel}>{t('health.createKeyRow')}</span>
        </button>
        <button type="button" className={ui.rowButton} onClick={() => setGuideOpen(true)}>
          <BookOpen size={20} className={s.rowIcon} />
          <span className={ui.rowLabel}>{t('health.guideRow')}</span>
        </button>
        {list.length ? (
          <a className={`${ui.rowButton} ${s.linkRow}`} href={RUN_SHORTCUT_URL} onClick={refreshOnReturn}>
            <RefreshCw size={20} className={s.rowIcon} />
            <span className={ui.rowLabel}>{t('health.runNow')}</span>
          </a>
        ) : null}
        {list.map((token) => (
          <TokenRow key={token.id} token={token} />
        ))}
      </div>
      <p className={ui.sectionFooter}>{tokens.isError ? t('health.loadFailed') : t('health.hint')}</p>
      <KeySheet open={keyOpen} onClose={() => setKeyOpen(false)} onShowGuide={() => setGuideOpen(true)} />
      <GuideSheet open={guideOpen} onClose={() => setGuideOpen(false)} />
    </div>
  )
}
