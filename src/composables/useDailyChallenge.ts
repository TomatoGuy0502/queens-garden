import { computed, shallowRef } from 'vue'
import { useEventListener } from '@vueuse/core'
import { dailyConfig, dailyStreak, dateKey } from '../queens/daily'
import { useGameStats } from './useGameStats'

export function useDailyChallenge() {
  const { stats } = useGameStats()
  const today = shallowRef(dateKey())
  // A tab left open past midnight should offer the new day's challenge when it is visited again.
  const refresh = () => (today.value = dateKey())
  useEventListener(document, 'visibilitychange', refresh)
  const config = computed(() => dailyConfig(today.value))
  const result = computed(() => stats.value.dailies[today.value] ?? null)
  const streak = computed(() => dailyStreak(stats.value.dailies, today.value))
  return { today, config, result, streak }
}
