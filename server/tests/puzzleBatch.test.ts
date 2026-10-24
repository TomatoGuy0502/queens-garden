import { beforeAll, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { generatePuzzle } from '../../src/queens/generator'
import type { QueensPuzzle } from '../../src/queens/types'
import { GENERATOR_VERSION } from '../../src/queens/version'
import { batchOptionsSchema, generateBatch } from '../puzzleBatch'
import { validateCatalogPuzzle } from '../puzzleValidation'
let puzzle: QueensPuzzle
beforeAll(() => {
  puzzle = generatePuzzle({ size: 12, difficulty: 'easy', seed: 42 })
}, 120000)
async function setup(count = 1) {
  const directory = await mkdtemp(join(tmpdir(), 'queens-batch-'))
  const options = {
    size: 12,
    count,
    difficulties: ['easy' as const],
    workers: 2,
    maxAttempts: 3,
    checkpoint: join(directory, 'batch.json'),
  }
  const compute = {
    generateValidated: vi.fn(() => Promise.resolve(structuredClone(puzzle))),
    validate: vi.fn((candidate: QueensPuzzle) =>
      Promise.resolve(
        validateCatalogPuzzle(candidate, {
          size: 12,
          difficulty: candidate.difficulty,
          seed: candidate.seed,
        }),
      ),
    ),
  }
  return { options, compute, cleanup: () => rm(directory, { recursive: true, force: true }) }
}
it('retains complete verified puzzles and resumes after interruption without regenerating', async () => {
  const { options, compute, cleanup } = await setup()
  try {
    const first = await generateBatch(options, compute, new AbortController().signal)
    expect(first.complete).toBe(true)
    expect(JSON.parse(await readFile(options.checkpoint, 'utf8')).puzzles).toEqual([puzzle])
    compute.generateValidated.mockClear()
    const resumed = await generateBatch(options, compute, new AbortController().signal)
    expect(resumed.puzzles).toEqual(first.puzzles)
    expect(resumed.attempts).toBe(0)
    expect(compute.generateValidated).not.toHaveBeenCalled()
    expect(compute.validate).toHaveBeenCalledTimes(1)
  } finally {
    await cleanup()
  }
})
it('bounds duplicate and unsuccessful generation attempts instead of accepting a partial target as complete', async () => {
  const { options, compute, cleanup } = await setup(2)
  try {
    const result = await generateBatch(options, compute, new AbortController().signal)
    expect(result.complete).toBe(false)
    expect(result.puzzles).toHaveLength(1)
    expect(result.attempts).toBe(3)
    compute.generateValidated.mockRejectedValue(new Error('No verified puzzle'))
    const failed = await generateBatch(options, compute, new AbortController().signal)
    expect(failed.complete).toBe(false)
    expect(failed.puzzles).toEqual([puzzle])
    expect(failed.failures).toBe(3)
  } finally {
    await cleanup()
  }
})
it('rejects modified checkpoint answers before they can be imported', async () => {
  const { options, compute, cleanup } = await setup()
  try {
    const modified = structuredClone(puzzle)
    modified.solution[0] = modified.solution[1]
    await writeFile(
      options.checkpoint,
      JSON.stringify({ format: 1, generatorVersion: GENERATOR_VERSION, puzzles: [modified] }),
    )
    await expect(generateBatch(options, compute, new AbortController().signal)).rejects.toThrow(
      /驗證/,
    )
    expect(compute.generateValidated).not.toHaveBeenCalled()
  } finally {
    await cleanup()
  }
})
it('does not launch generation after cancellation and rejects invalid resource limits', async () => {
  const { options, compute, cleanup } = await setup()
  try {
    const controller = new AbortController()
    controller.abort()
    const result = await generateBatch(options, compute, controller.signal)
    expect(result.complete).toBe(false)
    expect(compute.generateValidated).not.toHaveBeenCalled()
    for (const invalid of [{ workers: 0 }, { workers: 8 }, { count: 0 }, { maxAttempts: -1 }])
      expect(() => batchOptionsSchema.parse({ ...options, ...invalid })).toThrow()
  } finally {
    await cleanup()
  }
})
