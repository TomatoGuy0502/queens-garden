import { shallowRef } from 'vue'
import {
  emptyStats,
  parseStats,
  recordOutcome,
  type GameOutcome,
  type RecordedOutcome,
  type StatsData,
} from '../queens/stats'
const STORAGE_KEY = 'queens:stats:v1'
const storageAvailable = shallowRef(true)
function read(): StatsData {
  try {
    return parseStats(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'))
  } catch {
    storageAvailable.value = false
    return emptyStats()
  }
}
function write(value: StatsData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    storageAvailable.value = true
  } catch {
    storageAvailable.value = false
  }
}
const stats = shallowRef<StatsData>(read())
function record(outcome: GameOutcome): RecordedOutcome {
  // Read again so a second tab's results are not overwritten by this tab's older copy.
  const result = recordOutcome(storageAvailable.value ? read() : stats.value, outcome)
  stats.value = result.stats
  write(result.stats)
  return result
}
function reset() {
  stats.value = emptyStats()
  write(stats.value)
}
export function useGameStats() {
  return { stats, storageAvailable, record, reset }
}
