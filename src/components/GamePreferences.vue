<script setup lang="ts">
import { useTemplateRef } from 'vue'
import { Settings2, X } from '@lucide/vue'
import { useTheme, type ThemePreference } from '../composables/useTheme'
import type { BoardGuidance } from '../queens/guidance'
const preferences = defineModel<BoardGuidance>({ required: true })
defineProps<{ storageAvailable: boolean }>()
const { preference, storageAvailable: themeStorageAvailable, setPreference } = useTheme()
const themes = [
  { value: 'system', label: '跟隨系統' },
  { value: 'light', label: '淺色' },
  { value: 'dark', label: '深色' },
] as const
function changeTheme(event: Event) {
  setPreference((event.target as HTMLInputElement).value as ThemePreference)
}
const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const ranges = [
  { key: 'rows', label: '同一列' },
  { key: 'columns', label: '同一欄' },
  { key: 'regions', label: '同一色區' },
  { key: 'adjacent', label: '周圍八格' },
] as const
function update(key: keyof BoardGuidance, event: Event) {
  preferences.value = { ...preferences.value, [key]: (event.target as HTMLInputElement).checked }
}
</script>
<template>
  <button class="text-button preferences-button" aria-label="遊玩設定" @click="dialog?.showModal()">
    <Settings2 :size="18" /><span>遊玩設定</span>
  </button>
  <dialog
    ref="dialog"
    class="preferences-dialog"
    aria-labelledby="preferences-title"
    aria-describedby="preferences-description"
  >
    <div class="preferences-header">
      <h2 id="preferences-title">遊玩設定</h2>
      <button class="icon-button" aria-label="關閉設定" @click="dialog?.close()">
        <X :size="19" />
      </button>
    </div>
    <fieldset class="theme-options">
      <legend>外觀</legend>
      <label
        v-for="theme in themes"
        :key="theme.value"
        :class="{ selected: preference === theme.value }"
      >
        <input
          type="radio"
          name="theme"
          :value="theme.value"
          :checked="preference === theme.value"
          @change="changeTheme"
        />
        {{ theme.label }}
      </label>
    </fieldset>
    <p id="preferences-description">放置皇冠後，以淺色斜線標示受影響的格子。</p>
    <label class="guidance-toggle" for="guidance-enabled"
      ><span id="guidance-toggle-label">顯示皇冠排除範圍</span
      ><input
        id="guidance-enabled"
        type="checkbox"
        role="switch"
        aria-labelledby="guidance-toggle-label"
        :checked="preferences.enabled"
        @change="update('enabled', $event)"
    /></label>
    <fieldset :disabled="!preferences.enabled">
      <legend>引導範圍</legend>
      <label v-for="range in ranges" :key="range.key" class="range-option"
        ><input
          type="checkbox"
          :checked="preferences[range.key]"
          @change="update(range.key, $event)"
        />{{ range.label }}</label
      >
    </fieldset>
    <p class="guidance-note">
      只提供視覺引導，不會自動新增 X 或限制點擊。移除皇冠、Undo 或 Redo 時會同步更新。
    </p>
    <p class="storage-note" role="status">
      {{
        storageAvailable && themeStorageAvailable
          ? '設定立即套用，並儲存於此瀏覽器。'
          : '此瀏覽器無法儲存設定，本次遊戲仍會套用。'
      }}
    </p>
    <button class="primary done-button" @click="dialog?.close()">完成</button>
  </dialog>
</template>
<style scoped>
.preferences-button {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 36px;
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
.guidance-toggle input {
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
.theme-options {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin: 18px 0 24px;
}
.theme-options label {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 4px;
  border: 1px solid var(--control-border);
  border-radius: 5px;
  cursor: pointer;
  font-size: 12px;
}
.theme-options label.selected {
  background: var(--accent-soft);
  border-color: var(--accent);
  color: var(--accent);
}
.theme-options input {
  margin: 0;
  accent-color: var(--accent);
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
.done-button {
  display: flex;
  margin-left: auto;
  min-width: 90px;
}
@media (max-width: 650px) {
  .preferences-button {
    width: 32px;
    justify-content: center;
  }
  .preferences-button span {
    display: none;
  }
}
</style>
