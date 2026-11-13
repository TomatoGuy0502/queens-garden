<script setup lang="ts">
// The bar shown while a finished board is looked over again.
const emit = defineEmits<{ endReview: [] }>()
</script>
<template>
  <Teleport to="body">
    <div class="review-controls" role="region" :aria-label="$t('board.reviewLabel')">
      <span>{{ $t('board.reviewing') }}</span>
      <button type="button" class="primary" @click="emit('endReview')">
        {{ $t('board.back') }}
      </button>
    </div>
  </Teleport>
</template>
<style scoped>
.review-controls {
  position: fixed;
  bottom: max(16px, env(safe-area-inset-bottom));
  left: 50%;
  transform: translateX(-50%);
  z-index: 90;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  width: min(460px, calc(100vw - 32px));
  padding: 12px 14px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--surface);
  box-shadow: 0 4px 20px #30263a18;
}
.review-controls > span {
  font-size: 12px;
  line-height: 1.6;
  color: var(--muted);
}
.review-controls > button {
  flex-shrink: 0;
}
</style>
