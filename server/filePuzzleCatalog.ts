import { GENERATOR_VERSION } from '../src/queens/version'
import { readFile, mkdir, writeFile, rename } from 'node:fs/promises'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import {
  catalogRecord,
  recipeKey,
  replay,
  type CatalogRecord,
  type CatalogRepository,
  type PuzzleReplay,
} from './puzzleCatalogModel'
interface State {
  boards: Record<string, { record: CatalogRecord; uses: number; enabled: boolean }>
  recipes: Record<string, { hash: string; replay: PuzzleReplay }>
}
export async function fileCatalogRepository(path?: string): Promise<CatalogRepository> {
  let state: State = { boards: {}, recipes: {} }
  if (path)
    try {
      state = JSON.parse(await readFile(path, 'utf8')) as State
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  let queue: Promise<unknown> = Promise.resolve()
  function transaction<T>(work: () => T): Promise<T> {
    const promise = queue.then(async () => {
      const previous = structuredClone(state)
      try {
        const result = work()
        if (path) {
          await mkdir(dirname(path), { recursive: true })
          const temp = `${path}.${randomUUID()}.tmp`
          await writeFile(temp, JSON.stringify(state), { mode: 0o600 })
          await rename(temp, path)
        }
        return result
      } catch (error) {
        state = previous
        throw error
      }
    })
    queue = promise.catch(() => {})
    return promise
  }
  const eligible = (entry: State['boards'][string]) =>
    entry.enabled &&
    entry.record.puzzle.version === GENERATOR_VERSION &&
    catalogRecord(entry.record.puzzle).hash === entry.record.hash
  return {
    save: (record) =>
      transaction(() => {
        const previous = state.boards[record.hash]
        state.boards[record.hash] = {
          record: structuredClone(record),
          uses: previous?.uses ?? 0,
          enabled: true,
        }
        const { id, seed, generation } = record.puzzle
        state.recipes[record.recipeKey] = { hash: record.hash, replay: { id, seed, generation } }
      }),
    takeFresh: (bucket) =>
      transaction(() => {
        const entry = Object.values(state.boards).find(
          (entry) =>
            eligible(entry) &&
            !entry.uses &&
            entry.record.puzzle.size === bucket.size &&
            entry.record.puzzle.difficulty === bucket.difficulty,
        )
        if (!entry) return null
        entry.uses++
        return structuredClone(entry.record)
      }),
    exact: (request) =>
      transaction(() => {
        const metadata = state.recipes[recipeKey(request)],
          entry = metadata && state.boards[metadata.hash]
        if (!entry || !eligible(entry)) return null
        entry.uses++
        return catalogRecord(replay(structuredClone(entry.record.puzzle), metadata.replay))
      }),
    use: (hash) =>
      transaction(() => {
        const entry = state.boards[hash]
        if (entry) entry.uses++
      }),
    invalidate: (hash) =>
      transaction(() => {
        const entry = state.boards[hash]
        if (entry) entry.enabled = false
      }),
    async countFresh(bucket) {
      await queue
      return Object.values(state.boards).filter(
        (entry) =>
          eligible(entry) &&
          !entry.uses &&
          entry.record.puzzle.size === bucket.size &&
          entry.record.puzzle.difficulty === bucket.difficulty,
      ).length
    },
  }
}
