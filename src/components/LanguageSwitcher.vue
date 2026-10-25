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
  <label class="language-switcher" :title="$t('language.label')">
    <Languages :size="18" aria-hidden="true" />
    <select :value="locale" :aria-label="$t('language.label')" @change="change">
      <option v-for="item in LOCALES" :key="item.code" :value="item.code" :lang="item.code">
        {{ item.name }}
      </option>
    </select>
  </label>
</template>
<style scoped>
.language-switcher {
  position: relative;
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 6px;
  color: var(--muted);
  cursor: pointer;
}
.language-switcher:hover {
  color: var(--accent);
}
/* The native menu opens from the icon; the select itself is invisible but stays focusable. */
select {
  position: absolute;
  inset: 0;
  width: 100%;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}
.language-switcher:has(select:focus-visible) {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
</style>
