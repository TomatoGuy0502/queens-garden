import { generatePlacement, random } from './random'
import { growRegions, mutateRegions } from './regionGrower'
import { solve, uniqueSolution } from './solver'
import { validRegions } from './validator'
import type { GenerateOptions, QueensPuzzle } from './types'
export const GENERATOR_VERSION = '1.0.0'
/** Fixed work budget, not wall-clock cutoffs: identical inputs reproduce identical output. */
export function generatePuzzle(options: GenerateOptions): QueensPuzzle {
  const { size, seed, maxAttempts = 160, mutationBudget = 100 } = options
  if (!Number.isInteger(size) || size < 6 || size > 12 || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff || !Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 2000 || !Number.isInteger(mutationBudget) || mutationBudget < 0 || mutationBudget > 1000) throw new Error('生成參數不合法。')
  const rng = random(seed)
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const solution = generatePlacement(size, rng)
    let regions = growRegions(solution, rng)
    let count = solve(regions, 24).solutionCount
    for (let mutation = 0; mutation <= mutationBudget; mutation++) {
      if (count === 1 && uniqueSolution(regions, solution) && validRegions(regions)) {
        return { id: `${GENERATOR_VERSION}-${size}-${seed}`, version: GENERATOR_VERSION, size, seed, regions, solution, difficulty: 'easy', difficultyScore: 0 }
      }
      const candidate = mutateRegions(regions, solution, rng)
      if (!candidate) continue
      const result = solve(candidate, 24)
      if (!result.exhausted && result.solutionCount <= count) { regions = candidate; count = result.solutionCount }
    }
  }
  throw new Error('已達生成預算，找不到通過驗證的關卡。請更換 Seed 或調整設定。')
}
