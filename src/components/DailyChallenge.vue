<script setup lang="ts">
import { CalendarCheck } from '@lucide/vue'
import { useDailyChallenge } from '../composables/useDailyChallenge'
import { DIFFICULTY_LABELS } from '../queens/levels'
import { formatDuration } from '../queens/stats'
defineProps<{ busy?: boolean; inGame?: boolean }>()
const emit = defineEmits<{ start: [] }>()
const { today, config, result, streak } = useDailyChallenge()
</script>
<template>
  <section class="daily" aria-labelledby="daily-title">
    <CalendarCheck :size="24" aria-hidden="true" />
    <div class="daily-body">
      <h2 id="daily-title">每日挑戰 · {{ today }}</h2>
      <p>
        今天是 {{ config.size }} × {{ config.size }} · {{ DIFFICULTY_LABELS[config.difficulty] }}，
        所有人拿到同一題。
      </p>
      <p class="status" role="status">
        <template v-if="result"
          >已完成 {{ formatDuration(result.seconds) }} · {{ result.hints }} 次提示</template
        >
        <template v-else>今天還沒完成</template>
        <template v-if="streak"> · 連續 {{ streak }} 天</template>
      </p>
    </div>
    <button v-if="inGame" class="primary" :disabled="busy" @click="emit('start')">
      {{ result ? '再玩一次' : '開始今日挑戰' }}
    </button>
    <RouterLink v-else class="primary" :to="{ path: '/solo', query: { daily: 'today' } }">
      {{ result ? '再玩一次' : '開始今日挑戰' }}
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
