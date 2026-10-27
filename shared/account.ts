import { z } from 'zod'
import { runLogSchema } from '../src/queens/replay'
import { BOARD_SIZES, DIFFICULTIES } from '../src/queens/levels'
import { isDateKey } from '../src/queens/daily'
export const profileSchema = z.object({ nickname: z.string().trim().min(1).max(24) })
export const finishRunSchema = z.object({
  day: z.string(),
  seed: z.number().int().min(0).max(0xffffffff),
  log: runLogSchema,
})
const count = z.number().int().nonnegative().max(1e9)
export const outcomeSchema = z.object({
  size: z.number().refine((size) => BOARD_SIZES.some((item) => item === size)),
  difficulty: z.enum(DIFFICULTIES),
  seconds: count,
  moves: count,
  hints: count,
  daily: z.string().refine(isDateKey).optional(),
})
export interface LeaderboardEntry {
  rank: number
  nickname: string
  seconds: number
  moves: number
  hints: number
  score: number
  /** The signed-in reader's own row. */
  me: boolean
}
export interface Leaderboard {
  day: string
  entries: LeaderboardEntry[]
}
/** Reply to starting a ranked daily: how long it has already run on the server's clock. */
export interface RunStart {
  day: string
  elapsedMs: number
  finished: boolean
}
export interface RunFinish {
  rank: number | null
  seconds: number
  hints: number
  score: number
}
