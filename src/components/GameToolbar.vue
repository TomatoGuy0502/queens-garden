<script setup lang="ts">
import { Undo2, Redo2, RotateCcw, Lightbulb, ScanLine } from '@lucide/vue'
defineProps<{
  blocked: boolean
  assisting: boolean
  canUndo: boolean
  canRedo: boolean
  canRestart: boolean
}>()
const emit = defineEmits<{
  undo: []
  redo: []
  restart: []
  hint: []
  check: []
}>()
</script>
<template>
  <div class="toolbar" role="toolbar" aria-label="遊戲工具">
    <p class="interaction-note">點擊格子：皇冠 → X → 清除</p>
    <div class="history-tools">
      <button
        class="icon-button"
        aria-label="復原"
        title="復原"
        :disabled="!canUndo"
        @click="emit('undo')"
      >
        <Undo2 :size="19" /></button
      ><button
        class="icon-button"
        aria-label="重做"
        title="重做"
        :disabled="!canRedo"
        @click="emit('redo')"
      >
        <Redo2 :size="19" /></button
      ><span class="tool-divider"></span
      ><button
        class="icon-button"
        aria-label="重新開始"
        title="重新開始"
        :disabled="!canRestart"
        @click="emit('restart')"
      >
        <RotateCcw :size="18" />
      </button>
    </div>
  </div>
  <div class="assist-tools">
    <button :disabled="blocked || assisting" @click="emit('hint')">
      <Lightbulb :size="17" />{{ assisting ? '推理中…' : '給我一點提示' }}</button
    ><button :disabled="blocked || assisting" @click="emit('check')">
      <ScanLine :size="17" />檢查錯誤
    </button>
  </div>
</template>
<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 19px;
  gap: 8px;
}
.interaction-note {
  margin: 0;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.6;
}
.history-tools {
  display: flex;
  align-items: center;
  gap: 5px;
}
.tool-divider {
  height: 18px;
  background: #ddd7df;
  width: 1px;
  margin: 0 5px;
}
.assist-tools {
  display: flex;
  justify-content: center;
  gap: 35px;
  border-top: 1px solid var(--line);
  margin-top: 20px;
  padding: 20px 0;
}
.assist-tools button {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 0;
  background: transparent;
  font-size: 12px;
  color: #6a527a;
  cursor: pointer;
}
.assist-tools button:last-child {
  color: var(--muted);
}
</style>
