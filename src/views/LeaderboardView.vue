<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ChevronLeft, ChevronRight } from '@lucide/vue'
import AppHeader from '../components/AppHeader.vue'
import { fetchLeaderboard } from '../composables/useAccount'
import { useDailyChallenge } from '../composables/useDailyChallenge'
import { useMessage } from '../i18n/message'
import { isDateKey, shiftDay } from '../queens/daily'
import { HINT_PENALTY_SECONDS } from '../queens/replay'
import { formatDuration } from '../queens/stats'
import type { LeaderboardEntry } from '../../shared/account'
import { LocalizedError, errorMessage, type Message } from '../../shared/message'
const route = useRoute()
const render = useMessage()
const { today } = useDailyChallenge()
const day = computed(() => {
  const value = route.query.day
  return isDateKey(value) && value <= today.value ? value : today.value
})
const entries = shallowRef<LeaderboardEntry[] | null>(null)
const error = shallowRef<Message | null>(null)
watch(
  day,
  async (value) => {
    entries.value = null
    error.value = null
    try {
      const board = await fetchLeaderboard(value)
      if (value === day.value) entries.value = board.entries
    } catch (failure) {
      if (value === day.value)
        error.value =
          failure instanceof LocalizedError ? failure.localized : errorMessage('SERVER_ERROR')
    }
  },
  { immediate: true },
)
</script>
<template>
  <main class="page-shell">
    <AppHeader />
    <h1>{{ $t('leaderboard.title') }}</h1>
    <p class="page-description">
      {{ $t('leaderboard.intro', { penalty: HINT_PENALTY_SECONDS }) }}
    </p>
    <nav class="days" :aria-label="$t('leaderboard.days')">
      <RouterLink
        class="icon-button"
        :to="{ query: { day: shiftDay(day, -1) } }"
        :aria-label="$t('leaderboard.previous')"
        ><ChevronLeft :size="18"
      /></RouterLink>
      <h2>{{ day }}</h2>
      <RouterLink
        v-if="day < today"
        class="icon-button"
        :to="{ query: { day: shiftDay(day, 1) } }"
        :aria-label="$t('leaderboard.next')"
        ><ChevronRight :size="18"
      /></RouterLink>
      <span v-else class="icon-button" aria-hidden="true"></span>
    </nav>
    <p v-if="error" class="notice" role="alert">{{ render(error) }}</p>
    <p v-else-if="!entries" class="notice" role="status">{{ $t('leaderboard.loading') }}</p>
    <p v-else-if="!entries.length" class="notice">{{ $t('leaderboard.empty') }}</p>
    <div v-else class="table-wrap">
      <table>
        <caption class="sr-only">
          {{
            $t('leaderboard.caption', { day })
          }}
        </caption>
        <thead>
          <tr>
            <th scope="col">{{ $t('leaderboard.rank') }}</th>
            <th scope="col">{{ $t('leaderboard.player') }}</th>
            <th scope="col">{{ $t('leaderboard.score') }}</th>
            <th scope="col">{{ $t('leaderboard.time') }}</th>
            <th scope="col">{{ $t('leaderboard.hints') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="entry in entries"
            :key="`${entry.rank}:${entry.nickname}`"
            :class="{ me: entry.me }"
          >
            <td>{{ entry.rank }}</td>
            <th scope="row">
              {{ entry.nickname ?? $t('leaderboard.anonymous')
              }}<span v-if="entry.me"> {{ $t('leaderboard.you') }}</span>
            </th>
            <td>
              <strong>{{ formatDuration(entry.score) }}</strong>
            </td>
            <td>{{ formatDuration(entry.seconds) }}</td>
            <td>{{ entry.hints }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </main>
</template>
<style scoped>
h1 {
  font-size: 29px;
  font-weight: 500;
  margin: 42px 0 14px;
}
.days {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 24px;
}
.days h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 550;
  font-variant-numeric: tabular-nums;
}
.notice {
  margin: 18px 0 0;
  padding: 10px 14px;
  font-size: 12px;
  border: 1px solid var(--line);
  border-radius: 5px;
  color: var(--muted);
}
.table-wrap {
  margin-top: 18px;
  overflow-x: auto;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: var(--surface);
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
th,
td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid var(--line);
  white-space: nowrap;
}
tbody tr:last-child > * {
  border-bottom: 0;
}
thead th {
  color: var(--muted);
  font-size: 12px;
  font-weight: 500;
}
tbody th {
  font-weight: 500;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
}
td strong {
  color: var(--accent);
  font-weight: 550;
}
tr.me {
  background: var(--subtle);
}
tr.me span {
  color: var(--accent);
  font-size: 12px;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
@media (max-width: 650px) {
  th,
  td {
    padding: 10px 10px;
  }
}
</style>
