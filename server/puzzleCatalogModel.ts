import { createHash } from 'node:crypto'
import {
  DEFAULT_MAX_ATTEMPTS,
  DEFAULT_MUTATION_BUDGET,
  GENERATOR_VERSION,
} from '../src/queens/version'
import type { Difficulty, QueensPuzzle } from '../src/queens/types'
export const CATALOG_VALIDATION_VERSION = '1'
export interface CatalogBucket {
  size: number
  difficulty: Difficulty
}
export interface CatalogRequest extends CatalogBucket {
  seed?: number
}
export type PuzzleReplay = Pick<QueensPuzzle, 'id' | 'seed' | 'generation'>
export interface CatalogRecord {
  hash: string
  recipeKey: string
  puzzle: QueensPuzzle
}
export interface CatalogRepository {
  save(record: CatalogRecord, options?: { served?: boolean }): Promise<void>
  takeFresh(bucket: CatalogBucket): Promise<CatalogRecord | null>
  exact(request: CatalogRequest & { seed: number }): Promise<CatalogRecord | null>
  invalidate(hash: string): Promise<void>
  countFresh(bucket: CatalogBucket): Promise<number>
}
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
export function recipeKey(request: CatalogRequest & { seed: number }) {
  return digest([
    GENERATOR_VERSION,
    CATALOG_VALIDATION_VERSION,
    request.size,
    request.difficulty,
    request.seed,
    DEFAULT_MAX_ATTEMPTS,
    DEFAULT_MUTATION_BUDGET,
  ])
}
export function catalogRecord(puzzle: QueensPuzzle): CatalogRecord {
  return {
    hash: digest([GENERATOR_VERSION, CATALOG_VALIDATION_VERSION, puzzle.size, puzzle.regions]),
    recipeKey: recipeKey(puzzle),
    puzzle,
  }
}
export function replay(board: QueensPuzzle, metadata: PuzzleReplay): QueensPuzzle {
  return { ...board, ...metadata }
}
