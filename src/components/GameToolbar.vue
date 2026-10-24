<script setup lang="ts">
import { Undo2, Redo2, RotateCcw, Lightbulb, ScanLine, Crown, X } from '@lucide/vue'
defineProps<{
  mode: 'queen' | 'marked'
  blocked: boolean
  assisting: boolean
  canUndo: boolean
  canRedo: boolean
  canRestart: boolean
}>()
const emit = defineEmits<{
  mode: [value: 'queen' | 'marked']
  undo: []
  redo: []
  restart: []
  hint: []
  check: []
}>()
</script>
<template>
  <div class="toolbar" role="toolbar" aria-label="遊戲工具">
    <div class="mode-toggle" aria-label="放置模式" role="group">
      <button
        :class="{ active: mode === 'queen' }"
        :aria-pressed="mode === 'queen'"
        :disabled="blocked"
        @click="emit('mode', 'queen')"
      >
        <Crown :size="17" /> 皇冠</button
      ><button
        :class="{ active: mode === 'marked' }"
        :aria-pressed="mode === 'marked'"
        :disabled="blocked"
        @click="emit('mode', 'marked')"
      >
        <X :size="17" /> 標記
      </button>
    </div>
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
.mode-toggle {
  display: flex;
  background: #eeece8;
  padding: 4px;
  border-radius: 6px;
  gap: 3px;
}
.mode-toggle button {
  display: flex;
  align-items: center;
  gap: 7px;
  border: 0;
  background: transparent;
  color: #8e8691;
  font-size: 12px;
  padding: 8px 14px;
  border-radius: 4px;
  cursor: pointer;
}
.mode-toggle .active {
  background: #fffdfa;
  color: var(--ink);
  box-shadow: 0 1px 3px #30263a15;
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
  padding-top: 20px;
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
