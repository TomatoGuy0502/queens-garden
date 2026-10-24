import { expect, it } from 'vitest'
import { evaluateDifficulty } from '../queens/difficulty'
import { solve, uniqueSolution } from '../queens/solver'
import {
  TUTORIAL_PUZZLE,
  buildLessons,
  conflictsOf,
  goalMet,
  nextHint,
  type TutorialGoal,
} from '../queens/tutorial'
import { validRegions } from '../queens/validator'
import type { CellState } from '../queens/types'

const lessons = buildLessons()
const find = (id: string) => lessons.find((lesson) => lesson.id === id)!

it('teaches on a valid board with a single logical solution', () => {
  const { regions, size } = TUTORIAL_PUZZLE
  expect(validRegions(regions, 2)).toBe(true)
  const result = solve(regions)
  expect(result.solutionCount).toBe(1)
  expect(uniqueSolution(regions, result.solutions[0])).toBe(true)
  expect(evaluateDifficulty(regions).solved).toBe(true)
  expect(size).toBe(6)
})
it('builds every lesson with a goal that is not yet met, except read-only lessons', () => {
  expect(lessons.map((lesson) => lesson.id)).toEqual([
    'rules',
    'queen',
    'mark',
    'adjacent',
    'adjacency',
    'intersection',
    'single',
    'finish',
    'done',
  ])
  for (const lesson of lessons) {
    expect(lesson.preset).toHaveLength(36)
    expect(lesson.body.length).toBeGreaterThan(0)
    if (lesson.goal.type === 'continue') expect(lesson.task).toBe('')
    else {
      expect(lesson.task).not.toBe('')
      expect(goalMet(lesson.goal, lesson.preset), lesson.id).toBe(false)
    }
  }
})
it('the technique lessons ask for exactly the cells the real deduction produced', () => {
  const steps = evaluateDifficulty(TUTORIAL_PUZZLE.regions).steps
  for (const [id, strategy] of [
    ['adjacency', 'adjacency'],
    ['intersection', 'intersection'],
  ] as const) {
    const lesson = find(id)
    const goal = lesson.goal as Extract<TutorialGoal, { type: 'mark-all' }>
    const step = steps.find((s) => s.strategy === strategy)!
    expect(goal.cells).toEqual(step.cells)
    expect(lesson.highlight).toEqual(step.cells)
    expect(lesson.body.join('')).toContain(step.reason)
  }
  const single = find('single').goal as Extract<TutorialGoal, { type: 'queen-at' }>
  expect(TUTORIAL_PUZZLE.regions.length).toBeGreaterThan(0)
  expect(solve(TUTORIAL_PUZZLE.regions).solutions[0][Math.floor(single.cell / 6)]).toBe(
    single.cell % 6,
  )
})
it('following each goal in order keeps the board consistent with the unique solution', () => {
  const solution = solve(TUTORIAL_PUZZLE.regions).solutions[0]
  for (const id of ['adjacency', 'intersection', 'single']) {
    const lesson = find(id)
    const cells = [...lesson.preset]
    if (lesson.goal.type === 'mark-all') for (const c of lesson.goal.cells) cells[c] = 'marked'
    if (lesson.goal.type === 'queen-at') cells[lesson.goal.cell] = 'queen'
    expect(goalMet(lesson.goal, cells), id).toBe(true)
    // No queen in a preset or goal may contradict the one real solution.
    cells.forEach((state, i) => {
      if (state === 'queen') expect(solution[Math.floor(i / 6)]).toBe(i % 6)
      else if (state === 'marked') expect(solution[Math.floor(i / 6)]).not.toBe(i % 6)
    })
  }
})
it('the finishing lesson can be completed by following the offered hints', () => {
  let cells: CellState[] = [...find('finish').preset]
  for (let i = 0; i < 40 && !goalMet({ type: 'solved' }, cells); i++) {
    const hint = nextHint(cells)
    expect(hint.action, hint.message).not.toBeNull()
    cells = cells.map((value, c) =>
      hint.cells.includes(c) ? (hint.action === 'place' ? 'queen' : 'marked') : value,
    )
  }
  expect(goalMet({ type: 'solved' }, cells)).toBe(true)
})
it('detects conflicts and the final solved board', () => {
  expect(conflictsOf(find('adjacent').preset)).toHaveLength(2)
  expect(goalMet({ type: 'no-conflict' }, find('adjacent').preset)).toBe(false)
  expect(goalMet({ type: 'solved' }, find('done').preset)).toBe(true)
  expect(goalMet({ type: 'queen-any' }, find('queen').preset)).toBe(false)
})
