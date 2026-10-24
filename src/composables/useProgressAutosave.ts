import { onBeforeUnmount, onMounted, watch } from 'vue'
import { hasProgress, sameGame, encodeCells, type SavedProgress } from '../queens/progress'
import type { CellState, PuzzleDefinition } from '../queens/types'
import { useSoloProgress } from './useSoloProgress'

interface AutosaveSource {
  puzzle: PuzzleDefinition | null
  cells: CellState[]
  history: CellState[][]
  future: CellState[][]
  hints: number
  attempt: number
  won: boolean
  paused: boolean
  exportProgress: () => SavedProgress | null
}
const SAVE_DELAY_MS = 300
const TICK_MS = 5000

/** Keeps the unfinished solo game in storage so it survives a reload or a closed tab. */
export function useProgressAutosave(game: AutosaveSource) {
  const { read, write, clear } = useSoloProgress()
  function flush() {
    const progress = game.exportProgress()
    if (!progress) return
    const stored = read()
    const same = stored !== null && sameGame(stored, progress)
    if (game.won) {
      if (same) clear()
    } else if (hasProgress(progress)) write(progress)
    // A restart leaves nothing worth resuming, so the older save of this puzzle goes away.
    else if (same) clear()
  }
  let timer: ReturnType<typeof setTimeout> | undefined
  const schedule = () => {
    clearTimeout(timer)
    timer = setTimeout(flush, SAVE_DELAY_MS)
  }
  watch(
    () => [
      game.puzzle?.id,
      game.attempt,
      encodeCells(game.cells),
      game.history.length,
      game.future.length,
      game.hints,
    ],
    schedule,
  )
  let interval: ReturnType<typeof setInterval> | undefined
  const onHide = () => document.hidden && flush()
  onMounted(() => {
    // The clock keeps running between moves, so refresh the saved time while playing.
    interval = setInterval(() => !game.paused && !game.won && flush(), TICK_MS)
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', flush)
  })
  onBeforeUnmount(() => {
    clearTimeout(timer)
    clearInterval(interval)
    document.removeEventListener('visibilitychange', onHide)
    window.removeEventListener('pagehide', flush)
    flush()
  })
}
