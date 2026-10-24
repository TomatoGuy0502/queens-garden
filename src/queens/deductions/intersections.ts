import type { DeductionStep } from '../types'
import { type LogicState, unitName } from './state'
export function lockedCandidates(state: LogicState): DeductionStep | null {
  for (let a = 0; a < state.units.length; a++) {
    const choices = state.units[a].filter(c => state.candidates.has(c))
    if (choices.length < 2) continue
    for (let b = 0; b < state.units.length; b++) {
      if (a === b || !choices.every(c => state.units[b].includes(c))) continue
      const eliminated = state.units[b].filter(c => state.candidates.has(c) && !choices.includes(c))
      if (eliminated.length) return { strategy: 'intersection', level: 2, action: 'eliminate', cells: eliminated, reason: `${unitName(a, state.n)} 的所有候選格都位於${unitName(b, state.n)}，這頂皇冠會占用兩者，因此可排除${unitName(b, state.n)} 的其他候選格。` }
    }
  }
  return null
}
