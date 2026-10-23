// Notification texts (ES/EN). The app's own texts live in src/i18n/locales; these are sent
// from the server, in the language saved in the user's settings.

export type Lang = 'es' | 'en'

export const PRIORITY_EMOJI = { high: '🔴', medium: '🟠', low: '🟢' } as const

export function messages(lang: Lang) {
  const es = lang === 'es'
  const num = (n: number) => new Intl.NumberFormat(lang, { maximumFractionDigits: 2 }).format(n)
  const tidy = (s: string) => s.replace(/\s+/g, ' ').trim()
  return {
    habitPending: es ? 'Todavía no lo has marcado hoy.' : 'You haven’t checked it off today yet.',
    habitAmount: (value: number, target: number, unit: string | null) =>
      tidy(es ? `Llevas ${num(value)} de ${num(target)} ${unit ?? ''} hoy.` : `${num(value)} of ${num(target)} ${unit ?? ''} so far today.`),
    habitClean: es ? 'Hoy vas limpio. ¡Sigue así!' : 'Clean so far today. Keep it up!',
    todoBody: es ? 'Tarea para hoy.' : 'TO-DO for today.',
    testTitle: 'Habit tracker',
    testBody: es ? '¡Las notificaciones funcionan! 🎉' : 'Notifications are working! 🎉',
  }
}
