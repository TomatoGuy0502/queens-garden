<script setup lang="ts">
import { Monitor, Moon, Sun } from '@lucide/vue'
import { useTheme, type ThemePreference } from '../composables/useTheme'
const { preference, storageAvailable, setPreference } = useTheme()
const themes = [
  { value: 'system', label: '跟隨系統', icon: Monitor },
  { value: 'light', label: '淺色', icon: Sun },
  { value: 'dark', label: '深色', icon: Moon },
] as const
function change(event: Event) {
  setPreference((event.target as HTMLInputElement).value as ThemePreference)
}
</script>
<template>
  <div
    class="theme-toggle"
    role="radiogroup"
    aria-label="外觀"
    :title="storageAvailable ? '外觀' : '此瀏覽器無法儲存外觀設定，本次仍會套用'"
  >
    <label
      v-for="theme in themes"
      :key="theme.value"
      :class="{ selected: preference === theme.value }"
      :title="theme.label"
    >
      <input
        type="radio"
        name="theme"
        :value="theme.value"
        :aria-label="theme.label"
        :checked="preference === theme.value"
        @change="change"
      />
      <component :is="theme.icon" :size="15" aria-hidden="true" />
    </label>
    <span v-if="!storageAvailable" class="sr-only" role="status"
      >此瀏覽器無法儲存外觀設定，本次仍會套用。</span
    >
  </div>
</template>
<style scoped>
.theme-toggle {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--control-border);
  border-radius: 6px;
}
label {
  position: relative;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  color: var(--muted);
  cursor: pointer;
}
label.selected {
  background: var(--accent-soft);
  color: var(--accent);
}
label:hover {
  color: var(--accent);
}
/* The native radio stays in the DOM for keyboard and assistive tech, drawn only as its icon. */
input {
  position: absolute;
  inset: 0;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}
label:has(input:focus-visible) {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>
