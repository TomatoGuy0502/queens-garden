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
/**
 * Level 3 puzzles only count as challenging when they need several advanced steps and score above
 * what a medium board of that size reaches; otherwise they are too easy to label and stay unrated.
 * Expert additionally needs repeated contradiction reasoning and a much higher score.
 */
export const HARD_MIN_SCORE: Readonly<Record<number, number>> = {
  6: 60,
  7: 70,
  8: 90,
  9: 100,
  10: 115,
  11: 135,
  12: 155,
}
export const EXPERT_MIN_SCORE: Readonly<Record<number, number>> = {
  6: 110,
  7: 125,
  8: 140,
  9: 155,
  10: 200,
  11: 225,
  12: 250,
}
const MIN_ADVANCED_STEPS = 3
const MIN_EXPERT_CONTRADICTIONS = 2
export function advancedDifficulty(size: number, score: number, steps: DeductionStep[]) {
  const advanced = steps.filter((step) => step.level === 3).length
  const contradictions = steps.filter((step) => step.strategy === 'contradiction').length
  if (advanced < MIN_ADVANCED_STEPS || score < (HARD_MIN_SCORE[size] ?? Infinity)) return 'unrated'
  return contradictions >= MIN_EXPERT_CONTRADICTIONS &&
    score >= (EXPERT_MIN_SCORE[size] ?? Infinity)
    ? 'expert'
    : 'hard'
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
    difficulty: !solved
      ? 'unrated'
      : level === 1
        ? 'easy'
        : level === 2
          ? 'medium'
          : advancedDifficulty(state.n, score, steps),
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
