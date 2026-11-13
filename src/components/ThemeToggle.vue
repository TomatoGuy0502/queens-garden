<script setup lang="ts">
import { Moon, Sun } from '@lucide/vue'
import { useTheme } from '../composables/useTheme'
const { resolved, storageAvailable, setPreference } = useTheme()
function change(event: Event) {
  setPreference((event.target as HTMLInputElement).checked ? 'dark' : 'light')
}
</script>
<template>
  <label
    class="theme-toggle"
    :title="storageAvailable ? $t('theme.dark') : $t('theme.unavailable')"
  >
    <input
      type="checkbox"
      role="switch"
      :aria-label="$t('theme.dark')"
      :checked="resolved === 'dark'"
      @change="change"
    />
    <Moon v-if="resolved === 'dark'" :size="18" aria-hidden="true" />
    <Sun v-else :size="18" aria-hidden="true" />
    <span v-if="!storageAvailable" class="sr-only" role="status">{{
      $t('theme.unavailableStatus')
    }}</span>
  </label>
</template>
<style scoped>
.theme-toggle {
  position: relative;
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 6px;
  color: var(--muted);
  cursor: pointer;
}
.theme-toggle:hover {
  color: var(--accent);
}
/* The native switch stays in the DOM for keyboard and assistive tech, drawn only as its icon. */
input {
  position: absolute;
  inset: 0;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}
.theme-toggle:has(input:focus-visible) {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
</style>
