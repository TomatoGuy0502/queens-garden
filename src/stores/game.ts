import { computed, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import type { GameSnapshot } from '../../shared/coop'
import type { CellState } from '../queens/types'
import { formatDuration } from '../queens/stats'
import { conflictCells } from '../queens/validator'
export const useCoopGameStore = defineStore('coopGame', () => {
  const state = shallowRef<GameSnapshot | null>(null),
    tick = shallowRef(0)
  // A player's own edit shows at once and gives way to the server's answer when it arrives.
  const shadow = shallowRef<Record<number, CellState>>({})
  let receivedAt = 0
  function accept(snapshot: GameSnapshot) {
    if (state.value?.id !== snapshot.id) shadow.value = {}
    state.value = snapshot
    receivedAt = performance.now()
    tick.value = receivedAt
  }
  function clock() {
    tick.value = performance.now()
  }
  function clear() {
    state.value = null
    shadow.value = {}
  }
  function show(index: number, cell: CellState) {
    shadow.value = { ...shadow.value, [index]: cell }
  }
  function settle(index: number) {
    const { [index]: _shown, ...rest } = shadow.value
    shadow.value = rest
  }
  const cells = computed(() => state.value?.cells.map((cell, i) => shadow.value[i] ?? cell) ?? [])
  const elapsedMs = computed(
    () =>
      (state.value?.elapsedMs ?? 0) +
      (state.value?.phase === 'playing' ? Math.max(0, tick.value - receivedAt) : 0),
  )
  const time = computed(() => formatDuration(Math.floor(elapsedMs.value / 1000)))
  const queens = computed(() =>
    state.value?.puzzle
      ? cells.value.flatMap((cell, i) =>
          cell === 'queen'
            ? [
                {
                  row: Math.floor(i / state.value!.puzzle!.size),
                  col: i % state.value!.puzzle!.size,
                },
              ]
            : [],
        )
      : [],
  )
  const conflicts = computed(() =>
    state.value?.puzzle ? conflictCells(state.value.puzzle.regions, queens.value) : [],
  )
  return { state, cells, time, elapsedMs, queens, conflicts, accept, clock, clear, show, settle }
})
