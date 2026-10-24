import { shallowRef } from 'vue'
type Status = 'done' | 'dismissed' | null
const STORAGE_KEY = 'queens:tutorial:v1'
const storageAvailable = shallowRef(true)
function read(): Status {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'done' || value === 'dismissed' ? value : null
  } catch {
    storageAvailable.value = false
    return null
  }
}
const status = shallowRef<Status>(read())
function write(value: Exclude<Status, null>) {
  status.value = value
  try {
    localStorage.setItem(STORAGE_KEY, value)
    storageAvailable.value = true
  } catch {
    storageAvailable.value = false
  }
}
export function useTutorialStatus() {
  return {
    status,
    storageAvailable,
    // A finished tutorial is never downgraded by dismissing the prompt later.
    markDone: () => write('done'),
    dismiss: () => status.value ?? write('dismissed'),
  }
}
