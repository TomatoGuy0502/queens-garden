import { expect, it } from 'vitest'
import {
  MAX_SAVED_HISTORY,
  decodeCells,
  encodeCells,
  hasProgress,
  parseProgress,
  restoreProgress,
  sameGame,
  type SavedProgress,
} from '../queens/progress'
import { GENERATOR_VERSION } from '../queens/version'
import type { CellState } from '../queens/types'

const board = (n: number, ...entries: [number, CellState][]) => {
  const cells = Array<CellState>(n * n).fill('empty')
  for (const [index, state] of entries) cells[index] = state
  return cells
}
const saved = (overrides: Partial<SavedProgress> = {}): SavedProgress => ({
  version: GENERATOR_VERSION,
  size: 6,
  difficulty: 'medium',
  seed: 42,
  daily: null,
  cells: encodeCells(board(6, [0, 'queen'], [7, 'marked'])),
  history: [encodeCells(board(6)), encodeCells(board(6, [0, 'queen']))],
  future: [],
  elapsedMs: 65000,
  moves: 3,
  hints: 1,
  savedAt: 1700000000000,
  ...overrides,
})

it('round-trips cell states through the compact encoding', () => {
  const cells = board(6, [0, 'queen'], [5, 'marked'], [35, 'queen'])
  const text = encodeCells(cells)
  expect(text).toHaveLength(36)
  expect(text[0]).toBe('q')
  expect(decodeCells(text, 36)).toEqual(cells)
  expect(decodeCells(text, 25)).toBeNull()
  expect(decodeCells('x'.repeat(36), 36)).toBeNull()
})
it('restores a valid save with its history, timer and counters', () => {
  const parsed = parseProgress(JSON.parse(JSON.stringify(saved())))!
  expect(parsed).toEqual(saved())
  const restored = restoreProgress(parsed)
  expect(restored.cells[0]).toBe('queen')
  expect(restored.cells[7]).toBe('marked')
  expect(restored.history).toHaveLength(2)
  expect(restored).toMatchObject({ elapsedMs: 65000, moves: 3, hints: 1 })
})
it('rejects saves from another generator version or with a malformed board', () => {
  expect(parseProgress(null)).toBeNull()
  expect(parseProgress('x')).toBeNull()
  expect(parseProgress(saved({ version: '0.0.1' }))).toBeNull()
  expect(parseProgress(saved({ size: 11 }))).toBeNull()
  expect(parseProgress(saved({ difficulty: 'legendary' as never }))).toBeNull()
  expect(parseProgress(saved({ seed: -1 }))).toBeNull()
  expect(parseProgress(saved({ seed: 2 ** 32 }))).toBeNull()
  expect(parseProgress(saved({ cells: 'q'.repeat(35) }))).toBeNull()
  expect(parseProgress(saved({ cells: 'z'.repeat(36) }))).toBeNull()
  expect(parseProgress(saved({ history: ['e'.repeat(35)] }))).toBeNull()
  expect(parseProgress(saved({ future: [3 as never] }))).toBeNull()
  expect(parseProgress(saved({ daily: '2026-02-30' }))).toBeNull()
  expect(parseProgress(saved({ elapsedMs: -1 }))).toBeNull()
  expect(parseProgress(saved({ moves: 1.5 }))).toBeNull()
  const tooLong = Array<string>(MAX_SAVED_HISTORY + 1).fill(encodeCells(board(6)))
  expect(parseProgress(saved({ history: tooLong }))).toBeNull()
  expect(parseProgress(saved({ daily: '2026-10-27' }))?.daily).toBe('2026-10-27')
})
it('tells an untouched board from one with progress and matches a save to its puzzle', () => {
  expect(hasProgress(saved({ cells: encodeCells(board(6)), history: [] }))).toBe(false)
  expect(hasProgress(saved({ cells: encodeCells(board(6, [3, 'marked'])), history: [] }))).toBe(
    true,
  )
  expect(hasProgress(saved({ cells: encodeCells(board(6)) }))).toBe(true)
  expect(sameGame(saved(), { size: 6, difficulty: 'medium', seed: 42 })).toBe(true)
  expect(sameGame(saved(), { size: 6, difficulty: 'medium', seed: 43 })).toBe(false)
  expect(sameGame(saved(), { size: 7, difficulty: 'medium', seed: 42 })).toBe(false)
  expect(sameGame(saved(), { size: 6, difficulty: 'easy', seed: 42 })).toBe(false)
})
