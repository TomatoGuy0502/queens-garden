import type { DeductionStep, Difficulty } from '../queens/types'

export interface Puzzle3DDefinition {
  id: string
  version: string
  size: number
  /** regions[z][r][c] = region id in 0..n²-1, with Math.floor(id / n) === z. */
  regions: number[][][]
  seed: number
  difficulty: Difficulty
  difficultyScore: number
  generation: { maxAttempts: number; mutationBudget: number; requestedDifficulty?: Difficulty }
}
export interface Queens3DPuzzle extends Puzzle3DDefinition {
  /** The skeleton: solution[r][c] = layer of the crown in pillar (r, c). */
  solution: number[][]
  analysis: Difficulty3DReport
}
/** `cells` are stacked-board cell indexes and `units` index the 4n² units of `buildUnits`. */
export interface Deduction3DStep extends Omit<DeductionStep, 'evidence'> {
  /** Whether the reasoning needs a pillar, so it cannot be seen inside one layer. */
  crossLayer: boolean
  evidence?: Deduction3DStep[]
}
export interface Difficulty3DReport {
  difficulty: Difficulty | 'unrated'
  score: number
  steps: Deduction3DStep[]
  solved: boolean
}
export interface Generate3DOptions {
  size: number
  seed: number
  difficulty?: Difficulty
  maxAttempts?: number
  mutationBudget?: number
}
