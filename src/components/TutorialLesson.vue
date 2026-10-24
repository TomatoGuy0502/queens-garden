<script setup lang="ts">
import { CircleCheck, Lightbulb } from '@lucide/vue'
import type { TutorialLesson } from '../queens/tutorial'
defineProps<{
  lesson: TutorialLesson
  index: number
  total: number
  met: boolean
  hint: { message: string; cells: number[] } | null
  isFirst: boolean
  isLast: boolean
}>()
const emit = defineEmits<{ next: []; previous: []; restart: []; hint: [] }>()
</script>
<template>
  <section class="lesson" aria-labelledby="lesson-title">
    <p class="progress">第 {{ index + 1 }} / {{ total }} 課</p>
    <h2 id="lesson-title">{{ lesson.title }}</h2>
    <p v-for="paragraph in lesson.body" :key="paragraph" class="body">{{ paragraph }}</p>
    <div v-if="lesson.task" class="task" role="status" aria-live="polite">
      <CircleCheck v-if="met" :size="18" aria-hidden="true" />
      <span v-else class="todo" aria-hidden="true"></span>
      <span>{{ met ? '完成了！可以進入下一課。' : lesson.task }}</span>
    </div>
    <div v-if="lesson.hints" class="hint-area">
      <button class="text-button" @click="emit('hint')"><Lightbulb :size="16" />給我提示</button>
      <p v-if="hint" class="hint" role="status">{{ hint.message }}</p>
    </div>
    <div v-if="isLast" class="actions finish">
      <RouterLink class="primary" to="/solo">開始遊戲</RouterLink>
      <RouterLink class="secondary" to="/">回到首頁</RouterLink>
    </div>
    <div v-else class="actions">
      <button class="text-button" :disabled="isFirst" @click="emit('previous')">上一課</button>
      <button v-if="lesson.task" class="text-button" @click="emit('restart')">重設這一課</button>
      <button class="primary" :disabled="!met" @click="emit('next')">下一課 →</button>
    </div>
    <button v-if="!isLast && lesson.task && !met" class="skip text-button" @click="emit('next')">
      跳過這一課
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
