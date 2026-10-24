import { expect, it } from 'vitest'
import { generatePuzzle } from '../queens/generator'
import { DIFFICULTIES } from '../queens/levels'
import { MIN_REGION_AREA, validRegions } from '../queens/validator'
import { uniqueSolution } from '../queens/solver'

// Exercise the actual UI budget: success must match the selected level; failure must be explicit.
for (const size of [6, 7, 8, 9, 10, 12]) {
  for (const difficulty of DIFFICULTIES) {
    it(`${size}×${size} ${difficulty}: verified matching puzzle or explicit bounded failure`, () => {
      const start = performance.now()
      let outcome = 'budget exhausted'
      try {
        const puzzle = generatePuzzle({ size, seed: 42, difficulty })
        expect(puzzle.difficulty).toBe(difficulty)
        expect(puzzle.analysis.solved).toBe(true)
        expect(validRegions(puzzle.regions, MIN_REGION_AREA[difficulty])).toBe(true)
        expect(uniqueSolution(puzzle.regions, puzzle.solution)).toBe(true)
        outcome = `success, score ${puzzle.difficultyScore}`
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect(error).toMatchObject({ localized: { key: 'errors.GENERATION_BUDGET' } })
      }
      console.info(`${size} ${difficulty}: ${outcome} (${Math.round(performance.now() - start)}ms)`)
    }, 120000)
  }
}
