import { message } from '../../../shared/message'
import type { DeductionStep } from '../types'
import { type LogicState, unitRef } from './state'
export function lockedCandidates(state: LogicState): DeductionStep | null {
  for (let a = 0; a < state.units.length; a++) {
    const choices = state.units[a].filter((c) => state.candidates.has(c))
    if (choices.length < 2) continue
    // Only the row, column and region of the first candidate can contain every candidate (ascending, as before).
    const n = state.n,
      first = choices[0]
    for (const b of [
      Math.floor(first / n),
      n + (first % n),
      2 * n + state.regions[Math.floor(first / n)][first % n],
    ]) {
      if (a === b || !choices.every((c) => state.units[b].includes(c))) continue
      const eliminated = state.units[b].filter(
        (c) => state.candidates.has(c) && !choices.includes(c),
      )
      if (eliminated.length)
        return {
          strategy: 'intersection',
          level: 2,
          action: 'eliminate',
          cells: eliminated,
          units: [a, b],
          reason: message('reason.intersection', {
            a: unitRef(a, state.n),
            b: unitRef(b, state.n),
          }),
        }
    }
  }
  return null
}
