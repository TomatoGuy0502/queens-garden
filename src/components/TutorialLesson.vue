<script setup lang="ts">
import { CircleCheck, Lightbulb } from '@lucide/vue'
import type { Message } from '../../shared/message'
import { useMessage } from '../i18n/message'
import type { TutorialLesson } from '../queens/tutorial'
defineProps<{
  lesson: TutorialLesson
  index: number
  total: number
  met: boolean
  hint: { message: Message; cells: number[] } | null
  isFirst: boolean
  isLast: boolean
  /** Where the finished player goes to play. */
  play: string
}>()
const emit = defineEmits<{ next: []; previous: []; restart: []; hint: [] }>()
const render = useMessage()
</script>
<template>
  <section class="lesson" aria-labelledby="lesson-title">
    <p class="progress">{{ $t('tutorial.progress', { index: index + 1, total }) }}</p>
    <h2 id="lesson-title">{{ render(lesson.title) }}</h2>
    <p v-for="(paragraph, number) in lesson.body" :key="number" class="body">
      {{ render(paragraph) }}
    </p>
    <div v-if="lesson.task" class="task" role="status" aria-live="polite">
      <CircleCheck v-if="met" :size="18" aria-hidden="true" />
      <span v-else class="todo" aria-hidden="true"></span>
      <span>{{ met ? $t('tutorial.done') : render(lesson.task) }}</span>
    </div>
    <div v-if="lesson.hints" class="hint-area">
      <button type="button" class="text-button" @click="emit('hint')">
        <Lightbulb :size="16" />{{ $t('tutorial.hint') }}
      </button>
      <p v-if="hint" class="hint" role="status">{{ render(hint.message) }}</p>
    </div>
    <div v-if="isLast" class="actions finish">
      <RouterLink class="primary" :to="play">{{ $t('tutorial.start') }}</RouterLink>
      <RouterLink class="secondary" to="/">{{ $t('tutorial.home') }}</RouterLink>
    </div>
    <div v-else class="actions">
      <button type="button" class="text-button" :disabled="isFirst" @click="emit('previous')">
        {{ $t('tutorial.previous') }}
      </button>
      <button v-if="lesson.task" type="button" class="text-button" @click="emit('restart')">
        {{ $t('tutorial.restart') }}
      </button>
      <button type="button" class="primary" :disabled="!met" @click="emit('next')">
        {{ $t('tutorial.next') }}
      </button>
    </div>
    <button
      v-if="!isLast && lesson.task && !met"
      type="button"
      class="skip text-button"
      @click="emit('next')"
    >
      {{ $t('tutorial.skip') }}
    </button>
  </section>
</template>
<style scoped>
.lesson {
  padding: 24px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: var(--surface);
}
.progress {
  margin: 0 0 8px;
  font-size: 11px;
  letter-spacing: 1px;
  color: var(--muted);
}
h2 {
  margin: 0 0 14px;
  font-size: 20px;
  font-weight: 550;
}
.body {
  margin: 0 0 12px;
  font-size: 13px;
  line-height: 1.9;
  color: var(--ink);
}
.task {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 18px 0 4px;
  padding: 12px 14px;
  font-size: 13px;
  border-radius: 5px;
  background: var(--accent-soft);
  color: var(--accent);
}
.todo {
  flex: none;
  width: 16px;
  height: 16px;
  border: 2px solid currentColor;
  border-radius: 50%;
}
.hint-area {
  margin-top: 14px;
}
.hint-area .text-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.hint {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.8;
  color: var(--muted);
}
.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  margin-top: 22px;
}
.actions .primary {
  margin-left: auto;
}
.actions.finish .primary {
  margin-left: 0;
}
.actions a {
  text-decoration: none;
  text-align: center;
}
.skip {
  display: block;
  margin: 12px 0 0 auto;
  font-size: 11px;
}
</style>
