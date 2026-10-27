<script setup lang="ts">
import { shallowRef, watch } from 'vue'
import { CalendarCheck } from '@lucide/vue'
import { useDailyChallenge } from '../composables/useDailyChallenge'
import { formatDuration } from '../queens/stats'
import { fetchRankedResult, useAccount } from '../composables/useAccount'
import type { LeaderboardEntry } from '../../shared/account'
defineProps<{ busy?: boolean; inGame?: boolean }>()
const emit = defineEmits<{ start: [] }>()
const { today, config, result, streak } = useDailyChallenge()
const { enabled, account } = useAccount()
// A signed-in player's card shows the leaderboard result, not a faster replay of a known board.
const ranked = shallowRef<LeaderboardEntry | null>(null)
watch(
  [account, today],
  async ([signedIn, day]) => {
    ranked.value = null
    if (!signedIn) return
    const found = await fetchRankedResult(day).catch(() => null)
    // A sign-out or a new day while this was loading makes the answer stale.
    if (account.value === signedIn && today.value === day) ranked.value = found
  },
  { immediate: true },
)
</script>
<template>
  <section class="daily" aria-labelledby="daily-title">
    <CalendarCheck :size="24" aria-hidden="true" />
    <div class="daily-body">
      <h2 id="daily-title">{{ $t('daily.title', { date: today }) }}</h2>
      <p>
        {{
          $t('daily.today', {
            size: config.size,
            difficulty: $t(`difficulty.${config.difficulty}`),
          })
        }}
      </p>
      <p class="status" role="status">
        <template v-if="ranked">{{
          $t('ranked.done', { time: formatDuration(ranked.score), rank: ranked.rank })
        }}</template>
        <template v-else-if="result">{{
          $t('daily.done', {
            time: formatDuration(result.seconds),
            hints: $t('count.hints', result.hints),
          })
        }}</template>
        <template v-else>{{ $t('daily.pending') }}</template>
        <template v-if="streak">{{ $t('daily.streak', { days: streak }) }}</template>
      </p>
      <p v-if="enabled">
        {{ $t(account ? 'ranked.rules' : 'ranked.signIn') }}
        <RouterLink :to="{ path: '/leaderboard', query: { day: today } }">{{
          $t('ranked.leaderboard')
        }}</RouterLink>
      </p>
    </div>
    <button v-if="inGame" type="button" class="primary" :disabled="busy" @click="emit('start')">
      {{ result ? $t('daily.again') : $t('daily.start') }}
    </button>
    <RouterLink v-else class="primary" :to="{ path: '/solo', query: { daily: 'today' } }">
      {{ result ? $t('daily.again') : $t('daily.start') }}
    </RouterLink>
  </section>
</template>
<style scoped>
.daily {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px 18px;
  padding: 20px 22px;
  border: 1px solid var(--accent-border);
  border-radius: 7px;
  background: var(--surface);
}
.daily > svg {
  flex: none;
  color: var(--accent);
}
.daily-body {
  flex: 1 1 190px;
  min-width: 0;
}
h2 {
  margin: 0 0 6px;
  font-size: 16px;
  font-weight: 550;
}
p {
  margin: 0;
  font-size: 12px;
  line-height: 1.8;
  color: var(--muted);
}
.status {
  color: var(--accent);
}
.primary {
  flex: 1 0 auto;
  text-decoration: none;
  text-align: center;
}
@media (min-width: 651px) {
  .primary {
    flex: none;
  }
}
</style>
