import type { Difficulty, Position } from './types'
export function neighbors(index: number, size: number): number[] {
  const row = Math.floor(index / size),
    col = index % size
  return [
    [row - 1, col],
    [row + 1, col],
    [row, col - 1],
    [row, col + 1],
  ]
    .filter(([r, c]) => r >= 0 && r < size && c >= 0 && c < size)
    .map(([r, c]) => r * size + c)
}
export function connected(cells: number[], size: number): boolean {
  if (!cells.length) return false
  const allowed = new Set(cells),
    seen = new Set([cells[0]]),
    queue = [cells[0]]
  for (const current of queue)
    for (const next of neighbors(current, size)) {
      if (allowed.has(next) && !seen.has(next)) {
        seen.add(next)
        queue.push(next)
      }
    }
  return seen.size === cells.length
}
export const MIN_REGION_AREA: Readonly<Record<Difficulty, number>> = {
  easy: 2,
  medium: 3,
  hard: 4,
  expert: 4,
}

export function validRegions(regions: number[][], minimumArea = 2): boolean {
  const n = regions.length
  if (
    !Number.isInteger(minimumArea) ||
    minimumArea < 1 ||
    n < 1 ||
    n > 12 ||
    regions.some((row) => row.length !== n)
  )
    return false
  const flat = regions.flat()
  if (flat.some((id) => !Number.isInteger(id) || id < 0 || id >= n)) return false
  return Array.from({ length: n }, (_, id) => {
    const cells = flat.flatMap((v, i) => (v === id ? [i] : []))
    return cells.length >= minimumArea && connected(cells, n)
  }).every(Boolean)
}
export function conflictCells(regions: number[][], queens: Position[]): number[] {
  const n = regions.length,
    bad = new Set<number>()
  for (let a = 0; a < queens.length; a++)
    for (let b = a + 1; b < queens.length; b++) {
      const p = queens[a],
        q = queens[b]
      if (
        p.row === q.row ||
        p.col === q.col ||
        regions[p.row][p.col] === regions[q.row][q.col] ||
        (Math.abs(p.row - q.row) <= 1 && Math.abs(p.col - q.col) <= 1)
      ) {
        bad.add(p.row * n + p.col)
        bad.add(q.row * n + q.col)
      }
    }
  return [...bad]
}
export function validPlacement(regions: number[][], placement: number[]): boolean {
  const n = regions.length
  return (
    placement.length === n &&
    placement.every((c) => Number.isInteger(c) && c >= 0 && c < n) &&
    conflictCells(
      regions,
      placement.map((col, row) => ({ row, col })),
    ).length === 0
  )
}
