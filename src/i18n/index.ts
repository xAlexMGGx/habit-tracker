import i18n from 'i18next'
import { initReactI18next, useTranslation } from 'react-i18next'
import { enUS, es as esLocale } from 'date-fns/locale'
import type { Language } from '../lib/database.types'
import es from './locales/es.json'
import en from './locales/en.json'

const STORAGE_KEY = 'ht:lang'

/** The iPhone's language if it is one we support; English otherwise. */
export function deviceLanguage(): Language {
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language]
  for (const lang of langs) {
    const l = lang.toLowerCase()
    if (l.startsWith('es')) return 'es'
    if (l.startsWith('en')) return 'en'
  }
  return 'en'
}

function storedLanguage(): Language | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'es' || v === 'en' ? v : null
  } catch {
    return null
  }
}

const initial = storedLanguage() ?? deviceLanguage()
document.documentElement.lang = initial

void i18n.use(initReactI18next).init({
  resources: { es: { translation: es }, en: { translation: en } },
  lng: initial,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

export function applyLanguage(lang: Language) {
  if (i18n.language !== lang) void i18n.changeLanguage(lang)
  document.documentElement.lang = lang
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch {
    // Private mode: the account setting still applies after sign-in.
  }
}

export function currentLanguage(): Language {
  return i18n.language === 'es' ? 'es' : 'en'
}

/** date-fns locale matching the interface language. */
export function useDateLocale() {
  const { i18n: instance } = useTranslation()
  return instance.language === 'es' ? esLocale : enUS
}

export default i18n
