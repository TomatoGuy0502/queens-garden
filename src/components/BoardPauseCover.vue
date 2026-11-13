<script setup lang="ts">
import { Pause, Play } from '@lucide/vue'
// Hides a paused board; fills the nearest positioned ancestor.
withDefaults(defineProps<{ canResume?: boolean }>(), { canResume: true })
const emit = defineEmits<{ resume: [] }>()
</script>
<template>
  <div class="pause-cover">
    <Pause :size="28" />
    <h2>{{ $t('board.pausedTitle') }}</h2>
    <p>{{ $t('board.pausedBody') }}</p>
    <button type="button" class="primary" :disabled="!canResume" @click="emit('resume')">
      <Play :size="16" /> {{ $t('board.resume') }}
    </button>
  </div>
</template>
<style scoped>
.pause-cover {
  position: absolute;
  inset: 0;
  z-index: 4;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 12px;
  border-radius: 5px;
  background: var(--subtle);
}
h2 {
  font-size: 21px;
  margin: 0;
}
p {
  font-size: 13px;
  color: var(--muted);
  margin: 0 0 9px;
}
</style>
