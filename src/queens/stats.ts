import type { Difficulty } from './types'
import { DIFFICULTIES } from './levels'
import { isDateKey } from './daily'

export interface GameOutcome {
  size: number
  difficulty: Difficulty
  seconds: number
  moves: number
  hints: number
  /** Played on the stacked (3D) board, whose results are kept apart from the flat board's. */
  stacked?: boolean
  /** Local date key when the game was that day's challenge. */
  daily?: string
}
export interface DailyResult {
  seconds: number
  moves: number
  hints: number
}
export interface BucketStats {
  completed: number
  totalSeconds: number
  bestSeconds: number
  /** Completed without asking for a single hint. */
  withoutHints: number
}
export interface StatsData {
  buckets: Record<string, BucketStats>
  /** Best result per daily challenge date. */
  dailies: Record<string, DailyResult>
}
const MAX_DAILIES = 400
export interface RecordedOutcome {
  stats: StatsData
  previousBest: number | null
  newBest: boolean
}

export const bucketKey = (size: number, difficulty: Difficulty, stacked = false) =>
  `${stacked ? '3d:' : ''}${size}:${difficulty}`
export const emptyStats = (): StatsData => ({ buckets: {}, dailies: {} })
export function formatDuration(seconds: number): string {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

const count = (value: unknown) =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null
/** Stored data is untrusted: keep only well-formed buckets and drop everything else. */
export function parseStats(raw: unknown): StatsData {
  const stats = emptyStats()
  if (!raw || typeof raw !== 'object') return stats
  const { buckets, dailies } = raw as { buckets?: unknown; dailies?: unknown }
  if (dailies && typeof dailies === 'object')
    for (const [date, value] of Object.entries(dailies)) {
      const entry = value as Partial<Record<keyof DailyResult, unknown>> | null
      const seconds = count(entry?.seconds),
        moves = count(entry?.moves),
        hints = count(entry?.hints)
      if (isDateKey(date) && seconds !== null && moves !== null && hints !== null)
        stats.dailies[date] = { seconds, moves, hints }
    }
  if (!buckets || typeof buckets !== 'object') return stats
  for (const [key, value] of Object.entries(buckets)) {
    const [size, difficulty] = key.replace(/^3d:/, '').split(':')
    const entry = value as Partial<Record<keyof BucketStats, unknown>> | null
    const completed = count(entry?.completed),
      totalSeconds = count(entry?.totalSeconds),
      bestSeconds = count(entry?.bestSeconds),
      withoutHints = count(entry?.withoutHints)
    if (
      !/^\d+$/.test(size) ||
      !DIFFICULTIES.some((item) => item === difficulty) ||
      !completed ||
      totalSeconds === null ||
      bestSeconds === null ||
      withoutHints === null ||
      withoutHints > completed ||
      bestSeconds > totalSeconds
    )
      continue
    stats.buckets[key] = { completed, totalSeconds, bestSeconds, withoutHints }
  }
  return stats
}

export function recordOutcome(stats: StatsData, outcome: GameOutcome): RecordedOutcome {
  const key = bucketKey(outcome.size, outcome.difficulty, outcome.stacked)
  const current = stats.buckets[key]
  const previousBest = current?.bestSeconds ?? null
  const next: BucketStats = {
    completed: (current?.completed ?? 0) + 1,
    totalSeconds: (current?.totalSeconds ?? 0) + outcome.seconds,
    bestSeconds: Math.min(previousBest ?? Infinity, outcome.seconds),
    withoutHints: (current?.withoutHints ?? 0) + (outcome.hints === 0 ? 1 : 0),
  }
  const dailies = { ...stats.dailies }
  const day = outcome.daily
  if (day && (!dailies[day] || outcome.seconds < dailies[day].seconds))
    dailies[day] = { seconds: outcome.seconds, moves: outcome.moves, hints: outcome.hints }
  // Keep the newest dates only, so long-term play cannot grow the stored data without bound.
  const kept = Object.fromEntries(Object.entries(dailies).sort().slice(-MAX_DAILIES))
  return {
    stats: { buckets: { ...stats.buckets, [key]: next }, dailies: kept },
    previousBest,
    // The first completion of a bucket sets a baseline, not a record worth celebrating.
    newBest: previousBest !== null && outcome.seconds < previousBest,
  }
}
/** Combines two separate play histories, such as a device's games and an account's. */
export function mergeStats(a: StatsData, b: StatsData): StatsData {
  const buckets = { ...a.buckets }
  for (const [key, other] of Object.entries(b.buckets)) {
    const mine = buckets[key]
    buckets[key] = mine
      ? {
          completed: mine.completed + other.completed,
          totalSeconds: mine.totalSeconds + other.totalSeconds,
          bestSeconds: Math.min(mine.bestSeconds, other.bestSeconds),
          withoutHints: mine.withoutHints + other.withoutHints,
        }
      : other
  }
  const dailies = { ...a.dailies }
  for (const [day, other] of Object.entries(b.dailies))
    if (!dailies[day] || other.seconds < dailies[day].seconds) dailies[day] = other
  return {
    buckets,
    dailies: Object.fromEntries(Object.entries(dailies).sort().slice(-MAX_DAILIES)),
  }
}
export const averageSeconds = (bucket: BucketStats) =>
  Math.round(bucket.totalSeconds / bucket.completed)
