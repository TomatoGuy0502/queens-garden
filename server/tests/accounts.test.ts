import { expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { readFile } from 'node:fs/promises'
import * as schema from '../schema'
import { databaseAccountRepository } from '../accounts'
import { firstPartyCookie } from '../auth'
import { emptyStats, mergeStats, recordOutcome } from '../../src/queens/stats'

async function repository() {
  const client = new PGlite()
  const journal = JSON.parse(await readFile('drizzle/meta/_journal.json', 'utf8')) as {
    entries: { tag: string }[]
  }
  for (const entry of journal.entries)
    await client.exec(await readFile(`drizzle/${entry.tag}.sql`, 'utf8'))
  return { client, accounts: databaseAccountRepository(drizzle(client, { schema })) }
}

it('keeps nicknames unique regardless of case and forgets a deleted player', async () => {
  const { client, accounts } = await repository()
  expect(await accounts.nickname('a')).toBeNull()
  await accounts.setNickname('a', 'Alice')
  await expect(accounts.setNickname('b', 'ALICE')).rejects.toMatchObject({ code: 'NICKNAME_TAKEN' })
  await accounts.setNickname('a', 'alice')
  expect(await accounts.nickname('a')).toBe('alice')
  await accounts.delete('a')
  expect(await accounts.nickname('a')).toBeNull()
  await accounts.setNickname('b', 'Alice')
  await client.close()
})

it('keeps one ranked run per player and day and ranks finishers by score, then moves', async () => {
  const { client, accounts } = await repository()
  const day = '2026-10-27'
  const start = new Date('2026-10-27T02:00:00Z')
  for (const [id, nickname] of [
    ['a', 'Alice'],
    ['b', 'Bob'],
    ['c', 'Cleo'],
    ['d', 'Dan'],
  ])
    await accounts.setNickname(id, nickname)
  expect(await accounts.startRun('a', day, start)).toEqual({ startedAt: start, finished: false })
  // Starting again keeps the original clock.
  expect((await accounts.startRun('a', day, new Date('2026-10-27T03:00:00Z'))).startedAt).toEqual(
    start,
  )
  for (const id of ['b', 'c', 'd']) await accounts.startRun(id, day, start)
  const result = (score: number, moves: number) => ({ seconds: score, moves, hints: 0, score })
  expect(await accounts.finishRun('a', day, result(90, 9), start)).toBe(true)
  expect(await accounts.finishRun('a', day, result(10, 9), start)).toBe(false)
  await accounts.finishRun('b', day, result(60, 12), start)
  await accounts.finishRun('c', day, result(60, 8), start)
  expect((await accounts.startRun('a', day, start)).finished).toBe(true)
  const board = await accounts.leaderboard(day, 'a', 2)
  expect(board.map(({ nickname, rank, me }) => [nickname, rank, me])).toEqual([
    ['Cleo', 1, false],
    ['Bob', 2, false],
    ['Alice', 3, true],
  ])
  // Unfinished runs and other days stay off the board.
  expect(await accounts.leaderboard('2026-10-26', null, 100)).toEqual([])
  expect(await accounts.leaderboard(day, 'd', 100)).toHaveLength(3)
  // A finisher without a nickname still ranks, as an anonymous row.
  await accounts.startRun('e', day, start)
  await accounts.finishRun('e', day, result(120, 9), start)
  expect(
    (await accounts.leaderboard(day, 'e', 0)).map(({ nickname, rank }) => [nickname, rank]),
  ).toEqual([[null, 4]])
  await accounts.delete('e')
  await accounts.delete('c')
  expect((await accounts.leaderboard(day, null, 100)).map((entry) => entry.nickname)).toEqual([
    'Bob',
    'Alice',
  ])
  await client.close()
})

it("keeps a player's statistics and removes them with the account", async () => {
  const { client, accounts } = await repository()
  const game = { size: 8, difficulty: 'easy' as const, seconds: 90, moves: 20, hints: 0 }
  expect(await accounts.stats('a')).toEqual(emptyStats())
  const local = recordOutcome(emptyStats(), game).stats
  await accounts.updateStats('a', (current) => mergeStats(current, local))
  await Promise.all(
    [1, 2, 3].map(() => accounts.updateStats('a', (current) => recordOutcome(current, game).stats)),
  )
  expect((await accounts.stats('a')).buckets['8:easy'].completed).toBe(4)
  await accounts.delete('a')
  expect(await accounts.stats('a')).toEqual(emptyStats())
  await client.close()
})

it('rewrites Neon Auth cookies as first-party cookies', () => {
  expect(
    firstPartyCookie(
      '__Secure-neon-auth.session_token=abc; Max-Age=60; Domain=neon.tech; Path=/; HttpOnly; Secure; SameSite=None; Partitioned',
    ),
  ).toBe('__Secure-neon-auth.session_token=abc; Max-Age=60; Path=/; HttpOnly; Secure; SameSite=Lax')
})
