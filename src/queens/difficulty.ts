import type { CellState, DeductionStep, DifficultyReport, Strategy } from './types'
import { applyStep, contradiction, createState, type LogicState } from './deductions/state'
import { adjacentExclusion } from './deductions/adjacency'
import { singleCandidate } from './deductions/singles'
import { lockedCandidates } from './deductions/intersections'
import { hallSets } from './deductions/hall'
import { contradictionReasoning } from './deductions/contradiction'
export const STRATEGY_WEIGHTS: Record<Strategy, number> = {
  single: 1,
  adjacency: 1,
  intersection: 4,
  hall: 10,
  contradiction: 16,
}
export function nextDeduction(state: LogicState, maxLevel = 3): DeductionStep | null {
  return (
    singleCandidate(state) ??
    adjacentExclusion(state) ??
    (maxLevel >= 2 ? lockedCandidates(state) : null) ??
    (maxLevel >= 3 ? (hallSets(state) ?? contradictionReasoning(state)) : null)
  )
}
export function evaluateDifficulty(regions: number[][], maxLevel = 3): DifficultyReport {
  const state = createState(regions),
    steps: DeductionStep[] = []
  let score = 0,
    level = 1
  for (
    let i = 0;
    i < state.n * state.n * 2 && state.queens.size < state.n && !contradiction(state);
    i++
  ) {
    const step = nextDeduction(state, maxLevel)
    if (!step) break
    applyStep(state, step)
    steps.push(step)
    score += STRATEGY_WEIGHTS[step.strategy] + (step.action === 'eliminate' ? step.cells.length : 0)
    level = Math.max(level, step.level)
  }
  const solved = state.queens.size === state.n && !contradiction(state)
  return {
    difficulty: !solved ? 'unrated' : level === 1 ? 'easy' : level === 2 ? 'medium' : 'hard',
    score,
    steps,
    solved,
  }
}
export function logicalHint(
  regions: number[][],
  cells: CellState[],
): { step: DeductionStep | null; message: string } {
  const state = createState(regions, cells)
  if (contradiction(state))
    return {
      step: null,
      message: '目前有矛盾：皇冠互相衝突，或某列、欄、區域已沒有可用格。請先撤回皇冠或 X 標記。',
    }
  const step = nextDeduction(state)
  return {
    step,
    message: step?.reason ?? '目前的邏輯策略找不到可安全解釋的下一步，請嘗試調整標記或繼續推理。',
  }
}
