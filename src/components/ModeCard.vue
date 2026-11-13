<script setup lang="ts">
import { ArrowRight } from '@lucide/vue'
import type { RouteLocationRaw } from 'vue-router'
// A way to play, offered on the home page and on the pages that split a mode in two. The icon is the slot.
defineProps<{
  to: RouteLocationRaw
  title: string
  body: string
  cta: string
  /** Short label in the top right corner, such as NEW. */
  badge?: string
}>()
</script>
<template>
  <RouterLink :to="to" class="mode-card">
    <slot />
    <h2>{{ title }}</h2>
    <p>{{ body }}</p>
    <span class="cta">{{ cta }} <ArrowRight :size="16" /></span>
    <span v-if="badge" class="badge">{{ badge }}</span>
  </RouterLink>
</template>
<style scoped>
.mode-card {
  position: relative;
  display: block;
  padding: 30px;
  border: 1px solid var(--line);
  border-radius: 7px;
  text-decoration: none;
  color: var(--ink);
  background: var(--surface);
}
.mode-card:hover {
  border-color: var(--accent-border);
}
:slotted(svg) {
  color: var(--accent);
}
h2 {
  font-size: 20px;
  font-weight: 550;
  margin: 20px 0 12px;
}
p {
  font-size: 13px;
  line-height: 1.9;
  color: var(--muted);
  min-height: 50px;
}
.cta {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--accent);
  font-size: 12px;
  margin-top: 25px;
}
.badge {
  position: absolute;
  top: 18px;
  right: 18px;
  padding: 3px 8px;
  border-radius: 4px;
  background: var(--accent);
  color: var(--surface);
  font-size: 10px;
  font-weight: 600;
  line-height: 1.4;
  letter-spacing: 1px;
}
@media (max-width: 650px) {
  .mode-card {
    padding: 24px;
  }
}
</style>
