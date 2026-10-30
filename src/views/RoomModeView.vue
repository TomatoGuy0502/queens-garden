<script setup lang="ts">
import { Users, Swords, ArrowRight } from '@lucide/vue'
import AppHeader from '../components/AppHeader.vue'
</script>
<template>
  <main class="page-shell">
    <AppHeader />
    <h1>{{ $t('nav.coop') }}</h1>
    <p class="page-description">{{ $t('rooms.intro') }}</p>
    <div class="mode-cards">
      <RouterLink to="/rooms/new" class="mode-card"
        ><Users :size="28" />
        <h2>{{ $t('rooms.coop.title') }}</h2>
        <p>{{ $t('rooms.coop.body') }}</p>
        <span>{{ $t('rooms.coop.cta') }} <ArrowRight :size="16" /></span></RouterLink
      ><RouterLink to="/rooms/new?mode=duel" class="mode-card"
        ><Swords :size="28" />
        <h2>{{ $t('rooms.duel.title') }}</h2>
        <p>{{ $t('rooms.duel.body') }}</p>
        <span>{{ $t('rooms.duel.cta') }} <ArrowRight :size="16" /></span
      ></RouterLink>
    </div>
  </main>
</template>
<style scoped>
h1 {
  font-size: 29px;
  font-weight: 500;
  margin: 42px 0 14px;
}
.mode-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 24px;
  margin-top: 24px;
}
.mode-card {
  display: block;
  padding: 30px;
  border: 1px solid var(--line);
  border-radius: 7px;
  text-decoration: none;
  color: var(--ink);
  background: var(--surface);
}
.mode-card > svg {
  color: var(--accent);
}
.mode-card h2 {
  font-size: 20px;
  font-weight: 550;
  margin: 20px 0 12px;
}
.mode-card p {
  font-size: 13px;
  line-height: 1.9;
  color: var(--muted);
  min-height: 50px;
}
.mode-card > span {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--accent);
  font-size: 12px;
  margin-top: 25px;
}
.mode-card:hover {
  border-color: var(--accent-border);
}
@media (max-width: 650px) {
  .mode-cards {
    grid-template-columns: 1fr;
    gap: 18px;
  }
  .mode-card {
    padding: 24px;
  }
}
</style>
