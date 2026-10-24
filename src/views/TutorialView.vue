<script setup lang="ts">
import { watch } from 'vue'
import AppHeader from '../components/AppHeader.vue'
import QueensBoard from '../components/QueensBoard.vue'
import TutorialLesson from '../components/TutorialLesson.vue'
import { useGamePreferences } from '../composables/useGamePreferences'
import { useTutorial } from '../composables/useTutorial'
import { useTutorialStatus } from '../composables/useTutorialStatus'
import { TUTORIAL_PUZZLE } from '../queens/tutorial'
const { guidance } = useGamePreferences()
const tutorial = useTutorial()
const { markDone } = useTutorialStatus()
const { lesson, lessons, index, cells, met, conflicts, hint, highlighted, isFirst, isLast } =
  tutorial
watch(isLast, (last) => last && markDone())
</script>
<template>
  <main class="page-shell">
    <AppHeader />
    <h1>{{ $t('tutorial.title') }}</h1>
    <p class="page-description">{{ $t('tutorial.intro') }}</p>
    <div class="tutorial">
      <QueensBoard
        :key="lesson.id"
        :puzzle="TUTORIAL_PUZZLE"
        :cells="cells"
        :guidance="guidance"
        :paused="false"
        :won="false"
        :highlighted="highlighted"
        :mistakes="conflicts"
        :busy="false"
        @play="tutorial.edit($event)"
        @mark="tutorial.edit($event, 'mark')"
      />
      <TutorialLesson
        :lesson="lesson"
        :index="index"
        :total="lessons.length"
        :met="met"
        :hint="hint"
        :is-first="isFirst"
        :is-last="isLast"
        @next="tutorial.next"
        @previous="tutorial.previous"
        @restart="tutorial.restart"
        @hint="tutorial.showHint"
      />
    </div>
  </main>
</template>
<style scoped>
h1 {
  font-size: 29px;
  font-weight: 500;
  margin: 42px 0 14px;
}
.tutorial {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 380px);
  gap: 32px;
  align-items: start;
  margin-top: 28px;
}
@media (max-width: 800px) {
  .tutorial {
    grid-template-columns: minmax(0, 1fr);
    gap: 22px;
  }
}
</style>
