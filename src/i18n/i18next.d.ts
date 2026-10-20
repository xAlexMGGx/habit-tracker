import 'i18next'
import type es from './locales/es.json'

// Type-checks every t('…') key against the Spanish file.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation'
    resources: { translation: typeof es }
  }
}
