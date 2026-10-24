import { connected, neighbors } from './validator'
/** Multi-source frontier growth preserves orthogonal connectivity by construction. */
export function growRegions(solution: number[], rng: () => number): number[][] {
  const n = solution.length, board = Array<number>(n * n).fill(-1), areas = Array<number>(n).fill(1)
  solution.forEach((col, row) => { board[row * n + col] = row })
  const bias = Array.from({ length: n }, () => 0.015 + Math.pow(rng(), 4) * 8)
  let remaining = n * n - n
  while (remaining) {
    const frontier: { cell: number; region: number; weight: number }[] = []
    for (let cell = 0; cell < board.length; cell++) if (board[cell] === -1) {
      const ids = new Set(neighbors(cell, n).map(i => board[i]).filter(id => id >= 0))
      for (const region of ids) frontier.push({ cell, region, weight: bias[region] / Math.pow(areas[region], 0.3) })
    }
    let pick = rng() * frontier.reduce((sum, f) => sum + f.weight, 0)
    const chosen = frontier.find(f => (pick -= f.weight) <= 0) ?? frontier[frontier.length - 1]
    board[chosen.cell] = chosen.region; areas[chosen.region]++; remaining--
  }
  return Array.from({ length: n }, (_, r) => board.slice(r * n, (r + 1) * n))
}
/** Only transfer a boundary cell if it is not an anchor and its donor stays connected. */
export function mutateRegions(regions: number[][], solution: number[], rng: () => number): number[][] | null {
  const n = regions.length, flat = regions.flat()
  const cells = Array.from({ length: n * n }, (_, i) => i).filter(i => solution[Math.floor(i / n)] !== i % n)
  for (let attempt = 0; attempt < n * n; attempt++) {
    const cell = cells[Math.floor(rng() * cells.length)], donor = flat[cell]
    const targets = neighbors(cell, n).filter(i => flat[i] !== donor)
    if (!targets.length) continue
    if (!connected(flat.flatMap((id, i) => id === donor && i !== cell ? [i] : []), n)) continue
    flat[cell] = flat[targets[Math.floor(rng() * targets.length)]]
    return Array.from({ length: n }, (_, r) => flat.slice(r * n, (r + 1) * n))
  }
  return null
}
