import { eq } from 'drizzle-orm'
import { type PgDatabase, type PgQueryResultHKT } from 'drizzle-orm/pg-core'
import * as schema from './schema'
import { RoomError } from './model'
export interface AccountRepository {
  nickname(userId: string): Promise<string | null>
  setNickname(userId: string, nickname: string): Promise<void>
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
  return {
    async nickname(userId) {
      const rows = await db
        .select({ nickname: schema.playerProfiles.nickname })
        .from(schema.playerProfiles)
        .where(eq(schema.playerProfiles.userId, userId))
      return rows[0]?.nickname ?? null
    },
    async setNickname(userId, nickname) {
      try {
        await db
          .insert(schema.playerProfiles)
          .values({ userId, nickname })
          .onConflictDoUpdate({ target: schema.playerProfiles.userId, set: { nickname } })
      } catch (error) {
        if (uniqueViolation(error)) throw new RoomError('NICKNAME_TAKEN')
        throw error
      }
    },
    async delete(userId) {
      await db.delete(schema.playerProfiles).where(eq(schema.playerProfiles.userId, userId))
    },
  }
}
