import { unitName } from './deductions/state'
import type { DeductionStep, Strategy } from './types'

export const STRATEGY_INFO: Record<Strategy, { label: string; summary: string }> = {
  single: {
    label: '單一候選',
    summary: '某一列、欄或區域只剩一個可以放皇冠的格子，皇冠一定在那裡。',
  },
  adjacency: {
    label: '相鄰排除',
    summary: '某個單位的每個候選位置都和同一格相鄰，那一格放皇冠一定會碰到，可以標 X。',
  },
  intersection: {
    label: '區域與列／欄的交集',
    summary: '某個單位的候選格全都落在另一個單位裡，另一個單位的其他格就可以排除。',
  },
  hall: {
    label: 'Hall 集合',
    summary: '幾個單位的皇冠被限制在同樣數量的列、欄或區域裡，那些單位內的其他格就可以排除。',
  },
  contradiction: {
    label: '反證',
    summary: '假設某一格放皇冠，用基本推理往下走，如果出現矛盾，這一格就不能放。',
  },
}

export function unitCells(index: number, regions: number[][]): number[] {
  const n = regions.length
  if (index < n) return Array.from({ length: n }, (_, col) => index * n + col)
  if (index < 2 * n) return Array.from({ length: n }, (_, row) => row * n + index - n)
  const region = index - 2 * n
  return regions.flatMap((row, r) => row.flatMap((id, c) => (id === region ? [r * n + c] : [])))
}

export const HINT_LEVELS = 3
export interface HintView {
  text: string
  /** Cells to highlight at this level; the answer cells are only revealed at the last level. */
  cells: number[]
}
/** Progressive hint: where to look, then which technique, and only then the answer. */
export function hintView(step: DeductionStep, level: number, regions: number[][]): HintView {
  if (level >= HINT_LEVELS) return { text: step.reason, cells: step.cells }
  const n = regions.length
  const focus = [...new Set(step.units.flatMap((unit) => unitCells(unit, regions)))]
  if (level <= 1)
    return {
      text: step.units.length
        ? `先看看${step.units.map((unit) => unitName(unit, n)).join('、')}：這裡有一步可以推出來。`
        : '先試著假設某一格放皇冠，看看會不會一路推到矛盾。',
      cells: focus,
    }
  const { label, summary } = STRATEGY_INFO[step.strategy]
  return { text: `這一步可以用「${label}」：${summary}`, cells: focus }
}
