import { shuffle } from '../queens/random'

/**
 * A skeleton is L[r][c] = the layer holding the crown of pillar (r, c): a Latin square in which
 * equal values never touch diagonally. It is the whole solution of a stacked board.
 */
export function isValidSkeleton(L: number[][]): boolean {
  const n = L.length
  if (
    !n ||
    L.some((row) => row.length !== n || row.some((v) => !Number.isInteger(v) || v < 0 || v >= n))
  )
    return false
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      const v = L[r][c]
      for (let i = 0; i < n; i++)
        if ((i !== c && L[r][i] === v) || (i !== r && L[i][c] === v)) return false
      if (r && ((c && L[r - 1][c - 1] === v) || (c < n - 1 && L[r - 1][c + 1] === v))) return false
    }
  return true
}

/**
 * Fills cells in row order; only the upper-left and upper-right cells can already hold a
 * diagonal neighbour. Returns true when the node budget ran out before the search finished.
 */
function search(
  n: number,
  values: () => readonly number[],
  maxNodes: number,
  found: (skeleton: number[][]) => boolean,
): boolean {
  const grid = Array<number>(n * n).fill(-1),
    rows = Array<number>(n).fill(0),
    cols = Array<number>(n).fill(0)
  let nodes = 0,
    exhausted = false
  /** True stops the whole search. */
  function visit(cell: number): boolean {
    if (++nodes > maxNodes) return (exhausted = true)
    if (cell === n * n)
      return found(Array.from({ length: n }, (_, r) => grid.slice(r * n, (r + 1) * n)))
    const r = Math.floor(cell / n),
      c = cell % n
    for (const v of values()) {
      const bit = 1 << v
      if (
        rows[r] & bit ||
        cols[c] & bit ||
        (r && c && grid[cell - n - 1] === v) ||
        (r && c < n - 1 && grid[cell - n + 1] === v)
      )
        continue
      grid[cell] = v
      rows[r] |= bit
      cols[c] |= bit
      if (visit(cell + 1)) return true
      rows[r] ^= bit
      cols[c] ^= bit
    }
    grid[cell] = -1
    return false
  }
  visit(0)
  return exhausted
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i)

/** Every skeleton of size n in a fixed order. Only meant for small n: 5 has 240, 6 has 146,880. */
export function enumerateSkeletons(n: number): number[][][] {
  const all: number[][][] = [],
    values = range(n)
  search(
    n,
    () => values,
    Infinity,
    (skeleton) => {
      all.push(skeleton)
      return false
    },
  )
  return all
}

let five: number[][][] | undefined
/** n = 5 picks one of its 240 skeletons; larger boards use bounded random backtracking. */
export function generateSkeleton(n: number, rng: () => number): number[][] {
  // Sizes 3 and 4 have no skeleton at all.
  if (!Number.isInteger(n) || n < 5 || n > 12) throw new Error('不支援的疊層棋盤大小。')
  if (n === 5) {
    five ??= enumerateSkeletons(5)
    return five[Math.floor(rng() * five.length)].map((row) => [...row])
  }
  const values = range(n)
  let result: number[][] | undefined
  search(
    n,
    () => shuffle(values, rng),
    200000,
    (skeleton) => {
      result = skeleton
      return true
    },
  )
  if (!result) throw new Error('骨架搜尋已達上限。')
  return result
}
