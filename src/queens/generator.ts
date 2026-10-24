import { LocalizedError, errorMessage } from '../../shared/message'
import { evaluateDifficulty } from './difficulty'
import { generatePlacement, random } from './random'
import { growRegions, mutateRegions } from './regionGrower'
import { solve, uniqueSolution } from './solver'
import { MIN_REGION_AREA, validRegions } from './validator'
import type { GenerateOptions, QueensPuzzle } from './types'
import { DIFFICULTIES } from './levels'
import { GENERATOR_VERSION } from './version'
export { GENERATOR_VERSION } from './version'
/** Fixed work budget, not wall-clock cutoffs: identical inputs reproduce identical output. */
export function generatePuzzle(options: GenerateOptions): QueensPuzzle {
  const { size, seed, maxAttempts = 160, mutationBudget = 100 } = options
  if (
    (options.difficulty !== undefined && !DIFFICULTIES.includes(options.difficulty)) ||
    !Number.isInteger(size) ||
    size < 6 ||
    size > 12 ||
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
    const solution = generatePlacement(size, rng)
    let regions = growRegions(solution, rng, minimumArea)
    if (!validRegions(regions, minimumArea)) continue
    let search = solve(regions, 24)
    for (let mutation = 0; mutation <= mutationBudget; mutation++) {
      if (
        search.solutionCount === 1 &&
        uniqueSolution(regions, solution) &&
        validRegions(regions, minimumArea)
      ) {
        const analysis = evaluateDifficulty(regions)
        if (
          analysis.difficulty !== 'unrated' &&
          validRegions(regions, MIN_REGION_AREA[analysis.difficulty]) &&
          (!options.difficulty || options.difficulty === analysis.difficulty)
        ) {
          return {
            id: `${GENERATOR_VERSION}-${size}-${seed}-${options.difficulty ?? 'any'}-${mutationBudget}`,
            version: GENERATOR_VERSION,
            size,
            seed,
            regions,
            solution,
            difficulty: analysis.difficulty,
            difficultyScore: analysis.score,
            generation: { maxAttempts, mutationBudget, requestedDifficulty: options.difficulty },
            analysis,
          }
        }
        break
      }
      if (mutation === mutationBudget) break
      const candidate = mutateRegions(regions, solution, rng, minimumArea, search.solutions)
      if (!candidate) continue
      const result = solve(candidate, 24)
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
