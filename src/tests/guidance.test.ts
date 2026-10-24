import { expect, it } from 'vitest'
import { DEFAULT_GUIDANCE, guidedCells } from '../queens/guidance'
import type { CellState } from '../queens/types'
const regions = Array.from({ length: 6 }, (_, row) =>
  Array.from({ length: 6 }, (_, col) => Math.floor(row / 2) * 2 + Math.floor(col / 3)),
)
function board() {
  const cells = Array<CellState>(36).fill('empty')
  cells[14] = 'queen'
  return cells
}
const disabledRanges = {
  enabled: true,
  rows: false,
  columns: false,
  regions: false,
  adjacent: false,
}
for (const [key, expected] of [
  ['rows', [12, 13, 15, 16, 17]],
  ['columns', [2, 8, 20, 26, 32]],
  ['regions', [12, 13, 18, 19, 20]],
  ['adjacent', [7, 8, 9, 13, 15, 19, 20, 21]],
] as const)
  it(`selectively guides ${key} and leaves the queen visible`, () => {
    const result = guidedCells(regions, board(), { ...disabledRanges, [key]: true })
    expect([...result.keys()]).toEqual(expected)
    expect(result.has(14)).toBe(false)
  })
it('is off by default and respects disabling all ranges', () => {
  expect(guidedCells(regions, board(), DEFAULT_GUIDANCE).size).toBe(0)
  expect(guidedCells(regions, board(), disabledRanges).size).toBe(0)
})
it('preserves manual marks and allows long diagonals', () => {
  const cells = board()
  cells[7] = 'marked'
  const original = [...cells]
  const result = guidedCells(regions, cells, { ...DEFAULT_GUIDANCE, enabled: true })
  expect(result.has(7)).toBe(true)
  expect(result.has(0)).toBe(false)
  expect(result.has(28)).toBe(false)
  expect(cells).toEqual(original)
})
it('removing a queen keeps exclusions caused by a different queen', () => {
  const cells = board()
  cells[0] = 'queen'
  expect(guidedCells(regions, cells, { ...DEFAULT_GUIDANCE, enabled: true }).get(2)).toContain(
    'column',
  )
  cells[14] = 'empty'
  const result = guidedCells(regions, cells, { ...DEFAULT_GUIDANCE, enabled: true })
  expect(result.get(2)).toEqual(['row', 'region'])
  expect(result.has(26)).toBe(false)
})
it('never dims queens even when they conflict', () => {
  const cells = board()
  cells[15] = 'queen'
  const result = guidedCells(regions, cells, { ...DEFAULT_GUIDANCE, enabled: true })
  expect(result.has(14)).toBe(false)
  expect(result.has(15)).toBe(false)
})
