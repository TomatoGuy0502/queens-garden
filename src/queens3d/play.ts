import { message } from '../../shared/message'
import { HINT_LEVELS, strategyLabel, strategySummary, type HintView } from '../queens/strategies'
import type { CellState, DeductionStep } from '../queens/types'
import { conflictCells } from '../queens/validator'
import { buildUnits, cellAt, cellIndex } from './geometry'
import { layerRegions } from './regions'
import type { Puzzle3DDefinition } from './types'

/** Crowns that break a rule: the 2D rules inside each layer, plus two crowns in one pillar. */
export function conflictCells3d(regions: number[][][], cells: readonly CellState[]): number[] {
  const n = regions.length,
    bad = new Set<number>()
  const crowns = cells.flatMap((state, cell) => (state === 'queen' ? [cellAt(n, cell)] : []))
  for (let z = 0; z < n; z++) {
    const inLayer = crowns.filter((crown) => crown.z === z).map(({ r, c }) => ({ row: r, col: c }))
    for (const local of conflictCells(layerRegions(regions, z), inLayer)) bad.add(z * n * n + local)
  }
  for (const a of crowns)
    if (crowns.some((b) => b !== a && b.r === a.r && b.c === a.c))
      bad.add(cellIndex(n, a.z, a.r, a.c))
  return [...bad]
}
/** Cells without a crown whose pillar already holds one. Never consults the solution. */
export function pillarGuided(n: number, cells: readonly CellState[]): number[] {
  const taken = new Set(cells.flatMap((state, cell) => (state === 'queen' ? [cell % (n * n)] : [])))
  return cells.flatMap((state, cell) =>
    state !== 'queen' && taken.has(cell % (n * n)) ? [cell] : [],
  )
}
/** An empty board of the right shape, drawn hidden to reserve the space a real one will take. */
export function blankPuzzle3d(size: number): Puzzle3DDefinition {
  return {
    id: 'blank',
    version: '',
    size,
    seed: 0,
    difficulty: 'easy',
    difficultyScore: 0,
    generation: { maxAttempts: 0, mutationBudget: 0, layered: false },
    regions: Array.from({ length: size }, (_, z) =>
      Array.from({ length: size }, () => Array<number>(size).fill(z * size)),
    ),
  }
}
/** Progressive hint: where to look, then which technique, and only then the answer. */
export function hintView3d(step: DeductionStep, level: number, regions: number[][][]): HintView {
  if (level >= HINT_LEVELS) return { text: step.reason, cells: step.cells }
  const units = buildUnits(regions)
  const focus = [...new Set(step.units.flatMap((unit) => units[unit]))]
  if (level <= 1)
    return {
      text: step.units.length
        ? message('hint.look', { units: { units3: step.units, n: regions.length } })
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
