<script setup lang="ts">
import { onUnmounted, watch } from 'vue'
import { X } from '@lucide/vue'
const props = defineProps<{ notice: { id: number; message: string } | null }>()
const emit = defineEmits<{ dismiss: [] }>()
let timer: ReturnType<typeof setTimeout> | undefined
function stop() {
  clearTimeout(timer)
}
function schedule() {
  stop()
  if (props.notice) timer = setTimeout(() => emit('dismiss'), 5000)
}
watch(() => props.notice?.id, schedule, { immediate: true })
onUnmounted(stop)
</script>
<template>
  <Teleport to="body">
    <div class="toast-host" role="status" aria-live="polite" aria-atomic="true">
      <Transition name="toast">
        <div
          v-if="notice"
          :key="notice.id"
          class="room-toast"
          @pointerenter="stop"
          @pointerleave="schedule"
          @focusin="stop"
          @focusout="schedule"
        >
          <span>{{ notice.message }}</span>
          <button class="icon-button" aria-label="關閉通知" @click="emit('dismiss')">
            <X :size="17" />
          </button>
        </div>
      </Transition>
    </div>
  </Teleport>
</template>
<style scoped>
.toast-host {
  position: fixed;
  bottom: max(24px, env(safe-area-inset-bottom));
  left: 50%;
  transform: translateX(-50%);
  width: max-content;
  max-width: calc(100vw - 32px);
  z-index: 100;
  pointer-events: none;
}
.room-toast {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 14px 12px 18px;
  border: 1px solid var(--accent-border);
  background: var(--surface);
  color: var(--ink);
  box-shadow: 0 4px 18px #30263a18;
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.7;
  pointer-events: auto;
}
.room-toast .icon-button {
  flex-shrink: 0;
}
.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 0.15s,
    transform 0.15s;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
@media (prefers-reduced-motion: reduce) {
  .toast-enter-active,
  .toast-leave-active {
    transition: none;
  }
}
</style>
