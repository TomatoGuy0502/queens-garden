<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import AppHeader from '../components/AppHeader.vue'
import { useGameStats } from '../composables/useGameStats'
import { BOARD_SIZES, DIFFICULTIES, DIFFICULTY_LABELS } from '../queens/levels'
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
    <h1>我的成績</h1>
    <p class="page-description">
      單人遊戲的完成紀錄只保存在這個瀏覽器，不會上傳。共完成 {{ total }} 局。
    </p>
    <p v-if="!storageAvailable" class="notice" role="status">
      瀏覽器拒絕儲存，成績只會保留到關閉此頁面。
    </p>
    <div v-if="total" class="table-wrap">
      <table>
        <caption class="sr-only">
          各棋盤大小與難度的最佳時間、平均時間與完成局數
        </caption>
        <thead>
          <tr>
            <th scope="col">大小</th>
            <th v-for="difficulty in DIFFICULTIES" :key="difficulty" scope="col">
              {{ DIFFICULTY_LABELS[difficulty] }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.size">
            <th scope="row">{{ row.size }} × {{ row.size }}</th>
            <td v-for="cell in row.cells" :key="cell.difficulty">
              <template v-if="cell.best">
                <strong>{{ cell.best }}</strong>
                <span>平均 {{ cell.average }}</span>
                <span>{{ cell.completed }} 局 · {{ cell.withoutHints }} 局無提示</span>
              </template>
              <span v-else class="empty">—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else class="empty-stats">
      <p>還沒有完成紀錄。完成一局單人遊戲後，這裡會顯示各難度的最佳時間。</p>
      <RouterLink class="primary" to="/solo">開始遊戲</RouterLink>
    </div>
    <div v-if="total" class="reset">
      <template v-if="confirming">
        <p>清除全部成績？這無法復原。</p>
        <button class="text-button" @click="confirming = false">保留</button>
        <button class="primary" @click="clear">清除</button>
      </template>
      <button v-else class="text-button" @click="confirming = true">清除成績</button>
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
