import { expect, it } from 'vitest'
import { random } from '../../queens/random'
import { cellIndex } from '../../queens3d/geometry'
import { growRegions3d } from '../../queens3d/regions'
import { enumerateSkeletons, generateSkeleton, isValidSkeleton } from '../../queens3d/skeleton'
import { solve3d, uniqueSolution3d } from '../../queens3d/solver'

const key = (skeleton: number[][]) => skeleton.flat().join('')
/** Independent oracle: a skeleton solves a board when every region holds exactly one crown. */
function oracle(regions: number[][][], skeletons: number[][][]): string[] {
  const n = regions.length
  return skeletons
    .filter((L) => {
      const seen = new Set<number>()
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) seen.add(regions[L[r][c]][r][c])
      return seen.size === n * n
    })
    .map(key)
    .sort()
}
/** Every layer cut into its rows, so regions add nothing to the layer-row rule. */
const striped = (n: number) =>
  Array.from({ length: n }, (_, z) =>
    Array.from({ length: n }, (_, r) => Array<number>(n).fill(z * n + r)),
  )

it('finds every skeleton when regions add no constraint', () => {
  expect(solve3d(striped(3), 10)).toMatchObject({ solutionCount: 0, exhausted: false })
  expect(solve3d(striped(4), 10)).toMatchObject({ solutionCount: 0, exhausted: false })
  const all = solve3d(striped(5), 1000)
  expect(all.exhausted).toBe(false)
  expect(all.solutions.map(key).sort()).toEqual(enumerateSkeletons(5).map(key).sort())
})
it('matches the skeleton oracle on 300 random 5×5×5 boards', () => {
  const skeletons = enumerateSkeletons(5)
  let multiple = 0
  for (let seed = 0; seed < 300; seed++) {
    const rng = random(seed)
    const regions = growRegions3d(generateSkeleton(5, rng), rng, 1 + (seed % 3))
    const result = solve3d(regions, 1000)
    expect(result.exhausted).toBe(false)
    expect(result.solutions.every(isValidSkeleton)).toBe(true)
    expect(result.solutions.map(key).sort(), `seed ${seed}`).toEqual(oracle(regions, skeletons))
    if (result.solutionCount > 1) multiple++
  }
  // The comparison is only meaningful if the sample has both unique and ambiguous boards.
  expect(multiple).toBeGreaterThan(10)
  expect(multiple).toBeLessThan(300)
})
it('matches the skeleton oracle on 6×6×6 boards', () => {
  const skeletons = enumerateSkeletons(6)
  expect(skeletons).toHaveLength(146880)
  for (let seed = 0; seed < 5; seed++) {
    const rng = random(seed)
    const regions = growRegions3d(generateSkeleton(6, rng), rng)
    const result = solve3d(regions, 100000)
    expect(result.exhausted).toBe(false)
    expect(result.solutions.map(key).sort(), `seed ${seed}`).toEqual(oracle(regions, skeletons))
  }
}, 120000)
it('stops at the limit, honours allowed cells and reports an exhausted budget', () => {
  const rng = random(7)
  const skeleton = generateSkeleton(5, rng)
  const regions = striped(5)
  expect(solve3d(regions, 2).solutionCount).toBe(2)
  expect(uniqueSolution3d(regions, skeleton)).toBe(false)
  const only = new Set(skeleton.flatMap((row, r) => row.map((z, c) => cellIndex(5, z, r, c))))
  const forced = solve3d(regions, 10, only)
  expect(forced.solutions).toEqual([skeleton])
  expect(solve3d(regions, 10, new Set()).solutionCount).toBe(0)
  expect(solve3d(regions, 1000, undefined, 20)).toMatchObject({ exhausted: true })
  expect(() => solve3d(regions, 0)).toThrow()
  expect(() => solve3d([[[0]], [[1]]])).toThrow()
})
