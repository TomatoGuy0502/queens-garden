import { shallowRef, watch } from 'vue'
import { DEFAULT_GUIDANCE, type BoardGuidance } from '../queens/guidance'
const STORAGE_KEY = 'queens:board-guidance:v1'
export function useGamePreferences() {
  const storageAvailable = shallowRef(true)
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
      storageAvailable.value = false
      return { ...DEFAULT_GUIDANCE }
    }
  }
  const guidance = shallowRef<BoardGuidance>(read())
  watch(guidance, (value) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
      storageAvailable.value = true
    } catch {
      storageAvailable.value = false
    }
  })
  return { guidance, storageAvailable }
}
