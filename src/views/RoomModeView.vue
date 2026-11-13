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
