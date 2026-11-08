<script setup lang="ts">
import { SOLO_ONLY } from '../deployment'
import { Crown, Users, GraduationCap, ArrowRight } from '@lucide/vue'
import AppHeader from '../components/AppHeader.vue'
import DailyChallenge from '../components/DailyChallenge.vue'
</script>
<template>
  <main class="page-shell">
    <AppHeader />
    <h1>{{ $t('app.title') }}</h1>
    <p class="page-description">{{ $t('home.intro') }}</p>
    <DailyChallenge class="daily-card" />
    <div class="mode-cards">
      <RouterLink to="/solo" class="mode-card"
        ><Crown :size="28" />
        <h2>{{ $t('home.solo.title') }}</h2>
        <p>{{ $t('home.solo.body') }}</p>
        <span>{{ $t('home.solo.cta') }} <ArrowRight :size="16" /></span></RouterLink
      ><RouterLink v-if="!SOLO_ONLY" to="/rooms" class="mode-card"
        ><Users :size="28" />
        <h2>{{ $t('home.coop.title') }}</h2>
        <p>{{ $t('home.coop.body') }}</p>
        <span>{{ $t('home.coop.cta') }} <ArrowRight :size="16" /></span></RouterLink
      ><RouterLink to="/tutorial" class="mode-card"
        ><GraduationCap :size="28" />
        <h2>{{ $t('home.tutorial.title') }}</h2>
        <p>{{ $t('home.tutorial.body') }}</p>
        <span>{{ $t('home.tutorial.cta') }} <ArrowRight :size="16" /></span
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
.daily-card {
  margin-top: 28px;
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
