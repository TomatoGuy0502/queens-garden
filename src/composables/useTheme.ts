import { readonly, shallowRef, watch } from 'vue'

export type ThemePreference = 'system' | 'light' | 'dark'
const STORAGE_KEY = 'queens:theme:v1'
const preference = shallowRef<ThemePreference>('system')
const storageAvailable = shallowRef(true)
function normalize(value: string | null): ThemePreference {
  return value === 'light' || value === 'dark' ? value : 'system'
}

// Initialize once for the application, independently of route/component lifetimes.
export function initializeTheme() {
  try {
    preference.value = normalize(localStorage.getItem(STORAGE_KEY))
  } catch {
    storageAvailable.value = false
  }
  const system = window.matchMedia('(prefers-color-scheme: dark)')
  function apply() {
    const theme =
      preference.value === 'system' ? (system.matches ? 'dark' : 'light') : preference.value
    document.documentElement.dataset.theme = theme
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#1c1a20' : '#f8f7f3')
  }
  function sync(event: StorageEvent) {
    if (event.key === STORAGE_KEY || event.key === null)
      preference.value = normalize(event.newValue)
  }
  const stop = watch(preference, apply, { immediate: true, flush: 'sync' })
  system.addEventListener('change', apply)
  window.addEventListener('storage', sync)
  return () => {
    stop()
    system.removeEventListener('change', apply)
    window.removeEventListener('storage', sync)
  }
}
export function useTheme() {
  function setPreference(value: ThemePreference) {
    preference.value = value
    try {
      localStorage.setItem(STORAGE_KEY, value)
      storageAvailable.value = true
    } catch {
      storageAvailable.value = false
    }
  }
  return {
    preference: readonly(preference),
    storageAvailable: readonly(storageAvailable),
    setPreference,
  }
}
