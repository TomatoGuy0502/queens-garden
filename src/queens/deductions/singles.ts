import { message } from '../../../shared/message'
import type { DeductionStep } from '../types'
import { type LogicState, unitRef } from './state'
export function singleCandidate(state: LogicState): DeductionStep | null {
  for (let i = 0; i < state.units.length; i++) {
    const choices = state.units[i].filter((c) => state.candidates.has(c))
    if (choices.length === 1 && !state.queens.has(choices[0])) {
      return {
        strategy: 'single',
        level: 1,
        action: 'place',
        cells: choices,
        units: [i],
        reason: message('reason.single', {
          unit: unitRef(i, state.n),
          row: Math.floor(choices[0] / state.n) + 1,
          col: (choices[0] % state.n) + 1,
        }),
      }
    }
  }
  return null
}
