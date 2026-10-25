import { message } from '../../../shared/message'
import type { DeductionStep } from '../types'
import { type LogicState, unitsRef } from './state'
/**
 * Pigeonhole/Hall subsets across any pair of unit families. A set of k units eliminates the same
 * cells as the complementary set of n - k units read the other way, so sizes stop at n / 2.
 */
export function hallSets(state: LogicState): DeductionStep | null {
  const n = state.n
  const targetOf = (target: number, c: number) =>
    target === 0
      ? Math.floor(c / n)
      : target === 1
        ? c % n
        : state.regions[Math.floor(c / n)][c % n]
  // Candidate cells and the bit set of row/column/region ids they touch, computed once per call.
  const candidateCells = state.units.map((unit) => unit.filter((c) => state.candidates.has(c)))
  const touched = candidateCells.map((cells) =>
    [0, 1, 2].map((target) => cells.reduce((mask, c) => mask | (1 << targetOf(target, c)), 0)),
  )
  const popcount = (mask: number) => {
    let count = 0
    for (; mask; mask &= mask - 1) count++
    return count
  }
  // Pairs and triples come first everywhere, so larger sets never reorder the earlier steps.
  const larger = Array.from({ length: Math.max(0, Math.floor(n / 2) - 3) }, (_, i) => i + 4)
  return pass([2, 3]) ?? pass(larger)

  function pass(sizes: number[]): DeductionStep | null {
    for (const source of [0, 1, 2])
      for (const target of [0, 1, 2]) {
        if (source === target) continue
        const available = Array.from({ length: n }, (_, i) => source * n + i).filter(
          (i) => !state.units[i].some((c) => state.queens.has(c)),
        )
        for (const size of sizes) {
          const selected: number[] = []
          // Lexicographic order, same as the combination order the reasons depend on.
          const search = (from: number, mask: number): DeductionStep | null => {
            if (popcount(mask) > size) return null
            if (selected.length === size) {
              if (popcount(mask) !== size) return null
              return explain(target, size, [...selected])
            }
            for (let k = from; k < available.length; k++) {
              selected.push(available[k])
              const found = search(k + 1, mask | touched[available[k]][target])
              selected.pop()
              if (found) return found
            }
            return null
          }
          const found = search(0, 0)
          if (found) return found
        }
      }
    return null
  }

  function explain(target: number, size: number, selected: number[]): DeductionStep | null {
    const sourceCells = selected.flatMap((i) => candidateCells[i])
    const targetIds = [...new Set(sourceCells.map((c) => targetOf(target, c)))]
    const keep = new Set(sourceCells)
    const eliminated = targetIds.flatMap((id) =>
      candidateCells[target * n + id].filter((c) => !keep.has(c)),
    )
    if (!eliminated.length) return null
    return {
      strategy: 'hall',
      level: 3,
      action: 'eliminate',
      cells: eliminated,
      units: selected,
      reason: message('reason.hall', {
        units: unitsRef(selected, n),
        size,
        targets: unitsRef(
          targetIds.map((id) => target * n + id),
          n,
        ),
      }),
    }
  }
}
