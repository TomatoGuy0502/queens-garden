import { computed, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import type { GameSnapshot } from '../../shared/coop'
import { formatDuration } from '../queens/stats'
import { conflictCells } from '../queens/validator'
export const useCoopGameStore = defineStore('coopGame', () => {
  const state = shallowRef<GameSnapshot | null>(null),
    tick = shallowRef(0)
  let receivedAt = 0
  function accept(snapshot: GameSnapshot) {
    state.value = snapshot
    receivedAt = performance.now()
    tick.value = receivedAt
  }
  function clock() {
    tick.value = performance.now()
  }
  function clear() {
    state.value = null
  }
  const elapsedMs = computed(
    () =>
      (state.value?.elapsedMs ?? 0) +
      (state.value?.phase === 'playing' ? Math.max(0, tick.value - receivedAt) : 0),
  )
  const time = computed(() => formatDuration(Math.floor(elapsedMs.value / 1000)))
  const queens = computed(() =>
    state.value?.puzzle
      ? state.value.cells.flatMap((cell, i) =>
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
  return { state, time, elapsedMs, queens, conflicts, accept, clock, clear }
})
