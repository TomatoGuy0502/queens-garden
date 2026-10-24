<script setup lang="ts">
import { onMounted, useTemplateRef } from 'vue'
import CrownIcon from './CrownIcon.vue'
defineProps<{
  time: string
  moves: number
  hints: number
  nextDisabled?: boolean
  nextLabel?: string
}>()
const emit = defineEmits<{ next: [] }>()
const result = useTemplateRef<HTMLElement>('result')
const nextButton = useTemplateRef<HTMLButtonElement>('nextButton')
onMounted(() => {
  result.value?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  nextButton.value?.focus({ preventScroll: true })
})
</script>
<template>
  <section ref="result" class="result" aria-labelledby="result-title">
    <CrownIcon filled class="result-crown" />
    <h2 id="result-title">關卡完成</h2>
    <p>{{ time }} 完成 · {{ moves }} 次操作 · {{ hints }} 次提示</p>
    <button ref="nextButton" class="primary" :disabled="nextDisabled" @click="emit('next')">
      {{ nextLabel ?? '再來一局 →' }}
    </button>
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
  background: #fffdfa;
  border: 1px solid #d7c6e2;
  border-radius: 7px;
  box-shadow: 0 8px 32px #30263a14;
  animation: result-in 0.3s ease-out;
}
.result-crown {
  width: 40px;
  height: 40px;
  color: #78548d;
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
    transform: translateY(6px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
</style>
