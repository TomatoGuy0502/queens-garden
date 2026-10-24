import { shallowRef } from 'vue'
import { parseProgress, type SavedProgress } from '../queens/progress'
const STORAGE_KEY = 'queens:solo-progress:v1'
const storageAvailable = shallowRef(true)
// Read on demand rather than cached, so another tab's newer save is never overwritten blindly.
function read(): SavedProgress | null {
  try {
    return parseProgress(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'))
  } catch {
    storageAvailable.value = false
    return null
  }
}
function write(progress: SavedProgress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
    storageAvailable.value = true
  } catch {
    storageAvailable.value = false
  }
}
function clear() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    storageAvailable.value = false
  }
}
export function useSoloProgress() {
  return { read, write, clear, storageAvailable }
}
