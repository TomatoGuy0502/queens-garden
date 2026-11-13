import { expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { readFile } from 'node:fs/promises'
import { databaseRepository } from '../repository'
import * as schema from '../schema'
import { RoomManager } from '../rooms'
import { generatePuzzle } from '../../src/queens/generator'

it('runs the actual migration on PostgreSQL and persists private snapshots and an atomic event ledger', async () => {
  const client = new PGlite()
  // PGlite runs PostgreSQL itself in WASM; production uses the node-postgres driver.
  const journal = JSON.parse(await readFile('drizzle/meta/_journal.json', 'utf8')) as {
    entries: { tag: string }[]
  }
  for (const entry of journal.entries)
    await client.exec(await readFile(`drizzle/${entry.tag}.sql`, 'utf8'))
  const repository = databaseRepository(drizzle(client, { schema }))
  const manager = new RoomManager(repository, {
    generate: () => Promise.resolve(generatePuzzle({ size: 6, seed: 42 })),
    generate3d: () => Promise.reject(new Error('unused')),
    hint3d: () => Promise.reject(new Error('unused')),
    hint: () => Promise.resolve({ step: null, message: { key: 'hint.stuck' } }),
    close: () => Promise.resolve(),
  })
  const host = await manager.create('Alice', { size: 6, difficulty: 'easy' })
  const stored = await repository.get(host.state.id)
  expect(stored?.players[0].tokenHash).toHaveLength(64)
  const events = await client.query('select * from coop_room_events')
  expect(events.rows).toHaveLength(1)
  await expect(
    repository.save(stored!, { type: 'duplicate-revision', playerId: host.credentials.playerId }),
  ).rejects.toThrow()
  expect((await repository.get(host.state.id))?.revision).toBe(stored!.revision)
  await repository.deleteExpired(Date.now() + 25 * 3600000)
  expect(await repository.get(host.state.id)).toBeNull()
  expect((await client.query('select * from coop_room_events')).rows).toHaveLength(0)
  await client.close()
})
