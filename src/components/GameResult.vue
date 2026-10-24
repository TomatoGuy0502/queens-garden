<script setup lang="ts">
import { onMounted, useTemplateRef } from 'vue'
import CrownIcon from './CrownIcon.vue'
import { formatDuration } from '../queens/stats'
const props = defineProps<{
  time: string
  moves: number
  hints: number
  /** Personal best context for solo games; omitted for shared rooms. */
  record?: { newBest: boolean; previousBest: number | null }
  nextDisabled?: boolean
  nextLabel?: string
}>()
const emit = defineEmits<{ next: []; review: [] }>()
const result = useTemplateRef<HTMLElement>('result')
const nextButton = useTemplateRef<HTMLButtonElement>('nextButton')
const reviewButton = useTemplateRef<HTMLButtonElement>('reviewButton')
onMounted(() => {
  result.value?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  const target = props.nextDisabled ? reviewButton.value : nextButton.value
  target?.focus({ preventScroll: true })
})
</script>
<template>
  <section ref="result" class="result" aria-labelledby="result-title">
    <CrownIcon filled class="result-crown" />
    <h2 id="result-title">關卡完成</h2>
    <p>{{ time }} 完成 · {{ moves }} 次操作 · {{ hints }} 次提示</p>
    <p v-if="record" class="record" :class="{ best: record.newBest }">
      <template v-if="record.newBest"
        >新紀錄！原本最佳 {{ formatDuration(record.previousBest!) }}</template
      >
      <template v-else-if="record.previousBest !== null"
        >此大小與難度的最佳時間 {{ formatDuration(record.previousBest) }}</template
      >
      <template v-else>第一次完成這個大小與難度，成績已記錄</template>
    </p>
    <button ref="nextButton" class="primary" :disabled="nextDisabled" @click="emit('next')">
      {{ nextLabel ?? '再來一局 →' }}
    </button>
    <button ref="reviewButton" class="secondary" @click="emit('review')">查看棋盤</button>
  </section>
</template>
<style scoped>
.result {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  width: min(100%, 340px);
  padding: 28px 20px;
  text-align: center;
  background: var(--surface);
  border: 1px solid var(--accent-border);
  border-radius: 7px;
  box-shadow: 0 8px 32px #30263a14;
  animation: result-in 0.3s ease-out;
}
.result-crown {
  width: 40px;
  height: 40px;
  color: var(--accent);
}
.result h2 {
  font-size: 24px;
  font-weight: 550;
  margin: 0;
}
.result p {
  font-size: 12px;
  line-height: 1.8;
  margin: 0;
  color: var(--muted);
}
.result .record.best {
  color: var(--accent);
  font-weight: 600;
}
.result button {
  min-width: 144px;
  margin-top: 4px;
}
@media (max-width: 380px) {
  .result {
    padding: 20px 12px;
    gap: 12px;
  }
  .result h2 {
    font-size: 21px;
  }
}
@keyframes result-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>
