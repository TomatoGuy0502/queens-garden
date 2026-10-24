import { computed, onMounted, onUnmounted, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import type { CellState, DeductionStep, Difficulty, PuzzleDefinition } from '../queens/types'
import type { WorkerRequest, WorkerResponse } from '../queens/protocol'
import { nextCell } from '../queens/cells'
import {
  MAX_SAVED_HISTORY,
  encodeCells,
  type RestoredProgress,
  type SavedProgress,
} from '../queens/progress'
import { HINT_LEVELS, hintView } from '../queens/strategies'
import { conflictCells } from '../queens/validator'

export function useQueensGame() {
  const router = useRouter()
  const puzzle = shallowRef<PuzzleDefinition | null>(null)
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
  const message = shallowRef(''),
    error = shallowRef('')
  const hint = shallowRef<DeductionStep | null>(null),
    // 0 = no hint; 1 = where to look; 2 = which technique; 3 = the full answer.
    hintLevel = shallowRef(0),
    mistakes = shallowRef<number[]>([])
  let worker: Worker | null = null,
    requestId = 0,
    revision = 0,
    generationId = 0,
    timer: ReturnType<typeof setInterval> | undefined
  let lastTick = 0,
    elapsedMs = 0
  const requests = new Map<
    number,
    { resolve: (response: WorkerResponse) => void; reject: (reason: Error) => void }
  >()
  const queens = computed(() =>
    cells.value.flatMap((state, i) =>
      state === 'queen'
        ? [{ row: Math.floor(i / puzzle.value!.size), col: i % puzzle.value!.size }]
        : [],
    ),
  )
  const conflicts = computed(() =>
    puzzle.value ? conflictCells(puzzle.value.regions, queens.value) : [],
  )
  const won = computed(
    () => !!puzzle.value && queens.value.length === puzzle.value.size && !conflicts.value.length,
  )
  const time = computed(
    () =>
      `${String(Math.floor(seconds.value / 60)).padStart(2, '0')}:${String(seconds.value % 60).padStart(2, '0')}`,
  )
  const blocked = computed(() => busy.value || paused.value || won.value)
  const hintInfo = computed(() =>
    hint.value && puzzle.value && hintLevel.value
      ? hintView(hint.value, hintLevel.value, puzzle.value.regions)
      : null,
  )
  const feedback = computed(() => hintInfo.value?.text ?? message.value)
  const hintCells = computed(() => hintInfo.value?.cells ?? [])
  const hintRevealed = computed(() => !!hint.value && hintLevel.value >= HINT_LEVELS)

  function stopWorker(reason = '運算已取消。') {
    worker?.terminate()
    worker = null
    for (const pending of requests.values()) pending.reject(new Error(reason))
    requests.clear()
  }
  function rpc(
    payload:
      | Omit<Extract<WorkerRequest, { type: 'generate' }>, 'id'>
      | Omit<Extract<WorkerRequest, { type: 'hint' | 'check' }>, 'id'>,
  ): Promise<WorkerResponse> {
    if (!worker) {
      worker = new Worker(new URL('../queens/worker.ts', import.meta.url), { type: 'module' })
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const pending = requests.get(event.data.id)
        if (!pending) return
        requests.delete(event.data.id)
        if (event.data.error) pending.reject(new Error(event.data.error))
        else pending.resolve(event.data)
      }
      worker.onerror = () => {
        stopWorker('運算服務無法啟動，請重新產生關卡。')
        error.value = '運算服務發生錯誤，請重新產生關卡。'
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
    message.value = ''
  }
  function resetSession() {
    cells.value = Array<CellState>(puzzle.value!.size ** 2).fill('empty')
    history.value = []
    future.value = []
    moves.value = 0
    hints.value = 0
    seconds.value = 0
    elapsedMs = 0
    lastTick = performance.now()
    paused.value = false
    attempt.value++
    clearFeedback()
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
    error.value = ''
    clearFeedback()
    const generation = ++generationId
    cells.value = []
    puzzle.value = null
    daily.value = null
    try {
      const result = await rpc({ type: 'generate', options: { size, difficulty, seed } })
      if (generation !== generationId) return 'stale'
      puzzle.value = result.puzzle!
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
      await router.replace({ path: '/solo', query: Object.fromEntries(params) })
      return 'ready'
    } catch (reason) {
      if (generation !== generationId) return 'stale'
      error.value = (reason as Error).message
      return 'failed'
    } finally {
      if (generation === generationId) busy.value = false
    }
  }
  function cancelGeneration() {
    generationId++
    stopWorker()
    busy.value = false
    error.value = '已取消生成。請選擇設定後再試一次。'
  }
  function edit(index: number, action: 'cycle' | 'mark' = 'cycle') {
    if (blocked.value || !puzzle.value || index < 0 || index >= cells.value.length) return
    history.value = [...history.value, [...cells.value]].slice(-1000)
    future.value = []
    const next = nextCell(cells.value[index], action)
    cells.value = cells.value.map((cell, i) => (i === index ? next : cell))
    moves.value++
    clearFeedback()
    if (won.value) message.value = '關卡完成。'
  }
  function undo() {
    if (busy.value || paused.value || !history.value.length) return
    future.value = [...future.value, [...cells.value]]
    cells.value = history.value.at(-1)!
    history.value = history.value.slice(0, -1)
    clearFeedback()
    lastTick = performance.now()
  }
  function redo() {
    if (busy.value || paused.value || !future.value.length) return
    history.value = [...history.value, [...cells.value]]
    cells.value = future.value.at(-1)!
    future.value = future.value.slice(0, -1)
    clearFeedback()
  }
  async function assist(type: 'hint' | 'check') {
    if (blocked.value || assisting.value || !puzzle.value) return
    // Asking again on an unchanged board only reveals more of the same hint.
    if (type === 'hint' && hint.value) {
      if (hintLevel.value < HINT_LEVELS) {
        hintLevel.value++
        hints.value++
      }
      return
    }
    assisting.value = true
    const atRevision = revision
    try {
      const response = await rpc({ type, cells: [...cells.value] })
      if (atRevision !== revision) return
      message.value = response.message ?? ''
      hint.value = response.step ?? null
      mistakes.value = response.mistakes ?? []
      if (type === 'hint') {
        hints.value++
        hintLevel.value = response.step ? 1 : 0
      }
    } catch (reason) {
      if (atRevision === revision) message.value = (reason as Error).message
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
    clearFeedback()
  }
  function togglePause() {
    if (busy.value || won.value) return
    paused.value = !paused.value
    lastTick = performance.now()
  }
  function onVisibility() {
    if (document.hidden && puzzle.value && !won.value) paused.value = true
  }
  onMounted(() => {
    lastTick = performance.now()
    timer = setInterval(() => {
      const now = performance.now()
      if (puzzle.value && !blocked.value) {
        elapsedMs += now - lastTick
        seconds.value = Math.floor(elapsedMs / 1000)
      }
      lastTick = now
    }, 200)
    document.addEventListener('visibilitychange', onVisibility)
  })
  onUnmounted(() => {
    stopWorker()
    clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisibility)
  })
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
    restart: resetSession,
    edit,
    undo,
    redo,
    assist,
    applyHint,
    togglePause,
  }
}
