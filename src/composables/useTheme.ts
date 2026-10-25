import { computed, readonly, shallowRef, watch } from 'vue'
import { usePreferredDark } from '@vueuse/core'

export type ThemePreference = 'system' | 'light' | 'dark'
const STORAGE_KEY = 'queens:theme:v1'
const preference = shallowRef<ThemePreference>('system')
const storageAvailable = shallowRef(true)
const systemDark = usePreferredDark()
/** What is actually shown: the player's choice, or the system's while none was made. */
const resolved = computed(() =>
  preference.value === 'system' ? (systemDark.value ? 'dark' : 'light') : preference.value,
)
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
  function apply() {
    const theme = resolved.value
    document.documentElement.dataset.theme = theme
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#1c1a20' : '#f8f7f3')
  }
  function sync(event: StorageEvent) {
    if (event.key === STORAGE_KEY || event.key === null)
      preference.value = normalize(event.newValue)
  }
  const stop = watch(resolved, apply, { immediate: true, flush: 'sync' })
  window.addEventListener('storage', sync)
  return () => {
    stop()
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
    resolved,
    storageAvailable: readonly(storageAvailable),
    setPreference,
  }
}
