import { and, eq, isNotNull, isNull, lte, or, sql } from 'drizzle-orm'
import { type PgDatabase, type PgQueryResultHKT } from 'drizzle-orm/pg-core'
import * as schema from './schema'
import { RoomError } from './model'
import type { RankedResult } from '../src/queens/replay'
import type { LeaderboardEntry } from '../shared/account'
export interface DailyRun {
  startedAt: Date
  finished: boolean
}
/** Everything the game stores about a signed-in player. */
export interface AccountRepository {
  nickname(userId: string): Promise<string | null>
  setNickname(userId: string, nickname: string): Promise<void>
  /** Starts the player's ranked run for `day`, or returns the one already started. */
  startRun(userId: string, day: string, now: Date): Promise<DailyRun>
  /** Records the result once; false when there is no unfinished run. */
  finishRun(userId: string, day: string, result: RankedResult, now: Date): Promise<boolean>
  /** The top `limit` finishers of a day, plus `userId`'s own row wherever it ranks. */
  leaderboard(day: string, userId: string | null, limit: number): Promise<LeaderboardEntry[]>
  /** Removes everything the game stores about a user. */
  delete(userId: string): Promise<void>
}
const uniqueViolation = (error: unknown): boolean =>
  !!error &&
  typeof error === 'object' &&
  (('code' in error && error.code === '23505') ||
    ('cause' in error && uniqueViolation(error.cause)))
export function databaseAccountRepository<T extends PgQueryResultHKT>(
  db: PgDatabase<T, typeof schema>,
): AccountRepository {
  const { playerProfiles: profiles, dailyRuns: runs } = schema
  return {
    async nickname(userId) {
      const rows = await db
        .select({ nickname: profiles.nickname })
        .from(profiles)
        .where(eq(profiles.userId, userId))
      return rows[0]?.nickname ?? null
    },
    async setNickname(userId, nickname) {
      try {
        await db
          .insert(profiles)
          .values({ userId, nickname })
          .onConflictDoUpdate({ target: profiles.userId, set: { nickname } })
      } catch (error) {
        if (uniqueViolation(error)) throw new RoomError('NICKNAME_TAKEN')
        throw error
      }
    },
    async startRun(userId, day, now) {
      await db.insert(runs).values({ userId, day, startedAt: now }).onConflictDoNothing()
      const [run] = await db
        .select({ startedAt: runs.startedAt, finishedAt: runs.finishedAt })
        .from(runs)
        .where(and(eq(runs.userId, userId), eq(runs.day, day)))
      return { startedAt: run.startedAt, finished: run.finishedAt !== null }
    },
    async finishRun(userId, day, result, now) {
      const written = await db
        .update(runs)
        .set({ ...result, finishedAt: now })
        .where(and(eq(runs.userId, userId), eq(runs.day, day), isNull(runs.finishedAt)))
        .returning({ day: runs.day })
      return written.length > 0
    },
    async leaderboard(day, userId, limit) {
      const ranked = db
        .select({
          userId: runs.userId,
          nickname: profiles.nickname,
          seconds: sql<number>`${runs.seconds}`.as('seconds'),
          moves: sql<number>`${runs.moves}`.as('moves'),
          hints: sql<number>`${runs.hints}`.as('hints'),
          score: sql<number>`${runs.score}`.as('score'),
          rank: sql<number>`rank() over (order by ${runs.score}, ${runs.moves}, ${runs.finishedAt})`
            .mapWith(Number)
            .as('rank'),
        })
        .from(runs)
        .innerJoin(profiles, eq(profiles.userId, runs.userId))
        .where(and(eq(runs.day, day), isNotNull(runs.finishedAt)))
        .as('ranked')
      const rows = await db
        .select()
        .from(ranked)
        .where(or(lte(ranked.rank, limit), eq(ranked.userId, userId ?? '')))
        .orderBy(ranked.rank)
      return rows.map(({ userId: id, ...entry }) => ({ ...entry, me: id === userId }))
    },
    async delete(userId) {
      await db.transaction(async (tx) => {
        await tx.delete(runs).where(eq(runs.userId, userId))
        await tx.delete(profiles).where(eq(profiles.userId, userId))
      })
    },
  }
}
