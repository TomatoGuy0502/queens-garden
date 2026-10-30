import { shallowRef, watch } from 'vue'
import { defineStore } from 'pinia'
import { nextCell, type CellAction } from '../queens/cells'
import type { CellState } from '../queens/types'
import { useCoopGameStore } from './game'
import { useRoomStore } from './room'
interface Move {
  index: number
  before: CellState
  after: CellState
}
/**
 * A duelist plays on a board of their own. The board and its undo history live here, in memory;
 * the server only keeps the latest board, to measure progress and recognise a win.
 */
export const useDuelStore = defineStore('duel', () => {
  const room = useRoomStore(),
    game = useCoopGameStore()
  const cells = shallowRef<CellState[]>([]),
    past = shallowRef<Move[]>([]),
    future = shallowRef<Move[]>([])
  let boardOf = ''
  // A board is empty at the start of a round and comes back from the server after a reload.
  watch(
    () => game.state,
    (state) => {
      if (state?.id === boardOf) return
      if (!state?.puzzle) {
        boardOf = ''
        cells.value = []
      } else {
        boardOf = state.id
        cells.value = state.duel?.mine ?? Array<CellState>(state.puzzle.size ** 2).fill('empty')
      }
      past.value = []
      future.value = []
    },
    { immediate: true },
  )
  const publish = () => room.send({ type: 'duelBoard', cells: cells.value })
  // Moves made while offline never reached the server, so send the board again once back.
  watch(
    () => room.connected,
    (connected) => {
      if (connected && cells.value.length && game.state?.phase === 'playing') void publish()
    },
  )
  function put(index: number, state: CellState) {
    const next = [...cells.value]
    next[index] = state
    cells.value = next
    void publish()
  }
  function edit(index: number, action: CellAction = 'cycle') {
    if (game.state?.phase !== 'playing') return
    const before = cells.value[index],
      after = nextCell(before, action)
    past.value = [...past.value, { index, before, after }]
    future.value = []
    put(index, after)
  }
  function undo() {
    const move = past.value.at(-1)
    if (!move || game.state?.phase !== 'playing') return
    past.value = past.value.slice(0, -1)
    future.value = [...future.value, move]
    put(move.index, move.before)
  }
  function redo() {
    const move = future.value.at(-1)
    if (!move || game.state?.phase !== 'playing') return
    future.value = future.value.slice(0, -1)
    past.value = [...past.value, move]
    put(move.index, move.after)
  }
  return { cells, past, future, edit, undo, redo }
})
