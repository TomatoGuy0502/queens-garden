import { createI18n } from 'vue-i18n'
import { expect, it } from 'vitest'
import { renderMessage } from '../../i18n/message'
import zhHant from '../../i18n/messages/zh-Hant'
import { random } from '../../queens/random'
import { MIN_REGION_AREA } from '../../queens/validator'
import { applyStep, createState3d } from '../../queens3d/deductions/state'
import { logicalHint3d, nextDeduction3d } from '../../queens3d/difficulty'
import { generatePuzzle3d, layersAmbiguous } from '../../queens3d/generator'
import { cellIndex } from '../../queens3d/geometry'
import { growRegions3d, mutateRegions3d, validRegions3d } from '../../queens3d/regions'
import { generateSkeleton, isValidSkeleton } from '../../queens3d/skeleton'
import { solve3d, uniqueSolution3d } from '../../queens3d/solver'
import type { Deduction3DStep } from '../../queens3d/types'

const crowns = (skeleton: number[][]) =>
  new Set(skeleton.flatMap((row, r) => row.map((z, c) => cellIndex(skeleton.length, z, r, c))))
/** A step is safe when it keeps every given solution: placed crowns in all, eliminated cells in none. */
function expectSafe(step: Deduction3DStep, solutions: Set<number>[], label: string) {
  for (const solution of solutions)
    for (const cell of step.cells)
      expect(solution.has(cell), `${label}: ${step.strategy} cell ${cell}`).toBe(
        step.action === 'place',
      )
}

for (const size of [5, 6])
  for (const difficulty of ['easy', 'medium', 'hard'] as const)
    it(`${size}×${size}×${size} ${difficulty}: seed 42 gives a verified, reproducible board`, () => {
      const puzzle = generatePuzzle3d({ size, seed: 42, difficulty })
      expect(puzzle.difficulty).toBe(difficulty)
      expect(puzzle.analysis.solved).toBe(true)
      expect(isValidSkeleton(puzzle.solution)).toBe(true)
      expect(validRegions3d(puzzle.regions, MIN_REGION_AREA[difficulty])).toBe(true)
      expect(uniqueSolution3d(puzzle.regions, puzzle.solution)).toBe(true)
      expect(layersAmbiguous(puzzle.regions)).toBe(true)
      expect(generatePuzzle3d({ size, seed: 42, difficulty })).toEqual(puzzle)
      expect(JSON.parse(JSON.stringify(puzzle))).toEqual(puzzle)
      const solution = [crowns(puzzle.solution)]
      puzzle.analysis.steps.forEach((step, i) => expectSafe(step, solution, `step ${i}`))
    })
it('fails explicitly when the budget runs out or the level has no threshold yet', () => {
  const budget = expect.objectContaining({ localized: { key: 'errors.GENERATION_BUDGET' } })
  expect(() =>
    generatePuzzle3d({ size: 5, seed: 1, difficulty: 'expert', maxAttempts: 3 }),
  ).toThrow(budget)
  // A single attempt rarely passes the layered requirement, and never fails any other way.
  let failures = 0
  for (let seed = 0; seed < 20; seed++)
    try {
      generatePuzzle3d({ size: 5, seed, difficulty: 'easy', maxAttempts: 1 })
    } catch (error) {
      expect(error).toEqual(budget)
      failures++
    }
  expect(failures).toBeGreaterThan(0)
  for (const size of [4, 7, 5.5])
    expect(() => generatePuzzle3d({ size, seed: 1 })).toThrow('生成參數不合法。')
})
it('can turn the layered requirement off, as a different recipe', () => {
  const flat = generatePuzzle3d({ size: 5, seed: 42, difficulty: 'easy', layered: false })
  expect(flat.generation.layered).toBe(false)
  expect(uniqueSolution3d(flat.regions, flat.solution)).toBe(true)
  expect(flat.id).not.toBe(generatePuzzle3d({ size: 5, seed: 42, difficulty: 'easy' }).id)
})
it('keeps regions connected, in their layer and above the minimum area through 250 mutations', () => {
  for (const minimumArea of [2, 3, 4]) {
    const rng = random(minimumArea)
    const skeleton = generateSkeleton(6, rng)
    let regions = growRegions3d(skeleton, rng, minimumArea)
    if (!validRegions3d(regions, minimumArea)) continue
    for (let i = 0; i < 250; i++) {
      regions = mutateRegions3d(regions, skeleton, rng, minimumArea) ?? regions
      expect(validRegions3d(regions, minimumArea)).toBe(true)
      // Crown cells are anchors: the skeleton always stays a solution.
      expect(new Set(skeleton.flatMap((row, r) => row.map((z, c) => regions[z][r][c]))).size).toBe(
        36,
      )
    }
  }
})
it('never loses a solution, even on boards with several', () => {
  let advanced = 0,
    crossLayer = 0
  for (let seed = 0; seed < 60; seed++) {
    const rng = random(seed)
    const size = 5 + (seed % 2)
    const regions = growRegions3d(generateSkeleton(size, rng), rng, 3)
    const solved = solve3d(regions, 500)
    if (solved.exhausted || solved.solutionCount >= 500) continue
    const solutions = solved.solutions.map(crowns)
    const state = createState3d(regions)
    for (let i = 0; i < size ** 3 * 2 && state.queens.size < size * size; i++) {
      const step = nextDeduction3d(state)
      if (!step) break
      expectSafe(step, solutions, `seed ${seed} step ${i}`)
      if (step.level === 3) advanced++
      if (step.crossLayer) crossLayer++
      applyStep(state, step)
    }
  }
  expect(advanced).toBeGreaterThan(20)
  expect(crossLayer).toBeGreaterThan(20)
}, 120000)
it('hints from the cells a player has, and reports a contradiction instead of guessing', () => {
  const puzzle = generatePuzzle3d({ size: 5, seed: 42, difficulty: 'medium' })
  const solution = [crowns(puzzle.solution)]
  const empty = Array<'empty' | 'marked' | 'queen'>(125).fill('empty')
  const first = logicalHint3d(puzzle.regions, empty)
  expect(first.step).toEqual(puzzle.analysis.steps[0])
  // Following the hints from an empty board solves it.
  const cells = [...empty]
  for (let i = 0; i < 400 && cells.filter((cell) => cell === 'queen').length < 25; i++) {
    const { step } = logicalHint3d(puzzle.regions, cells)
    expect(step, `hint ${i}`).not.toBeNull()
    expectSafe(step!, solution, `hint ${i}`)
    for (const cell of step!.cells) cells[cell] = step!.action === 'place' ? 'queen' : 'marked'
  }
  expect(new Set(cells.flatMap((cell, i) => (cell === 'queen' ? [i] : [])))).toEqual(solution[0])
  // Two crowns in one pillar.
  const clash = [...empty]
  clash[cellIndex(5, 0, 2, 2)] = clash[cellIndex(5, 3, 2, 2)] = 'queen'
  expect(logicalHint3d(puzzle.regions, clash)).toMatchObject({
    step: null,
    message: { key: 'hint.contradiction' },
  })
})
it('names layer rows, layer columns, pillars and regions of a stacked board', () => {
  const { t } = createI18n({
    legacy: false,
    locale: 'zh-Hant',
    messages: { 'zh-Hant': zhHant },
  }).global
  const units = { units3: [1 * 5 + 2, 25 + 4 * 5 + 0, 50 + 2 * 5 + 3, 75 + 3 * 5 + 1], n: 5 }
  expect(renderMessage(t, { key: 'hint.look', params: { units } })).toBe(
    '先看看第 2 層第 3 列、第 5 層第 1 欄、柱（3, 4）、第 4 層區域 B：這裡有一步可以推出來。',
  )
  const puzzle = generatePuzzle3d({ size: 5, seed: 42, difficulty: 'medium' })
  for (const step of puzzle.analysis.steps)
    expect(renderMessage(t, step.reason)).not.toMatch(/\{|reason|unit3?\./)
})
