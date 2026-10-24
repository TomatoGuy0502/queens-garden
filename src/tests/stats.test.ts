import { expect, it } from 'vitest'
import {
  averageSeconds,
  emptyStats,
  formatDuration,
  parseStats,
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
  expect(emptyStats().buckets).toEqual({})
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
  ).toEqual({ buckets: { '8:medium': good } })
})
