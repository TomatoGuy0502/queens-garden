import type { CellState } from './types'

export interface BoardGuidance {
  enabled: boolean
  rows: boolean
  columns: boolean
  regions: boolean
  adjacent: boolean
}
export type GuidanceReason = 'row' | 'column' | 'region' | 'adjacent'
export const DEFAULT_GUIDANCE: Readonly<BoardGuidance> = {
  enabled: false,
  rows: true,
  columns: true,
  regions: true,
  adjacent: true,
}

/** Only considers placed queens; never changes marks or consults the solution. */
export function guidedCells(
  regions: number[][],
  cells: readonly CellState[],
  settings: BoardGuidance,
): Map<number, GuidanceReason[]> {
  const result = new Map<number, GuidanceReason[]>()
  if (!settings.enabled) return result
  const n = regions.length
  const queens = cells.flatMap((cell, index) =>
    cell === 'queen' ? [{ row: Math.floor(index / n), col: index % n }] : [],
  )
  for (let index = 0; index < cells.length; index++) {
    if (cells[index] === 'queen') continue
    const row = Math.floor(index / n),
      col = index % n
    const reasons = new Set<GuidanceReason>()
    for (const queen of queens) {
      if (settings.rows && row === queen.row) reasons.add('row')
      if (settings.columns && col === queen.col) reasons.add('column')
      if (settings.regions && regions[row][col] === regions[queen.row][queen.col])
        reasons.add('region')
      if (settings.adjacent && Math.abs(row - queen.row) <= 1 && Math.abs(col - queen.col) <= 1)
        reasons.add('adjacent')
    }
    if (reasons.size) result.set(index, [...reasons])
  }
  return result
}
