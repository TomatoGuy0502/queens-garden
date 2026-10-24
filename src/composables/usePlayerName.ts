import { shallowRef, watch } from 'vue'
const KEY = 'queens:player-name'
export function usePlayerName() {
  let saved = ''
  try {
    saved = localStorage.getItem(KEY)?.trim().slice(0, 24) ?? ''
  } catch {
    /* Storage is optional. */
  }
  const name = shallowRef(saved)
  watch(name, (value) => {
    try {
      if (value.trim()) localStorage.setItem(KEY, value.trim().slice(0, 24))
      else localStorage.removeItem(KEY)
    } catch {
      /* Keep the nickname usable when storage is unavailable. */
    }
  })
  return name
}
