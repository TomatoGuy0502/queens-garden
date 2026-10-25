import type { GenerateOptions, QueensPuzzle } from '../src/queens/types'
import {
  DEFAULT_MAX_ATTEMPTS,
  DEFAULT_MUTATION_BUDGET,
  GENERATOR_VERSION,
} from '../src/queens/version'
import { MIN_REGION_AREA, validPlacement, validRegions } from '../src/queens/validator'
import { uniqueSolution } from '../src/queens/solver'
import { evaluateDifficulty } from '../src/queens/difficulty'
import { DIFFICULTIES } from '../src/queens/levels'
export class CatalogValidationError extends Error {
  readonly code = 'CATALOG_INVALID'
}
/** Independently verify every archived or served puzzle inside a compute worker. */
function validate(puzzle: QueensPuzzle, request: GenerateOptions): QueensPuzzle {
  if (
    puzzle?.version !== GENERATOR_VERSION ||
    puzzle.size !== request.size ||
    puzzle.seed !== request.seed ||
    (request.difficulty && puzzle.difficulty !== request.difficulty) ||
    puzzle.generation?.maxAttempts !== (request.maxAttempts ?? DEFAULT_MAX_ATTEMPTS) ||
    puzzle.generation.mutationBudget !== (request.mutationBudget ?? DEFAULT_MUTATION_BUDGET) ||
    puzzle.generation.requestedDifficulty !== request.difficulty ||
    puzzle.id !==
      `${GENERATOR_VERSION}-${request.size}-${request.seed}-${request.difficulty ?? 'any'}-${request.mutationBudget ?? DEFAULT_MUTATION_BUDGET}`
  )
    throw new CatalogValidationError('題庫版本或 Seed 重現參數不符。')
  if (
    !DIFFICULTIES.includes(puzzle.difficulty) ||
    !validRegions(puzzle.regions, MIN_REGION_AREA[puzzle.difficulty]) ||
    !validPlacement(puzzle.regions, puzzle.solution) ||
    !uniqueSolution(puzzle.regions, puzzle.solution)
  )
    throw new CatalogValidationError('題庫盤面未通過區域、配置或唯一解驗證。')
  const analysis = evaluateDifficulty(puzzle.regions)
  if (
    !analysis.solved ||
    analysis.difficulty !== puzzle.difficulty ||
    analysis.score !== puzzle.difficultyScore
  )
    throw new CatalogValidationError('題庫難度或推理分數未通過驗證。')
  return { ...puzzle, analysis }
}

export function validateCatalogPuzzle(
  puzzle: QueensPuzzle,
  request: GenerateOptions,
): QueensPuzzle {
  try {
    return validate(puzzle, request)
  } catch (error) {
    if (error instanceof CatalogValidationError) throw error
    throw new CatalogValidationError('題庫盤面資料不合法。')
  }
}
