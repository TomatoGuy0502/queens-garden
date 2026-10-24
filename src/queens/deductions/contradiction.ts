import type { DeductionStep } from '../types'
import { type LogicState, applyStep, contradiction, place, unitName } from './state'
import { singleCandidate } from './singles'
import { lockedCandidates } from './intersections'
/** Depth-one assumption, followed only by singles/intersections, never a solution lookup. */
export function contradictionReasoning(state: LogicState): DeductionStep | null {
  const ordered = [...state.candidates].filter((c) => !state.queens.has(c))
  for (const cell of ordered) {
    const trial: LogicState = {
      ...state,
      candidates: new Set(state.candidates),
      queens: new Set(state.queens),
    }
    place(trial, cell)
    const evidence: DeductionStep[] = []
    while (!contradiction(trial) && evidence.length < state.n * state.n * 2) {
      const step = singleCandidate(trial) ?? lockedCandidates(trial)
      if (!step) break
      applyStep(trial, step)
      evidence.push(step)
    }
    if (contradiction(trial)) {
      const emptyUnit = trial.units.findIndex((unit) => !unit.some((c) => trial.candidates.has(c)))
      const consequence =
        emptyUnit >= 0 ? `${unitName(emptyUnit, state.n)}沒有候選格` : '皇冠之間互相衝突'
      return {
        strategy: 'contradiction',
        level: 3,
        action: 'eliminate',
        cells: [cell],
        evidence,
        reason: `假設第 ${Math.floor(cell / state.n) + 1} 列、第 ${(cell % state.n) + 1} 欄有皇冠，經 ${evidence.length} 步單一候選與交集推理後，會造成${consequence}。這個假設矛盾，因此可排除此格。`,
      }
    }
  }
  return null
}
