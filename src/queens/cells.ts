import type { CellState } from './types'

/** Click cycles empty → queen → marked → empty; the mark action toggles only the X. */
export function nextCell(current: CellState, action: 'cycle' | 'mark' = 'cycle'): CellState {
  if (action === 'mark') return current === 'marked' ? 'empty' : 'marked'
  return current === 'empty' ? 'queen' : current === 'queen' ? 'marked' : 'empty'
}
