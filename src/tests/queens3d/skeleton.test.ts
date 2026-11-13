import { expect, it } from 'vitest'
import { random } from '../../queens/random'
import { enumerateSkeletons, generateSkeleton, isValidSkeleton } from '../../queens3d/skeleton'

it('has no skeleton for sizes 3 and 4', () => {
  expect(enumerateSkeletons(3)).toEqual([])
  expect(enumerateSkeletons(4)).toEqual([])
  expect(() => generateSkeleton(3, random(1))).toThrow()
  expect(() => generateSkeleton(4, random(1))).toThrow()
})
it('enumerates exactly 240 distinct valid skeletons for size 5', () => {
  const all = enumerateSkeletons(5)
  expect(all).toHaveLength(240)
  expect(new Set(all.map((L) => L.flat().join(''))).size).toBe(240)
  expect(all.every(isValidSkeleton)).toBe(true)
  expect(all).toContainEqual([
    [0, 1, 2, 3, 4],
    [2, 3, 4, 0, 1],
    [4, 0, 1, 2, 3],
    [1, 2, 3, 4, 0],
    [3, 4, 0, 1, 2],
  ])
})
it('rejects squares that break a rule', () => {
  // A cyclic Latin square repeats every value along the anti-diagonals.
  expect(isValidSkeleton([0, 1, 2, 3, 4].map((r) => [0, 1, 2, 3, 4].map((c) => (r + c) % 5)))).toBe(
    false,
  )
  expect(
    isValidSkeleton([
      [0, 0],
      [1, 1],
    ]),
  ).toBe(false)
  expect(isValidSkeleton([[0, 1], [1]])).toBe(false)
  expect(isValidSkeleton([])).toBe(false)
})
for (const n of [5, 6, 7, 8])
  it(`generates valid, reproducible skeletons for size ${n}`, () => {
    for (let seed = 0; seed < 50; seed++) {
      const skeleton = generateSkeleton(n, random(seed))
      expect(isValidSkeleton(skeleton), `seed ${seed}`).toBe(true)
      expect(generateSkeleton(n, random(seed))).toEqual(skeleton)
    }
  })
it('varies with the seed', () => {
  for (const n of [5, 6]) {
    const seen = new Set(
      Array.from({ length: 30 }, (_, seed) => generateSkeleton(n, random(seed)).flat().join('')),
    )
    expect(seen.size).toBeGreaterThan(10)
  }
})
