import { message, type Message } from '../../shared/message'
import { unitsRef } from './deductions/state'
import type { DeductionStep, Strategy } from './types'

/** Where each technique's name and one-line explanation live in the message catalogs. */
export const strategyLabel = (strategy: Strategy) => message(`strategy.${strategy}.label`)
export const strategySummary = (strategy: Strategy) => message(`strategy.${strategy}.summary`)

export function unitCells(index: number, regions: number[][]): number[] {
  const n = regions.length
  if (index < n) return Array.from({ length: n }, (_, col) => index * n + col)
  if (index < 2 * n) return Array.from({ length: n }, (_, row) => row * n + index - n)
  const region = index - 2 * n
  return regions.flatMap((row, r) => row.flatMap((id, c) => (id === region ? [r * n + c] : [])))
}

export const HINT_LEVELS = 3
export interface HintView {
  text: Message
  /** Cells to highlight at this level; the answer cells are only revealed at the last level. */
  cells: number[]
}
/** Progressive hint: where to look, then which technique, and only then the answer. */
export function hintView(step: DeductionStep, level: number, regions: number[][]): HintView {
  if (level >= HINT_LEVELS) return { text: step.reason, cells: step.cells }
  const n = regions.length
  const focus = [...new Set(step.units.flatMap((unit) => unitCells(unit, regions)))]
  if (level <= 1)
    return {
      text: step.units.length
        ? message('hint.look', { units: unitsRef(step.units, n) })
        : message('hint.assume'),
      cells: focus,
    }
  return {
    text: message('hint.technique', {
      label: strategyLabel(step.strategy),
      summary: strategySummary(step.strategy),
    }),
    cells: focus,
  }
}
