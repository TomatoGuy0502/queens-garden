import { expect, it } from 'vitest'
import {
  averageSeconds,
  emptyStats,
  formatDuration,
  parseStats,
  mergeStats,
  recordOutcome,
  type GameOutcome,
} from '../queens/stats'

const outcome = (seconds: number, hints = 0): GameOutcome => ({
  size: 8,
  difficulty: 'medium',
  seconds,
  moves: 20,
  hints,
})

it('formats durations like the game timer', () => {
  expect(formatDuration(0)).toBe('00:00')
  expect(formatDuration(65)).toBe('01:05')
  expect(formatDuration(75 * 60 + 9)).toBe('75:09')
})
it('records completions per size and difficulty without mutating the previous stats', () => {
  const first = recordOutcome(emptyStats(), outcome(120))
  expect(first.previousBest).toBeNull()
  expect(first.newBest).toBe(false)
  expect(first.stats.buckets['8:medium']).toEqual({
    completed: 1,
    totalSeconds: 120,
    bestSeconds: 120,
    withoutHints: 1,
  })
  const other = recordOutcome(first.stats, { ...outcome(50), size: 6, difficulty: 'easy' })
  expect(Object.keys(other.stats.buckets).sort()).toEqual(['6:easy', '8:medium'])
  expect(emptyStats()).toEqual({ buckets: {}, dailies: {} })
})
it('only celebrates a strictly faster time and counts hint-free completions', () => {
  let stats = recordOutcome(emptyStats(), outcome(100)).stats
  const slower = recordOutcome(stats, outcome(130, 2))
  expect(slower.newBest).toBe(false)
  expect(slower.previousBest).toBe(100)
  expect(slower.stats.buckets['8:medium'].bestSeconds).toBe(100)
  stats = slower.stats
  expect(recordOutcome(stats, outcome(100)).newBest).toBe(false)
  const faster = recordOutcome(stats, outcome(80))
  expect(faster.newBest).toBe(true)
  expect(faster.previousBest).toBe(100)
  expect(faster.stats.buckets['8:medium']).toMatchObject({
    completed: 3,
    bestSeconds: 80,
    withoutHints: 2,
  })
  expect(averageSeconds(faster.stats.buckets['8:medium'])).toBe(Math.round(310 / 3))
})
it('keeps only well formed stored buckets', () => {
  const good = { completed: 2, totalSeconds: 90, bestSeconds: 40, withoutHints: 1 }
  expect(parseStats(null)).toEqual(emptyStats())
  expect(parseStats('x')).toEqual(emptyStats())
  expect(parseStats({ buckets: 3 })).toEqual(emptyStats())
  expect(
    parseStats({
      buckets: {
        '8:medium': good,
        '8:legendary': good,
        'x:easy': good,
        '6:easy': { ...good, completed: 0 },
        '7:easy': { ...good, withoutHints: 3 },
        '9:easy': { ...good, bestSeconds: 100 },
        '10:hard': { ...good, totalSeconds: -1 },
        '12:hard': { ...good, completed: 1.5 },
      },
    }),
  ).toEqual({ buckets: { '8:medium': good }, dailies: {} })
})
it('stores the best result per daily challenge date and counts it in the size bucket too', () => {
  const day = '2026-10-27'
  const first = recordOutcome(emptyStats(), { ...outcome(90, 1), daily: day })
  expect(first.stats.dailies).toEqual({ [day]: { seconds: 90, moves: 20, hints: 1 } })
  expect(first.stats.buckets['8:medium'].completed).toBe(1)
  const slower = recordOutcome(first.stats, { ...outcome(120), daily: day })
  expect(slower.stats.dailies[day].seconds).toBe(90)
  const faster = recordOutcome(slower.stats, { ...outcome(60, 0), daily: day })
  expect(faster.stats.dailies[day]).toEqual({ seconds: 60, moves: 20, hints: 0 })
  expect(recordOutcome(faster.stats, outcome(10)).stats.dailies).toEqual(faster.stats.dailies)
})
it('only keeps the newest daily dates and validates stored ones', () => {
  let stats = emptyStats()
  const start = new Date(Date.UTC(2025, 0, 1))
  for (let i = 0; i < 405; i++) {
    const day = new Date(start.getTime() + i * 86400000).toISOString().slice(0, 10)
    stats = recordOutcome(stats, { ...outcome(10), daily: day }).stats
  }
  const days = Object.keys(stats.dailies)
  expect(days).toHaveLength(400)
  expect(days[0]).toBe(new Date(start.getTime() + 5 * 86400000).toISOString().slice(0, 10))
  const parsed = parseStats({
    buckets: {},
    dailies: {
      '2026-10-27': { seconds: 5, moves: 6, hints: 0 },
      '2026-13-40': { seconds: 5, moves: 6, hints: 0 },
      '2026-10-28': { seconds: -5, moves: 6, hints: 0 },
      today: { seconds: 5, moves: 6, hints: 0 },
    },
  })
  expect(Object.keys(parsed.dailies)).toEqual(['2026-10-27'])
})
it('merges two play histories by summing buckets and keeping the better daily', () => {
  const a = recordOutcome(emptyStats(), {
    size: 8,
    difficulty: 'easy',
    seconds: 100,
    moves: 20,
    hints: 1,
    daily: '2026-10-26',
  }).stats
  const b = recordOutcome(
    recordOutcome(emptyStats(), { size: 8, difficulty: 'easy', seconds: 60, moves: 18, hints: 0 })
      .stats,
    { size: 6, difficulty: 'hard', seconds: 50, moves: 15, hints: 0, daily: '2026-10-26' },
  ).stats
  const merged = mergeStats(a, b)
  expect(merged.buckets['8:easy']).toEqual({
    completed: 2,
    totalSeconds: 160,
    bestSeconds: 60,
    withoutHints: 1,
  })
  expect(merged.buckets['6:hard'].completed).toBe(1)
  expect(merged.dailies['2026-10-26']).toEqual({ seconds: 50, moves: 15, hints: 0 })
  expect(mergeStats(merged, emptyStats())).toEqual(merged)
})
it('keeps stacked results apart from the flat board of the same size', () => {
  const flat = recordOutcome(emptyStats(), { ...outcome(90), size: 6, difficulty: 'easy' }).stats
  const both = recordOutcome(flat, { ...outcome(40), size: 6, difficulty: 'easy', stacked: true })
  expect(Object.keys(both.stats.buckets).sort()).toEqual(['3d:6:easy', '6:easy'])
  expect(both.previousBest).toBeNull()
  expect(parseStats(JSON.parse(JSON.stringify(both.stats)))).toEqual(both.stats)
})
