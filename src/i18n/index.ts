import { createI18n } from 'vue-i18n'
import { DEFAULT_LOCALE, detectLocale, isLocale, type Locale } from './locales'
import en from './messages/en'
import ja from './messages/ja'
import zhHant from './messages/zh-Hant'

export const STORAGE_KEY = 'queens:locale:v1'
const messages = { 'zh-Hant': zhHant, en, ja }

function storedLocale(): Locale | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return isLocale(value) ? value : null
  } catch {
    return null
  }
}
export const i18n = createI18n({
  legacy: false,
  locale: storedLocale() ?? detectLocale(navigator.languages ?? [navigator.language]),
  fallbackLocale: DEFAULT_LOCALE,
  messages,
})
/** Keeps what the browser and search engines see in step with the interface language. */
export function applyDocumentLanguage(locale: Locale) {
  const { t } = i18n.global
  document.documentElement.lang = locale
  document.title = t('app.pageTitle')
  document.querySelector('meta[name="description"]')?.setAttribute('content', t('app.description'))
}
