import type { DeductionStep } from '../types'
import { type LogicState, unitName } from './state'
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
        reason: `${unitName(i, state.n)} 排除已占用的列、欄、區域及皇冠相鄰格後，只剩一個候選格。可在第 ${Math.floor(choices[0] / state.n) + 1} 列、第 ${(choices[0] % state.n) + 1} 欄放皇冠。`,
      }
    }
  }
  return null
}
