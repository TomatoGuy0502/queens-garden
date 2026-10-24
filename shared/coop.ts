import { z } from 'zod'
import { ROOM_CODE_PATTERN } from './roomCode'
import type { CellState, DeductionStep, PuzzleDefinition } from '../src/queens/types'
export const MAX_ROOM_PLAYERS = 8

export const sizeSchema = z.union([
  z.literal(6),
  z.literal(7),
  z.literal(8),
  z.literal(9),
  z.literal(10),
  z.literal(12),
])
export const difficultySchema = z.enum(['easy', 'medium', 'hard'])
export const settingsSchema = z.object({
  size: sizeSchema,
  difficulty: difficultySchema,
  seed: z.number().int().min(0).max(0xffffffff).optional(),
})
export const createRoomSchema = settingsSchema.extend({ name: z.string().trim().min(1).max(24) })
export const joinRoomSchema = z.object({ name: z.string().trim().min(1).max(24) })
export const roomCodeSchema = z.string().trim().toUpperCase().regex(ROOM_CODE_PATTERN)
export const credentialsSchema = z.object({
  roomId: roomCodeSchema,
  playerId: z.uuid(),
  token: z.string().regex(/^[a-f0-9]{64}$/),
})
export type Credentials = z.infer<typeof credentialsSchema>
export type RoomSettings = z.infer<typeof settingsSchema>
const envelope = { actionId: z.uuid() }
const round = { ...envelope, gameId: z.uuid() }
export const commandSchema = z.discriminatedUnion('type', [
  z.object({ ...round, type: z.literal('configure'), settings: settingsSchema }),
  z.object({ ...round, type: z.literal('start') }),
  z.object({ ...round, type: z.literal('reset') }),
  z.object({ ...envelope, type: z.literal('leave') }),
  z.object({
    ...round,
    type: z.literal('setCell'),
    index: z.number().int().min(0).max(143),
    expectedVersion: z.number().int().min(0),
    nextState: z.enum(['empty', 'queen', 'marked']),
  }),
  z.object({ ...round, type: z.literal('undo'), targetId: z.uuid() }),
  z.object({ ...round, type: z.literal('redo'), targetId: z.uuid() }),
  z.object({ ...round, type: z.literal('pause'), paused: z.boolean() }),
  z.object({ ...round, type: z.literal('hint') }),
  z.object({ ...round, type: z.literal('check') }),
  z.object({ ...round, type: z.literal('applyHint'), hintId: z.uuid() }),
])
export type RoomCommand = z.infer<typeof commandSchema>
export interface Change {
  index: number
  before: CellState
  after: CellState
}
export interface BoardAction {
  id: string
  playerId: string
  changes: Change[]
  versions: number[]
  undoVersions: number[]
  undone: boolean
}
export interface Player {
  id: string
  name: string
  connected: boolean
}
export interface SharedHint {
  id: string
  boardRevision: number
  step: DeductionStep | null
  message: string
}
export interface GameSnapshot {
  id: string
  phase: 'waiting' | 'generating' | 'playing' | 'paused' | 'completed'
  puzzle: PuzzleDefinition | null
  cells: CellState[]
  versions: number[]
  boardRevision: number
  actions: BoardAction[]
  elapsedMs: number
  moves: number
  hints: number
  hint: SharedHint | null
  message: string
  mistakes: number[]
}
export interface RoomSnapshot {
  id: string
  hostId: string
  settings: RoomSettings
  players: Player[]
  revision: number
  serverNow: number
  expiresAt: number
  game: GameSnapshot
}
export type RoomReply =
  | { ok: true; state: RoomSnapshot }
  | { ok: false; error: string; code: string }
export interface RoomAccess {
  credentials: Credentials
  state: RoomSnapshot
}
export const pointSchema = z.object({ gameId: z.uuid(), index: z.number().int().min(0).max(143) })
export interface Point {
  playerId: string
  name: string
  index: number
  gameId: string
  expiresAt: number
}
export const hoverSchema = z.object({
  gameId: z.uuid(),
  index: z.number().int().min(0).max(143).nullable(),
})
export interface Hover extends Omit<Point, 'index'> {
  index: number | null
}
export interface ServerEvents {
  'room:hover': (hover: Hover) => void
  'room:state': (state: RoomSnapshot) => void
  'room:point': (point: Point) => void
  'room:error': (error: { message: string }) => void
}
export interface ClientEvents {
  'room:hover': (hover: z.infer<typeof hoverSchema>) => void
  'room:command': (command: RoomCommand, ack: (reply: RoomReply) => void) => void
  'room:point': (point: z.infer<typeof pointSchema>) => void
  'room:sync': (ack: (reply: RoomReply) => void) => void
}
