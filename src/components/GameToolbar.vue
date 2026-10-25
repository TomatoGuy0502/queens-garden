<script setup lang="ts">
import { Undo2, Redo2, RotateCcw, Lightbulb, ScanLine } from '@lucide/vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
const props = withDefaults(
  defineProps<{
    blocked: boolean
    assisting: boolean
    /** Solo games reveal hints in three steps; shared rooms show the whole hint at once. */
    hintLevel?: number
    hintRevealed?: boolean
    canUndo: boolean
    canRedo: boolean
    canRestart: boolean
  }>(),
  { hintLevel: 0, hintRevealed: false },
)
const { t } = useI18n()
const HINT_KEYS = ['hintAsk', 'hintMore', 'hintAnswer', 'hintShown'] as const
const hintLabel = computed(() => t(`toolbar.${HINT_KEYS[Math.min(props.hintLevel, 3)]}`))
const emit = defineEmits<{
  undo: []
  redo: []
  restart: []
  hint: []
  check: []
}>()
</script>
<template>
  <div class="toolbar" role="toolbar" :aria-label="$t('toolbar.label')">
    <p class="interaction-note">{{ $t('toolbar.note') }}</p>
    <div class="history-tools">
      <button
        type="button"
        class="icon-button"
        :aria-label="$t('toolbar.undo')"
        :title="$t('toolbar.undo')"
        :disabled="!canUndo"
        @click="emit('undo')"
      >
        <Undo2 :size="19" /></button
      ><button
        type="button"
        class="icon-button"
        :aria-label="$t('toolbar.redo')"
        :title="$t('toolbar.redo')"
        :disabled="!canRedo"
        @click="emit('redo')"
      >
        <Redo2 :size="19" /></button
      ><span class="tool-divider"></span
      ><button
        type="button"
        class="icon-button"
        :aria-label="$t('toolbar.restart')"
        :title="$t('toolbar.restart')"
        :disabled="!canRestart"
        @click="emit('restart')"
      >
        <RotateCcw :size="18" />
      </button>
    </div>
  </div>
  <div class="assist-tools">
    <button type="button" :disabled="blocked || assisting || hintRevealed" @click="emit('hint')">
      <Lightbulb :size="17" />{{ assisting ? $t('toolbar.thinking') : hintLabel }}</button
    ><button type="button" :disabled="blocked || assisting" @click="emit('check')">
      <ScanLine :size="17" />{{ $t('toolbar.check') }}
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
  background: var(--line);
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
  color: var(--accent);
  cursor: pointer;
}
.assist-tools button:last-child {
  color: var(--muted);
}
</style>
