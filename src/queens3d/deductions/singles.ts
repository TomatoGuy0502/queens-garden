import { message } from '../../../shared/message'
import type { Deduction3DStep } from '../types'
import { type Logic3DState, cellRef, choices, isPillar, unit3Ref } from './state'

export function singleCandidate(state: Logic3DState): Deduction3DStep | null {
  for (let i = 0; i < state.units.length; i++) {
    const cells = choices(state, i)
    if (cells.length === 1 && !state.queens.has(cells[0]))
      return {
        strategy: 'single',
        level: 1,
        action: 'place',
        cells,
        units: [i],
        crossLayer: isPillar(state, i),
        reason: message('reason3d.single', {
          unit: unit3Ref(i, state.n),
          ...cellRef(state.n, cells[0]),
        }),
      }
  }
  return null
}
