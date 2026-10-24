import { randomBytes, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { z } from 'zod'
import type { Difficulty, QueensPuzzle } from '../src/queens/types'
import { GENERATOR_VERSION } from '../src/queens/version'
import type { CatalogCompute } from './compute'
import { catalogRecord } from './puzzleCatalogModel'

export interface BatchOptions {
  size: number
  count: number
  difficulties: Difficulty[]
  workers: number
  maxAttempts: number
  checkpoint: string
}
export const batchOptionsSchema = z.object({
  size: z.coerce.number().int().min(6).max(12),
  count: z.coerce.number().int().min(1).max(1000),
  difficulties: z.array(z.enum(['easy', 'medium', 'hard'])).min(1),
  workers: z.coerce.number().int().min(1).max(4),
  maxAttempts: z.coerce.number().int().min(1).max(30000),
  checkpoint: z.string().min(1),
})
const archiveSchema = z.object({
  format: z.literal(1),
  generatorVersion: z.literal(GENERATOR_VERSION),
  puzzles: z
    .array(
      z
        .object({
          size: z.number().int().min(6).max(12),
          seed: z.number().int().min(0).max(0xffffffff),
          difficulty: z.enum(['easy', 'medium', 'hard']),
        })
        .passthrough(),
    )
    .max(3000),
})
export interface BatchResult {
  puzzles: QueensPuzzle[]
  attempts: number
  failures: number
  complete: boolean
}
/** Generate locally; atomically retain every verified board before any database import. */
export async function generateBatch(
  options: BatchOptions,
  compute: Pick<CatalogCompute, 'generateValidated' | 'validate'>,
  signal: AbortSignal,
  report: (message: string) => void = () => {},
): Promise<BatchResult> {
  batchOptionsSchema.parse(options)
  const puzzles: QueensPuzzle[] = []
  const hashes = new Set<string>()
  let previous: string | undefined
  try {
    previous = await readFile(options.checkpoint, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  if (previous !== undefined) {
    const archive = archiveSchema.parse(JSON.parse(previous))
    for (const candidate of archive.puzzles) {
      if (signal.aborted) return { puzzles, attempts: 0, failures: 0, complete: false }
      // Checkpoint contents are untrusted, including their claimed solution and difficulty.
      const puzzle = await compute.validate(candidate as unknown as QueensPuzzle, {
        size: options.size,
        difficulty: candidate.difficulty,
        seed: candidate.seed,
      })
      const hash = catalogRecord(puzzle).hash
      if (!hashes.has(hash)) {
        puzzles.push(puzzle)
        hashes.add(hash)
      }
    }
    report(`已重新驗證批次檔中的 ${puzzles.length} 題。`)
  }
  let writes = Promise.resolve()
  function save() {
    const work = writes.then(async () => {
      await mkdir(dirname(options.checkpoint), { recursive: true })
      const temporary = `${options.checkpoint}.${randomUUID()}.tmp`
      await writeFile(
        temporary,
        JSON.stringify({
          format: 1,
          generatorVersion: GENERATOR_VERSION,
          puzzles,
        }),
        { mode: 0o600 },
      )
      await rename(temporary, options.checkpoint)
    })
    writes = work
    return work
  }
  const jobs = options.difficulties.flatMap((difficulty) =>
    Array<Difficulty>(
      Math.max(0, options.count - puzzles.filter((p) => p.difficulty === difficulty).length),
    ).fill(difficulty),
  )
  let attempts = 0,
    failures = 0,
    fatal = false
  const seeds = new Set(puzzles.map((puzzle) => `${puzzle.difficulty}:${puzzle.seed}`))
  async function worker() {
    while (jobs.length && !signal.aborted && !fatal) {
      const difficulty = jobs.shift()!
      let accepted = false
      while (!accepted && !signal.aborted && !fatal && attempts < options.maxAttempts) {
        attempts++
        const seed = randomBytes(4).readUInt32LE()
        if (seeds.has(`${difficulty}:${seed}`)) continue
        seeds.add(`${difficulty}:${seed}`)
        const started = Date.now()
        let puzzle: QueensPuzzle
        try {
          puzzle = await compute.generateValidated({ size: options.size, difficulty, seed })
        } catch {
          if (signal.aborted) break
          failures++
          report(`${difficulty} seed=${seed} 未在預算內生成合格題目，繼續下一次。`)
          continue
        }
        if (fatal) return
        const hash = catalogRecord(puzzle).hash
        if (hashes.has(hash)) continue
        hashes.add(hash)
        puzzles.push(puzzle)
        try {
          await save()
        } catch (error) {
          fatal = true
          throw error
        }
        accepted = true
        report(
          `${difficulty} ${puzzles.filter((p) => p.difficulty === difficulty).length}/${options.count} seed=${seed} score=${puzzle.difficultyScore} (${((Date.now() - started) / 1000).toFixed(1)}s)`,
        )
      }
    }
  }
  const results = await Promise.allSettled(Array.from({ length: options.workers }, worker))
  const rejected = results.find((result) => result.status === 'rejected')
  if (rejected?.status === 'rejected') throw rejected.reason
  const complete = options.difficulties.every(
    (difficulty) =>
      puzzles.filter((puzzle) => puzzle.difficulty === difficulty).length >= options.count,
  )
  return { puzzles, attempts, failures, complete }
}
