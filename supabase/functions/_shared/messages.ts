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

/** Shown when the key can't be checked, so the user's language isn't known yet. */
export const INVALID_KEY_TEXT =
  'Habit tracker: la clave no es válida o se ha revocado. Crea otra en Ajustes → Salud. / ' +
  'The key is invalid or was revoked. Create a new one in Settings → Health.'

/** Replies of the `health` function. The shortcut shows them as a notification. */
export function healthTexts(lang: Lang) {
  const es = lang === 'es'
  const num = (n: number) => new Intl.NumberFormat(lang, { maximumFractionDigits: 2 }).format(n)
  return {
    noHabits: es
      ? 'Habit tracker: no tienes hábitos que usen Salud. Créalos en Mis hábitos (cuantitativo, fuente Salud).'
      : 'Habit tracker: none of your habits use Health. Set one up in My habits (quantitative, source Health).',
    noData: es
      ? 'Habit tracker: no ha llegado ningún dato de Salud de estos días. ¿Tiene Atajos permiso para leer Salud?'
      : 'Habit tracker: no Health data arrived for these days. Does Shortcuts have access to Health?',
    today: es ? 'Hoy' : 'Today',
    yesterday: es ? 'Ayer' : 'Yesterday',
    steps: (n: number) => (es ? `${num(n)} pasos` : `${num(n)} steps`),
    sleep: (hours: number) => {
      const h = Math.floor(hours)
      const min = Math.round((hours - h) * 60)
      const time = min ? `${h} h ${min} min` : `${h} h`
      return es ? `${time} de sueño` : `${time} of sleep`
    },
    workouts: (n: number) =>
      es ? (n === 1 ? '1 entrenamiento' : `${n} entrenamientos`) : n === 1 ? '1 workout' : `${n} workouts`,
    noTime: es
      ? '⚠️ Las fechas del sueño no llevan hora: en el atajo, activa «Incluir hora» en el formato ISO 8601.'
      : '⚠️ Sleep dates have no time: in the shortcut, turn on “Include ISO 8601 Time”.',
  }
}
