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
    <h2 id="round-confirm-title">{{ kind === 'restart' ? '重新開始本關？' : '更換關卡？' }}</h2>
    <p id="round-confirm-description">
      {{
        kind === 'restart'
          ? '保留相同盤面，清除所有玩家的皇冠、X、操作歷史、提示與計時。'
          : '結束目前這局，所有玩家回到等待室，由房主選擇新關卡。'
      }}
    </p>
    <div class="confirmation-actions">
      <button ref="cancelButton" class="secondary" :disabled="busy" @click="cancel">取消</button>
      <button class="primary" :disabled="busy" @click="emit('confirm')">
        {{ busy ? '處理中…' : kind === 'restart' ? '確認重新開始' : '回到等待室' }}
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
  background: #fffdfa;
  color: var(--ink);
}
.round-confirmation::backdrop {
  background: #30263a55;
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
