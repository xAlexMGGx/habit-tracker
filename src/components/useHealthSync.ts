import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useRevertToHealth } from '../data/logs'
import type { Habit, HabitLog } from '../lib/database.types'
import type { DateStr } from '../lib/dates'
import { useChoose } from './ConfirmProvider'

/** The guide asks to name the shortcut exactly this, so the app can run it. */
export const SHORTCUT_NAME = 'Habit tracker'

/**
 * Runs the shortcut with some input. The shortcut only shows its notification when it gets
 * input: from the app and from the 23:00 automation, not from the silent ones.
 */
export const RUN_SHORTCUT_URL = `shortcuts://run-shortcut?name=${encodeURIComponent(SHORTCUT_NAME)}&input=text&text=app`

/** Opens Atajos to run the shortcut; back in the app, reloads what it sent. */
export function useRunHealthShortcut() {
  const qc = useQueryClient()
  return () => {
    const refresh = () => {
      if (document.visibilityState !== 'visible') return
      document.removeEventListener('visibilitychange', refresh)
      void qc.invalidateQueries({ queryKey: ['habit_logs'] })
      void qc.invalidateQueries({ queryKey: ['api_tokens'] })
    }
    document.addEventListener('visibilitychange', refresh)
    // Same as tapping a link to it, which is what iOS expects for opening another app.
    const link = document.createElement('a')
    link.href = RUN_SHORTCUT_URL
    document.body.append(link)
    link.click()
    link.remove()
  }
}

/**
 * Sync from a Health habit (its heart, or the button in its detail). The sync never touches a
 * day changed by hand, so if this one was, it asks first whether Health's value should replace it.
 */
export function useHealthSync() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const choose = useChoose()
  const revert = useRevertToHealth()
  const run = useRunHealthShortcut()

  return async (habit: Habit, date: DateStr) => {
    const log = qc.getQueryData<HabitLog[]>(['habit_logs'])?.find((l) => l.habit_id === habit.id && l.log_date === date)
    if (log?.manual) {
      const choice = await choose({
        title: t('health.syncTitle'),
        message: t('health.syncManualMessage'),
        actions: [
          { value: 'overwrite', label: t('health.syncOverwrite'), destructive: true },
          { value: 'sync', label: t('health.syncOnly') },
        ],
      })
      if (!choice) return
      if (choice === 'overwrite') {
        try {
          await revert.mutateAsync({ habitId: habit.id, date, healthValue: log.health_value })
        } catch {
          return // the failed write already shows its toast
        }
      }
    }
    run()
  }
}
