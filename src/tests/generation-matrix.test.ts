import { expect, it } from 'vitest'
import { generatePuzzle } from '../queens/generator'
import { validRegions } from '../queens/validator'
import { uniqueSolution } from '../queens/solver'

// Exercise the actual UI budget: success must match the selected level; failure must be explicit.
for (const size of [6, 7, 8, 9, 10, 12]) {
  for (const difficulty of ['easy', 'medium', 'hard'] as const) {
    it(`${size}×${size} ${difficulty}: verified matching puzzle or explicit bounded failure`, () => {
      const start = performance.now()
      let outcome = 'budget exhausted'
      try {
        const puzzle = generatePuzzle({ size, seed: 42, difficulty })
        expect(puzzle.difficulty).toBe(difficulty)
        expect(puzzle.analysis.solved).toBe(true)
        expect(validRegions(puzzle.regions)).toBe(true)
        expect(uniqueSolution(puzzle.regions, puzzle.solution)).toBe(true)
        outcome = `success, score ${puzzle.difficultyScore}`
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toMatch(/^已達生成預算/)
      }
      console.info(`${size} ${difficulty}: ${outcome} (${Math.round(performance.now() - start)}ms)`)
    }, 120000)
  }
}
