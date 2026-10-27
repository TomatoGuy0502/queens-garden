import type { Difficulty } from './types'

export interface DailyConfig {
  size: number
  difficulty: Difficulty
}
/** Sunday to Saturday: a gentle start of the week that builds toward harder weekend boards. */
const WEEKLY: readonly DailyConfig[] = [
  { size: 10, difficulty: 'hard' },
  { size: 6, difficulty: 'easy' },
  { size: 7, difficulty: 'easy' },
  { size: 8, difficulty: 'medium' },
  { size: 8, difficulty: 'medium' },
  { size: 9, difficulty: 'hard' },
  { size: 8, difficulty: 'expert' },
]
/** A seed can fail the fixed generation budget; every player walks the same fallback sequence. */
export const DAILY_MAX_ATTEMPTS = 8

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/
const utc = (key: string) => {
  const [, year, month, day] = DATE_KEY.exec(key)!
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
}
export function isDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_KEY.test(value)) return false
  return utc(value).toISOString().startsWith(value)
}
/** The calendar day in Taiwan (UTC+8, no daylight saving): one shared day for every player. */
export function dateKey(date: Date = new Date()): string {
  return new Date(date.getTime() + 8 * 3600000).toISOString().slice(0, 10)
}
export function shiftDay(key: string, days: number): string {
  const date = utc(key)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
export function dailyConfig(key: string): DailyConfig {
  return { ...WEEKLY[utc(key).getUTCDay()] }
}
export function dailySeed(key: string, attempt: number): number {
  let hash = 0x811c9dc5
  for (const char of `queens-daily:${key}:${attempt}`) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193)
  }
  return hash >>> 0
}
/** Whether a loaded puzzle really is that day's challenge, so a crafted link cannot claim a day. */
export function isDailyPuzzle(
  key: string,
  puzzle: { size: number; difficulty: Difficulty; seed: number },
): boolean {
  const config = dailyConfig(key)
  return (
    puzzle.size === config.size &&
    puzzle.difficulty === config.difficulty &&
    Array.from({ length: DAILY_MAX_ATTEMPTS }, (_, attempt) => dailySeed(key, attempt)).includes(
      puzzle.seed,
    )
  )
}
/** Consecutive completed days; a streak stays alive until the end of the day after the last win. */
export function dailyStreak(completed: Readonly<Record<string, unknown>>, today: string): number {
  let day = today in completed ? today : shiftDay(today, -1)
  let streak = 0
  while (day in completed) {
    streak++
    day = shiftDay(day, -1)
  }
  return streak
}
