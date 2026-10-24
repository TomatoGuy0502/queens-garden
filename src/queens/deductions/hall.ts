import type { DeductionStep } from '../types'
import { type LogicState, unitName } from './state'
function combinations(values: number[], count: number): number[][] {
  if (!count) return [[]]
  return values.flatMap((v, i) => combinations(values.slice(i + 1), count - 1).map(tail => [v, ...tail]))
}
/** Pigeonhole/Hall subsets of two or three units across any pair of unit families. */
export function hallSets(state: LogicState): DeductionStep | null {
  const n = state.n
  for (const source of [0, 1, 2]) for (const target of [0, 1, 2]) {
    if (source === target) continue
    const available = Array.from({ length: n }, (_, i) => source * n + i).filter(i => !state.units[i].some(c => state.queens.has(c)))
    for (const size of [2, 3]) for (const selected of combinations(available, size)) {
      const sourceCells = selected.flatMap(i => state.units[i].filter(c => state.candidates.has(c)))
      const targetIds = [...new Set(sourceCells.map(c => target === 0 ? Math.floor(c / n) : target === 1 ? c % n : state.regions[Math.floor(c / n)][c % n]))]
      if (targetIds.length !== size) continue
      const keep = new Set(sourceCells)
      const eliminated = targetIds.flatMap(id => state.units[target * n + id].filter(c => state.candidates.has(c) && !keep.has(c)))
      if (eliminated.length) return { strategy: 'hall', level: 3, action: 'eliminate', cells: eliminated, reason: `${selected.map(i => unitName(i, n)).join('、')} 的 ${size} 頂皇冠被限制在 ${targetIds.map(id => unitName(target * n + id, n)).join('、')}，必須各占一個，因此這些單位中的其他候選格可以排除。` }
    }
  }
  return null
}
