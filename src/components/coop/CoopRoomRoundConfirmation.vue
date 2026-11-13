<script setup lang="ts">
import { onMounted, useTemplateRef } from 'vue'
const props = defineProps<{ kind: 'restart' | 'new'; busy: boolean }>()
const emit = defineEmits<{ confirm: []; cancel: [] }>()
const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const cancelButton = useTemplateRef<HTMLButtonElement>('cancelButton')
function cancel() {
  if (!props.busy) emit('cancel')
}
onMounted(() => {
  dialog.value?.showModal()
  cancelButton.value?.focus()
})
</script>
<template>
  <dialog
    ref="dialog"
    class="round-confirmation"
    aria-labelledby="round-confirm-title"
    aria-describedby="round-confirm-description"
    @cancel.prevent="cancel"
  >
    <h2 id="round-confirm-title">
      {{ $t(kind === 'restart' ? 'coop.round.restartTitle' : 'coop.round.newTitle') }}
    </h2>
    <p id="round-confirm-description">
      {{ $t(kind === 'restart' ? 'coop.round.restartBody' : 'coop.round.newBody') }}
    </p>
    <div class="confirmation-actions">
      <button ref="cancelButton" type="button" class="secondary" :disabled="busy" @click="cancel">
        {{ $t('coop.round.cancel') }}
      </button>
      <button type="button" class="primary" :disabled="busy" @click="emit('confirm')">
        {{
          busy
            ? $t('coop.round.processing')
            : $t(kind === 'restart' ? 'coop.round.confirmRestart' : 'coop.round.confirmNew')
        }}
      </button>
    </div>
  </dialog>
</template>
<style scoped>
.round-confirmation {
  width: min(420px, calc(100vw - 32px));
  padding: 26px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: var(--surface);
  color: var(--ink);
}
.round-confirmation::backdrop {
  background: var(--backdrop);
}
h2 {
  margin: 0 0 16px;
  font-size: 21px;
  font-weight: 550;
}
p {
  margin: 0;
  font-size: 13px;
  line-height: 1.9;
  color: var(--muted);
}
.confirmation-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 24px;
}
</style>
