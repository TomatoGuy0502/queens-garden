import { and, count, eq, sql } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { GENERATOR_VERSION } from '../src/queens/version'
import * as schema from './schema'
import {
  CATALOG_VALIDATION_VERSION,
  catalogRecord,
  recipeKey,
  replay,
  type CatalogBucket,
  type CatalogRepository,
} from './puzzleCatalogModel'
export function databaseCatalogRepository<T extends PgQueryResultHKT>(
  db: PgDatabase<T, typeof schema>,
): CatalogRepository {
  const board = schema.puzzleCatalog,
    recipes = schema.puzzleRecipes
  const current = () =>
    and(
      eq(board.version, GENERATOR_VERSION),
      eq(board.validationVersion, CATALOG_VALIDATION_VERSION),
      eq(board.enabled, true),
    )
  const fresh = (bucket: CatalogBucket) =>
    and(
      current(),
      eq(board.size, bucket.size),
      eq(board.difficulty, bucket.difficulty),
      eq(board.useCount, 0),
    )
  const used = { useCount: sql`${board.useCount} + 1`, lastUsedAt: sql`now()` }
  return {
    async save(record, options = {}) {
      await db.transaction(async (tx) => {
        await tx
          .insert(board)
          .values({
            hash: record.hash,
            version: record.puzzle.version,
            validationVersion: CATALOG_VALIDATION_VERSION,
            size: record.puzzle.size,
            difficulty: record.puzzle.difficulty,
            payload: record.puzzle,
            useCount: options.served ? 1 : 0,
            lastUsedAt: options.served ? new Date() : undefined,
          })
          .onConflictDoUpdate({
            target: board.hash,
            set: {
              enabled: true,
              payload: record.puzzle,
              verifiedAt: new Date(),
              useCount: options.served ? sql`${board.useCount} + 1` : board.useCount,
              lastUsedAt: options.served ? new Date() : board.lastUsedAt,
            },
          })
        const { id, seed, generation } = record.puzzle
        await tx
          .insert(recipes)
          .values({
            key: record.recipeKey,
            boardHash: record.hash,
            replay: { id, seed, generation },
          })
          .onConflictDoUpdate({
            target: recipes.key,
            set: { boardHash: record.hash, replay: { id, seed, generation } },
          })
      })
    },
    async takeFresh(bucket) {
      return db.transaction(async (tx) => {
        const rows = await tx
          .select({ hash: board.hash, payload: board.payload })
          .from(board)
          .where(fresh(bucket))
          .orderBy(board.createdAt, board.hash)
          .limit(1)
          .for('update', { skipLocked: true })
        const row = rows[0]
        if (!row) return null
        await tx.update(board).set(used).where(eq(board.hash, row.hash))
        return { ...catalogRecord(row.payload), hash: row.hash }
      })
    },
    async exact(request) {
      return db.transaction(async (tx) => {
        const rows = await tx
          .select({ hash: board.hash, payload: board.payload, metadata: recipes.replay })
          .from(recipes)
          .innerJoin(board, eq(recipes.boardHash, board.hash))
          .where(and(eq(recipes.key, recipeKey(request)), current()))
          .limit(1)
          .for('update', { of: board })
        const row = rows[0]
        if (!row) return null
        const record = { ...catalogRecord(replay(row.payload, row.metadata)), hash: row.hash }
        await tx.update(board).set(used).where(eq(board.hash, record.hash))
        return record
      })
    },
    async use(hash) {
      await db.update(board).set(used).where(eq(board.hash, hash))
    },
    async invalidate(hash) {
      await db.update(board).set({ enabled: false }).where(eq(board.hash, hash))
    },
    async countFresh(bucket) {
      const rows = await db.select({ value: count() }).from(board).where(fresh(bucket))
      return rows[0]?.value ?? 0
    },
  }
}
