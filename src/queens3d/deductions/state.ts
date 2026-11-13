import type { CellState } from '../../queens/types'
import { buildPeers, buildUnits, cellAt, touching } from '../geometry'
import type { Deduction3DStep } from '../types'

export interface Logic3DState {
  n: number
  units: number[][]
  /** Per cell: its layer row, layer column, pillar and region, in that order. */
  unitsOf: number[][]
  peers: number[][]
  touch: number[][]
  candidates: Set<number>
  queens: Set<number>
}
export function createState3d(regions: number[][][], cells?: readonly CellState[]): Logic3DState {
  const n = regions.length,
    units = buildUnits(regions),
    count = n ** 3
  const unitsOf = Array.from({ length: count }, (): number[] => [])
  units.forEach((unit, id) => unit.forEach((cell) => unitsOf[cell].push(id)))
  const state: Logic3DState = {
    n,
    units,
    unitsOf,
    peers: buildPeers(n, units),
    touch: Array.from({ length: count }, (_, cell) => touching(n, cell)),
    candidates: new Set(
      Array.from({ length: count }, (_, i) => i).filter((i) => cells?.[i] !== 'marked'),
    ),
    queens: new Set(),
  }
  cells?.forEach((cell, i) => {
    if (cell === 'queen') place(state, i)
  })
  return state
}
export function place(state: Logic3DState, cell: number): void {
  state.queens.add(cell)
  for (const peer of state.peers[cell]) state.candidates.delete(peer)
}
/** A unit without candidates, or a crown ruled out by another crown or by an X. */
export function contradiction(state: Logic3DState): boolean {
  return (
    state.units.some((unit) => !unit.some((c) => state.candidates.has(c))) ||
    [...state.queens].some((c) => !state.candidates.has(c))
  )
}
export function applyStep(state: Logic3DState, step: Deduction3DStep): void {
  if (step.action === 'place') step.cells.forEach((c) => place(state, c))
  else step.cells.forEach((c) => state.candidates.delete(c))
}
export const choices = (state: Logic3DState, unit: number) =>
  state.units[unit].filter((c) => state.candidates.has(c))
export const isPillar = (state: Logic3DState, unit: number) =>
  Math.floor(unit / (state.n * state.n)) === 2
/** Units and cells are named in the reader's language when a message is rendered. */
export const unit3Ref = (unit: number, n: number) => ({ unit3: unit, n })
export const units3Ref = (units: number[], n: number) => ({ units3: units, n })
export function cellRef(n: number, cell: number) {
  const { z, r, c } = cellAt(n, cell)
  return { layer: z + 1, row: r + 1, col: c + 1 }
}
