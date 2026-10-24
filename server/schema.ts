import {
  pgTable,
  text,
  jsonb,
  timestamp,
  integer,
  primaryKey,
  bigint,
  boolean,
  index,
} from 'drizzle-orm/pg-core'
import type { QueensPuzzle } from '../src/queens/types'
import type { PuzzleReplay } from './puzzleCatalogModel'
import type { RoomEvent, StoredRoom } from './model'
export const rooms = pgTable('coop_rooms', {
  id: text('id').primaryKey(),
  revision: integer('revision').notNull(),
  state: jsonb('state').$type<StoredRoom>().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
})
export const roomEvents = pgTable(
  'coop_room_events',
  {
    roomId: text('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    revision: integer('revision').notNull(),
    event: jsonb('event').$type<RoomEvent>().notNull(),
  },
  (table) => [primaryKey({ columns: [table.roomId, table.revision] })],
)

// Puzzle definitions outlive rooms; no room foreign key or room-expiry cascade.
export const puzzleCatalog = pgTable(
  'puzzle_catalog',
  {
    hash: text('hash').primaryKey(),
    version: text('generator_version').notNull(),
    validationVersion: text('validation_version').notNull(),
    size: integer('size').notNull(),
    difficulty: text('difficulty').notNull(),
    payload: jsonb('payload').$type<QueensPuzzle>().notNull(),
    enabled: boolean('enabled').notNull().default(true),
    useCount: bigint('use_count', { mode: 'number' }).notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    verifiedAt: timestamp('verified_at', { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  },
  (table) => [
    index('puzzle_catalog_stock_idx').on(
      table.version,
      table.validationVersion,
      table.size,
      table.difficulty,
      table.enabled,
      table.useCount,
      table.createdAt,
    ),
  ],
)
export const puzzleRecipes = pgTable('puzzle_recipes', {
  key: text('key').primaryKey(),
  boardHash: text('board_hash')
    .notNull()
    .references(() => puzzleCatalog.hash),
  replay: jsonb('replay').$type<PuzzleReplay>().notNull(),
})
