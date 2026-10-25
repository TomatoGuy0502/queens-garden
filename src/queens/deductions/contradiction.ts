import { message } from '../../../shared/message'
import type { DeductionStep } from '../types'
import { type LogicState, applyStep, contradiction, place, unitRef } from './state'
import { adjacentExclusion } from './adjacency'
import { singleCandidate } from './singles'
import { lockedCandidates } from './intersections'
/** Depth-one assumption, followed only by basic deductions/intersections, never a solution lookup. */
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
      const step = singleCandidate(trial) ?? adjacentExclusion(trial) ?? lockedCandidates(trial)
      if (!step) break
      applyStep(trial, step)
      evidence.push(step)
    }
    if (contradiction(trial)) {
      const emptyUnit = trial.units.findIndex((unit) => !unit.some((c) => trial.candidates.has(c)))
      const consequence =
        emptyUnit >= 0
          ? message('reason.noCandidates', { unit: unitRef(emptyUnit, state.n) })
          : message('reason.queensConflict')
      return {
        strategy: 'contradiction',
        level: 3,
        action: 'eliminate',
        cells: [cell],
        units: [],
        evidence,
        reason: message('reason.contradiction', {
          row: Math.floor(cell / state.n) + 1,
          col: (cell % state.n) + 1,
          count: evidence.length,
          consequence,
        }),
      }
    }
  }
  return null
}
