<script setup lang="ts">
import { watch } from 'vue'
import AppHeader from '../components/AppHeader.vue'
import Queens3DBoard from '../components/Queens3DBoard.vue'
import QueensBoard from '../components/QueensBoard.vue'
import TutorialLesson from '../components/TutorialLesson.vue'
import { useGamePreferences } from '../composables/useGamePreferences'
import { useTutorial } from '../composables/useTutorial'
import { useTutorialStatus } from '../composables/useTutorialStatus'
import { classicCourse } from '../queens/tutorial'
import { stackedCourse } from '../queens3d/tutorial'
import type { Puzzle3DDefinition } from '../queens3d/types'
import type { PuzzleDefinition } from '../queens/types'
const props = defineProps<{ stacked?: boolean }>()
const { guidance } = useGamePreferences()
const course = props.stacked ? stackedCourse() : classicCourse()
const tutorial = useTutorial(course)
const { markDone } = useTutorialStatus(props.stacked ? 'stacked' : 'flat')
const { lesson, lessons, index, cells, met, conflicts, hint, highlighted, isFirst, isLast } =
  tutorial
watch(isLast, (last) => last && markDone())
</script>
<template>
  <main class="page-shell">
    <AppHeader />
    <h1>{{ $t(`${course.texts}.title`) }}</h1>
    <p class="page-description">{{ $t(`${course.texts}.intro`) }}</p>
    <div class="tutorial">
      <Queens3DBoard
        v-if="stacked"
        :key="lesson.id"
        :puzzle="course.puzzle as Puzzle3DDefinition"
        :cells="cells"
        :guidance="guidance"
        :paused="false"
        :won="false"
        :highlighted="highlighted"
        :mistakes="conflicts"
        :busy="false"
        @play="tutorial.edit($event)"
        @mark="tutorial.edit($event, 'mark')"
        @crown="tutorial.edit($event, 'queen')"
      />
      <QueensBoard
        v-else
        :key="lesson.id"
        :puzzle="course.puzzle as PuzzleDefinition"
        :cells="cells"
        :guidance="guidance"
        :paused="false"
        :won="false"
        :highlighted="highlighted"
        :mistakes="conflicts"
        :busy="false"
        @play="tutorial.edit($event)"
        @mark="tutorial.edit($event, 'mark')"
        @crown="tutorial.edit($event, 'queen')"
      />
      <TutorialLesson
        :lesson="lesson"
        :index="index"
        :total="lessons.length"
        :met="met"
        :hint="hint"
        :is-first="isFirst"
        :is-last="isLast"
        :play="course.play"
        @next="tutorial.next"
        @previous="tutorial.previous"
        @restart="tutorial.restart"
        @hint="tutorial.showHint"
      />
    </div>
  </main>
</template>
<style scoped>
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
