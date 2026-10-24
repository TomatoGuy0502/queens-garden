import { describe, expect, it } from 'vitest'
import { generatePuzzle } from '../queens/generator'
import { solve, uniqueSolution } from '../queens/solver'
import { validPlacement, validRegions } from '../queens/validator'

describe('bounded seeded generation', () => {
  for (const size of [6, 7, 8, 9, 10, 12]) it(`generates valid unique connected ${size}×${size} puzzles across seeds`, () => {
    for (const seed of [1, 42, 2026]) {
      const puzzle = generatePuzzle({ size, seed })
      expect(validRegions(puzzle.regions)).toBe(true)
      expect(validPlacement(puzzle.regions, puzzle.solution)).toBe(true)
      expect(uniqueSolution(puzzle.regions, puzzle.solution)).toBe(true)
      expect(solve(puzzle.regions).solutionCount).toBe(1)
    }
  })
  it('reproduces identical serialized puzzles', () => {
    expect(generatePuzzle({ size: 8, seed: 734 })).toEqual(generatePuzzle({ size: 8, seed: 734 }))
  })
  it('fails explicitly under a tiny budget, never returns an unchecked board', () => {
    expect(() => generatePuzzle({ size: 12, seed: 1, maxAttempts: 1, mutationBudget: 0 })).toThrow(/預算/)
    expect(() => generatePuzzle({ size: 99, seed: 1 })).toThrow()
  })
})
