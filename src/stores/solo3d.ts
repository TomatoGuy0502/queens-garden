import { defineStore } from 'pinia'
import { useQueensGame, type GameVariant } from '../composables/useQueensGame'
import { conflictCells3d, hintView3d } from '../queens3d/play'
import type { Puzzle3DDefinition } from '../queens3d/types'

const STACKED: GameVariant<Puzzle3DDefinition> = {
  path: '/solo3d',
  worker: () => new Worker(new URL('../queens3d/worker.ts', import.meta.url), { type: 'module' }),
  cellCount: (size) => size ** 3,
  crowns: (size) => size ** 2,
  conflicts: ({ regions }, cells) => conflictCells3d(regions, cells),
  hintView: (step, level, { regions }) => hintView3d(step, level, regions),
}
export const useSolo3dGameStore = defineStore('solo3dGame', () => useQueensGame(STACKED))
