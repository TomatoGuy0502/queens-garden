<script setup lang="ts">
import { Languages } from '@lucide/vue'
import { useLocale } from '../composables/useLocale'
import { LOCALES, isLocale } from '../i18n/locales'
const { locale, setLocale } = useLocale()
function change(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  if (isLocale(value)) setLocale(value)
}
</script>
<template>
  <label class="language-switcher">
    <Languages :size="16" aria-hidden="true" />
    <span class="sr-only">{{ $t('language.label') }}</span>
    <select :value="locale" :title="$t('language.label')" @change="change">
      <option v-for="item in LOCALES" :key="item.code" :value="item.code" :lang="item.code">
        {{ item.name }}
      </option>
    </select>
  </label>
</template>
<style scoped>
.language-switcher {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--muted);
}
select {
  max-width: 112px;
  padding: 4px 2px;
  font: inherit;
  font-size: 12px;
  color: inherit;
  background: transparent;
  border: 0;
  cursor: pointer;
}
select:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 3px;
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
