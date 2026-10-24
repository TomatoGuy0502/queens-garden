import type { GenerateOptions, QueensPuzzle } from '../src/queens/types'
import { GENERATOR_VERSION } from '../src/queens/version'
import { MIN_REGION_AREA, validPlacement, validRegions } from '../src/queens/validator'
import { uniqueSolution } from '../src/queens/solver'
import { evaluateDifficulty } from '../src/queens/difficulty'
export class CatalogValidationError extends Error {
  readonly code = 'CATALOG_INVALID'
}
/** Independently verify every archived or served puzzle inside a compute worker. */
function validate(puzzle: QueensPuzzle, request: GenerateOptions): QueensPuzzle {
  if (
    !puzzle ||
    puzzle.version !== GENERATOR_VERSION ||
    puzzle.size !== request.size ||
    puzzle.seed !== request.seed ||
    (request.difficulty && puzzle.difficulty !== request.difficulty) ||
    puzzle.generation?.maxAttempts !== (request.maxAttempts ?? 160) ||
    puzzle.generation.mutationBudget !== (request.mutationBudget ?? 100) ||
    puzzle.generation.requestedDifficulty !== request.difficulty ||
    puzzle.id !==
      `${GENERATOR_VERSION}-${request.size}-${request.seed}-${request.difficulty ?? 'any'}-${request.mutationBudget ?? 100}`
  )
    throw new CatalogValidationError('題庫版本或 Seed 重現參數不符。')
  if (
    !['easy', 'medium', 'hard'].includes(puzzle.difficulty) ||
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
