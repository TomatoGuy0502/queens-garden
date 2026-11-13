import { computed, onUnmounted, shallowRef } from 'vue'
import { useEventListener, useIntervalFn } from '@vueuse/core'
import { useRouter } from 'vue-router'
import { LocalizedError, failureMessage, message as say, type Message } from '../../shared/message'
import type { CellState, DeductionStep, Difficulty, PuzzleDefinition } from '../queens/types'
import type { WorkerRequest, WorkerResponse } from '../queens/protocol'
import { nextCell, type CellAction } from '../queens/cells'
import {
  MAX_SAVED_HISTORY,
  encodeCells,
  type RestoredProgress,
  type SavedProgress,
} from '../queens/progress'
import { HINT_LEVELS, hintView, type HintView } from '../queens/strategies'
import { formatDuration } from '../queens/stats'
import { conflictCells } from '../queens/validator'
import type { RunEvent } from '../queens/replay'

type BasePuzzle = Pick<PuzzleDefinition, 'id' | 'version' | 'size' | 'seed' | 'difficulty'>
/** What differs between kinds of board; the rest of a solo game is the same. */
export interface GameVariant<P> {
  /** Route the board lives on; its query reproduces the puzzle. */
  path: string
  worker: () => Worker
  cellCount: (size: number) => number
  crowns: (size: number) => number
  conflicts: (puzzle: P, cells: CellState[]) => number[]
  hintView: (step: DeductionStep, level: number, puzzle: P) => HintView
}
const FLAT: GameVariant<PuzzleDefinition> = {
  path: '/solo',
  worker: () => new Worker(new URL('../queens/worker.ts', import.meta.url), { type: 'module' }),
  cellCount: (size) => size ** 2,
  crowns: (size) => size,
  conflicts: ({ regions, size }, cells) =>
    conflictCells(
      regions,
      cells.flatMap((state, i) =>
        state === 'queen' ? [{ row: Math.floor(i / size), col: i % size }] : [],
      ),
    ),
  hintView: (step, level, { regions }) => hintView(step, level, regions),
}

export function useQueensGame<P extends BasePuzzle = PuzzleDefinition>(
  variant = FLAT as unknown as GameVariant<P>,
) {
  const router = useRouter()
  const puzzle = shallowRef<P | null>(null)
  const cells = shallowRef<CellState[]>([])
  const history = shallowRef<CellState[][]>([]),
    future = shallowRef<CellState[][]>([])
  const busy = shallowRef(false),
    assisting = shallowRef(false),
    paused = shallowRef(false)
  const seconds = shallowRef(0),
    moves = shallowRef(0),
    hints = shallowRef(0),
    // Bumps on every fresh start of the same puzzle, so one attempt is only ever scored once.
    attempt = shallowRef(0)
  /** Date key when the puzzle on the board is that day's challenge. */
  const daily = shallowRef<string | null>(null)
  // A ranked daily runs on the server's clock (no pausing) and logs every action for it to replay.
  const ranked = shallowRef(false)
  let runStart = 0,
    runLog: RunEvent[] = []
  const track = (event: RunEvent) => {
    if (ranked.value) runLog.push(event)
  }
  const now = () => Date.now() - runStart
  const message = shallowRef<Message | null>(null),
    error = shallowRef<Message | null>(null)
  const hint = shallowRef<DeductionStep | null>(null),
    // 0 = no hint; 1 = where to look; 2 = which technique; 3 = the full answer.
    hintLevel = shallowRef(0),
    mistakes = shallowRef<number[]>([])
  let worker: Worker | null = null,
    requestId = 0,
    revision = 0,
    generationId = 0
  let lastTick = performance.now(),
    elapsedMs = 0
  const requests = new Map<
    number,
    { resolve: (response: WorkerResponse) => void; reject: (reason: Error) => void }
  >()
  /** Cells holding a crown. */
  const queens = computed(() => cells.value.flatMap((state, i) => (state === 'queen' ? [i] : [])))
  const conflicts = computed(() =>
    puzzle.value ? variant.conflicts(puzzle.value, cells.value) : [],
  )
  const won = computed(
    () =>
      !!puzzle.value &&
      queens.value.length === variant.crowns(puzzle.value.size) &&
      !conflicts.value.length,
  )
  const time = computed(() => formatDuration(seconds.value))
  const blocked = computed(() => busy.value || paused.value || won.value)
  const hintInfo = computed(() =>
    hint.value && puzzle.value && hintLevel.value
      ? variant.hintView(hint.value, hintLevel.value, puzzle.value)
      : null,
  )
  const feedback = computed(() => hintInfo.value?.text ?? message.value)
  const hintCells = computed(() => hintInfo.value?.cells ?? [])
  const hintRevealed = computed(() => !!hint.value && hintLevel.value >= HINT_LEVELS)

  function stopWorker(reason: Message = say('game.errors.aborted')) {
    worker?.terminate()
    worker = null
    for (const pending of requests.values()) pending.reject(new LocalizedError(reason))
    requests.clear()
  }
  function rpc(
    payload:
      | Omit<Extract<WorkerRequest, { type: 'generate' }>, 'id'>
      | Omit<Extract<WorkerRequest, { type: 'hint' | 'check' }>, 'id'>,
  ): Promise<WorkerResponse> {
    if (!worker) {
      worker = variant.worker()
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const pending = requests.get(event.data.id)
        if (!pending) return
        requests.delete(event.data.id)
        if (event.data.error) pending.reject(new LocalizedError(event.data.error))
        else pending.resolve(event.data)
      }
      worker.onerror = () => {
        stopWorker(say('game.errors.workerStart'))
        error.value = say('game.errors.workerFailed')
        busy.value = false
        assisting.value = false
      }
    }
    const id = ++requestId
    return new Promise((resolve, reject) => {
      requests.set(id, { resolve, reject })
      worker!.postMessage({ ...payload, id })
    })
  }
  function clearFeedback() {
    revision++
    hint.value = null
    hintLevel.value = 0
    mistakes.value = []
    message.value = null
  }
  function resetSession() {
    cells.value = Array<CellState>(variant.cellCount(puzzle.value!.size)).fill('empty')
    history.value = []
    future.value = []
    moves.value = 0
    hints.value = 0
    seconds.value = 0
    elapsedMs = 0
    lastTick = performance.now()
    paused.value = false
    ranked.value = false
    runLog = []
    attempt.value++
    clearFeedback()
  }
  /** Turns the board into a ranked run that started `elapsedMs` ago on the server. */
  function startRanked(elapsedMs: number, log: RunEvent[] = []) {
    ranked.value = true
    runStart = Date.now() - elapsedMs
    runLog = [...log]
    paused.value = false
  }
  function applyProgress(saved: RestoredProgress) {
    cells.value = saved.cells
    history.value = saved.history
    future.value = saved.future
    moves.value = saved.moves
    hints.value = saved.hints
    elapsedMs = saved.elapsedMs
    seconds.value = Math.floor(elapsedMs / 1000)
    lastTick = performance.now()
  }
  /** Everything needed to continue this game later, or null while there is no board. */
  function exportProgress(): SavedProgress | null {
    const current = puzzle.value
    if (!current || busy.value) return null
    return {
      version: current.version,
      size: current.size,
      difficulty: current.difficulty,
      seed: current.seed,
      daily: daily.value,
      cells: encodeCells(cells.value),
      history: history.value.slice(-MAX_SAVED_HISTORY).map(encodeCells),
      future: future.value.slice(-MAX_SAVED_HISTORY).map(encodeCells),
      elapsedMs: Math.floor(elapsedMs),
      moves: moves.value,
      hints: hints.value,
      ...(ranked.value && { log: [...runLog] }),
      savedAt: Date.now(),
    }
  }
  /** `stale` means a newer request or a cancel took over, so callers must not retry. */
  async function newGame(
    size: number,
    difficulty: Difficulty,
    seed: number,
    dailyDate: string | null = null,
    restore?: RestoredProgress,
  ): Promise<'ready' | 'failed' | 'stale'> {
    stopWorker()
    busy.value = true
    assisting.value = false
    paused.value = false
    error.value = null
    clearFeedback()
    const generation = ++generationId
    cells.value = []
    puzzle.value = null
    daily.value = null
    try {
      const result = await rpc({ type: 'generate', options: { size, difficulty, seed } })
      if (generation !== generationId) return 'stale'
      // Each variant's worker answers with its own kind of puzzle.
      const generated: unknown = result.puzzle
      puzzle.value = generated as P
      daily.value = dailyDate
      resetSession()
      if (restore) applyProgress(restore)
      const params = new URLSearchParams({
        size: String(size),
        difficulty,
        seed: String(seed),
        v: puzzle.value.version,
      })
      if (dailyDate) params.set('daily', dailyDate)
      await router.replace({ path: variant.path, query: Object.fromEntries(params) })
      return 'ready'
    } catch (reason) {
      if (generation !== generationId) return 'stale'
      error.value = failureMessage(reason, 'COMPUTE_ERROR')
      return 'failed'
    } finally {
      if (generation === generationId) busy.value = false
    }
  }
  function cancelGeneration() {
    generationId++
    stopWorker()
    busy.value = false
    error.value = say('game.errors.cancelled')
  }
  function edit(index: number, action: CellAction = 'cycle') {
    if (blocked.value || !puzzle.value || index < 0 || index >= cells.value.length) return
    history.value = [...history.value, [...cells.value]].slice(-1000)
    future.value = []
    const next = nextCell(cells.value[index], action)
    cells.value = cells.value.map((cell, i) => (i === index ? next : cell))
    moves.value++
    track([now(), 'edit', index, action])
    clearFeedback()
    if (won.value) message.value = say('game.won')
  }
  function undo() {
    if (busy.value || paused.value || !history.value.length) return
    future.value = [...future.value, [...cells.value]]
    cells.value = history.value.at(-1)!
    history.value = history.value.slice(0, -1)
    track([now(), 'undo'])
    clearFeedback()
    lastTick = performance.now()
  }
  function redo() {
    if (busy.value || paused.value || !future.value.length) return
    history.value = [...history.value, [...cells.value]]
    cells.value = future.value.at(-1)!
    future.value = future.value.slice(0, -1)
    track([now(), 'redo'])
    clearFeedback()
  }
  async function assist(type: 'hint' | 'check') {
    if (blocked.value || assisting.value || !puzzle.value) return
    // Asking again on an unchanged board only reveals more of the same hint.
    if (type === 'hint' && hint.value) {
      if (hintLevel.value < HINT_LEVELS) {
        hintLevel.value++
        hints.value++
        track([now(), 'hint'])
      }
      return
    }
    assisting.value = true
    const atRevision = revision
    try {
      const response = await rpc({ type, cells: [...cells.value] })
      if (atRevision !== revision) return
      message.value = response.message ?? null
      hint.value = response.step ?? null
      mistakes.value = response.mistakes ?? []
      if (type === 'hint') {
        hints.value++
        track([now(), 'hint'])
        hintLevel.value = response.step ? 1 : 0
      }
    } catch (reason) {
      if (atRevision === revision) message.value = failureMessage(reason, 'COMPUTE_ERROR')
    } finally {
      assisting.value = false
    }
  }
  function applyHint() {
    if (!hint.value || blocked.value) return
    history.value = [...history.value, [...cells.value]].slice(-1000)
    future.value = []
    const step = hint.value
    cells.value = cells.value.map((cell, i) =>
      step.cells.includes(i) ? (step.action === 'place' ? 'queen' : 'marked') : cell,
    )
    moves.value++
    track([now(), 'apply', step.action, step.cells])
    clearFeedback()
  }
  function togglePause() {
    if (busy.value || won.value || ranked.value) return
    paused.value = !paused.value
    lastTick = performance.now()
  }
  function onVisibility() {
    if (document.hidden && puzzle.value && !won.value && !ranked.value) paused.value = true
  }
  useIntervalFn(() => {
    const now = performance.now()
    if (puzzle.value && !blocked.value) {
      elapsedMs = ranked.value ? Date.now() - runStart : elapsedMs + now - lastTick
      seconds.value = Math.floor(elapsedMs / 1000)
    }
    lastTick = now
  }, 200)
  useEventListener(document, 'visibilitychange', onVisibility)
  onUnmounted(stopWorker)
  return {
    puzzle,
    cells,
    busy,
    assisting,
    paused,
    seconds,
    time,
    queens,
    conflicts,
    won,
    history,
    future,
    moves,
    hints,
    attempt,
    daily,
    ranked,
    message,
    error,
    hint,
    hintLevel,
    hintRevealed,
    hintCells,
    feedback,
    mistakes,
    blocked,
    newGame,
    exportProgress,
    cancelGeneration,
    // A ranked run keeps its clock and log, so it cannot start over.
    restart: () => {
      if (!ranked.value) resetSession()
    },
    startRanked,
    runLog: () => [...runLog],
    edit,
    undo,
    redo,
    assist,
    applyHint,
    togglePause,
  }
}
