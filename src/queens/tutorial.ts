import { message, type Message } from '../../shared/message'
import { applyStep, createState } from './deductions/state'
import { evaluateDifficulty, logicalHint } from './difficulty'
import { solve } from './solver'
import { conflictCells } from './validator'
import { GENERATOR_VERSION } from './version'
import type { CellState, DeductionStep, PuzzleDefinition } from './types'
import type { Puzzle3DDefinition } from '../queens3d/types'

/** A fixed medium 6×6 board whose first steps are small adjacency, intersection and single moves. */
const REGIONS = [
  [1, 1, 0, 0, 0, 0],
  [1, 1, 1, 1, 1, 0],
  [1, 1, 1, 2, 2, 0],
  [1, 1, 3, 3, 2, 2],
  [5, 5, 3, 4, 4, 4],
  [5, 3, 3, 3, 3, 3],
]
export const TUTORIAL_PUZZLE: PuzzleDefinition = {
  id: 'tutorial',
  version: GENERATOR_VERSION,
  size: 6,
  regions: REGIONS,
  seed: 0,
  difficulty: 'medium',
  difficultyScore: 24,
  generation: { maxAttempts: 160, mutationBudget: 100 },
}

export type TutorialGoal =
  | { type: 'continue' }
  | { type: 'queen-any' }
  | { type: 'mark-any' }
  | { type: 'no-conflict' }
  | { type: 'mark-all'; cells: number[] }
  | { type: 'queen-at'; cell: number }
  | { type: 'solved' }
export interface TutorialLesson {
  id: string
  title: Message
  body: Message[]
  /** What the player must do, shown beside the board; null for read-only lessons. */
  task: Message | null
  goal: TutorialGoal
  preset: CellState[]
  highlight: number[]
  hints?: boolean
}

const size = REGIONS.length
const empty = (): CellState[] => Array<CellState>(size * size).fill('empty')
const queensOf = (cells: readonly CellState[]) =>
  cells.flatMap((state, i) =>
    state === 'queen' ? [{ row: Math.floor(i / size), col: i % size }] : [],
  )
export const conflictsOf = (cells: readonly CellState[]) => conflictCells(REGIONS, queensOf(cells))
/** One tutorial: its board, its lessons, and the rules that judge a lesson's board. */
export interface TutorialCourse {
  puzzle: PuzzleDefinition | Puzzle3DDefinition
  lessons: TutorialLesson[]
  /** Crowns on a solved board. */
  crowns: number
  conflicts: (cells: readonly CellState[]) => number[]
  hint: (cells: CellState[]) => { message: Message; cells: number[]; action: string | null }
  /** i18n prefix of the course's page texts. */
  texts: 'tutorial' | 'tutorial3d'
  /** Where a finished player goes to play for real. */
  play: string
}
export function goalMet(
  goal: TutorialGoal,
  cells: readonly CellState[],
  course: Pick<TutorialCourse, 'crowns' | 'conflicts'> = { crowns: size, conflicts: conflictsOf },
): boolean {
  switch (goal.type) {
    case 'continue':
      return true
    case 'queen-any':
      return cells.includes('queen')
    case 'mark-any':
      return cells.includes('marked')
    case 'no-conflict':
      return !course.conflicts(cells).length
    case 'mark-all':
      return goal.cells.every((cell) => cells[cell] === 'marked')
    case 'queen-at':
      return cells[goal.cell] === 'queen'
    case 'solved':
      return (
        cells.filter((state) => state === 'queen').length === course.crowns &&
        !course.conflicts(cells).length
      )
  }
}
/** The board a careful player would have after the first `count` logical steps. */
function boardAfter(steps: DeductionStep[], count: number): CellState[] {
  const state = createState(REGIONS)
  const cells = empty()
  for (const step of steps.slice(0, count)) {
    applyStep(state, step)
    for (const cell of step.cells) cells[cell] = step.action === 'place' ? 'queen' : 'marked'
  }
  return cells
}
export function nextHint(cells: CellState[]) {
  const { step, message: text } = logicalHint(REGIONS, cells)
  return { message: text, cells: step?.cells ?? [], action: step?.action ?? null }
}

export function buildLessons(): TutorialLesson[] {
  const steps = evaluateDifficulty(REGIONS).steps
  const adjacency = steps.findIndex((step) => step.strategy === 'adjacency')
  const intersection = steps.findIndex((step) => step.strategy === 'intersection')
  const single = steps.findIndex((step, i) => step.strategy === 'single' && i > intersection)
  if (adjacency < 0 || intersection < 0 || single < 0)
    throw new Error('The tutorial board lacks a step to demonstrate.')
  const solved = empty()
  for (const [row, col] of solve(REGIONS).solutions[0].entries()) solved[row * size + col] = 'queen'
  const conflict = empty()
  conflict[2 * size + 2] = 'queen'
  conflict[3 * size + 3] = 'queen'
  const text = (id: string, part: string, params?: Record<string, number>) =>
    message(`tutorial.lessons.${id}.${part}`, params)
  const lesson = (
    id: string,
    paragraphs: (string | Message)[],
    goal: TutorialGoal,
    options: {
      task?: boolean
      count?: number
      preset?: CellState[]
      highlight?: number[]
      hints?: boolean
    } = {},
  ): TutorialLesson => {
    const params = options.count === undefined ? undefined : { count: options.count }
    return {
      id,
      title: text(id, 'title'),
      body: paragraphs.map((paragraph) =>
        typeof paragraph === 'string' ? text(id, paragraph, params) : paragraph,
      ),
      goal,
      task: options.task === false ? null : text(id, 'task', params),
      preset: options.preset ?? empty(),
      highlight: options.highlight ?? [],
      hints: options.hints ?? false,
    }
  }
  const step = (index: number) => steps[index]
  return [
    lesson('rules', ['p1', 'p2', 'p3'], { type: 'continue' }, { task: false }),
    lesson('mark', ['p1', 'p2'], { type: 'mark-any' }),
    lesson('queen', ['p1', 'p2'], { type: 'queen-any' }),
    lesson('adjacent', ['p1', 'p2'], { type: 'no-conflict' }, { preset: conflict }),
    lesson(
      'adjacency',
      ['p1', step(adjacency).reason, 'p3'],
      { type: 'mark-all', cells: step(adjacency).cells },
      {
        count: step(adjacency).cells.length,
        preset: boardAfter(steps, adjacency),
        highlight: step(adjacency).cells,
      },
    ),
    lesson(
      'intersection',
      ['p1', step(intersection).reason],
      { type: 'mark-all', cells: step(intersection).cells },
      {
        count: step(intersection).cells.length,
        preset: boardAfter(steps, intersection),
        highlight: step(intersection).cells,
      },
    ),
    lesson(
      'single',
      ['p1', step(single).reason],
      { type: 'queen-at', cell: step(single).cells[0] },
      { preset: boardAfter(steps, single), highlight: step(single).cells },
    ),
    lesson(
      'finish',
      ['p1', 'p2'],
      { type: 'solved' },
      { preset: boardAfter(steps, single + 1), hints: true },
    ),
    lesson('done', ['p1', 'p2'], { type: 'continue' }, { task: false, preset: solved }),
  ]
}

export const classicCourse = (): TutorialCourse => ({
  puzzle: TUTORIAL_PUZZLE,
  lessons: buildLessons(),
  crowns: size,
  conflicts: conflictsOf,
  hint: nextHint,
  texts: 'tutorial',
  play: '/solo',
})
