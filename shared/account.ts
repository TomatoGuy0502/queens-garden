import { z } from 'zod'
import { runLogSchema } from '../src/queens/replay'
export const profileSchema = z.object({ nickname: z.string().trim().min(1).max(24) })
export const finishRunSchema = z.object({
  day: z.string(),
  seed: z.number().int().min(0).max(0xffffffff),
  log: runLogSchema,
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
