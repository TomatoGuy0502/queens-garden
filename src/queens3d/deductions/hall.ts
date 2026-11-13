import { message } from '../../../shared/message'
import type { Deduction3DStep } from '../types'
import { type Logic3DState, choices, units3Ref } from './state'

/** Largest set tried; pairs are found before triples so the simpler explanation wins. */
const SIZES = [2, 3]
/**
 * Hall sets between two unit families: when `size` units of one family can only put their
 * crowns in `size` units of another, those take one each and lose every other candidate.
 */
export function hallSets(state: Logic3DState): Deduction3DStep | null {
  const n = state.n,
    perFamily = n * n
  const candidates = state.units.map((_, unit) => choices(state, unit))
  // touched[unit][family]: the units of that family holding a candidate of this unit.
  const touched = candidates.map((cells) =>
    [0, 1, 2, 3].map((family) => [...new Set(cells.map((c) => state.unitsOf[c][family]))]),
  )
  for (const size of SIZES)
    for (let source = 0; source < 4; source++)
      for (let target = 0; target < 4; target++) {
        if (source === target) continue
        // A unit that touches more targets than the set has members can never be part of it.
        const available = Array.from(
          { length: perFamily },
          (_, i) => source * perFamily + i,
        ).filter((unit) => candidates[unit].length > 1 && touched[unit][target].length <= size)
        const selected: number[] = []
        const search = (from: number, union: number[]): Deduction3DStep | null => {
          if (selected.length === size) return union.length === size ? explain(union) : null
          for (let k = from; k < available.length; k++) {
            const next = [...new Set([...union, ...touched[available[k]][target]])]
            if (next.length > size) continue
            selected.push(available[k])
            const found = search(k + 1, next)
            selected.pop()
            if (found) return found
          }
          return null
        }
        const explain = (targets: number[]): Deduction3DStep | null => {
          const keep = new Set(selected.flatMap((unit) => candidates[unit]))
          const eliminated = targets.flatMap((unit) => candidates[unit].filter((c) => !keep.has(c)))
          if (!eliminated.length) return null
          return {
            strategy: 'hall',
            level: 3,
            action: 'eliminate',
            cells: eliminated,
            units: [...selected],
            crossLayer: source === 2 || target === 2,
            reason: message('reason.hall', {
              units: units3Ref([...selected], n),
              size,
              targets: units3Ref(
                targets.toSorted((a, b) => a - b),
                n,
              ),
            }),
          }
        }
        const found = search(0, [])
        if (found) return found
      }
  return null
}
