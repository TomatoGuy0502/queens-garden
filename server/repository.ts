import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { databaseUrl } from './databaseUrl'
import { drizzle } from 'drizzle-orm/node-postgres'
import { eq, lt } from 'drizzle-orm'
import { type PgDatabase, type PgQueryResultHKT } from 'drizzle-orm/pg-core'
import * as schema from './schema'
import { RoomError, type RoomRepository, type StoredRoom } from './model'
export function databaseRepository<T extends PgQueryResultHKT>(
  db: PgDatabase<T, typeof schema>,
): RoomRepository {
  return {
    async get(id) {
      const rows = await db.select().from(schema.rooms).where(eq(schema.rooms.id, id))
      return rows[0]?.state ?? null
    },
    async save(room, event) {
      await db.transaction(async (tx) => {
        const written = await tx
          .insert(schema.rooms)
          .values({
            id: room.id,
            revision: room.revision,
            state: room,
            expiresAt: new Date(room.expiresAt),
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: schema.rooms.id,
            set: {
              revision: room.revision,
              state: room,
              expiresAt: new Date(room.expiresAt),
              updatedAt: new Date(),
            },
            setWhere: eq(schema.rooms.revision, room.revision - 1),
          })
          .returning({ id: schema.rooms.id })
        if (!written.length)
          throw new RoomError('房間已更新，請同步最新狀態後重試。', 'STATE_CONFLICT')
        await tx
          .insert(schema.roomEvents)
          .values({ roomId: room.id, revision: room.revision, event })
      })
    },
    async deleteExpired(now) {
      await db.delete(schema.rooms).where(lt(schema.rooms.expiresAt, new Date(now)))
    },
  }
}
export function postgresRepository(url: string) {
  const pool = new Pool({
    connectionString: databaseUrl(url),
    max: 5,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
  })
  pool.on('error', (error) => console.error('PostgreSQL pool connection error:', error.message))
  return { repository: databaseRepository(drizzle(pool, { schema })), close: () => pool.end() }
}
/** Explicit local-development storage. Production requires PostgreSQL. */
export async function fileRepository(path: string): Promise<RoomRepository> {
  let records: Record<string, StoredRoom> = {}
  try {
    records = JSON.parse(await readFile(path, 'utf8')) as Record<string, StoredRoom>
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  let queue: Promise<void> = Promise.resolve()
  function write(mutator: () => void): Promise<void> {
    const work = queue.then(async () => {
      const previous = structuredClone(records)
      mutator()
      try {
        await mkdir(dirname(path), { recursive: true })
        const temp = `${path}.${randomUUID()}.tmp`
        await writeFile(temp, JSON.stringify(records), { mode: 0o600 })
        await rename(temp, path)
      } catch (error) {
        records = previous
        throw error
      }
    })
    queue = work.catch(() => {})
    return work
  }
  return {
    async get(id) {
      await queue
      return records[id] ? structuredClone(records[id]) : null
    },
    save: (room) =>
      write(() => {
        records[room.id] = structuredClone(room)
      }),
    deleteExpired: (now) =>
      write(() => {
        for (const [id, room] of Object.entries(records))
          if (room.expiresAt < now) delete records[id]
      }),
  }
}
