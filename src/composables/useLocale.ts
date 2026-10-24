import { computed, shallowRef } from 'vue'
import { STORAGE_KEY, applyDocumentLanguage, i18n } from '../i18n'
import { isLocale, type Locale } from '../i18n/locales'

const storageAvailable = shallowRef(true)
const locale = computed(() => i18n.global.locale.value)
function apply(next: Locale) {
  i18n.global.locale.value = next
  applyDocumentLanguage(next)
}
/** Called once at startup, like the theme: applies the language and follows other tabs. */
export function initializeLocale() {
  apply(locale.value)
  function sync(event: StorageEvent) {
    if (event.key === STORAGE_KEY && isLocale(event.newValue)) apply(event.newValue)
  }
  window.addEventListener('storage', sync)
  return () => window.removeEventListener('storage', sync)
}
export function useLocale() {
  function setLocale(next: Locale) {
    apply(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
      storageAvailable.value = true
    } catch {
      storageAvailable.value = false
    }
  }
  return { locale, storageAvailable, setLocale }
}
