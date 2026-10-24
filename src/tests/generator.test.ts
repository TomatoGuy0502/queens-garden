import { describe, expect, it } from 'vitest'
import { generatePuzzle } from '../queens/generator'
import { solve, uniqueSolution } from '../queens/solver'
import { MIN_REGION_AREA, validPlacement, validRegions } from '../queens/validator'

describe('bounded seeded generation', () => {
  for (const size of [6, 7, 8, 9, 10, 12])
    it(`generates valid unique connected ${size}×${size} puzzles across seeds`, () => {
      for (const seed of [1, 42, 2026]) {
        const puzzle = generatePuzzle({ size, seed })
        expect(validRegions(puzzle.regions, MIN_REGION_AREA[puzzle.difficulty])).toBe(true)
        expect(validPlacement(puzzle.regions, puzzle.solution)).toBe(true)
        expect(uniqueSolution(puzzle.regions, puzzle.solution)).toBe(true)
        expect(solve(puzzle.regions).solutionCount).toBe(1)
      }
    })
  it('reproduces identical serialized puzzles', () => {
    expect(generatePuzzle({ size: 8, seed: 734 })).toEqual(generatePuzzle({ size: 8, seed: 734 }))
  })
  it('serializes its complete replay recipe, including custom work budgets', () => {
    const puzzle = generatePuzzle({
      size: 6,
      seed: 42,
      difficulty: 'medium',
      maxAttempts: 200,
      mutationBudget: 40,
    })
    const restored = JSON.parse(JSON.stringify(puzzle)) as typeof puzzle
    expect(
      generatePuzzle({
        size: restored.size,
        seed: restored.seed,
        difficulty: restored.generation.requestedDifficulty,
        maxAttempts: restored.generation.maxAttempts,
        mutationBudget: restored.generation.mutationBudget,
      }),
    ).toEqual(puzzle)
  })
  it('fails explicitly under a tiny budget, never returns an unchecked board', () => {
    expect(() => generatePuzzle({ size: 12, seed: 1, maxAttempts: 1, mutationBudget: 0 })).toThrow(
      /預算/,
    )
    expect(() => generatePuzzle({ size: 99, seed: 1 })).toThrow()
  })
})

for (const difficulty of ['easy', 'medium', 'hard'] as const) {
  it(`${difficulty} satisfies the area rule across seeds without changing its logical label`, () => {
    for (const seed of [1, 42, 2026]) {
      const puzzle = generatePuzzle({ size: 8, seed, difficulty })
      expect(puzzle.difficulty).toBe(difficulty)
      expect(validRegions(puzzle.regions, MIN_REGION_AREA[difficulty])).toBe(true)
      expect(uniqueSolution(puzzle.regions, puzzle.solution)).toBe(true)
      expect(puzzle.analysis.difficulty).toBe(difficulty)
    }
  })
}
