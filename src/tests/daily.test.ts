import { expect, it } from 'vitest'
import {
  DAILY_MAX_ATTEMPTS,
  dailyConfig,
  dailySeed,
  dailyStreak,
  dateKey,
  isDailyPuzzle,
  isDateKey,
  shiftDay,
} from '../queens/daily'
import { generatePuzzle } from '../queens/generator'

it('uses the Taiwan calendar day and validates stored date keys', () => {
  expect(dateKey(new Date('2026-10-05T23:59:00+08:00'))).toBe('2026-10-05')
  expect(dateKey(new Date('2026-10-05T16:00:00Z'))).toBe('2026-10-06')
  expect(dateKey(new Date('2026-01-01T00:00:00+08:00'))).toBe('2026-01-01')
  expect(dateKey(new Date('2025-12-31T15:59:59Z'))).toBe('2025-12-31')
  expect(isDateKey('2026-02-28')).toBe(true)
  expect(isDateKey('2026-02-30')).toBe(false)
  expect(isDateKey('2026-2-3')).toBe(false)
  expect(isDateKey(20261025)).toBe(false)
})
it('moves across month and year boundaries', () => {
  expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28')
  expect(shiftDay('2028-03-01', -1)).toBe('2028-02-29')
  expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01')
})
it('gives every player the same seeds and rotates the weekly board', () => {
  expect(dailySeed('2026-10-25', 0)).toBe(dailySeed('2026-10-25', 0))
  const seeds = new Set([
    ...Array.from({ length: DAILY_MAX_ATTEMPTS }, (_, i) => dailySeed('2026-10-25', i)),
    dailySeed('2026-10-26', 0),
  ])
  expect(seeds.size).toBe(DAILY_MAX_ATTEMPTS + 1)
  for (const seed of seeds) expect(seed).toBeLessThanOrEqual(0xffffffff)
  const week = Array.from({ length: 7 }, (_, i) => dailyConfig(shiftDay('2026-10-25', i)))
  expect(new Set(week.map((c) => `${c.size}-${c.difficulty}`)).size).toBeGreaterThan(4)
  expect(dailyConfig('2026-10-25')).toEqual({ size: 10, difficulty: 'hard' })
  expect(dailyConfig('2026-10-31')).toEqual({ size: 8, difficulty: 'expert' })
})
it('recognises only that day’s puzzle as the daily challenge', () => {
  const config = dailyConfig('2026-10-27')
  const puzzle = { ...config, seed: dailySeed('2026-10-27', 2) }
  expect(isDailyPuzzle('2026-10-27', puzzle)).toBe(true)
  expect(isDailyPuzzle('2026-10-27', { ...puzzle, seed: 1 })).toBe(false)
  expect(isDailyPuzzle('2026-10-27', { ...puzzle, size: puzzle.size + 1 })).toBe(false)
  expect(isDailyPuzzle('2026-10-28', puzzle)).toBe(false)
})
it('counts consecutive days and keeps a streak alive until the end of the next day', () => {
  const done = (...days: string[]) => Object.fromEntries(days.map((d) => [d, true]))
  expect(dailyStreak({}, '2026-10-25')).toBe(0)
  expect(dailyStreak(done('2026-10-25'), '2026-10-25')).toBe(1)
  expect(dailyStreak(done('2026-10-23', '2026-10-24'), '2026-10-25')).toBe(2)
  expect(dailyStreak(done('2026-10-22', '2026-10-24'), '2026-10-25')).toBe(1)
  expect(dailyStreak(done('2026-10-22'), '2026-10-25')).toBe(0)
  expect(dailyStreak(done('2026-10-24', '2026-10-25', '2026-10-26'), '2026-10-25')).toBe(2)
})
it('every day of the week can be generated within a few fallback seeds', () => {
  for (let day = 0; day < 7; day++) {
    const key = shiftDay('2026-10-25', day)
    const { size, difficulty } = dailyConfig(key)
    let found = false
    for (let attempt = 0; attempt < DAILY_MAX_ATTEMPTS && !found; attempt++) {
      try {
        generatePuzzle({ size, difficulty, seed: dailySeed(key, attempt) })
        found = true
      } catch {
        // The next fixed fallback seed is tried, exactly as the game does.
      }
    }
    expect(found, `${key} ${size}x${size} ${difficulty}`).toBe(true)
  }
}, 120000)
