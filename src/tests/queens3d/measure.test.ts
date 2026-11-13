import { it } from 'vitest'
import { random } from '../../queens/random'
import { solve } from '../../queens/solver'
import { MIN_REGION_AREA } from '../../queens/validator'
import { evaluateDifficulty3d } from '../../queens3d/difficulty'
import {
  growRegions3d,
  layerRegions,
  mutateRegions3d,
  validRegions3d,
} from '../../queens3d/regions'
import { generateSkeleton } from '../../queens3d/skeleton'
import { solve3d } from '../../queens3d/solver'
import { DIFFICULTIES } from '../../queens/levels'

/**
 * Not a pass/fail test: prints how unique boards rate, to pick thresholds from. Run with
 *   QUEENS3D_MEASURE=1 npx vitest run src/tests/queens3d/measure.test.ts --disableConsoleIntercept
 * QUEENS3D_SEEDS sets how many seeds each size and minimum area gets (default 40).
 */
const seeds = Number(process.env.QUEENS3D_SEEDS ?? 40)
const quantiles = (values: number[]) => {
  const sorted = values.toSorted((a, b) => a - b)
  return [0, 0.25, 0.5, 0.75, 1].map((q) => sorted[Math.round(q * (sorted.length - 1))]).join('/')
}
for (const size of [5, 6])
  for (const requested of DIFFICULTIES.filter((d) => d !== 'expert'))
    it.skipIf(!process.env.QUEENS3D_MEASURE)(
      `${size}×${size}×${size} with ${requested} region areas`,
      () => {
        const minimumArea = MIN_REGION_AREA[requested]
        const start = performance.now()
        const rated: Record<string, { score: number; cross: number; layered: boolean }[]> = {}
        let unique = 0,
          attempts = 0
        for (let seed = 0; seed < seeds; seed++) {
          const rng = random(seed)
          // One attempt per seed, so the numbers are a per-attempt rate rather than a per-game one.
          attempts++
          const solution = generateSkeleton(size, rng)
          let regions = growRegions3d(solution, rng, minimumArea)
          if (!validRegions3d(regions, minimumArea)) continue
          let search = solve3d(regions, 24)
          for (let mutation = 0; mutation < 100 && search.solutionCount !== 1; mutation++) {
            const candidate = mutateRegions3d(regions, solution, rng, minimumArea, search.solutions)
            if (!candidate) continue
            const result = solve3d(candidate, 24)
            if (!result.exhausted && result.solutionCount <= search.solutionCount) {
              regions = candidate
              search = result
            }
          }
          if (search.solutionCount !== 1) continue
          unique++
          const report = evaluateDifficulty3d(regions)
          const level = !report.solved
            ? 'unsolved'
            : `L${Math.max(...report.steps.map((s) => s.level))}`
          ;(rated[level] ??= []).push({
            score: report.score,
            cross: report.steps.filter((step) => step.crossLayer).length,
            // Every layer alone (no pillars) has several solutions, so layers must be combined.
            layered: regions.every((_, z) => solve(layerRegions(regions, z), 2).solutionCount > 1),
          })
        }
        const lines = Object.entries(rated)
          .sort()
          .map(
            ([level, boards]) =>
              `  ${level}: ${boards.length} boards, score ${quantiles(boards.map((b) => b.score))}, ` +
              `cross-layer steps ${quantiles(boards.map((b) => b.cross))}, ` +
              `every layer ambiguous alone ${boards.filter((b) => b.layered).length}`,
          )
        console.info(
          [
            `${size}³ min area ${minimumArea}: ${unique}/${attempts} attempts unique, ` +
              `${Math.round((performance.now() - start) / attempts)}ms per attempt`,
            ...lines,
          ].join('\n'),
        )
      },
      600000,
    )
