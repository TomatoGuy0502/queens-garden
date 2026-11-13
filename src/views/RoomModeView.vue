<script setup lang="ts">
import { Users, Swords } from '@lucide/vue'
import AppHeader from '../components/AppHeader.vue'
import BaseModeCard from '../components/BaseModeCard.vue'
</script>
<template>
  <main class="page-shell">
    <AppHeader />
    <h1>{{ $t('nav.coop') }}</h1>
    <p class="page-description">{{ $t('rooms.intro') }}</p>
    <div class="mode-cards">
      <BaseModeCard
        to="/rooms/new"
        :title="$t('rooms.coop.title')"
        :body="$t('rooms.coop.body')"
        :cta="$t('rooms.coop.cta')"
        ><Users :size="28"
      /></BaseModeCard>
      <BaseModeCard
        to="/rooms/new?mode=duel"
        :title="$t('rooms.duel.title')"
        :body="$t('rooms.duel.body')"
        :cta="$t('rooms.duel.cta')"
        ><Swords :size="28"
      /></BaseModeCard>
    </div>
  </main>
</template>
