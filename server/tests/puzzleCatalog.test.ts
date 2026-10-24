import { expect, it } from 'vitest'
import { PuzzleCatalog, DEFAULT_STOCK } from '../puzzleCatalog'
import { fileCatalogRepository } from '../filePuzzleCatalog'
import { catalogRecord } from '../puzzleCatalogModel'
import { workerPool } from '../compute'
import { generatePuzzle } from '../../src/queens/generator'
const bucket = { size: 6, difficulty: 'easy' as const }
it('serves fresh stock, archives demand generation and replays exact seeds without substitution', async () => {
  const repository = await fileCatalogRepository(),
    engine = workerPool(1)
  const catalog = new PuzzleCatalog(repository, engine, { enabled: false, seed: () => 2026 })
  try {
    const stocked = generatePuzzle({ ...bucket, seed: 42 })
    await repository.save(catalogRecord(stocked))
    expect(await catalog.get(bucket)).toEqual(stocked)
    expect(catalog.stats.stockHits).toBe(1)
    const requests = await Promise.all([
      catalog.get({ ...bucket, seed: 1 }),
      catalog.get({ ...bucket, seed: 1 }),
    ])
    expect(requests[0].seed).toBe(1)
    expect(requests[0]).toEqual(requests[1])
    expect(catalog.stats.generated).toBe(1)
    expect((await catalog.get({ ...bucket, seed: 1 })).seed).toBe(1)
    expect(catalog.stats.seedHits).toBe(1)
    expect((await catalog.get(bucket)).seed).toBe(2026)
    expect(catalog.stats.generated).toBe(2)
  } finally {
    await catalog.stop()
    await engine.close()
  }
})
it('invalid cached solutions are retired and never returned to a player', async () => {
  const repository = await fileCatalogRepository(),
    engine = workerPool(1)
  const catalog = new PuzzleCatalog(repository, engine, { enabled: false })
  try {
    const bad = generatePuzzle({ ...bucket, seed: 42 })
    bad.solution = Array(6).fill(0)
    await repository.save(catalogRecord(bad))
    const good = await catalog.get({ ...bucket, seed: 42 })
    expect(good.solution).not.toEqual(bad.solution)
    expect(catalog.stats.rejected).toBe(1)
    expect(catalog.stats.generated).toBe(1)
  } finally {
    await catalog.stop()
    await engine.close()
  }
})
it('refills only to the configured waterline, keeps a full pool dormant and uses 8×8 default buckets', async () => {
  expect(DEFAULT_STOCK).toEqual(
    ['easy', 'medium', 'hard', 'expert'].map((difficulty) => ({ size: 8, difficulty })),
  )
  const repository = await fileCatalogRepository(),
    engine = workerPool(1)
  const catalog = new PuzzleCatalog(repository, engine, {
    target: 1,
    buckets: [bucket],
    idleMs: 100,
    seed: () => 42,
  })
  try {
    await catalog.refillOnce()
    expect(await repository.countFresh(bucket)).toBe(1)
    await catalog.refillOnce()
    expect(catalog.stats.prefilled).toBe(1)
    const puzzle = await catalog.get(bucket)
    expect(puzzle.seed).toBe(42)
    expect(catalog.stats.stockHits).toBe(1)
    expect(await repository.countFresh(bucket)).toBe(0)
  } finally {
    await catalog.stop()
    await engine.close()
  }
})

it('a real cooperative room consumes stock and uses exact-seed archive replays without exposing solutions', async () => {
  const { mkdtemp, rm } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const { randomUUID } = await import('node:crypto')
  const { fileRepository } = await import('../repository')
  const { RoomManager } = await import('../rooms')
  const dir = await mkdtemp(join(tmpdir(), 'queens-source-')),
    engine = workerPool(1)
  const repository = await fileRepository(join(dir, 'rooms.json'))
  const catalogRepository = await fileCatalogRepository(join(dir, 'puzzles.json'))
  const catalog = new PuzzleCatalog(catalogRepository, engine, { enabled: false })
  try {
    await catalogRepository.save(catalogRecord(generatePuzzle({ ...bucket, seed: 42 })))
    const manager = new RoomManager(repository, engine, undefined, catalog)
    const host = await manager.create('Host', { size: 6, difficulty: 'easy' })
    await manager.connect(host.credentials, 'host')
    let state = await manager.state(host.credentials)
    for (const seed of [undefined, 1, 42]) {
      if (state.game.phase !== 'waiting')
        state = await manager.command(host.credentials, {
          type: 'reset',
          gameId: state.game.id,
          actionId: randomUUID(),
        })
      state = await manager.command(host.credentials, {
        type: 'configure',
        settings: { size: 6, difficulty: 'easy', seed },
        gameId: state.game.id,
        actionId: randomUUID(),
      })
      await manager.command(host.credentials, {
        type: 'start',
        gameId: state.game.id,
        actionId: randomUUID(),
      })
      await expect
        .poll(async () => (await manager.state(host.credentials)).game.phase)
        .toBe('playing')
      state = await manager.state(host.credentials)
      expect(state.game.puzzle?.seed).toBe(seed ?? 42)
      expect(JSON.stringify(state)).not.toMatch(/"solution"|"analysis"/)
    }
    expect(catalog.stats).toMatchObject({ stockHits: 1, seedHits: 1, generated: 1 })
    await repository.deleteExpired(Date.now() + 25 * 3600000)
    expect((await catalogRepository.exact({ ...bucket, seed: 42 }))?.puzzle.seed).toBe(42)
  } finally {
    await catalog.stop()
    await engine.close()
    await rm(dir, { recursive: true, force: true })
  }
})

it('bounds failed background retries and stops cleanly without pretending stock is full', async () => {
  const repository = await fileCatalogRepository(),
    engine = workerPool(1)
  let attempts = 0
  engine.generateValidated = () => {
    attempts++
    return Promise.reject(new Error('Generation budget exhausted'))
  }
  const catalog = new PuzzleCatalog(repository, engine, {
    buckets: [bucket],
    idleMs: 100,
    retryMs: 60000,
  })
  try {
    for (let i = 0; i < 5; i++) await catalog.refillOnce()
    expect(attempts).toBe(3)
    expect(await repository.countFresh(bucket)).toBe(0)
  } finally {
    await catalog.stop()
    await engine.close()
  }
})
it('player demand interrupts an already-running refill even before a cache lookup completes', async () => {
  const repository = await fileCatalogRepository(),
    engine = workerPool(1)
  const catalog = new PuzzleCatalog(repository, engine, {
    buckets: [{ size: 12, difficulty: 'hard' }],
    idleMs: 100,
    seed: () => 42,
  })
  try {
    const fill = catalog.refillOnce()
    await expect.poll(() => engine.isIdle()).toBe(false)
    const puzzle = await catalog.get({ ...bucket, seed: 42 })
    await fill
    expect(puzzle.size).toBe(6)
    expect(catalog.stats.generated).toBe(1)
    expect(catalog.stats.prefilled).toBe(0)
  } finally {
    await catalog.stop()
    await engine.close()
  }
})
