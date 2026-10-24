import { applyStep, createState } from './deductions/state'
import { evaluateDifficulty, logicalHint } from './difficulty'
import { solve } from './solver'
import { conflictCells } from './validator'
import { GENERATOR_VERSION } from './version'
import type { CellState, DeductionStep, PuzzleDefinition } from './types'

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
  title: string
  body: string[]
  /** What the player must do, shown beside the board; empty for read-only lessons. */
  task: string
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
export function goalMet(goal: TutorialGoal, cells: readonly CellState[]): boolean {
  switch (goal.type) {
    case 'continue':
      return true
    case 'queen-any':
      return cells.includes('queen')
    case 'mark-any':
      return cells.includes('marked')
    case 'no-conflict':
      return !conflictsOf(cells).length
    case 'mark-all':
      return goal.cells.every((cell) => cells[cell] === 'marked')
    case 'queen-at':
      return cells[goal.cell] === 'queen'
    case 'solved':
      return queensOf(cells).length === size && !conflictsOf(cells).length
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
  const { step, message } = logicalHint(REGIONS, cells)
  return { message, cells: step?.cells ?? [], action: step?.action ?? null }
}

export function buildLessons(): TutorialLesson[] {
  const steps = evaluateDifficulty(REGIONS).steps
  const adjacency = steps.findIndex((step) => step.strategy === 'adjacency')
  const intersection = steps.findIndex((step) => step.strategy === 'intersection')
  const single = steps.findIndex((step, i) => step.strategy === 'single' && i > intersection)
  if (adjacency < 0 || intersection < 0 || single < 0)
    throw new Error('教學棋盤缺少需要示範的推理步驟。')
  const solved = empty()
  for (const [row, col] of solve(REGIONS).solutions[0].entries()) solved[row * size + col] = 'queen'
  const conflict = empty()
  conflict[2 * size + 2] = 'queen'
  conflict[3 * size + 3] = 'queen'
  const lesson = (
    id: string,
    title: string,
    body: string[],
    goal: TutorialGoal,
    task: string,
    preset: CellState[] = empty(),
    highlight: number[] = [],
    hints = false,
  ): TutorialLesson => ({ id, title, body, goal, task, preset, highlight, hints })
  const step = (index: number) => steps[index]
  return [
    lesson(
      'rules',
      '認識規則',
      [
        '每一列、每一欄、每個顏色區域，都要放上恰好一頂皇冠。',
        '任兩頂皇冠不能相鄰，上下左右和斜角都不行；較遠的對角線沒關係。',
        '棋盤上有唯一一組正確擺法，只要靠推理就能找到，不需要猜。',
      ],
      { type: 'continue' },
      '',
    ),
    lesson(
      'queen',
      '放下皇冠',
      ['點一下任何一格，就會放上一頂皇冠。'],
      { type: 'queen-any' },
      '在棋盤上放一頂皇冠',
    ),
    lesson(
      'mark',
      '用 X 整理想法',
      [
        'X 代表「這一格一定不是皇冠」，幫你記住已經排除的位置。',
        '再點一次皇冠格會變成 X，第三次清除。桌機也可以按滑鼠右鍵或鍵盤的 X 鍵直接標記。',
      ],
      { type: 'mark-any' },
      '把任何一格標記成 X',
    ),
    lesson(
      'adjacent',
      '皇冠不能相鄰',
      [
        '這兩頂皇冠斜角相鄰，所以格子出現了紅色斜紋，表示衝突。',
        '出現衝突時，可以點皇冠把它變成 X，或使用復原。',
      ],
      { type: 'no-conflict' },
      '消除衝突，讓兩頂皇冠不再相鄰',
      conflict,
    ),
    lesson(
      'adjacency',
      '技巧一：相鄰排除',
      [
        '與其亂猜，不如先找出「一定不能放」的格子。',
        step(adjacency).reason,
        `框選的 ${step(adjacency).cells.length} 格就是這個推理排除的位置。`,
      ],
      { type: 'mark-all', cells: step(adjacency).cells },
      `把框選的 ${step(adjacency).cells.length} 格標記成 X`,
      boardAfter(steps, adjacency),
      step(adjacency).cells,
    ),
    lesson(
      'intersection',
      '技巧二：區域與列的交集',
      ['有時某個區域所有可放的位置，剛好都落在同一列（或同一欄）。', step(intersection).reason],
      { type: 'mark-all', cells: step(intersection).cells },
      `把框選的 ${step(intersection).cells.length} 格標記成 X`,
      boardAfter(steps, intersection),
      step(intersection).cells,
    ),
    lesson(
      'single',
      '技巧三：只剩一格',
      ['當某一列、欄或區域只剩下一個可以放的格子，皇冠就一定在那裡。', step(single).reason],
      { type: 'queen-at', cell: step(single).cells[0] },
      '在框選的格子放上皇冠',
      boardAfter(steps, single),
      step(single).cells,
    ),
    lesson(
      'finish',
      '換你完成',
      [
        '剩下的格子交給你。持續交替使用上面三個技巧：先排除，再找只剩一格的地方。',
        '卡住時可以按「給我提示」，它會告訴你下一步的理由。',
      ],
      { type: 'solved' },
      '放滿 6 頂皇冠，完成這盤',
      boardAfter(steps, single + 1),
      [],
      true,
    ),
    lesson(
      'done',
      '你學會了！',
      [
        '你已經學會規則、X 標記與三個基本推理技巧。',
        '更難的題目還會用到更進階的推理，遇到時使用「給我一點提示」。現在可以開始真正的遊戲。',
      ],
      { type: 'continue' },
      '',
      solved,
    ),
  ]
}
