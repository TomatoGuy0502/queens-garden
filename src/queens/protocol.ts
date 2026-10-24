import type { Message } from '../../shared/message'
import type { CellState, DeductionStep, GenerateOptions, PuzzleDefinition } from './types'
export type WorkerRequest = { id: number } & (
  | { type: 'generate'; options: GenerateOptions }
  | { type: 'hint'; cells: CellState[] }
  | { type: 'check'; cells: CellState[] }
)
export interface WorkerResponse {
  id: number
  error?: Message
  puzzle?: PuzzleDefinition
  step?: DeductionStep | null
  message?: Message
  mistakes?: number[]
}
