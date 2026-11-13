<script setup lang="ts">
import { Users, Swords } from '@lucide/vue'
import AppHeader from '../components/AppHeader.vue'
import ModeCard from '../components/ModeCard.vue'
</script>
<template>
  <main class="page-shell">
    <AppHeader />
    <h1>{{ $t('nav.coop') }}</h1>
    <p class="page-description">{{ $t('rooms.intro') }}</p>
    <div class="mode-cards">
      <ModeCard
        to="/rooms/new"
        :title="$t('rooms.coop.title')"
        :body="$t('rooms.coop.body')"
        :cta="$t('rooms.coop.cta')"
        ><Users :size="28"
      /></ModeCard>
      <ModeCard
        to="/rooms/new?mode=duel"
        :title="$t('rooms.duel.title')"
        :body="$t('rooms.duel.body')"
        :cta="$t('rooms.duel.cta')"
        ><Swords :size="28"
      /></ModeCard>
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
@media (max-width: 650px) {
  .mode-cards {
    grid-template-columns: 1fr;
    gap: 18px;
  }
}
</style>
