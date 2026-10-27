/**
 * A user-facing sentence described as data, so the server and the solver can say things without
 * choosing a language: the interface turns it into text with the reader's own catalog.
 */
export type MessageParam =
  | string
  | number
  | Message
  /** A row (0..n-1), column (n..2n-1) or region (2n..3n-1) of an n×n board. */
  | { unit: number; n: number }
  | { units: number[]; n: number }
export interface Message {
  key: string
  params?: Record<string, MessageParam>
}
export const message = (key: string, params?: Record<string, MessageParam>): Message =>
  params ? { key, params } : { key }
/** An error whose text is chosen by the reader; `message` is only a fallback for logs. */
export class LocalizedError extends Error {
  constructor(
    readonly localized: Message,
    fallback = localized.key,
  ) {
    super(fallback)
    this.name = 'LocalizedError'
  }
}

/** Every failure a reader can be told about; each has an `errors.<CODE>` entry in every catalog. */
export const ERROR_CODES = [
  'NOT_FOUND',
  'UNAUTHORIZED',
  'ROOM_CODE_EXHAUSTED',
  'ROOM_FULL',
  'ACTION_ID_REUSED',
  'HOST_ONLY',
  'STALE_GAME',
  'NOT_PLAYING',
  'NO_CHANGE',
  'NOT_WAITING',
  'CANNOT_START',
  'NO_BOARD',
  'CANNOT_PAUSE',
  'CELL_OUT_OF_RANGE',
  'CELL_CONFLICT',
  'GAME_PAUSED',
  'NOTHING_TO_UNDO',
  'UNDO_CONFLICT',
  'STALE_HINT',
  'HINT_NOT_REVEALED',
  'STATE_CONFLICT',
  'INVALID_ACTION',
  'RATE_LIMIT',
  'INVALID_INPUT',
  'INVALID_COMMAND',
  'INVALID_CREDENTIALS',
  'SERVER_ERROR',
  'CONNECT_FAILED',
  'SYNC_FAILED',
  'RESOURCE_NOT_FOUND',
  'COMPUTE_TIMEOUT',
  'COMPUTE_BUSY',
  'COMPUTE_CLOSED',
  'COMPUTE_ERROR',
  'GENERATION_FAILED',
  'GENERATION_BUDGET',
  'NO_PUZZLE',
  'INVALID_STATE',
  'SIGN_IN_REQUIRED',
  'NICKNAME_TAKEN',
  'RUN_REJECTED',
  'RUN_FINISHED',
] as const
export type ErrorCode = (typeof ERROR_CODES)[number]
export const errorMessage = (code: ErrorCode, params?: Record<string, MessageParam>): Message =>
  message(`errors.${code}`, params)
/** Compute failures the reader can act on; anything else is reported as a generation failure. */
const COMPUTE_CODES = new Set<string>([
  'COMPUTE_TIMEOUT',
  'COMPUTE_BUSY',
  'COMPUTE_CLOSED',
  'GENERATION_BUDGET',
])
/** What to tell a reader about a failure, without leaking internal details. */
export function failureMessage(error: unknown, fallback: ErrorCode = 'SERVER_ERROR'): Message {
  if (error instanceof LocalizedError) return error.localized
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : null
  return typeof code === 'string' && COMPUTE_CODES.has(code)
    ? errorMessage(code as ErrorCode)
    : errorMessage(fallback)
}
