import { pgTable, text, jsonb, timestamp, integer, primaryKey } from 'drizzle-orm/pg-core'
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
