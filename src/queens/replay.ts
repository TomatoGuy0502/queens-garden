import { z } from 'zod'
import type { CellState } from './types'
import { nextCell } from './cells'
import { conflictCells } from './validator'

/** A ranked daily is timed by the server; every action is logged so it can verify the board. */
export const MAX_RUN_EVENTS = 5000
/** Seconds added to a ranked time for each hint asked for. */
export const HINT_PENALTY_SECONDS = 30
/** Faster than this, on average, is not a person clicking. */
const MAX_EVENTS_PER_SECOND = 20
/** No one solves faster than this per queen, so a quicker finish is a script. */
const MIN_MS_PER_QUEEN = 1000
/** How far the log's clock may run ahead of the server's, for latency at start and finish. */
const CLOCK_SLACK_MS = 3000

const at = z.number().int().nonnegative()
/** One action, timed in milliseconds from the start of the run. */
export const runEventSchema = z.union([
  z.tuple([
    at,
    z.literal('edit'),
    z.number().int().nonnegative(),
    z.enum(['cycle', 'mark', 'queen']),
  ]),
  z.tuple([at, z.enum(['undo', 'redo', 'hint'])]),
  z.tuple([
    at,
    z.literal('apply'),
    z.enum(['place', 'eliminate']),
    z.array(z.number().int().nonnegative()).max(100),
  ]),
])
export type RunEvent = z.infer<typeof runEventSchema>
export const runLogSchema = z.array(runEventSchema).max(MAX_RUN_EVENTS)

export interface RunReplay {
  won: boolean
  moves: number
  hints: number
  /** Time of the last event. */
  lastAt: number
}
/** Replays a log from an empty board the way the game applies it; null when it cannot happen. */
export function replayRun(regions: number[][], log: readonly RunEvent[]): RunReplay | null {
  const size = regions.length
  let cells = Array<CellState>(size * size).fill('empty')
  const history: CellState[][] = [],
    future: CellState[][] = []
  let moves = 0,
    hints = 0,
    lastAt = 0
  const won = () => {
    const queens = cells.flatMap((state, i) =>
      state === 'queen' ? [{ row: Math.floor(i / size), col: i % size }] : [],
    )
    return queens.length === size && !conflictCells(regions, queens).length
  }
  for (const event of log) {
    if (event[0] < lastAt || won()) return null
    lastAt = event[0]
    if (event.length === 2 && event[1] === 'hint') hints++
    else if (event.length === 2) {
      const [from, to] = event[1] === 'undo' ? [history, future] : [future, history]
      if (!from.length) return null
      to.push(cells)
      cells = from.pop()!
    } else {
      const [index, action] = event[1] === 'edit' ? [[event[2]], event[3]] : [event[3], event[2]]
      if (index.some((i) => i >= cells.length)) return null
      history.push(cells)
      future.length = 0
      cells = cells.map((cell, i) =>
        !index.includes(i)
          ? cell
          : action === 'place'
            ? 'queen'
            : action === 'eliminate'
              ? 'marked'
              : nextCell(cell, action),
      )
      moves++
    }
  }
  return { won: won(), moves, hints, lastAt }
}
export interface RankedResult {
  seconds: number
  moves: number
  hints: number
  score: number
}
/**
 * Scores a finished ranked run, or null when the log does not solve the board or could not have
 * been played in the time the server measured.
 */
export function scoreRun(
  regions: number[][],
  log: readonly RunEvent[],
  elapsedMs: number,
): RankedResult | null {
  if (elapsedMs < regions.length * MIN_MS_PER_QUEEN) return null
  const replay = replayRun(regions, log)
  if (!replay?.won || replay.lastAt > elapsedMs + CLOCK_SLACK_MS) return null
  if (log.length > MAX_EVENTS_PER_SECOND * (replay.lastAt / 1000 + 1)) return null
  const seconds = Math.round(elapsedMs / 1000)
  return {
    seconds,
    moves: replay.moves,
    hints: replay.hints,
    score: seconds + HINT_PENALTY_SECONDS * replay.hints,
  }
}
