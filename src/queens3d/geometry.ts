/** Cells of an n-layer board are numbered (z * n + r) * n + c. */
export const cellIndex = (n: number, z: number, r: number, c: number) => (z * n + r) * n + c
export const cellAt = (n: number, cell: number) => ({
  z: Math.floor(cell / (n * n)),
  r: Math.floor(cell / n) % n,
  c: cell % n,
})

export const UNIT_FAMILIES = ['layerRow', 'layerCol', 'pillar', 'region'] as const
export type UnitFamily = (typeof UNIT_FAMILIES)[number]
/**
 * Every set of cells that holds exactly one crown, n² per family in the order of UNIT_FAMILIES:
 * layer row z * n + r, layer column z * n + c, pillar r * n + c, then the region ids.
 */
export function buildUnits(regions: number[][][]): number[][] {
  const n = regions.length
  const units = Array.from({ length: 4 * n * n }, (): number[] => [])
  for (let z = 0; z < n; z++)
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) {
        const cell = cellIndex(n, z, r, c)
        units[z * n + r].push(cell)
        units[n * n + z * n + c].push(cell)
        units[2 * n * n + r * n + c].push(cell)
        units[3 * n * n + regions[z][r][c]].push(cell)
      }
  return units
}
/** The cells around one in its own layer, diagonals included; layers never touch each other. */
export function touching(n: number, cell: number): number[] {
  const { z, r, c } = cellAt(n, cell),
    result: number[] = []
  for (let row = Math.max(0, r - 1); row <= Math.min(n - 1, r + 1); row++)
    for (let col = Math.max(0, c - 1); col <= Math.min(n - 1, c + 1); col++)
      if (row !== r || col !== c) result.push(cellIndex(n, z, row, col))
  return result
}
/** For each cell, every other cell that cannot also hold a crown. */
export function buildPeers(n: number, units: number[][]): number[][] {
  const peers = Array.from({ length: n ** 3 }, (_, cell) => new Set(touching(n, cell)))
  for (const unit of units) for (const a of unit) for (const b of unit) if (a !== b) peers[a].add(b)
  return peers.map((set) => [...set])
}
/** Shape check shared by everything that takes a region cube from outside. */
export function validShape(regions: number[][][]): boolean {
  const n = regions.length
  return (
    n > 0 &&
    n <= 12 &&
    regions.every(
      (layer) =>
        Array.isArray(layer) &&
        layer.length === n &&
        layer.every(
          (row) =>
            Array.isArray(row) &&
            row.length === n &&
            row.every((id) => Number.isInteger(id) && id >= 0 && id < n * n),
        ),
    )
  )
}
