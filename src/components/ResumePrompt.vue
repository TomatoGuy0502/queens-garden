<script setup lang="ts">
import { computed } from 'vue'
import CrownIcon from './CrownIcon.vue'
import { dateKey } from '../queens/daily'
import { DIFFICULTY_LABELS } from '../queens/levels'
import type { SavedProgress } from '../queens/progress'
import { formatDuration } from '../queens/stats'
const props = defineProps<{ saved: SavedProgress }>()
const emit = defineEmits<{ resume: []; discard: [] }>()
const summary = computed(() => {
  const { size, difficulty, elapsedMs, moves, savedAt, daily } = props.saved
  const when = new Date(savedAt).toLocaleString('zh-TW', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  return `${daily === dateKey() ? '每日挑戰 · ' : ''}${size} × ${size} · ${DIFFICULTY_LABELS[difficulty]} · 已進行 ${formatDuration(Math.floor(elapsedMs / 1000))} · ${moves} 次操作（${when} 儲存）`
})
</script>
<template>
  <div class="empty-board resume" role="group" aria-labelledby="resume-title">
    <CrownIcon />
    <h2 id="resume-title">繼續上一局？</h2>
    <p>{{ summary }}</p>
    <div class="resume-actions">
      <button class="primary" @click="emit('resume')">繼續這一局</button>
      <button class="text-button" @click="emit('discard')">放棄，開始新遊戲</button>
    </div>
  </div>
</template>
<style scoped>
.resume-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 10px 18px;
  margin-top: 6px;
}
</style>
