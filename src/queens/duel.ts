import type { CellState } from './types'
/**
 * Rows and columns covered by queens, whichever is fewer; says nothing about being correct. On a
 * stacked board these are the rows and columns of every layer, so a full board counts size².
 */
export function duelProgress(cells: readonly CellState[], size: number): number {
  const rows = new Set<number>(),
    columns = new Set<number>()
  cells.forEach((cell, index) => {
    if (cell !== 'queen') return
    rows.add(Math.floor(index / size))
    columns.add(Math.floor(index / size ** 2) * size + (index % size))
  })
  return Math.min(rows.size, columns.size)
}
