<script setup lang="ts">
import { X } from '@lucide/vue'
import { useId, useTemplateRef } from 'vue'
// A titled dialog with a close button; a click on the backdrop closes it too.
withDefaults(defineProps<{ title: string; closeLabel: string; width?: number }>(), { width: 440 })
const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const titleId = useId()
// A click on the dialog itself, outside its box, can only have landed on the backdrop.
function closeOnBackdrop(event: MouseEvent) {
  const element = dialog.value
  if (!element || event.target !== element) return
  const box = element.getBoundingClientRect()
  if (
    event.clientX < box.left ||
    event.clientX > box.right ||
    event.clientY < box.top ||
    event.clientY > box.bottom
  )
    element.close()
}
defineExpose({
  showModal: () => dialog.value?.showModal(),
  close: () => dialog.value?.close(),
})
</script>
<template>
  <dialog
    ref="dialog"
    class="modal-dialog"
    :style="{ width: `min(${width}px, calc(100% - 36px))` }"
    :aria-labelledby="titleId"
    @click="closeOnBackdrop"
  >
    <div class="modal-header">
      <h2 :id="titleId">{{ title }}</h2>
      <button type="button" class="icon-button" :aria-label="closeLabel" @click="dialog?.close()">
        <X :size="19" />
      </button>
    </div>
    <slot />
  </dialog>
</template>
<style scoped>
.modal-dialog {
  max-height: calc(100dvh - 36px);
  overflow-y: auto;
  padding: 24px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--page);
  color: var(--ink);
  font:
    13px/1.8 Inter,
    'PingFang TC',
    system-ui,
    sans-serif;
  box-shadow: 0 16px 60px #30263a22;
}
.modal-dialog::backdrop {
  background: var(--backdrop);
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}
.modal-header h2 {
  margin: 0;
  font-size: 19px;
  font-weight: 550;
}
</style>
