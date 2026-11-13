import { buildPeers, buildUnits, cellAt, validShape } from './geometry'

export interface Solve3DResult {
  solutionCount: number
  /** Each solution as a skeleton: L[r][c] = layer of the crown in pillar (r, c). */
  solutions: number[][][]
  nodes: number
  exhausted: boolean
}
/**
 * Exact cover search (Algorithm X): the 4n² units must each get one crown, and touching cells
 * exclude each other. It always branches on the unit with the fewest cells left, and keeps
 * counters instead of dancing links. Reaching `maxNodes` reports `exhausted`, never uniqueness.
 */
export function solve3d(
  regions: number[][][],
  limit = 2,
  allowed?: ReadonlySet<number>,
  maxNodes = 2000000,
): Solve3DResult {
  if (!Number.isInteger(limit) || limit < 1) throw new Error('解答上限必須是正整數。')
  if (!validShape(regions)) throw new Error('不合法的區域矩陣。')
  const n = regions.length,
    units = buildUnits(regions),
    peers = buildPeers(n, units)
  const unitsOf = Array.from({ length: n ** 3 }, (): number[] => [])
  units.forEach((unit, id) => unit.forEach((cell) => unitsOf[cell].push(id)))
  // blocked[cell]: how many placed crowns (or the caller) rule the cell out.
  const blocked = Array.from({ length: n ** 3 }, (_, cell) =>
    allowed?.has(cell) === false ? 1 : 0,
  )
  const open = units.map((unit) => unit.filter((cell) => !blocked[cell]).length)
  const covered = Array<boolean>(units.length).fill(false)
  const placed: number[] = []
  const result: Solve3DResult = { solutionCount: 0, solutions: [], nodes: 0, exhausted: false }
  const done = () => result.solutionCount >= limit || result.exhausted

  function visit(): void {
    if (done()) return
    if (++result.nodes > maxNodes) {
      result.exhausted = true
      return
    }
    let best = -1
    for (let id = 0; id < units.length; id++)
      if (!covered[id] && (best < 0 || open[id] < open[best])) best = id
    if (best < 0) {
      const skeleton = Array.from({ length: n }, () => Array<number>(n).fill(-1))
      for (const cell of placed) {
        const { z, r, c } = cellAt(n, cell)
        skeleton[r][c] = z
      }
      result.solutions.push(skeleton)
      result.solutionCount++
      return
    }
    if (!open[best]) return
    for (const cell of units[best]) {
      if (blocked[cell]) continue
      placed.push(cell)
      for (const id of unitsOf[cell]) covered[id] = true
      for (const peer of peers[cell])
        if (!blocked[peer]++) for (const id of unitsOf[peer]) open[id]--
      visit()
      for (const peer of peers[cell])
        if (!--blocked[peer]) for (const id of unitsOf[peer]) open[id]++
      for (const id of unitsOf[cell]) covered[id] = false
      placed.pop()
      if (done()) return
    }
  }
  visit()
  return result
}
export function uniqueSolution3d(regions: number[][][], target: number[][]): boolean {
  const result = solve3d(regions)
  return (
    !result.exhausted &&
    result.solutionCount === 1 &&
    result.solutions[0].every((row, r) => row.every((z, c) => z === target[r][c]))
  )
}
