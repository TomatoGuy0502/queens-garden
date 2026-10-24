import { describe, expect, it } from 'vitest'
import { solve, uniqueSolution } from '../queens/solver'
import { validPlacement, validRegions, conflictCells } from '../queens/validator'

describe('independent solver', () => {
  it('finds multiple solutions and stops at two', () => {
    const regions = Array.from({ length: 6 }, (_, r) => Array(6).fill(r) as number[])
    const result = solve(regions)
    expect(result.solutionCount).toBe(2)
    expect(result.solutions.every((p) => validPlacement(regions, p))).toBe(true)
  })
  it('recognizes no solution', () => {
    expect(
      solve([
        [0, 0],
        [1, 1],
      ]).solutionCount,
    ).toBe(0)
  })
  it('allows long diagonals but forbids adjacent diagonals', () => {
    const regions = Array.from({ length: 6 }, (_, r) => Array(6).fill(r) as number[])
    expect(
      conflictCells(regions, [
        { row: 0, col: 0 },
        { row: 2, col: 2 },
      ]),
    ).toEqual([])
    expect(
      conflictCells(regions, [
        { row: 0, col: 0 },
        { row: 1, col: 1 },
      ]),
    ).toHaveLength(2)
  })
  it('does not claim uniqueness when node budget is exhausted', () => {
    expect(
      solve(
        Array.from({ length: 6 }, (_, r) => Array(6).fill(r) as number[]),
        2,
        undefined,
        1,
      ).exhausted,
    ).toBe(true)
  })
  it('rejects malformed regions and invalid placements', () => {
    expect(() => solve([[0], [1]])).toThrow()
    expect(
      validRegions([
        [0, 1],
        [1, 0],
      ]),
    ).toBe(false)
    expect(
      validRegions([
        [0, 0],
        [1, 1],
      ]),
    ).toBe(true)
    expect(
      validPlacement(
        [
          [0, 0],
          [1, 1],
        ],
        [0, 1],
      ),
    ).toBe(false)
    expect(
      uniqueSolution(
        [
          [0, 0],
          [1, 1],
        ],
        [0, 1],
      ),
    ).toBe(false)
  })
})

it('matches an independent permutation oracle on twenty irregular boards', async () => {
  const { random, generatePlacement } = await import('../queens/random')
  const { growRegions } = await import('../queens/regionGrower')
  function permutations(values: number[]): number[][] {
    if (!values.length) return [[]]
    return values.flatMap((v, i) =>
      permutations(values.filter((_, j) => i !== j)).map((tail) => [v, ...tail]),
    )
  }
  const all = permutations([0, 1, 2, 3, 4, 5])
  for (let seed = 0; seed < 20; seed++) {
    const rng = random(seed),
      board = growRegions(generatePlacement(6, rng), rng)
    const expected = all.filter((p) => {
      if (p.some((c, r) => r > 0 && Math.abs(c - p[r - 1]) <= 1)) return false
      return new Set(p.map((c, r) => board[r][c])).size === 6
    })
    const result = solve(board, 1000)
    expect(result.exhausted).toBe(false)
    expect(result.solutionCount).toBe(expected.length)
    expect(result.solutions).toEqual(expected)
  }
})
