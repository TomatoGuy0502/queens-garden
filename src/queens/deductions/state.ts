import type { CellState, DeductionStep } from '../types'
import { conflictCells } from '../validator'
export interface LogicState {
  n: number
  regions: number[][]
  units: number[][]
  candidates: Set<number>
  queens: Set<number>
}
export function createState(regions: number[][], cells?: CellState[]): LogicState {
  const n = regions.length
  const units: number[][] = []
  for (let r = 0; r < n; r++) units.push(Array.from({ length: n }, (_, c) => r * n + c))
  for (let c = 0; c < n; c++) units.push(Array.from({ length: n }, (_, r) => r * n + c))
  for (let id = 0; id < n; id++) units.push(regions.flat().flatMap((v, i) => (v === id ? [i] : [])))
  const state: LogicState = {
    n,
    regions,
    units,
    candidates: new Set(
      Array.from({ length: n * n }, (_, i) => i).filter((i) => cells?.[i] !== 'marked'),
    ),
    queens: new Set(),
  }
  cells?.forEach((cell, i) => {
    if (cell === 'queen') place(state, i)
  })
  return state
}
export function peers(state: LogicState, a: number, b: number): boolean {
  const n = state.n,
    ar = Math.floor(a / n),
    ac = a % n,
    br = Math.floor(b / n),
    bc = b % n
  return (
    a !== b &&
    (ar === br ||
      ac === bc ||
      state.regions[ar][ac] === state.regions[br][bc] ||
      (Math.abs(ar - br) <= 1 && Math.abs(ac - bc) <= 1))
  )
}
export function place(state: LogicState, cell: number): void {
  state.queens.add(cell)
  for (const other of state.candidates)
    if (peers(state, cell, other)) state.candidates.delete(other)
}
export function contradiction(state: LogicState): boolean {
  return (
    state.units.some((unit) => !unit.some((c) => state.candidates.has(c))) ||
    [...state.queens].some((c) => !state.candidates.has(c)) ||
    conflictCells(
      state.regions,
      [...state.queens].map((i) => ({ row: Math.floor(i / state.n), col: i % state.n })),
    ).length > 0
  )
}
export function applyStep(state: LogicState, step: DeductionStep): void {
  if (step.action === 'place') step.cells.forEach((c) => place(state, c))
  else step.cells.forEach((c) => state.candidates.delete(c))
}
export function unitName(index: number, n: number): string {
  return index < n
    ? `第 ${index + 1} 列`
    : index < 2 * n
      ? `第 ${index - n + 1} 欄`
      : `區域 ${String.fromCharCode(65 + index - 2 * n)}`
}
