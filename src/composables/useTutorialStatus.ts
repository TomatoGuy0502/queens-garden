import { shallowRef } from 'vue'
type Status = 'done' | 'dismissed' | null
const STORAGE_KEYS = { flat: 'queens:tutorial:v1', stacked: 'queens:tutorial3d:v1' } as const
type Board = keyof typeof STORAGE_KEYS
const storageAvailable = shallowRef(true)
function read(board: Board): Status {
  try {
    const value = localStorage.getItem(STORAGE_KEYS[board])
    return value === 'done' || value === 'dismissed' ? value : null
  } catch {
    storageAvailable.value = false
    return null
  }
}
const statuses = {
  flat: shallowRef<Status>(read('flat')),
  stacked: shallowRef<Status>(read('stacked')),
}
function write(board: Board, value: Exclude<Status, null>) {
  statuses[board].value = value
  try {
    localStorage.setItem(STORAGE_KEYS[board], value)
    storageAvailable.value = true
  } catch {
    storageAvailable.value = false
  }
}
/** The classic and the stacked tutorial are learned, and their prompts dismissed, separately. */
export function useTutorialStatus(board: Board = 'flat') {
  const status = statuses[board]
  return {
    status,
    storageAvailable,
    // A finished tutorial is never downgraded by dismissing the prompt later.
    markDone: () => write(board, 'done'),
    dismiss: () => status.value ?? write(board, 'dismissed'),
  }
}
