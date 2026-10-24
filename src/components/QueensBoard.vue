<script setup lang="ts">
import { computed, shallowRef, nextTick, useTemplateRef } from 'vue'
import { Pause, Play } from '@lucide/vue'
import QueensCell from './QueensCell.vue'
import { guidedCells, type BoardGuidance } from '../queens/guidance'
import type { CellState, PuzzleDefinition } from '../queens/types'
const props = withDefaults(
  defineProps<{
    puzzle: PuzzleDefinition
    cells: CellState[]
    paused: boolean
    won: boolean
    highlighted: number[]
    mistakes: number[]
    busy: boolean
    guidance: BoardGuidance
    canResume?: boolean
    pendingCells?: number[]
    points?: { index: number; name: string }[]
    hovers?: { index: number | null; name: string }[]
  }>(),
  { canResume: true, pendingCells: () => [], points: () => [], hovers: () => [] },
)
const emit = defineEmits<{
  play: [index: number]
  mark: [index: number]
  resume: []
  hover: [index: number | null]
}>()
const focusIndex = shallowRef(0),
  board = useTemplateRef<HTMLDivElement>('board')
const rows = computed(() =>
  props.puzzle.regions.map((regions, row) =>
    regions.map((region, col) => ({
      index: row * props.puzzle.size + col,
      region,
    })),
  ),
)
const exclusions = computed(() => guidedCells(props.puzzle.regions, props.cells, props.guidance))
// Draw each shared boundary once. Square caps overlap at vertices, closing every corner.
const boundaryPath = computed(() => {
  const { size: n, regions } = props.puzzle
  const segments = [`M0 0H${n}V${n}H0Z`]
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      if (col < n - 1 && regions[row][col] !== regions[row][col + 1]) {
        segments.push(`M${col + 1} ${row}v1`)
      }
      if (row < n - 1 && regions[row][col] !== regions[row + 1][col]) {
        segments.push(`M${col} ${row + 1}h1`)
      }
    }
  }
  return segments.join(' ')
})
function focus(index: number) {
  focusIndex.value = index
  emit('hover', index)
}
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
  <div class="board-stage">
    <div class="board-scroll" :style="{ '--minimum-size': `${puzzle.size * 40 + 4}px` }">
      <div class="board-frame">
        <div
          class="column-axis"
          :style="{ gridTemplateColumns: `repeat(${puzzle.size}, 1fr)` }"
          aria-hidden="true"
        >
          <span v-for="n in puzzle.size" :key="n">{{ n }}</span>
        </div>
        <div
          class="row-axis"
          :style="{ gridTemplateRows: `repeat(${puzzle.size}, 1fr)` }"
          aria-hidden="true"
        >
          <span v-for="n in puzzle.size" :key="n">{{ n }}</span>
        </div>
        <div class="board-wrap" :class="{ complete: won }">
          <div
            ref="board"
            class="board"
            role="grid"
            aria-label="Queens 棋盤；方向鍵移動、空白鍵或 Enter 循環皇冠、X、空格；X 鍵直接標記"
            :aria-rowcount="puzzle.size"
            :aria-colcount="puzzle.size"
            :class="{ concealed: paused }"
            :inert="paused || busy"
            @pointerleave="emit('hover', null)"
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
                :guidance-reasons="exclusions.get(cell.index) ?? []"
                :active="focusIndex === cell.index"
                :disabled="won || paused || busy || !!pendingCells?.includes(cell.index)"
                :point-names="
                  points?.filter((point) => point.index === cell.index).map((point) => point.name)
                "
                :hover-names="
                  hovers.filter((hover) => hover.index === cell.index).map((hover) => hover.name)
                "
                :highlighted="highlighted.includes(cell.index)"
                :mistake="mistakes.includes(cell.index)"
                @play="emit('play', $event)"
                @mark="emit('mark', $event)"
                @navigate="navigate"
                @focus="focus"
                @hover="emit('hover', $event)"
              />
            </div>
            <svg
              class="region-boundaries"
              :viewBox="`0 0 ${puzzle.size} ${puzzle.size}`"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                :d="boundaryPath"
                fill="none"
                stroke="#39333b"
                stroke-width="4"
                stroke-linecap="square"
                stroke-linejoin="miter"
                vector-effect="non-scaling-stroke"
              />
            </svg>
          </div>
          <div v-if="paused" class="pause-cover">
            <Pause :size="28" />
            <h2>遊戲已暫停</h2>
            <p>棋盤和計時都已暫停。</p>
            <button class="primary" :disabled="canResume === false" @click="emit('resume')">
              <Play :size="16" /> 繼續遊戲
            </button>
          </div>
        </div>
      </div>
    </div>
    <div v-if="won" class="result-cover"><slot name="result" /></div>
  </div>
  <p v-if="puzzle.size >= 8" class="scroll-note">較大的棋盤可左右滑動，保留舒適的點擊空間。</p>
</template>
<style scoped>
.board-stage {
  position: relative;
}
.result-cover {
  position: absolute;
  inset: 0;
  z-index: 4;
  display: grid;
  place-items: center;
  padding: 20px;
  border-radius: 5px;
  background: #f8f7f3d9;
}

.board-scroll {
  width: 100%;
  overflow-x: auto;
  border-radius: 5px;
}
.scroll-note {
  display: none;
}
@media (max-width: 650px) {
  .scroll-note {
    display: block;
    color: var(--muted);
    font-size: 10px;
    margin: 10px 0 0;
  }
}

.board-frame {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr);
  grid-template-rows: 24px auto;
  width: 100%;
  min-width: calc(var(--minimum-size) + 24px);
}
.column-axis,
.row-axis {
  display: grid;
  align-items: center;
  text-align: center;
  color: var(--muted);
  font:
    10px ui-monospace,
    monospace;
}
.column-axis {
  grid-column: 2;
  grid-row: 1;
  padding-inline: 2px;
}
.row-axis {
  grid-column: 1;
  grid-row: 2;
  padding-block: 2px;
  position: sticky;
  left: 0;
  z-index: 4;
  background: #f8f7f3;
}
.board-wrap {
  grid-column: 2;
  grid-row: 2;
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
.region-boundaries {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 3;
}
.board {
  position: relative;
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
