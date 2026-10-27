import { expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { readFile } from 'node:fs/promises'
import * as schema from '../schema'
import { databaseAccountRepository } from '../accounts'
import { firstPartyCookie } from '../auth'

it('keeps nicknames unique regardless of case and forgets a deleted player', async () => {
  const client = new PGlite()
  const journal = JSON.parse(await readFile('drizzle/meta/_journal.json', 'utf8')) as {
    entries: { tag: string }[]
  }
  for (const entry of journal.entries)
    await client.exec(await readFile(`drizzle/${entry.tag}.sql`, 'utf8'))
  const accounts = databaseAccountRepository(drizzle(client, { schema }))
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

it('rewrites Neon Auth cookies as first-party cookies', () => {
  expect(
    firstPartyCookie(
      '__Secure-neon-auth.session_token=abc; Max-Age=60; Domain=neon.tech; Path=/; HttpOnly; Secure; SameSite=None; Partitioned',
    ),
  ).toBe('__Secure-neon-auth.session_token=abc; Max-Age=60; Path=/; HttpOnly; Secure; SameSite=Lax')
})
