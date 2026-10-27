import { expect, it } from 'vitest'
import { generatePuzzle } from '../queens/generator'
import { replayRun, runLogSchema, scoreRun, type RunEvent } from '../queens/replay'

const puzzle = generatePuzzle({ size: 6, seed: 42 })
// One queen per row at the solution's column, one second apart.
const solve = (from = 0): RunEvent[] =>
  puzzle.solution.map((col, row) => [from + row * 1000, 'edit', row * 6 + col, 'queen'])

it('replays edits, undo, redo and hints the way the game applies them', () => {
  const log: RunEvent[] = [
    [0, 'edit', 0, 'cycle'],
    [100, 'undo'],
    [200, 'redo'],
    [300, 'hint'],
    [400, 'apply', 'eliminate', [1, 2]],
    [500, 'undo'],
    [600, 'undo'],
    ...solve(1000),
  ]
  expect(replayRun(puzzle.regions, log)).toEqual({ won: true, moves: 8, hints: 1, lastAt: 6000 })
  expect(runLogSchema.safeParse(log).success).toBe(true)
})
it('rejects logs that could not have happened', () => {
  expect(replayRun(puzzle.regions, [[0, 'undo']])).toBeNull()
  expect(replayRun(puzzle.regions, [[0, 'edit', 36, 'queen']])).toBeNull()
  expect(
    replayRun(puzzle.regions, [
      [5, 'hint'],
      [4, 'hint'],
    ]),
  ).toBeNull()
  // Nothing may follow the winning move.
  expect(replayRun(puzzle.regions, [...solve(), [9000, 'hint']])).toBeNull()
  expect(runLogSchema.safeParse([[0, 'edit', -1, 'queen']]).success).toBe(false)
})
it('scores with the server clock and a penalty per hint', () => {
  expect(scoreRun(puzzle.regions, [[0, 'hint'], ...solve(1000)], 61400)).toEqual({
    seconds: 61,
    moves: 6,
    hints: 1,
    score: 91,
  })
  // Unsolved, a log clock far ahead of the server's, and inhuman speed are all refused.
  expect(scoreRun(puzzle.regions, solve().slice(1), 60000)).toBeNull()
  expect(scoreRun(puzzle.regions, solve(), 1000)).toBeNull()
  const instant: RunEvent[] = solve().map(([, ...rest]) => [0, ...rest])
  expect(scoreRun(puzzle.regions, instant, 5900)).toBeNull()
  expect(scoreRun(puzzle.regions, instant, 6000)).not.toBeNull()
  const flood: RunEvent[] = Array.from({ length: 200 }, (_, i) => [i, 'hint'])
  expect(scoreRun(puzzle.regions, [...flood, ...solve(200)], 60000)).toBeNull()
})
