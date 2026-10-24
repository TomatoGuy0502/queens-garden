import type { Difficulty } from './types'
import { DIFFICULTIES } from './levels'

export interface GameOutcome {
  size: number
  difficulty: Difficulty
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
}
export interface RecordedOutcome {
  stats: StatsData
  previousBest: number | null
  newBest: boolean
}

export const bucketKey = (size: number, difficulty: Difficulty) => `${size}:${difficulty}`
export const emptyStats = (): StatsData => ({ buckets: {} })
export function formatDuration(seconds: number): string {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

const count = (value: unknown) =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null
/** Stored data is untrusted: keep only well-formed buckets and drop everything else. */
export function parseStats(raw: unknown): StatsData {
  const stats = emptyStats()
  if (!raw || typeof raw !== 'object') return stats
  const buckets = (raw as { buckets?: unknown }).buckets
  if (!buckets || typeof buckets !== 'object') return stats
  for (const [key, value] of Object.entries(buckets)) {
    const [size, difficulty] = key.split(':')
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
  const key = bucketKey(outcome.size, outcome.difficulty)
  const current = stats.buckets[key]
  const previousBest = current?.bestSeconds ?? null
  const next: BucketStats = {
    completed: (current?.completed ?? 0) + 1,
    totalSeconds: (current?.totalSeconds ?? 0) + outcome.seconds,
    bestSeconds: Math.min(previousBest ?? Infinity, outcome.seconds),
    withoutHints: (current?.withoutHints ?? 0) + (outcome.hints === 0 ? 1 : 0),
  }
  return {
    stats: { buckets: { ...stats.buckets, [key]: next } },
    previousBest,
    // The first completion of a bucket sets a baseline, not a record worth celebrating.
    newBest: previousBest !== null && outcome.seconds < previousBest,
  }
}
export const averageSeconds = (bucket: BucketStats) =>
  Math.round(bucket.totalSeconds / bucket.completed)
