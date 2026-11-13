import { message } from '../../shared/message'
import type { TutorialCourse, TutorialGoal, TutorialLesson } from '../queens/tutorial'
import type { CellState } from '../queens/types'
import { evaluateDifficulty3d, logicalHint3d } from './difficulty'
import { applyStep, createState3d } from './deductions/state'
import { buildUnits, cellIndex } from './geometry'
import { conflictCells3d } from './play'
import type { Deduction3DStep, Puzzle3DDefinition } from './types'
import { GENERATOR_3D_VERSION } from './version'

/** Easy 5×5×5 board (seed 29) whose twelfth step is a pillar with one cell left. */
const REGIONS = [
  [
    [1, 0, 0, 0, 0],
    [1, 1, 1, 1, 4],
    [1, 3, 2, 2, 4],
    [3, 3, 3, 3, 4],
    [3, 3, 3, 3, 4],
  ],
  [
    [5, 5, 5, 5, 6],
    [8, 7, 5, 5, 6],
    [8, 7, 7, 5, 6],
    [8, 8, 8, 9, 6],
    [8, 8, 8, 9, 9],
  ],
  [
    [10, 10, 11, 11, 11],
    [10, 10, 11, 11, 11],
    [10, 12, 11, 11, 13],
    [10, 12, 14, 13, 13],
    [10, 12, 14, 14, 14],
  ],
  [
    [15, 15, 15, 15, 15],
    [15, 16, 15, 18, 17],
    [19, 16, 18, 18, 17],
    [19, 18, 18, 18, 18],
    [19, 19, 18, 18, 18],
  ],
  [
    [22, 22, 21, 21, 20],
    [22, 21, 21, 21, 20],
    [22, 22, 21, 23, 23],
    [22, 24, 21, 23, 23],
    [24, 24, 24, 24, 24],
  ],
]
export const TUTORIAL_3D_PUZZLE: Puzzle3DDefinition = {
  id: 'tutorial3d',
  version: GENERATOR_3D_VERSION,
  size: 5,
  regions: REGIONS,
  seed: 0,
  difficulty: 'easy',
  difficultyScore: 56,
  generation: { maxAttempts: 160, mutationBudget: 100, layered: true },
}

const n = REGIONS.length
/** Crowns left for the player in the closing lesson. */
const LEFT_TO_FINISH = 2 * n
const conflicts = (cells: readonly CellState[]) => conflictCells3d(REGIONS, cells)
/** The board after the first `count` steps, with every ruled-out cell already crossed out. */
function boardAfter(steps: Deduction3DStep[], count: number): CellState[] {
  const state = createState3d(REGIONS)
  for (const step of steps.slice(0, count)) applyStep(state, step)
  return Array.from({ length: n ** 3 }, (_, cell) =>
    state.queens.has(cell) ? 'queen' : state.candidates.has(cell) ? 'empty' : 'marked',
  )
}
const pillarCells = (r: number, c: number) =>
  Array.from({ length: n }, (_, z) => cellIndex(n, z, r, c))

export function buildLessons3d(): TutorialLesson[] {
  const steps = evaluateDifficulty3d(REGIONS).steps
  const single = steps.findIndex((step) => step.crossLayer && step.action === 'place')
  let placed = 0
  const finish = steps.findIndex(
    (step, i) =>
      (placed += step.action === 'place' ? 1 : 0) === n * n - LEFT_TO_FINISH && i > single,
  )
  if (single < 0 || finish < 0) throw new Error('The stacked tutorial board lacks a step to show.')
  const solved = boardAfter(steps, steps.length)
  // A crown in its true place at pillar (0, 0), and a second one stacked on another layer above it.
  const layer =
    solved.findIndex((state, cell) => state === 'queen' && cell % (n * n) === 0) / (n * n)
  const crown = cellIndex(n, layer, 0, 0)
  const pillar = Array<CellState>(n ** 3).fill('empty')
  pillar[crown] = 'queen'
  const stacked = [...pillar]
  stacked[cellIndex(n, (layer + 2) % n, 0, 0)] = 'queen'
  const others = pillarCells(0, 0).filter((cell) => cell !== crown)
  const units = buildUnits(REGIONS)
  const lesson = (
    id: string,
    parts: (string | Deduction3DStep['reason'])[],
    goal: TutorialGoal,
    options: {
      params?: Record<string, number>
      preset?: CellState[]
      highlight?: number[]
      hints?: boolean
    } = {},
  ): TutorialLesson => {
    const text = (part: string) => message(`tutorial3d.lessons.${id}.${part}`, options.params)
    return {
      id,
      title: text('title'),
      body: parts.map((part) => (typeof part === 'string' ? text(part) : part)),
      task: goal.type === 'continue' ? null : text('task'),
      goal,
      preset: options.preset ?? Array<CellState>(n ** 3).fill('empty'),
      highlight: options.highlight ?? [],
      hints: options.hints ?? false,
    }
  }
  const step = steps[single]
  return [
    lesson('rules', ['p1', 'p2', 'p3'], { type: 'continue' }, { params: { count: n * n } }),
    lesson(
      'pillar',
      ['p1', 'p2'],
      { type: 'mark-all', cells: others },
      {
        params: { layer: layer + 1, count: others.length },
        preset: pillar,
        highlight: others,
      },
    ),
    lesson('stack', ['p1', 'p2'], { type: 'no-conflict' }, { preset: stacked }),
    lesson(
      'single',
      ['p1', step.reason],
      { type: 'queen-at', cell: step.cells[0] },
      { preset: boardAfter(steps, single), highlight: units[step.units[0]] },
    ),
    lesson(
      'finish',
      ['p1', 'p2'],
      { type: 'solved' },
      {
        params: { count: n * n, left: LEFT_TO_FINISH },
        preset: boardAfter(steps, finish + 1),
        hints: true,
      },
    ),
    lesson('done', ['p1', 'p2'], { type: 'continue' }, { preset: solved }),
  ]
}
export const stackedCourse = (): TutorialCourse => ({
  puzzle: TUTORIAL_3D_PUZZLE,
  lessons: buildLessons3d(),
  crowns: n * n,
  conflicts,
  hint: (cells) => {
    const { step, message: text } = logicalHint3d(REGIONS, cells)
    return { message: text, cells: step?.cells ?? [], action: step?.action ?? null }
  },
  texts: 'tutorial3d',
  play: '/solo3d',
})
