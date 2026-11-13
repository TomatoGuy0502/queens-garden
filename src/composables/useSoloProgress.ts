import { shallowRef } from 'vue'
import { parseProgress, type ProgressRules, type SavedProgress } from '../queens/progress'
const STORAGE_KEY = 'queens:solo-progress:v1'
const storageAvailable = shallowRef(true)
/** Each kind of board keeps its unfinished game under its own key, checked by its own rules. */
export function useSoloProgress(key = STORAGE_KEY, rules?: ProgressRules) {
  // Read on demand rather than cached, so another tab's newer save is never overwritten blindly.
  function read(): SavedProgress | null {
    try {
      return parseProgress(JSON.parse(localStorage.getItem(key) ?? 'null'), rules)
    } catch {
      storageAvailable.value = false
      return null
    }
  }
  function write(progress: SavedProgress) {
    try {
      localStorage.setItem(key, JSON.stringify(progress))
      storageAvailable.value = true
    } catch {
      storageAvailable.value = false
    }
  }
  function clear() {
    try {
      localStorage.removeItem(key)
    } catch {
      storageAvailable.value = false
    }
  }
  return { read, write, clear, storageAvailable }
}
