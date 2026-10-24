import { expect, it } from 'vitest'
import { generatePuzzle } from '../queens/generator'
import { evaluateDifficulty, logicalHint } from '../queens/difficulty'
import { applyStep, createState, contradiction } from '../queens/deductions/state'
import { nextDeduction } from '../queens/difficulty'
import { solve } from '../queens/solver'

it('easy is solvable using level one only; score and steps reproduce', () => {
  const p = generatePuzzle({ size: 6, seed: 42, difficulty: 'easy' })
  const report = evaluateDifficulty(p.regions, 1)
  expect(report.solved).toBe(true)
  expect(report.steps.every(step => step.level === 1)).toBe(true)
  expect(evaluateDifficulty(p.regions)).toEqual(p.analysis)
})
for (const difficulty of ['medium', 'hard'] as const) it(`${difficulty} label requires actual deductions at its level`, () => {
  const p = generatePuzzle({ size: 8, seed: 42, difficulty, maxAttempts: 400 })
  expect(p.analysis.solved).toBe(true)
  expect(p.analysis.steps.some(step => step.level === (difficulty === 'medium' ? 2 : 3))).toBe(true)
  expect(evaluateDifficulty(p.regions, difficulty === 'medium' ? 1 : 2).solved).toBe(false)
})
it('never rates a board it cannot finish', () => {
  const board = Array.from({ length: 6 }, (_, r) => Array(6).fill(r) as number[])
  expect(evaluateDifficulty(board, 1).difficulty).toBe('unrated')
})
it('every logged elimination preserves all possible solutions at that step', () => {
  const p = generatePuzzle({ size: 8, seed: 123, difficulty: 'hard', maxAttempts: 400 })
  const state = createState(p.regions)
  for (let i = 0; i < 128; i++) {
    const step = nextDeduction(state)
    if (!step) break
    const before = solve(p.regions, 2, state.candidates)
    expect(before.solutionCount).toBe(1)
    const queenCells = before.solutions[0].map((c, r) => r * p.size + c)
    if (step.action === 'eliminate') expect(step.cells.every(c => !queenCells.includes(c))).toBe(true)
    else expect(step.cells.every(c => queenCells.includes(c))).toBe(true)
    applyStep(state, step)
    expect(contradiction(state)).toBe(false)
  }
  expect(state.queens.size).toBe(p.size)
})
it('hints prioritize conflicting queens and over-marked units', () => {
  const p = generatePuzzle({ size: 6, seed: 1 })
  const cells = Array<import('../queens/types').CellState>(36).fill('empty')
  cells[0] = cells[1] = 'queen'
  expect(logicalHint(p.regions, cells).message).toContain('矛盾')
  cells.fill('empty'); cells.fill('marked', 0, 6)
  expect(logicalHint(p.regions, cells).message).toContain('矛盾')
})
