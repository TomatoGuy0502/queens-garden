import { isDateKey } from './daily'
import { BOARD_SIZES, DIFFICULTIES } from './levels'
import type { CellState, Difficulty } from './types'
import { GENERATOR_VERSION } from './version'
import { runLogSchema, type RunEvent } from './replay'

/** Undo history kept with a saved game; older steps are dropped to bound the stored size. */
export const MAX_SAVED_HISTORY = 100
const SYMBOL: Record<CellState, string> = { empty: 'e', queen: 'q', marked: 'm' }
const STATE = { e: 'empty', q: 'queen', m: 'marked' } as const

export interface SavedProgress {
  version: string
  size: number
  difficulty: Difficulty
  seed: number
  /** Date key of the daily challenge being played, if any. */
  daily: string | null
  cells: string
  history: string[]
  future: string[]
  elapsedMs: number
  moves: number
  hints: number
  /** Action log of a ranked daily, replayed by the server when it is finished. */
  log?: RunEvent[]
  savedAt: number
}
export interface RestoredProgress {
  cells: CellState[]
  history: CellState[][]
  future: CellState[][]
  elapsedMs: number
  moves: number
  hints: number
  log?: RunEvent[]
}

export const encodeCells = (cells: readonly CellState[]) =>
  cells.map((state) => SYMBOL[state]).join('')
export function decodeCells(text: string, length: number): CellState[] | null {
  if (text.length !== length || !/^[eqm]+$/.test(text)) return null
  return Array.from(text, (char) => STATE[char as keyof typeof STATE])
}
export const hasProgress = (progress: Pick<SavedProgress, 'cells' | 'history'>) =>
  progress.history.length > 0 || /[qm]/.test(progress.cells)
/** Whether a save belongs to exactly this puzzle, so it can be resumed from a matching link. */
export const sameGame = (
  progress: Pick<SavedProgress, 'size' | 'difficulty' | 'seed'>,
  puzzle: { size: number; difficulty: Difficulty; seed: number },
) =>
  progress.size === puzzle.size &&
  progress.difficulty === puzzle.difficulty &&
  progress.seed === puzzle.seed

const count = (value: unknown, max = Number.MAX_SAFE_INTEGER) =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= max
    ? value
    : null
/** Saved data is untrusted: anything malformed, or from another generator version, is dropped. */
export function parseProgress(raw: unknown): SavedProgress | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Record<string, unknown>
  const { size, difficulty, seed, cells, history, future } = value
  if (
    value.version !== GENERATOR_VERSION ||
    !BOARD_SIZES.some((item) => item === size) ||
    !DIFFICULTIES.some((item) => item === difficulty) ||
    count(seed, 0xffffffff) === null ||
    (value.daily !== null && !isDateKey(value.daily)) ||
    typeof cells !== 'string' ||
    !Array.isArray(history) ||
    !Array.isArray(future)
  )
    return null
  const length = (size as number) ** 2
  const boards = (list: unknown[]) =>
    list.length <= MAX_SAVED_HISTORY &&
    list.every((item) => typeof item === 'string' && decodeCells(item, length) !== null)
  const elapsedMs = count(value.elapsedMs, 1000 * 60 * 60 * 24 * 365),
    moves = count(value.moves),
    hints = count(value.hints),
    savedAt = count(value.savedAt),
    log = value.log === undefined ? undefined : runLogSchema.safeParse(value.log).data
  if (
    decodeCells(cells, length) === null ||
    !boards(history) ||
    !boards(future) ||
    elapsedMs === null ||
    moves === null ||
    hints === null ||
    savedAt === null ||
    (value.log !== undefined && !log)
  )
    return null
  return {
    version: GENERATOR_VERSION,
    size: size as number,
    difficulty: difficulty as Difficulty,
    seed: seed as number,
    daily: value.daily,
    cells,
    history: history as string[],
    future: future as string[],
    elapsedMs,
    moves,
    hints,
    ...(log && { log }),
    savedAt,
  }
}
export function restoreProgress(progress: SavedProgress): RestoredProgress {
  const length = progress.size ** 2
  const decode = (text: string) => decodeCells(text, length)!
  return {
    cells: decode(progress.cells),
    history: progress.history.map(decode),
    future: progress.future.map(decode),
    elapsedMs: progress.elapsedMs,
    moves: progress.moves,
    hints: progress.hints,
    log: progress.log,
  }
}
