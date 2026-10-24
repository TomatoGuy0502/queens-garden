import { expect, it } from 'vitest'
import { renderSource } from '../i18n/source'
import { generatePuzzle } from '../queens/generator'
import { HINT_LEVELS, hintView, strategyLabel, unitCells } from '../queens/strategies'
import type { Strategy } from '../queens/types'

const puzzles = [
  generatePuzzle({ size: 8, seed: 42, difficulty: 'medium', maxAttempts: 800 }),
  generatePuzzle({ size: 8, seed: 7, difficulty: 'hard', maxAttempts: 800 }),
  generatePuzzle({ size: 8, seed: 7, difficulty: 'expert', maxAttempts: 800 }),
]
const steps = puzzles.flatMap((puzzle) => puzzle.analysis.steps.map((step) => ({ puzzle, step })))
const regions = puzzles[0].regions

it('lists the rows, columns and regions each strategy reasons about', () => {
  const seen = new Set<Strategy>()
  for (const { puzzle, step } of steps) {
    seen.add(step.strategy)
    const n = puzzle.size
    for (const unit of step.units) {
      expect(unit).toBeGreaterThanOrEqual(0)
      expect(unit).toBeLessThan(3 * n)
    }
    if (step.strategy === 'single' || step.strategy === 'adjacency')
      expect(step.units).toHaveLength(1)
    if (step.strategy === 'intersection') expect(step.units).toHaveLength(2)
    if (step.strategy === 'hall') expect(step.units.length).toBeGreaterThanOrEqual(2)
    if (step.strategy === 'contradiction') expect(step.units).toEqual([])
  }
  // The boards cover the basic strategies and at least one advanced one.
  expect(seen.has('single') && seen.has('adjacency') && seen.has('intersection')).toBe(true)
  expect(seen.has('hall') || seen.has('contradiction')).toBe(true)
})
it('finds the cells of every row, column and region', () => {
  const n = regions.length
  expect(unitCells(1, regions)).toEqual(Array.from({ length: n }, (_, c) => n + c))
  expect(unitCells(n + 2, regions)).toEqual(Array.from({ length: n }, (_, r) => r * n + 2))
  for (let region = 0; region < n; region++) {
    const cells = unitCells(2 * n + region, regions)
    expect(cells.length).toBeGreaterThan(0)
    for (const cell of cells) expect(regions[Math.floor(cell / n)][cell % n]).toBe(region)
  }
})
it('reveals a hint gradually and only shows the answer at the last level', () => {
  for (const { puzzle, step } of steps) {
    const n = puzzle.size
    const first = hintView(step, 1, puzzle.regions)
    const second = hintView(step, 2, puzzle.regions)
    const last = hintView(step, HINT_LEVELS, puzzle.regions)
    expect(last).toEqual({ text: step.reason, cells: step.cells })
    const answer = renderSource(step.reason)
    const label = renderSource(strategyLabel(step.strategy))
    for (const early of [first, second]) {
      expect(early.text).not.toEqual(step.reason)
      expect(renderSource(early.text)).not.toContain(answer)
    }
    expect(renderSource(second.text)).toContain(label)
    expect(renderSource(first.text)).not.toContain(label)
    if (step.units.length) {
      expect(first.text).toEqual({
        key: 'hint.look',
        params: { units: { units: step.units, n } },
      })
      expect(first.cells).toEqual(second.cells)
      expect(new Set(first.cells)).toEqual(
        new Set(step.units.flatMap((unit) => unitCells(unit, puzzle.regions))),
      )
    } else expect(first.cells).toEqual([])
  }
})
it('names rows, columns and regions in the source language', () => {
  const { step, puzzle } = steps.find(({ step }) => step.units.length)!
  const text = renderSource(hintView(step, 1, puzzle.regions).text)
  for (const unit of step.units) {
    const n = puzzle.size
    const expected =
      unit < n
        ? `第 ${unit + 1} 列`
        : unit < 2 * n
          ? `第 ${unit - n + 1} 欄`
          : `區域 ${String.fromCharCode(65 + unit - 2 * n)}`
    expect(text).toContain(expected)
  }
})
it('clamps levels outside the range', () => {
  const { step } = steps[0]
  expect(hintView(step, 0, regions)).toEqual(hintView(step, 1, regions))
  expect(hintView(step, 9, regions)).toEqual(hintView(step, HINT_LEVELS, regions))
})
