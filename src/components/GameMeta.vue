<script setup lang="ts">
import { Clock3 } from '@lucide/vue'
import type { Difficulty } from '../queens/types'
// The line above a board: difficulty, size and time. Each screen adds what only it has.
defineProps<{
  difficulty: Difficulty
  /** The size as written, such as "8 × 8". */
  size: string
  time: string
  /** A marker before the difficulty, such as the daily challenge's. */
  badge?: string
}>()
</script>
<template>
  <div class="game-meta">
    <div class="puzzle-meta">
      <span v-if="badge" class="difficulty-badge daily-badge">{{ badge }}</span
      ><span class="difficulty-badge">{{ $t(`difficulty.${difficulty}`) }}</span
      ><span class="board-size">{{ size }}</span>
      <slot />
    </div>
    <div class="timer">
      <Clock3 :size="15" /><span>{{ time }}</span>
      <slot name="actions" />
    </div>
  </div>
</template>
<style scoped>
.game-meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 8px 12px;
  margin: 0 0 17px;
  min-height: 29px;
}
.puzzle-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}
.difficulty-badge,
.board-size,
.timer {
  white-space: nowrap;
}
.difficulty-badge {
  font-size: 10px;
  color: var(--accent);
  background: var(--accent-soft);
  padding: 5px 11px;
  border-radius: 4px;
}
.daily-badge {
  color: var(--surface);
  background: var(--accent);
}
.board-size {
  font-size: 12px;
  color: var(--muted);
  letter-spacing: 1px;
}
.timer {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--muted);
}
.timer > span {
  font:
    13px ui-monospace,
    monospace;
  color: var(--ink);
  min-width: 42px;
}
@media (max-width: 800px) {
  .puzzle-meta {
    gap: 8px;
  }
}
@media (max-width: 400px) {
  .puzzle-meta {
    gap: 6px 8px;
  }
  .difficulty-badge {
    padding: 5px 8px;
  }
  .timer {
    gap: 4px;
  }
  .timer > span {
    min-width: 0;
  }
}
@media (max-width: 650px) {
  .game-meta {
    margin-bottom: 13px;
  }
}
</style>
