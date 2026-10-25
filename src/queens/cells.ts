import type { CellState } from './types'

/** How a player edits a cell: cycle it, or jump straight to an X or a queen (and back to empty). */
export type CellAction = 'cycle' | 'mark' | 'queen'
/**
 * A click cycles empty → X → queen → empty: marking cells out is what players do most, so it comes
 * first. A right click toggles a queen and the X key toggles an X, each straight from any state.
 */
export function nextCell(current: CellState, action: CellAction = 'cycle'): CellState {
  if (action === 'mark') return current === 'marked' ? 'empty' : 'marked'
  if (action === 'queen') return current === 'queen' ? 'empty' : 'queen'
  return current === 'empty' ? 'marked' : current === 'marked' ? 'queen' : 'empty'
}
