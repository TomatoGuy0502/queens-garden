<script setup lang="ts">
import { SOLO_ONLY } from '../deployment'
import { Crown, Users, GraduationCap } from '@lucide/vue'
import AppHeader from '../components/AppHeader.vue'
import DailyChallenge from '../components/DailyChallenge.vue'
import BaseModeCard from '../components/BaseModeCard.vue'
</script>
<template>
  <main class="page-shell">
    <AppHeader />
    <h1>{{ $t('app.title') }}</h1>
    <p class="page-description">{{ $t('home.intro') }}</p>
    <DailyChallenge class="daily-card" />
    <div class="mode-cards">
      <BaseModeCard
        to="/play"
        :title="$t('home.solo.title')"
        :body="$t('home.solo.body')"
        :cta="$t('home.solo.cta')"
        ><Crown :size="28"
      /></BaseModeCard>
      <BaseModeCard
        v-if="!SOLO_ONLY"
        to="/rooms"
        :title="$t('home.coop.title')"
        :body="$t('home.coop.body')"
        :cta="$t('home.coop.cta')"
        ><Users :size="28"
      /></BaseModeCard>
      <BaseModeCard
        to="/tutorial"
        :title="$t('home.tutorial.title')"
        :body="$t('home.tutorial.body')"
        :cta="$t('home.tutorial.cta')"
        ><GraduationCap :size="28"
      /></BaseModeCard>
    </div>
  </main>
</template>
<style scoped>
.daily-card {
  margin-top: 28px;
}
</style>
