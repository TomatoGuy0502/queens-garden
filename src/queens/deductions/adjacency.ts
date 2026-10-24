import type { DeductionStep } from '../types'
import { type LogicState, unitName } from './state'

/** A queen cannot touch every possible location of another required queen. */
export function adjacentExclusion(state: LogicState): DeductionStep | null {
  const n = state.n
  for (let index = 0; index < state.units.length; index++) {
    const choices = state.units[index].filter((c) => state.candidates.has(c))
    if (choices.length < 2 || choices.length > 8) continue
    const eliminated = [...state.candidates].filter(
      (cell) =>
        !choices.includes(cell) &&
        choices.every(
          (other) =>
            Math.abs(Math.floor(cell / n) - Math.floor(other / n)) <= 1 &&
            Math.abs((cell % n) - (other % n)) <= 1,
        ),
    )
    if (eliminated.length)
      return {
        strategy: 'adjacency',
        level: 1,
        action: 'eliminate',
        cells: eliminated,
        reason: `${unitName(index, n)} 必須有一頂皇冠；框選格與它的每個候選位置都直接相鄰，放皇冠一定會造成接觸，因此可標記 X。`,
      }
  }
  return null
}
