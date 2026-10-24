import { computed, shallowRef, watch } from 'vue'
import { DEFAULT_GUIDANCE, type BoardGuidance } from '../queens/guidance'
const STORAGE_KEY = 'queens:board-guidance:v1'
const guidanceStorageAvailable = shallowRef(true)
function read(): BoardGuidance {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    if (!stored || typeof stored !== 'object' || Array.isArray(stored))
      return { ...DEFAULT_GUIDANCE }
    const values = stored as Record<string, unknown>
    const value = (key: keyof BoardGuidance) =>
      typeof values[key] === 'boolean' ? values[key] : DEFAULT_GUIDANCE[key]
    return {
      enabled: value('enabled'),
      rows: value('rows'),
      columns: value('columns'),
      regions: value('regions'),
      adjacent: value('adjacent'),
    }
  } catch {
    guidanceStorageAvailable.value = false
    return { ...DEFAULT_GUIDANCE }
  }
}
const guidance = shallowRef<BoardGuidance>(read())
watch(guidance, (value) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    guidanceStorageAvailable.value = true
  } catch {
    guidanceStorageAvailable.value = false
  }
})
const LAYOUT_STORAGE_KEY = 'queens:expanded-board:v1'
const layoutStorageAvailable = shallowRef(true)
function readExpandedBoard() {
  try {
    return localStorage.getItem(LAYOUT_STORAGE_KEY) === 'true'
  } catch {
    layoutStorageAvailable.value = false
    return false
  }
}
const expandedBoard = shallowRef(readExpandedBoard())
watch(expandedBoard, (value) => {
  try {
    localStorage.setItem(LAYOUT_STORAGE_KEY, String(value))
    layoutStorageAvailable.value = true
  } catch {
    layoutStorageAvailable.value = false
  }
})
const storageAvailable = computed(
  () => guidanceStorageAvailable.value && layoutStorageAvailable.value,
)
export function useGamePreferences() {
  return { guidance, expandedBoard, storageAvailable }
}
