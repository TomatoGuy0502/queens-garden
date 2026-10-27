import { shallowRef } from 'vue'
import {
  emptyStats,
  parseStats,
  recordOutcome,
  type GameOutcome,
  type RecordedOutcome,
  type StatsData,
} from '../queens/stats'
import { request } from '../services/api'
const STORAGE_KEY = 'queens:stats:v1'
/** The signed-in user whose statistics the local copy mirrors; absent for a guest's own stats. */
const OWNER_KEY = 'queens:stats:owner'
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
function owner() {
  try {
    return localStorage.getItem(OWNER_KEY)
  } catch {
    return null
  }
}
const stats = shallowRef<StatsData>(read())
// Set once the account's statistics are loaded; every game is then also recorded there.
let synced = false
function adopt(value: StatsData) {
  stats.value = parseStats(value)
  write(stats.value)
}
/**
 * Loads a signed-in player's statistics. The first time on this device, its guest statistics
 * are added to the account once; afterwards the local copy only mirrors the account.
 */
export async function syncStats(userId: string) {
  try {
    const mine = owner() === userId
    adopt(
      mine
        ? await request<StatsData>('/api/stats')
        : await request<StatsData>('/api/stats', {
            method: 'POST',
            body: owner() === null ? read() : emptyStats(),
          }),
    )
    localStorage.setItem(OWNER_KEY, userId)
    synced = true
  } catch {
    /* Offline or storage blocked: keep playing on the local copy and sync on the next visit. */
  }
}
/** After signing out the account's statistics leave the device, so the next player starts clean. */
export function forgetStats() {
  synced = false
  if (owner() === null) return
  try {
    localStorage.removeItem(OWNER_KEY)
  } catch {
    /* Nothing stored to remove. */
  }
  stats.value = emptyStats()
  write(stats.value)
}
function record(outcome: GameOutcome): RecordedOutcome {
  // Read again so a second tab's results are not overwritten by this tab's older copy.
  const result = recordOutcome(storageAvailable.value ? read() : stats.value, outcome)
  stats.value = result.stats
  write(result.stats)
  // shortcut: a game whose upload fails stays local only and is replaced by the account's copy
  // on the next sync; queue failed uploads if players report missing games.
  if (synced)
    void request<StatsData>('/api/stats/record', { method: 'POST', body: outcome }).then(
      adopt,
      () => undefined,
    )
  return result
}
function reset() {
  stats.value = emptyStats()
  write(stats.value)
  if (synced) void request('/api/stats', { method: 'DELETE' }).catch(() => undefined)
}
export function useGameStats() {
  return { stats, storageAvailable, record, reset }
}
