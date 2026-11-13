import { message } from '../../../shared/message'
import type { Deduction3DStep } from '../types'
import { type Logic3DState, applyStep, cellRef, contradiction, place, unit3Ref } from './state'
import { adjacentExclusion } from './adjacency'
import { singleCandidate } from './singles'
import { lockedCandidates } from './intersections'

/** Depth-one assumption, followed only by basic deductions/intersections, never a solution lookup. */
export function contradictionReasoning(state: Logic3DState): Deduction3DStep | null {
  for (const cell of [...state.candidates].filter((c) => !state.queens.has(c))) {
    const trial: Logic3DState = {
      ...state,
      candidates: new Set(state.candidates),
      queens: new Set(state.queens),
    }
    place(trial, cell)
    const evidence: Deduction3DStep[] = []
    while (!contradiction(trial) && evidence.length < state.n ** 3 * 2) {
      const step = singleCandidate(trial) ?? adjacentExclusion(trial) ?? lockedCandidates(trial)
      if (!step) break
      applyStep(trial, step)
      evidence.push(step)
    }
    if (!contradiction(trial)) continue
    const emptyUnit = trial.units.findIndex((unit) => !unit.some((c) => trial.candidates.has(c)))
    return {
      strategy: 'contradiction',
      level: 3,
      action: 'eliminate',
      cells: [cell],
      units: [],
      crossLayer: evidence.some((step) => step.crossLayer),
      evidence,
      reason: message('reason3d.contradiction', {
        ...cellRef(state.n, cell),
        count: evidence.length,
        consequence:
          emptyUnit >= 0
            ? message('reason.noCandidates', { unit: unit3Ref(emptyUnit, state.n) })
            : message('reason.queensConflict'),
      }),
    }
  }
  return null
}
