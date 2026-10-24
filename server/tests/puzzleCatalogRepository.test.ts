import { expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { readFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileCatalogRepository } from '../filePuzzleCatalog'
import { databaseCatalogRepository } from '../puzzleCatalogRepository'
import { catalogRecord, type CatalogRepository } from '../puzzleCatalogModel'
import { generatePuzzle } from '../../src/queens/generator'
import { validateCatalogPuzzle } from '../puzzleValidation'
import * as schema from '../schema'
const options = { size: 6, difficulty: 'easy' as const, seed: 42 }
async function contract(repository: CatalogRepository) {
  const puzzle = validateCatalogPuzzle(generatePuzzle(options), options)
  await repository.save(catalogRecord(puzzle))
  await repository.save(catalogRecord(puzzle))
  expect(await repository.countFresh(options)).toBe(1)
  const first = await repository.takeFresh(options)
  expect(first?.puzzle).toEqual(puzzle)
  expect(await repository.takeFresh(options)).toBeNull()
  expect((await repository.exact(options))?.puzzle).toEqual(puzzle)
  expect(await repository.exact({ ...options, seed: 99 })).toBeNull()
  // Identical boards deduplicate while each generating recipe keeps its own replay metadata.
  const alias = { ...puzzle, seed: 99, id: puzzle.id.replace('-42-', '-99-') }
  await repository.save(catalogRecord(alias))
  expect((await repository.exact({ ...options, seed: 99 }))?.puzzle).toEqual(alias)
  expect((await repository.exact(options))?.puzzle).toEqual(puzzle)
  expect(await repository.countFresh(options)).toBe(0)
  await repository.invalidate(catalogRecord(puzzle).hash)
  expect(await repository.exact(options)).toBeNull()
  await repository.save(catalogRecord(puzzle))
  expect((await repository.exact(options))?.puzzle).toEqual(puzzle)
}
it('persists a deduplicated file catalog and exact-seed recipes across restarts', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'queens-catalog-'))
  try {
    const path = join(dir, 'catalog.json')
    await contract(await fileCatalogRepository(path))
    expect((await (await fileCatalogRepository(path)).exact(options))?.puzzle.seed).toBe(42)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
it('claims one fresh file puzzle atomically for concurrent rooms', async () => {
  const repository = await fileCatalogRepository()
  await repository.save(catalogRecord(generatePuzzle(options)))
  const claims = await Promise.all(Array.from({ length: 8 }, () => repository.takeFresh(options)))
  expect(claims.filter(Boolean)).toHaveLength(1)
})
it('runs all actual migrations on PostgreSQL and retains catalog rows independently of room expiry', async () => {
  const client = new PGlite()
  try {
    const journal = JSON.parse(await readFile('drizzle/meta/_journal.json', 'utf8')) as {
      entries: { tag: string }[]
    }
    for (const entry of journal.entries)
      await client.exec(await readFile(`drizzle/${entry.tag}.sql`, 'utf8'))
    await contract(databaseCatalogRepository(drizzle(client, { schema })))
    await client.exec('delete from coop_rooms')
    expect((await client.query('select count(*)::int as count from puzzle_catalog')).rows).toEqual([
      { count: 1 },
    ])
    expect((await client.query('select count(*)::int as count from puzzle_recipes')).rows).toEqual([
      { count: 2 },
    ])
    await client.exec('delete from puzzle_recipes; delete from puzzle_catalog')
    const direct = databaseCatalogRepository(drizzle(client, { schema }))
    await direct.save(catalogRecord(generatePuzzle(options)), { served: true })
    expect(await direct.takeFresh(options)).toBeNull()
  } finally {
    await client.close()
  }
})
it('rejects invalid metadata, region shapes, solutions and difficulty labels', () => {
  const puzzle = generatePuzzle(options)
  for (const bad of [
    { ...puzzle, version: 'old' },
    { ...puzzle, seed: 1 },
    { ...puzzle, solution: Array(6).fill(0) },
    { ...puzzle, difficultyScore: -1 },
    { ...puzzle, regions: Array.from({ length: 6 }, () => Array(6).fill(0)) },
  ])
    expect(() => validateCatalogPuzzle(bad, options)).toThrow()
})

it('saves on-demand generation as already served so another room cannot claim it as fresh stock', async () => {
  const repository = await fileCatalogRepository()
  await repository.save(catalogRecord(generatePuzzle(options)), { served: true })
  expect(await repository.takeFresh(options)).toBeNull()
  expect((await repository.exact(options))?.puzzle.seed).toBe(42)
})
