import { z } from 'zod'
import type { Message } from './message'
import { ROOM_CODE_PATTERN } from './roomCode'
import { BOARD_SIZES, DIFFICULTIES } from '../src/queens/levels'
import type { CellState, DeductionStep, PuzzleDefinition } from '../src/queens/types'
import { BOARD_SIZES_3D } from '../src/queens3d/version'
import type { Puzzle3DDefinition } from '../src/queens3d/types'
export const MAX_ROOM_PLAYERS = 8
export const MAX_DUEL_PLAYERS = 2
export const ROOM_MODES = ['coop', 'duel'] as const
export type RoomMode = (typeof ROOM_MODES)[number]
export const maxPlayers = (mode: RoomMode) =>
  mode === 'duel' ? MAX_DUEL_PLAYERS : MAX_ROOM_PLAYERS

/** The most cells a board has: a 6 × 6 × 6 stacked board. */
const MAX_CELL = 215
export const sizeSchema = z.union([z.literal(BOARD_SIZES), z.literal(BOARD_SIZES_3D)])
export const difficultySchema = z.enum(DIFFICULTIES)
export const settingsSchema = z.object({
  size: sizeSchema,
  difficulty: difficultySchema,
  seed: z.number().int().min(0).max(0xffffffff).optional(),
  /** A stacked (3D) board: as many layers as rows. */
  stacked: z.boolean().optional(),
})
/** A stacked board has its own sizes and no expert level yet. */
export const validSettings = ({ size, difficulty, stacked }: z.infer<typeof settingsSchema>) =>
  stacked
    ? BOARD_SIZES_3D.some((n) => n === size) && difficulty !== 'expert'
    : BOARD_SIZES.some((n) => n === size)
export const createRoomSchema = settingsSchema
  .extend({
    name: z.string().trim().min(1).max(24),
    mode: z.enum(ROOM_MODES).default('coop'),
  })
  .refine(validSettings)
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
  z.object({
    ...round,
    type: z.literal('configure'),
    settings: settingsSchema.refine(validSettings),
  }),
  z.object({ ...round, type: z.literal('start') }),
  z.object({ ...round, type: z.literal('reset') }),
  z.object({ ...round, type: z.literal('restart') }),
  z.object({ ...envelope, type: z.literal('leave') }),
  z.object({
    ...round,
    type: z.literal('setCell'),
    index: z.number().int().min(0).max(MAX_CELL),
    expectedVersion: z.number().int().min(0),
    nextState: z.enum(['empty', 'queen', 'marked']),
  }),
  z.object({
    ...round,
    type: z.literal('duelBoard'),
    cells: z.array(z.enum(['empty', 'queen', 'marked'])).max(MAX_CELL + 1),
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
  message: Message
  /** 1 = where to look, 2 = the technique, 3 = the answer; 0 when there is no logical step. */
  level: number
}
/** A duel keeps one board per player; only the player's own board ever travels back to them. */
export interface DuelSnapshot {
  /** Per player id: rows and columns covered by queens, right or wrong. */
  progress: Record<string, number>
  winnerId: string | null
  /** The viewer's own board, present only in replies addressed to that viewer. */
  mine?: CellState[]
}
export interface GameSnapshot {
  id: string
  phase: 'waiting' | 'generating' | 'playing' | 'paused' | 'completed'
  puzzle: PuzzleDefinition | Puzzle3DDefinition | null
  cells: CellState[]
  versions: number[]
  boardRevision: number
  actions: BoardAction[]
  elapsedMs: number
  moves: number
  hints: number
  hint: SharedHint | null
  /** The latest room-wide notice; null when there is none. */
  message: Message | null
  mistakes: number[]
  duel?: DuelSnapshot
}
export interface RoomSnapshot {
  id: string
  mode: RoomMode
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
  | { ok: false; error: Message; code: string }
export interface RoomAccess {
  credentials: Credentials
  state: RoomSnapshot
}
export const pointSchema = z.object({
  gameId: z.uuid(),
  index: z.number().int().min(0).max(MAX_CELL),
})
export interface Point {
  playerId: string
  name: string
  index: number
  gameId: string
  expiresAt: number
}
export const hoverSchema = z.object({
  gameId: z.uuid(),
  index: z.number().int().min(0).max(MAX_CELL).nullable(),
})
export interface Hover extends Omit<Point, 'index'> {
  index: number | null
}
export interface ServerEvents {
  'room:hover': (hover: Hover) => void
  'room:state': (state: RoomSnapshot) => void
  'room:point': (point: Point) => void
  'room:error': (error: { message: Message }) => void
}
export interface ClientEvents {
  'room:hover': (hover: z.infer<typeof hoverSchema>) => void
  'room:command': (command: RoomCommand, ack: (reply: RoomReply) => void) => void
  'room:point': (point: z.infer<typeof pointSchema>) => void
  'room:sync': (ack: (reply: RoomReply) => void) => void
}
