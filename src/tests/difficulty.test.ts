import { expect, it } from 'vitest'
import { generatePuzzle } from '../queens/generator'
import {
  EXPERT_MIN_SCORE,
  HARD_MIN_SCORE,
  advancedDifficulty,
  evaluateDifficulty,
  logicalHint,
} from '../queens/difficulty'
import { renderSource } from '../i18n/source'
import type { DeductionStep } from '../queens/types'
import { applyStep, createState, contradiction } from '../queens/deductions/state'
import { nextDeduction } from '../queens/difficulty'
import { solve } from '../queens/solver'

it('easy is solvable using level one only; score and steps reproduce', () => {
  const p = generatePuzzle({ size: 6, seed: 42, difficulty: 'easy' })
  const report = evaluateDifficulty(p.regions, 1)
  expect(report.solved).toBe(true)
  expect(report.steps.every((step) => step.level === 1)).toBe(true)
  expect(evaluateDifficulty(p.regions)).toEqual(p.analysis)
})
for (const difficulty of ['medium', 'hard'] as const)
  it(`${difficulty} label requires actual deductions at its level`, () => {
    const p = generatePuzzle({ size: 8, seed: 42, difficulty, maxAttempts: 400 })
    expect(p.analysis.solved).toBe(true)
    expect(p.analysis.steps.some((step) => step.level === (difficulty === 'medium' ? 2 : 3))).toBe(
      true,
    )
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
    if (step.action === 'eliminate')
      expect(step.cells.every((c) => !queenCells.includes(c))).toBe(true)
    else expect(step.cells.every((c) => queenCells.includes(c))).toBe(true)
    applyStep(state, step)
    expect(contradiction(state)).toBe(false)
  }
  expect(state.queens.size).toBe(p.size)
})
it('hints prioritize conflicting queens and over-marked units', () => {
  const p = generatePuzzle({ size: 6, seed: 1 })
  const cells = Array<import('../queens/types').CellState>(36).fill('empty')
  cells[0] = cells[1] = 'queen'
  expect(renderSource(logicalHint(p.regions, cells).message)).toContain('矛盾')
  cells.fill('empty')
  cells.fill('marked', 0, 6)
  expect(renderSource(logicalHint(p.regions, cells).message)).toContain('矛盾')
})

it('Hall sets safely eliminate candidates even on a board with multiple solutions', async () => {
  const { hallSets } = await import('../queens/deductions/hall')
  const regions = Array.from({ length: 6 }, (_, r) => Array<number>(6).fill(r))
  const state = createState(regions)
  // Rows 1 and 3 require columns 1 and 3, so those columns are unavailable to other rows.
  for (const row of [0, 2])
    for (let col = 0; col < 6; col++)
      if (col !== 0 && col !== 2) state.candidates.delete(row * 6 + col)
  const possible = solve(regions, 1000, state.candidates)
  expect(possible.solutionCount).toBeGreaterThan(0)
  const step = hallSets(state)
  expect(step?.strategy).toBe('hall')
  for (const placement of possible.solutions) {
    const queenCells = placement.map((c, r) => r * 6 + c)
    expect(step!.cells.every((c) => !queenCells.includes(c))).toBe(true)
  }
})

it('basic adjacency exclusion preserves every solution and does not exclude its own candidates', async () => {
  const { adjacentExclusion } = await import('../queens/deductions/adjacency')
  const { random, generatePlacement } = await import('../queens/random')
  const { growRegions } = await import('../queens/regionGrower')
  let deductions = 0
  for (let seed = 0; seed < 30; seed++) {
    const rng = random(seed)
    const regions = growRegions(generatePlacement(6, rng), rng)
    const state = createState(regions)
    const step = adjacentExclusion(state)
    if (!step) continue
    deductions++
    expect(step.level).toBe(1)
    const result = solve(regions, 1000)
    expect(result.exhausted).toBe(false)
    for (const solution of result.solutions) {
      const queenCells = solution.map((col, row) => row * 6 + col)
      expect(step.cells.every((cell) => !queenCells.includes(cell))).toBe(true)
    }
  }
  expect(deductions).toBeGreaterThan(0)
})

const step = (strategy: DeductionStep['strategy']): DeductionStep => ({
  strategy,
  level: strategy === 'hall' || strategy === 'contradiction' ? 3 : 1,
  action: 'eliminate',
  cells: [],
  units: [],
  reason: { key: 'reason.single' },
})
const steps = (hall: number, contradiction: number) => [
  ...Array.from({ length: hall }, () => step('hall')),
  ...Array.from({ length: contradiction }, () => step('contradiction')),
  step('single'),
]
it('only rates advanced boards as hard or expert when they are demanding enough', () => {
  const size = 8,
    hard = HARD_MIN_SCORE[size],
    expert = EXPERT_MIN_SCORE[size]
  expect(advancedDifficulty(size, hard, steps(2, 0))).toBe('unrated')
  expect(advancedDifficulty(size, hard - 1, steps(3, 0))).toBe('unrated')
  expect(advancedDifficulty(size, hard, steps(3, 0))).toBe('hard')
  expect(advancedDifficulty(size, expert, steps(3, 1))).toBe('hard')
  expect(advancedDifficulty(size, expert - 1, steps(0, 3))).toBe('hard')
  expect(advancedDifficulty(size, expert, steps(1, 2))).toBe('expert')
  expect(advancedDifficulty(13, 9999, steps(5, 5))).toBe('unrated')
})
for (const difficulty of ['hard', 'expert'] as const)
  it(`generated ${difficulty} boards meet the advanced step and score requirements`, () => {
    const p = generatePuzzle({ size: 8, seed: 7, difficulty, maxAttempts: 800 })
    const contradictions = p.analysis.steps.filter((s) => s.strategy === 'contradiction').length
    expect(p.analysis.steps.filter((s) => s.level === 3).length).toBeGreaterThanOrEqual(3)
    expect(p.difficultyScore).toBeGreaterThanOrEqual(HARD_MIN_SCORE[8])
    if (difficulty === 'expert') {
      expect(contradictions).toBeGreaterThanOrEqual(2)
      expect(p.difficultyScore).toBeGreaterThanOrEqual(EXPERT_MIN_SCORE[8])
    } else expect(p.difficultyScore < EXPERT_MIN_SCORE[8] || contradictions < 2).toBe(true)
  })
