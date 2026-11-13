<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseIconCrown from './BaseIconCrown.vue'
import { dateKey } from '../queens/daily'
import type { SavedProgress } from '../queens/progress'
import { formatDuration } from '../queens/stats'
const props = defineProps<{ saved: SavedProgress }>()
const emit = defineEmits<{ resume: []; discard: [] }>()
const { t, locale } = useI18n()
const summary = computed(() => {
  const { size, difficulty, elapsedMs, moves, savedAt, daily } = props.saved
  const when = new Date(savedAt).toLocaleString(locale.value, {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  return t('resume.summary', {
    daily: daily === dateKey() ? t('resume.daily') : '',
    size,
    difficulty: t(`difficulty.${difficulty}`),
    elapsed: formatDuration(Math.floor(elapsedMs / 1000)),
    moves: t('count.moves', moves),
    when,
  })
})
</script>
<template>
  <div class="empty-board resume" role="group" aria-labelledby="resume-title">
    <BaseIconCrown />
    <h2 id="resume-title">{{ $t('resume.title') }}</h2>
    <p>{{ summary }}</p>
    <div class="resume-actions">
      <button type="button" class="primary" @click="emit('resume')">
        {{ $t('resume.continue') }}
      </button>
      <button type="button" class="text-button" @click="emit('discard')">
        {{ $t('resume.discard') }}
      </button>
    </div>
  </div>
</template>
<style scoped>
/* The board-sized frame comes from the game page; its inner styles do not reach this component. */
.resume > svg {
  width: 49px;
  height: 49px;
  color: var(--accent);
}
.resume h2 {
  font-size: 18px;
  font-weight: 500;
  margin-top: 26px;
}
.resume p {
  font-size: 11px;
  color: var(--muted);
  line-height: 1.9;
}
.resume-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 10px 18px;
  margin-top: 6px;
}
</style>
