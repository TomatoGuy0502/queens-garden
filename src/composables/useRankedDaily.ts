import { shallowRef, watch, type Ref } from 'vue'
import { finishRankedRun, startRankedRun } from './useAccount'
import type { RunFinish, RunStart } from '../../shared/account'
import { LocalizedError, errorMessage, message, type Message } from '../../shared/message'
const failure = (reason: unknown) =>
  reason instanceof LocalizedError ? reason.localized : errorMessage('SERVER_ERROR')
/** The server side of a ranked daily: starting the run, and sending its log once it is solved. */
export function useRankedDaily(game: {
  won: Ref<boolean>
  ranked: Ref<boolean>
  daily: Ref<string | null>
  puzzle: Ref<{ seed: number } | null>
  runLog: () => Parameters<typeof finishRankedRun>[2]
}) {
  // True while asking the server whether today's daily is ranked, before the board is generated.
  const preparing = shallowRef(false)
  // Today's leaderboard entry: submitted once the ranked board is solved.
  const result = shallowRef<RunFinish | 'pending' | null>(null)
  const notice = shallowRef<Message | null>(null)
  async function submit() {
    const current = game.puzzle.value
    if (!current || !game.daily.value) return
    result.value = 'pending'
    notice.value = null
    try {
      result.value = await finishRankedRun(game.daily.value, current.seed, game.runLog())
    } catch (reason) {
      result.value = null
      notice.value = failure(reason)
    }
  }
  watch(game.won, (isWon) => {
    if (isWon && game.ranked.value) void submit()
  })
  /** Today's ranked run for a signed-in player; null plays the daily unranked. */
  async function start(day: string): Promise<RunStart | null> {
    preparing.value = true
    try {
      const run = await startRankedRun()
      if (run?.day !== day) return null
      if (run.finished) notice.value = message('ranked.finished')
      return run.finished ? null : run
    } catch (reason) {
      notice.value = failure(reason)
      return null
    } finally {
      preparing.value = false
    }
  }
  return { preparing, result, notice, start, submit }
}
