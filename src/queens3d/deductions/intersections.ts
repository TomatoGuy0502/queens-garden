import { message } from '../../../shared/message'
import type { Deduction3DStep } from '../types'
import { type Logic3DState, choices, isPillar, unit3Ref } from './state'

/** When every candidate of unit A lies inside unit B, the rest of B is ruled out. */
export function lockedCandidates(state: Logic3DState): Deduction3DStep | null {
  for (let a = 0; a < state.units.length; a++) {
    const cells = choices(state, a)
    if (cells.length < 2) continue
    // Only the four units of the first candidate can contain every candidate.
    for (const b of state.unitsOf[cells[0]]) {
      if (a === b || !cells.every((c) => state.unitsOf[c].includes(b))) continue
      const eliminated = choices(state, b).filter((c) => !cells.includes(c))
      if (eliminated.length)
        return {
          strategy: 'intersection',
          level: 2,
          action: 'eliminate',
          cells: eliminated,
          units: [a, b],
          crossLayer: isPillar(state, a) || isPillar(state, b),
          reason: message('reason.intersection', {
            a: unit3Ref(a, state.n),
            b: unit3Ref(b, state.n),
          }),
        }
    }
  }
  return null
}
