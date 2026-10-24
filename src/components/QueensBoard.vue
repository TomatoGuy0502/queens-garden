<script setup lang="ts">
import { computed, shallowRef, nextTick, useTemplateRef } from 'vue'
import { Pause, Play } from '@lucide/vue'
import QueensCell from './QueensCell.vue'
import type { CellState, PuzzleDefinition } from '../queens/types'
const props = defineProps<{
  puzzle: PuzzleDefinition
  cells: CellState[]
  paused: boolean
  won: boolean
  highlighted: number[]
  mistakes: number[]
  busy: boolean
}>()
const emit = defineEmits<{ play: [index: number]; mark: [index: number]; resume: [] }>()
const focusIndex = shallowRef(0),
  board = useTemplateRef<HTMLDivElement>('board')
const rows = computed(() =>
  props.puzzle.regions.map((regions, row) =>
    regions.map((region, col) => ({
      index: row * props.puzzle.size + col,
      region,
      edges: [
        row === 0 || props.puzzle.regions[row - 1][col] !== region,
        col === props.puzzle.size - 1 || regions[col + 1] !== region,
        row === props.puzzle.size - 1 || props.puzzle.regions[row + 1][col] !== region,
        col === 0 || regions[col - 1] !== region,
      ],
    })),
  ),
)
async function navigate(index: number, event: KeyboardEvent) {
  const n = props.puzzle.size,
    row = Math.floor(index / n),
    col = index % n
  if (event.key.toLowerCase() === 'x') {
    event.preventDefault()
    emit('mark', index)
    return
  }
  let next = index
  if (event.key === 'ArrowUp') next = Math.max(0, row - 1) * n + col
  else if (event.key === 'ArrowDown') next = Math.min(n - 1, row + 1) * n + col
  else if (event.key === 'ArrowLeft') next = row * n + Math.max(0, col - 1)
  else if (event.key === 'ArrowRight') next = row * n + Math.min(n - 1, col + 1)
  else if (event.key === 'Home') next = row * n
  else if (event.key === 'End') next = row * n + n - 1
  else return
  event.preventDefault()
  focusIndex.value = next
  await nextTick()
  board.value?.querySelector<HTMLButtonElement>(`[data-index="${next}"]`)?.focus()
}
</script>
<template>
  <div class="board-wrap" :class="{ complete: won }">
    <div
      ref="board"
      class="board"
      role="grid"
      aria-label="Queens 棋盤；方向鍵移動、空白鍵放皇冠、X 鍵標記"
      :aria-rowcount="puzzle.size"
      :aria-colcount="puzzle.size"
      :class="{ concealed: paused }"
      :inert="paused || busy"
    >
      <div
        v-for="(row, r) in rows"
        :key="r"
        role="row"
        class="board-row"
        :style="{ gridTemplateColumns: `repeat(${puzzle.size}, 1fr)` }"
      >
        <QueensCell
          v-for="cell in row"
          :key="cell.index"
          v-bind="cell"
          :size="puzzle.size"
          :state="cells[cell.index]"
          :active="focusIndex === cell.index"
          :disabled="won || paused || busy"
          :highlighted="highlighted.includes(cell.index)"
          :mistake="mistakes.includes(cell.index)"
          @play="emit('play', $event)"
          @mark="emit('mark', $event)"
          @navigate="navigate"
          @focus="focusIndex = $event"
        />
      </div>
    </div>
    <div v-if="paused" class="pause-cover">
      <Pause :size="28" />
      <h2>休息一下也很好</h2>
      <p>棋盤和計時都已暫停。</p>
      <button class="primary" @click="emit('resume')"><Play :size="16" /> 繼續遊戲</button>
    </div>
  </div>
</template>
<style scoped>
.board-wrap {
  position: relative;
  width: 100%;
  border: 2px solid #39333b;
  border-radius: 5px;
  overflow: hidden;
  background: #ece9e4;
  box-shadow: 0 10px 24px #30263a08;
}
.board-row {
  display: grid;
}
.board {
  transition: opacity 0.2s;
}
.concealed {
  visibility: hidden;
}
.pause-cover {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  background: #f4f1ea;
  gap: 12px;
}
.pause-cover h2 {
  font-size: 21px;
  margin: 0;
}
.pause-cover p {
  font-size: 13px;
  color: var(--muted);
  margin: 0 0 9px;
}
.complete {
  animation: celebrate 0.8s ease-out;
}
@keyframes celebrate {
  30% {
    box-shadow: 0 0 0 9px #cbb5e477;
  }
  70% {
    box-shadow: 0 0 0 16px #cbb5e400;
  }
}
</style>
