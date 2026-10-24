import type { CellState, DeductionStep, GenerateOptions, PuzzleDefinition } from './types'
export type WorkerRequest = { id: number } & (
  | { type: 'generate'; options: GenerateOptions }
  | { type: 'hint'; cells: CellState[] }
  | { type: 'check'; cells: CellState[] }
)
export interface WorkerResponse {
  id: number
  error?: string
  puzzle?: PuzzleDefinition
  step?: DeductionStep | null
  message?: string
  mistakes?: number[]
}
