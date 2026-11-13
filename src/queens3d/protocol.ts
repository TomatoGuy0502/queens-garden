import type { WorkerResponse } from '../queens/protocol'
import type { Puzzle3DDefinition } from './types'

/** Requests have the shape of the 2D worker's; only the puzzle in the answer differs. */
export type { WorkerRequest as Worker3DRequest } from '../queens/protocol'
export type Worker3DResponse = Omit<WorkerResponse, 'puzzle'> & { puzzle?: Puzzle3DDefinition }
