<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { useRoute } from 'vue-router'
import { Settings2, X } from '@lucide/vue'
import { useGamePreferences } from '../composables/useGamePreferences'
import type { BoardGuidance } from '../queens/guidance'
const { expandedBoard } = useGamePreferences()
const preferences = defineModel<BoardGuidance>({ required: true })
defineProps<{ storageAvailable: boolean }>()
const dialog = useTemplateRef<HTMLDialogElement>('dialog')
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
const route = useRoute()
// Pillars only exist on the stacked board, so its option is only offered there.
const ranges = computed(() => [
  { key: 'rows', label: 'guidance.row' } as const,
  { key: 'columns', label: 'guidance.column' } as const,
  { key: 'regions', label: 'guidance.region' } as const,
  { key: 'adjacent', label: 'guidance.adjacent' } as const,
  ...(route.path === '/solo3d' ? [{ key: 'pillars', label: 'guidance.pillar' } as const] : []),
])
function update(key: keyof BoardGuidance, event: Event) {
  preferences.value = { ...preferences.value, [key]: (event.target as HTMLInputElement).checked }
}
</script>
<template>
  <button
    type="button"
    class="text-button preferences-button"
    :aria-label="$t('preferences.open')"
    :title="$t('preferences.open')"
    @click="dialog?.showModal()"
  >
    <Settings2 :size="18" />
  </button>
  <dialog
    ref="dialog"
    class="preferences-dialog"
    aria-labelledby="preferences-title"
    aria-describedby="preferences-description"
    @click="closeOnBackdrop"
  >
    <div class="preferences-header">
      <h2 id="preferences-title">{{ $t('preferences.title') }}</h2>
      <button
        type="button"
        class="icon-button"
        :aria-label="$t('preferences.close')"
        @click="dialog?.close()"
      >
        <X :size="19" />
      </button>
    </div>
    <label class="guidance-toggle layout-toggle">
      <span
        >{{ $t('preferences.expanded')
        }}<small id="expanded-board-note">{{ $t('preferences.expandedNote') }}</small></span
      >
      <input
        v-model="expandedBoard"
        type="checkbox"
        role="switch"
        :aria-label="$t('preferences.expanded')"
        aria-describedby="expanded-board-note"
      />
    </label>
    <p id="preferences-description">{{ $t('preferences.intro') }}</p>
    <label class="guidance-toggle" for="guidance-enabled"
      ><span id="guidance-toggle-label">{{ $t('preferences.guidance') }}</span
      ><input
        id="guidance-enabled"
        type="checkbox"
        role="switch"
        aria-labelledby="guidance-toggle-label"
        :checked="preferences.enabled"
        @change="update('enabled', $event)"
    /></label>
    <fieldset :disabled="!preferences.enabled">
      <legend>{{ $t('preferences.range') }}</legend>
      <label v-for="range in ranges" :key="range.key" class="range-option"
        ><input
          type="checkbox"
          :checked="preferences[range.key] ?? true"
          @change="update(range.key, $event)"
        />{{ $t(range.label) }}</label
      >
    </fieldset>
    <p class="guidance-note">{{ $t('preferences.note') }}</p>
    <p class="storage-note" role="status">
      {{ $t(storageAvailable ? 'preferences.saved' : 'preferences.unsaved') }}
    </p>
  </dialog>
</template>
<style scoped>
.preferences-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  min-height: 36px;
}
.preferences-button:hover {
  color: var(--accent);
}
.preferences-dialog {
  width: min(440px, calc(100% - 36px));
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
.preferences-dialog::backdrop {
  background: var(--backdrop);
}
.preferences-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}
.preferences-header h2 {
  margin: 0;
  font-size: 19px;
  font-weight: 550;
}
.preferences-dialog p {
  color: var(--muted);
}
.guidance-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 17px 0;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  font-weight: 550;
  cursor: pointer;
}
.layout-toggle {
  margin-bottom: 24px;
}
.layout-toggle small {
  display: block;
  margin-top: 4px;
  color: var(--muted);
  font-size: 11px;
  font-weight: 400;
}
.guidance-toggle input {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  accent-color: var(--accent);
  cursor: pointer;
}
fieldset {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin: 20px 0;
  padding: 0;
  border: 0;
}
legend {
  margin-bottom: 12px;
  font-size: 12px;
  color: var(--muted);
}
.range-option {
  display: flex;
  align-items: center;
  gap: 9px;
  cursor: pointer;
}
.range-option input {
  width: 17px;
  height: 17px;
  margin: 0;
  accent-color: var(--accent);
}
fieldset:disabled {
  opacity: 0.45;
}
.preferences-dialog {
  max-height: calc(100dvh - 36px);
  overflow-y: auto;
}
.guidance-note {
  font-size: 12px;
}
.storage-note {
  font-size: 11px;
  margin: 18px 0;
}
</style>
