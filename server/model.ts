import { errorMessage, type ErrorCode, type Message, type MessageParam } from '../shared/message'
import type { BoardAction, GameSnapshot, RoomSettings, SharedHint } from '../shared/coop'
import type { CellState, QueensPuzzle } from '../src/queens/types'
export interface StoredPlayer {
  id: string
  name: string
  tokenHash: string
  lastSeenAt: number
}
export interface StoredRoom {
  id: string
  hostId: string
  settings: RoomSettings
  players: StoredPlayer[]
  revision: number
  expiresAt: number
  checkpointAt: number
  gameId: string
  phase: GameSnapshot['phase']
  puzzle: QueensPuzzle | null
  cells: CellState[]
  versions: number[]
  boardRevision: number
  actions: BoardAction[]
  startedAt: number | null
  pausedAt: number | null
  pausedMs: number
  finishedAt: number | null
  moves: number
  hints: number
  hint: SharedHint | null
  message: Message | null
  mistakes: number[]
  receipts: Record<string, { playerId: string; fingerprint: string }>
}
export interface RoomEvent {
  type: string
  playerId: string
  actionId?: string
  changes?: BoardAction['changes']
  result?: {
    gameId: string
    puzzleId: string
    elapsedMs: number
    moves: number
    hints: number
    players: { id: string; name: string }[]
  }
}
export interface RoomRepository {
  get(id: string): Promise<StoredRoom | null>
  save(room: StoredRoom, event: RoomEvent): Promise<void>
  deleteExpired(now: number): Promise<void>
}
/** A refusal the room's players can be told about; the text is chosen by each reader's language. */
export class RoomError extends Error {
  readonly localized: Message
  constructor(
    public code: ErrorCode = 'INVALID_ACTION',
    params?: Record<string, MessageParam>,
  ) {
    super(code)
    this.localized = errorMessage(code, params)
  }
}
