<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import AppHeader from '../components/AppHeader.vue'
import { useGameStats } from '../composables/useGameStats'
import { BOARD_SIZES, DIFFICULTIES } from '../queens/levels'
import { averageSeconds, bucketKey, formatDuration } from '../queens/stats'
const { stats, storageAvailable, reset } = useGameStats()
const confirming = shallowRef(false)
const rows = computed(() =>
  BOARD_SIZES.map((size) => ({
    size,
    cells: DIFFICULTIES.map((difficulty) => {
      const bucket = stats.value.buckets[bucketKey(size, difficulty)]
      return bucket
        ? {
            difficulty,
            best: formatDuration(bucket.bestSeconds),
            average: formatDuration(averageSeconds(bucket)),
            completed: bucket.completed,
            withoutHints: bucket.withoutHints,
          }
        : { difficulty }
    }),
  })),
)
const total = computed(() =>
  Object.values(stats.value.buckets).reduce((sum, bucket) => sum + bucket.completed, 0),
)
function clear() {
  reset()
  confirming.value = false
}
</script>
<template>
  <main class="page-shell">
    <AppHeader />
    <h1>{{ $t('stats.title') }}</h1>
    <p class="page-description">{{ $t('stats.intro', { total }) }}</p>
    <p v-if="!storageAvailable" class="notice" role="status">{{ $t('stats.storage') }}</p>
    <div v-if="total" class="table-wrap">
      <table>
        <caption class="sr-only">
          {{
            $t('stats.caption')
          }}
        </caption>
        <thead>
          <tr>
            <th scope="col">{{ $t('stats.size') }}</th>
            <th v-for="difficulty in DIFFICULTIES" :key="difficulty" scope="col">
              {{ $t(`difficulty.${difficulty}`) }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.size">
            <th scope="row">{{ row.size }} × {{ row.size }}</th>
            <td v-for="cell in row.cells" :key="cell.difficulty">
              <template v-if="cell.best">
                <strong>{{ cell.best }}</strong>
                <span>{{ $t('stats.average', { time: cell.average }) }}</span>
                <span>{{
                  $t('stats.completed', { count: cell.completed, withoutHints: cell.withoutHints })
                }}</span>
              </template>
              <span v-else class="empty">—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else class="empty-stats">
      <p>{{ $t('stats.empty') }}</p>
      <RouterLink class="primary" to="/solo">{{ $t('stats.start') }}</RouterLink>
    </div>
    <div v-if="total" class="reset">
      <template v-if="confirming">
        <p>{{ $t('stats.confirm') }}</p>
        <button type="button" class="text-button" @click="confirming = false">
          {{ $t('stats.keep') }}
        </button>
        <button type="button" class="primary" @click="clear">{{ $t('stats.clear') }}</button>
      </template>
      <button v-else type="button" class="text-button" @click="confirming = true">
        {{ $t('stats.clearAll') }}
      </button>
    </div>
  </main>
</template>
<style scoped>
h1 {
  font-size: 29px;
  font-weight: 500;
  margin: 42px 0 14px;
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
  margin-top: 28px;
  overflow-x: auto;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: var(--surface);
}
table {
  width: 100%;
  min-width: 560px;
  border-collapse: collapse;
  font-size: 12px;
}
th,
td {
  padding: 14px 16px;
  text-align: left;
  vertical-align: top;
  border-bottom: 1px solid var(--line);
}
tbody tr:last-child > * {
  border-bottom: 0;
}
thead th {
  color: var(--muted);
  font-weight: 500;
}
tbody th {
  font-weight: 550;
  white-space: nowrap;
}
td strong {
  display: block;
  font-size: 17px;
  font-weight: 550;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
}
td span {
  display: block;
  margin-top: 3px;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
td .empty {
  color: var(--line);
}
.empty-stats {
  margin-top: 28px;
  padding: 36px 24px;
  text-align: center;
  border: 1px dashed var(--line);
  border-radius: 7px;
  color: var(--muted);
  font-size: 13px;
}
.empty-stats .primary {
  display: inline-block;
  margin-top: 8px;
  text-decoration: none;
}
.reset {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
  font-size: 12px;
}
.reset p {
  margin: 0;
  color: var(--muted);
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>
