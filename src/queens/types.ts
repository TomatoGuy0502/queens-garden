export type QueenPlacement = number[]
export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert'
export type CellState = 'empty' | 'marked' | 'queen'
export interface Position {
  row: number
  col: number
}
export interface PuzzleDefinition {
  id: string
  version: string
  size: number
  regions: number[][]
  seed: number
  difficulty: Difficulty
  difficultyScore: number
  generation: { maxAttempts: number; mutationBudget: number; requestedDifficulty?: Difficulty }
}
export interface QueensPuzzle extends PuzzleDefinition {
  solution: QueenPlacement
  analysis: DifficultyReport
}
export interface SolveResult {
  solutionCount: number
  solutions: QueenPlacement[]
  nodes: number
  exhausted: boolean
}
export type Strategy = 'single' | 'adjacency' | 'intersection' | 'hall' | 'contradiction'
export interface DeductionStep {
  strategy: Strategy
  level: 1 | 2 | 3
  action: 'place' | 'eliminate'
  cells: number[]
  /** Rows (0..n-1), columns (n..2n-1) and regions (2n..3n-1) the reasoning is about. */
  units: number[]
  reason: string
  evidence?: DeductionStep[]
}
export interface DifficultyReport {
  difficulty: Difficulty | 'unrated'
  score: number
  steps: DeductionStep[]
  solved: boolean
}
export interface GenerateOptions {
  size: number
  seed: number
  difficulty?: Difficulty
  maxAttempts?: number
  mutationBudget?: number
}
