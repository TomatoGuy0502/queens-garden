<script setup lang="ts">
import CrownIcon from './CrownIcon.vue'
defineProps<{ time: string; moves: number; hints: number }>()
const emit = defineEmits<{ next: [] }>()
</script>
<template>
  <section class="result" aria-labelledby="result-title">
    <CrownIcon filled class="result-crown" />
    <div>
      <span class="eyebrow">BEAUTIFULLY SOLVED</span>
      <h2 id="result-title">所有皇冠，都恰如其分。</h2>
      <p>{{ time }} 完成 · {{ moves }} 次操作 · {{ hints }} 次提示</p>
    </div>
    <button class="primary" @click="emit('next')">再來一局 →</button>
  </section>
</template>
<style scoped>
.result {
  display: flex;
  gap: 17px;
  align-items: center;
  padding: 23px;
  background: #eee8f3;
  border: 1px solid #d7c6e2;
  border-radius: 7px;
  margin: 24px 0;
  flex-wrap: wrap;
  animation: result-in 0.4s ease-out;
}
.result-crown {
  width: 34px;
  color: #78548d;
}
.result h2 {
  font-size: 16px;
  margin: 6px 0;
}
.result p {
  font-size: 11px;
  margin: 0;
  color: var(--muted);
}
.result button {
  margin-left: auto;
  font-size: 12px;
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
