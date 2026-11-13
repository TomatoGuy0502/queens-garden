import { LocalizedError, errorMessage } from '../../shared/message'
import { DIFFICULTIES } from '../queens/levels'
import { random } from '../queens/random'
import { MIN_REGION_AREA } from '../queens/validator'
import { evaluateDifficulty3d } from './difficulty'
import { growRegions3d, mutateRegions3d, validRegions3d } from './regions'
import { generateSkeleton } from './skeleton'
import { solve3d, uniqueSolution3d } from './solver'
import type { Generate3DOptions, Queens3DPuzzle } from './types'
import {
  BOARD_SIZES_3D,
  DEFAULT_3D_MAX_ATTEMPTS,
  DEFAULT_3D_MUTATION_BUDGET,
  GENERATOR_3D_VERSION,
} from './version'

/** Fixed work budget, not wall-clock cutoffs: identical inputs reproduce identical output. */
export function generatePuzzle3d(options: Generate3DOptions): Queens3DPuzzle {
  const {
    size,
    seed,
    maxAttempts = DEFAULT_3D_MAX_ATTEMPTS,
    mutationBudget = DEFAULT_3D_MUTATION_BUDGET,
  } = options
  if (
    (options.difficulty !== undefined && !DIFFICULTIES.includes(options.difficulty)) ||
    !BOARD_SIZES_3D.some((item) => item === size) ||
    !Number.isInteger(seed) ||
    seed < 0 ||
    seed > 0xffffffff ||
    !Number.isInteger(maxAttempts) ||
    maxAttempts < 1 ||
    maxAttempts > 2000 ||
    !Number.isInteger(mutationBudget) ||
    mutationBudget < 0 ||
    mutationBudget > 1000
  )
    throw new Error('生成參數不合法。')
  const minimumArea = MIN_REGION_AREA[options.difficulty ?? 'easy']
  const rng = random(seed)
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const solution = generateSkeleton(size, rng)
    let regions = growRegions3d(solution, rng, minimumArea)
    if (!validRegions3d(regions, minimumArea)) continue
    let search = solve3d(regions, 24)
    for (let mutation = 0; mutation <= mutationBudget; mutation++) {
      if (
        search.solutionCount === 1 &&
        uniqueSolution3d(regions, solution) &&
        validRegions3d(regions, minimumArea)
      ) {
        const analysis = evaluateDifficulty3d(regions)
        if (
          analysis.difficulty !== 'unrated' &&
          validRegions3d(regions, MIN_REGION_AREA[analysis.difficulty]) &&
          (!options.difficulty || options.difficulty === analysis.difficulty)
        )
          return {
            id: `3d-${GENERATOR_3D_VERSION}-${size}-${seed}-${options.difficulty ?? 'any'}-${mutationBudget}`,
            version: GENERATOR_3D_VERSION,
            size,
            seed,
            regions,
            solution,
            difficulty: analysis.difficulty,
            difficultyScore: analysis.score,
            generation: { maxAttempts, mutationBudget, requestedDifficulty: options.difficulty },
            analysis,
          }
        break
      }
      if (mutation === mutationBudget) break
      const candidate = mutateRegions3d(regions, solution, rng, minimumArea, search.solutions)
      if (!candidate) continue
      const result = solve3d(candidate, 24)
      if (!result.exhausted && result.solutionCount <= search.solutionCount) {
        regions = candidate
        search = result
      }
    }
  }
  throw new LocalizedError(
    errorMessage('GENERATION_BUDGET'),
    'Generation budget reached without finding a verified puzzle. Try another seed or settings.',
  )
}
