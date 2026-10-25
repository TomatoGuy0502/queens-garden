<script setup lang="ts">
import { computed, shallowRef, nextTick, useTemplateRef, watch, onMounted, onUnmounted } from 'vue'
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
    reviewing?: boolean
    highlighted: number[]
    mistakes: number[]
    busy: boolean
    guidance: BoardGuidance
    canResume?: boolean
    pendingCells?: number[]
    points?: { index: number; name: string }[]
    hovers?: { index: number | null; name: string }[]
  }>(),
  { reviewing: false, canResume: true, pendingCells: () => [], points: () => [], hovers: () => [] },
)
const emit = defineEmits<{
  play: [index: number]
  mark: [index: number]
  crown: [index: number]
  resume: []
  endReview: []
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
const readOnlyReview = computed(() => props.won && props.reviewing)
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
watch(
  () => props.won && props.reviewing,
  async (active) => {
    if (!active) return
    await nextTick()
    board.value
      ?.querySelector<HTMLButtonElement>(`[data-index="${focusIndex.value}"]`)
      ?.focus({ preventScroll: true })
  },
)
function reviewKey(event: KeyboardEvent) {
  if (
    props.won &&
    props.reviewing &&
    event.key === 'Escape' &&
    !event.defaultPrevented &&
    !document.querySelector('dialog[open]')
  ) {
    event.preventDefault()
    emit('endReview')
  }
}
onMounted(() => window.addEventListener('keydown', reviewKey))
onUnmounted(() => window.removeEventListener('keydown', reviewKey))
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
    if (!props.won) emit('mark', index)
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
            :aria-label="$t('board.label')"
            :aria-readonly="won && reviewing"
            :aria-rowcount="puzzle.size"
            :aria-colcount="puzzle.size"
            :class="{ concealed: paused }"
            :inert="paused || (busy && !readOnlyReview)"
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
                :disabled="
                  (won && !reviewing) ||
                  paused ||
                  (!readOnlyReview && (busy || !!pendingCells?.includes(cell.index)))
                "
                :read-only="won && reviewing"
                :point-names="
                  points?.filter((point) => point.index === cell.index).map((point) => point.name)
                "
                :hover-names="
                  hovers.filter((hover) => hover.index === cell.index).map((hover) => hover.name)
                "
                :highlighted="highlighted.includes(cell.index)"
                :mistake="mistakes.includes(cell.index)"
                @play="!won && emit('play', $event)"
                @mark="!won && emit('mark', $event)"
                @crown="!won && emit('crown', $event)"
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
                stroke="var(--board-boundary)"
                stroke-width="4"
                stroke-linecap="square"
                stroke-linejoin="miter"
                vector-effect="non-scaling-stroke"
              />
            </svg>
          </div>
          <div v-if="paused" class="pause-cover">
            <Pause :size="28" />
            <h2>{{ $t('board.pausedTitle') }}</h2>
            <p>{{ $t('board.pausedBody') }}</p>
            <button class="primary" :disabled="canResume === false" @click="emit('resume')">
              <Play :size="16" /> {{ $t('board.resume') }}
            </button>
          </div>
        </div>
      </div>
    </div>
    <div v-if="won && !reviewing" class="result-cover"><slot name="result" /></div>
  </div>
  <Teleport to="body">
    <div
      v-if="won && reviewing"
      class="review-controls"
      role="region"
      :aria-label="$t('board.reviewLabel')"
    >
      <span>{{ $t('board.reviewing') }}</span>
      <button class="primary" @click="emit('endReview')">{{ $t('board.back') }}</button>
    </div>
  </Teleport>
  <p v-if="puzzle.size >= 8" class="scroll-note">{{ $t('board.scroll') }}</p>
</template>
<style scoped>
.review-controls {
  position: fixed;
  bottom: max(16px, env(safe-area-inset-bottom));
  left: 50%;
  transform: translateX(-50%);
  z-index: 90;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  width: min(460px, calc(100vw - 32px));
  padding: 12px 14px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--surface);
  box-shadow: 0 4px 20px #30263a18;
}
.review-controls > span {
  font-size: 12px;
  line-height: 1.6;
  color: var(--muted);
}
.review-controls > button {
  flex-shrink: 0;
}
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
  background: var(--result-overlay);
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
  background: var(--page);
}
.board-wrap {
  grid-column: 2;
  grid-row: 2;
  position: relative;
  width: 100%;
  border: 2px solid var(--board-boundary);
  border-radius: 5px;
  overflow: hidden;
  background: var(--subtle);
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
  background: var(--subtle);
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
