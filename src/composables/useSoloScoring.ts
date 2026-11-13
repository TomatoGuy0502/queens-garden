import { shallowRef, watch, type Ref } from 'vue'
import { dailyStreak } from '../queens/daily'
import type { Difficulty } from '../queens/types'
import { useGameStats } from './useGameStats'
interface Finished {
  id: string
  size: number
  difficulty: Difficulty
}
/** Records each solved solo game in the player's stats and says how it compared. */
export function useSoloScoring(
  game: {
    won: Ref<boolean>
    puzzle: Ref<Finished | null>
    attempt: Ref<number>
    seconds: Ref<number>
    moves: Ref<number>
    hints: Ref<number>
    daily: Ref<string | null>
  },
  stacked = false,
) {
  const { record, stats } = useGameStats()
  const lastRecord = shallowRef<{
    newBest: boolean
    previousBest: number | null
    streak?: number
  } | null>(null)
  let scored = ''
  // Score each attempt once; undo then redo of the final move must not count as a new win.
  watch(game.won, (isWon) => {
    const current = game.puzzle.value
    if (!isWon || !current) return
    const key = `${current.id}#${game.attempt.value}`
    if (scored === key) return
    scored = key
    const { newBest, previousBest } = record({
      size: current.size,
      difficulty: current.difficulty,
      seconds: game.seconds.value,
      moves: game.moves.value,
      hints: game.hints.value,
      stacked,
      daily: game.daily.value ?? undefined,
    })
    lastRecord.value = {
      newBest,
      previousBest,
      streak: game.daily.value ? dailyStreak(stats.value.dailies, game.daily.value) : undefined,
    }
  })
  watch(
    () => `${game.puzzle.value?.id}#${game.attempt.value}`,
    () => {
      lastRecord.value = null
    },
  )
  return { lastRecord }
}
