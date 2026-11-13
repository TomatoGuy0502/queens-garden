import { message } from '../../../shared/message'
import type { Deduction3DStep } from '../types'
import { type Logic3DState, choices, unit3Ref } from './state'

/** A crown cannot touch every possible location of another required crown in its layer. */
export function adjacentExclusion(state: Logic3DState): Deduction3DStep | null {
  for (let i = 0; i < state.units.length; i++) {
    const cells = choices(state, i)
    if (cells.length < 2 || cells.length > 8) continue
    // An eliminated cell touches every choice, so it lies around the first one.
    const eliminated = state.touch[cells[0]].filter(
      (cell) =>
        state.candidates.has(cell) &&
        !cells.includes(cell) &&
        cells.every((other) => state.touch[cell].includes(other)),
    )
    if (eliminated.length)
      return {
        strategy: 'adjacency',
        level: 1,
        action: 'eliminate',
        cells: eliminated,
        units: [i],
        // The choices of a pillar sit in different layers, so they never share a neighbour.
        crossLayer: false,
        reason: message('reason.adjacency', { unit: unit3Ref(i, state.n) }),
      }
  }
  return null
}
