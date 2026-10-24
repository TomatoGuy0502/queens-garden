import type { SolveResult } from './types'
/** Row ordered search; diagonal constraints only apply to adjacent rows. */
export function solve(
  regions: number[][],
  limit = 2,
  allowed?: ReadonlySet<number>,
  maxNodes = 2000000,
): SolveResult {
  const n = regions.length
  if (!Number.isInteger(limit) || limit < 1) throw new Error('解答上限必須是正整數。')
  if (
    !n ||
    n > 12 ||
    regions.some(
      (row) => row.length !== n || row.some((id) => !Number.isInteger(id) || id < 0 || id >= n),
    )
  )
    throw new Error('不合法的區域矩陣。')
  const result: SolveResult = { solutionCount: 0, solutions: [], nodes: 0, exhausted: false }
  const path: number[] = []
  function visit(row: number, columns: number, colors: number): void {
    if (result.solutionCount >= limit || result.exhausted) return
    if (++result.nodes > maxNodes) {
      result.exhausted = true
      return
    }
    if (row === n) {
      result.solutions.push([...path])
      result.solutionCount++
      return
    }
    for (let col = 0; col < n; col++) {
      const region = regions[row][col]
      if (
        columns & (1 << col) ||
        colors & (1 << region) ||
        (row > 0 && Math.abs(path[row - 1] - col) <= 1) ||
        (allowed && !allowed.has(row * n + col))
      )
        continue
      path.push(col)
      visit(row + 1, columns | (1 << col), colors | (1 << region))
      path.pop()
      if (result.solutionCount >= limit || result.exhausted) break
    }
  }
  visit(0, 0, 0)
  return result
}
export function uniqueSolution(regions: number[][], target: number[]): boolean {
  const result = solve(regions)
  return (
    !result.exhausted &&
    result.solutionCount === 1 &&
    result.solutions[0].every((c, r) => c === target[r])
  )
}
