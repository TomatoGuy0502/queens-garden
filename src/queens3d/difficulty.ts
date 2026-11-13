import { message, type Message } from '../../shared/message'
import { STRATEGY_WEIGHTS } from '../queens/difficulty'
import type { CellState, Difficulty } from '../queens/types'
import type { Deduction3DStep, Difficulty3DReport } from './types'
import { applyStep, contradiction, createState3d, type Logic3DState } from './deductions/state'
import { adjacentExclusion } from './deductions/adjacency'
import { singleCandidate } from './deductions/singles'
import { lockedCandidates } from './deductions/intersections'
import { hallSets } from './deductions/hall'
import { contradictionReasoning } from './deductions/contradiction'

/**
 * Score a Level 3 board must reach to be offered as hard: just above the highest medium score
 * measured for that size (146 and 213 over 300 seeds). Expert has no threshold yet, so no board
 * is rated expert.
 */
export const HARD_MIN_SCORE_3D: Readonly<Record<number, number>> = { 5: 150, 6: 220 }
export const EXPERT_MIN_SCORE_3D: Readonly<Record<number, number>> = {}
const MIN_ADVANCED_STEPS = 3
const MIN_EXPERT_CONTRADICTIONS = 2
export function advancedDifficulty3d(
  size: number,
  score: number,
  steps: Deduction3DStep[],
): Difficulty | 'unrated' {
  const advanced = steps.filter((step) => step.level === 3).length
  const contradictions = steps.filter((step) => step.strategy === 'contradiction').length
  if (advanced < MIN_ADVANCED_STEPS || score < (HARD_MIN_SCORE_3D[size] ?? Infinity))
    return 'unrated'
  return contradictions >= MIN_EXPERT_CONTRADICTIONS &&
    score >= (EXPERT_MIN_SCORE_3D[size] ?? Infinity)
    ? 'expert'
    : 'hard'
}
export function nextDeduction3d(state: Logic3DState, maxLevel = 3): Deduction3DStep | null {
  return (
    singleCandidate(state) ??
    adjacentExclusion(state) ??
    (maxLevel >= 2 ? lockedCandidates(state) : null) ??
    (maxLevel >= 3 ? (hallSets(state) ?? contradictionReasoning(state)) : null)
  )
}
export function evaluateDifficulty3d(regions: number[][][], maxLevel = 3): Difficulty3DReport {
  const state = createState3d(regions),
    crowns = state.n * state.n,
    steps: Deduction3DStep[] = []
  let score = 0,
    level = 1
  for (
    let i = 0;
    i < state.n ** 3 * 2 && state.queens.size < crowns && !contradiction(state);
    i++
  ) {
    const step = nextDeduction3d(state, maxLevel)
    if (!step) break
    applyStep(state, step)
    steps.push(step)
    score += STRATEGY_WEIGHTS[step.strategy] + (step.action === 'eliminate' ? step.cells.length : 0)
    level = Math.max(level, step.level)
  }
  const solved = state.queens.size === crowns && !contradiction(state)
  return {
    difficulty: !solved
      ? 'unrated'
      : level === 1
        ? 'easy'
        : level === 2
          ? 'medium'
          : advancedDifficulty3d(state.n, score, steps),
    score,
    steps,
    solved,
  }
}
export function logicalHint3d(
  regions: number[][][],
  cells: readonly CellState[],
): { step: Deduction3DStep | null; message: Message } {
  const state = createState3d(regions, cells)
  if (contradiction(state)) return { step: null, message: message('hint.contradiction') }
  const step = nextDeduction3d(state)
  return { step, message: step?.reason ?? message('hint.stuck') }
}
