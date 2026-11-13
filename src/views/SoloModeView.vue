<script setup lang="ts">
import { Crown, Layers } from '@lucide/vue'
import AppHeader from '../components/AppHeader.vue'
import ModeCard from '../components/ModeCard.vue'
</script>
<template>
  <main class="page-shell">
    <AppHeader />
    <h1>{{ $t('nav.solo') }}</h1>
    <p class="page-description">{{ $t('play.intro') }}</p>
    <div class="mode-cards">
      <ModeCard
        to="/solo"
        :title="$t('play.classic')"
        :body="$t('home.solo.body')"
        :cta="$t('home.solo.cta')"
        ><Crown :size="28"
      /></ModeCard>
      <ModeCard
        to="/solo3d"
        :title="$t('stacked.home.title')"
        :body="$t('stacked.home.body')"
        :cta="$t('stacked.home.cta')"
        :badge="$t('play.new')"
        ><Layers :size="28"
      /></ModeCard>
    </div>
  </main>
</template>
