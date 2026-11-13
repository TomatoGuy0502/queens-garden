<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { computed, nextTick, shallowRef, useTemplateRef } from 'vue'
import { guidedCells, type BoardGuidance } from '../queens/guidance'
import type { CellState, PuzzleDefinition } from '../queens/types'
import { pillarGuided } from '../queens3d/play'
import { layerRegions } from '../queens3d/regions'
import type { Puzzle3DDefinition } from '../queens3d/types'
import BoardPauseCover from './BoardPauseCover.vue'
import BoardReviewBar from './BoardReviewBar.vue'
import QueensBoard from './QueensBoard.vue'

// Same props and events as QueensBoard, with cells numbered through all layers.
const props = withDefaults(
  defineProps<{
    puzzle: Puzzle3DDefinition
    cells: CellState[]
    paused: boolean
    won: boolean
    reviewing?: boolean
    highlighted: number[]
    mistakes: number[]
    busy: boolean
    guidance: BoardGuidance
    /** Draws nothing, but takes exactly the room the board will: for what is shown before a board exists. */
    placeholder?: boolean
    /** Room play, where cells are numbered through all layers. */
    canResume?: boolean
    pendingCells?: number[]
    points?: { index: number; name: string }[]
    hovers?: { index: number | null; name: string }[]
  }>(),
  // An absent boolean prop would otherwise be false, which disabled the resume button.
  { canResume: true, pendingCells: () => [], points: () => [], hovers: () => [] },
)
const emit = defineEmits<{
  hover: [index: number | null]
  play: [index: number]
  mark: [index: number]
  crown: [index: number]
  resume: []
  endReview: []
}>()
const stage = useTemplateRef<HTMLDivElement>('stage')
const n = computed(() => props.puzzle.size),
  area = computed(() => n.value ** 2)
// Layer shown on a narrow screen, where the layers become tabs.
const active = shallowRef(0)
// The cell under the pointer or holding focus; its pillar is outlined in every other layer.
const hovered = shallowRef<{ z: number; index: number } | null>(null)
// Each layer is drawn by the flat board, as an n × n puzzle with its own n regions.
const layerPuzzles = computed(() =>
  props.puzzle.regions.map((_, z): PuzzleDefinition => ({
    ...props.puzzle,
    regions: layerRegions(props.puzzle.regions, z),
  })),
)
// Cells of one layer, renumbered from the layer's own first cell.
const named = <T extends { index: number | null }>(items: T[] | undefined, z: number) =>
  (items ?? []).flatMap((item) =>
    item.index !== null && Math.floor(item.index / area.value) === z
      ? [{ ...item, index: item.index % area.value }]
      : [],
  )
const inLayer = (cells: number[], z: number) =>
  cells.flatMap((cell) => (Math.floor(cell / area.value) === z ? [cell % area.value] : []))
const pillars = computed(() =>
  props.guidance.enabled && props.guidance.pillars !== false
    ? pillarGuided(n.value, props.cells)
    : [],
)
// Thumbnails cross out every cell that cannot take a crown, whatever the guidance settings are.
const EVERY_RULE: BoardGuidance = {
  enabled: true,
  rows: true,
  columns: true,
  regions: true,
  adjacent: true,
}
const taken = computed(() => new Set(pillarGuided(n.value, props.cells)))
function blockedCells(regions: number[][], cells: CellState[], z: number) {
  const excluded = guidedCells(regions, cells, EVERY_RULE)
  return cells.map(
    (state, index) =>
      state === 'marked' || excluded.has(index) || taken.value.has(z * area.value + index),
  )
}
const layers = computed(() =>
  layerPuzzles.value.map((puzzle, z) => ({
    z,
    puzzle,
    cells: props.cells.slice(z * area.value, (z + 1) * area.value),
    blocked: blockedCells(
      puzzle.regions,
      props.cells.slice(z * area.value, (z + 1) * area.value),
      z,
    ),
    highlighted: inLayer(props.highlighted, z),
    mistakes: inLayer(props.mistakes, z),
    pillarGuided: inLayer(pillars.value, z),
    pending: inLayer(props.pendingCells ?? [], z),
    points: named(props.points, z),
    hovers: named(props.hovers, z),
    linked: hovered.value && hovered.value.z !== z ? hovered.value.index : null,
  })),
)
function hover(z: number, index: number | null) {
  if (index !== null) hovered.value = { z, index }
  else if (hovered.value?.z === z) hovered.value = null
  emit('hover', index === null ? null : z * area.value + index)
}
/** [ and ] (or PageUp and PageDown) move to the same cell of the layer above or below. */
async function switchLayer(event: KeyboardEvent) {
  const step =
    event.key === '[' || event.key === 'PageUp'
      ? -1
      : event.key === ']' || event.key === 'PageDown'
        ? 1
        : 0
  const cell = (event.target as HTMLElement).closest<HTMLElement>('[data-index]')
  if (!step || !cell) return
  event.preventDefault()
  const z = Math.min(n.value - 1, Math.max(0, Number(cell.dataset.layer) + step))
  active.value = z
  await nextTick()
  stage.value
    ?.querySelector<HTMLElement>(`[data-layer="${z}"][data-index="${cell.dataset.index}"]`)
    ?.focus()
}
useEventListener(window, 'keydown', (event: KeyboardEvent) => {
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
})
</script>
<template>
  <div ref="stage" class="stage" :style="{ '--n': n }" @keydown="switchLayer">
    <!-- On a narrow screen the layers are tabs, and each tab is a thumbnail of its layer. -->
    <div
      class="tabs"
      role="tablist"
      :aria-label="$t('stacked.tabs')"
      :class="{ concealed: paused || placeholder }"
    >
      <button
        v-for="layer in layers"
        :key="layer.z"
        type="button"
        role="tab"
        class="tab"
        :class="{ selected: active === layer.z }"
        :aria-selected="active === layer.z"
        :data-tab="layer.z"
        @click="active = layer.z"
      >
        <span class="thumbnail" aria-hidden="true"
          ><i
            v-for="(state, index) in layer.cells"
            :key="index"
            :class="{
              crown: state === 'queen',
              blocked: layer.blocked[index],
              linked: layer.linked === index,
            }"
            :style="{
              backgroundColor: `var(--region-${layer.puzzle.regions[Math.floor(index / n)][index % n]})`,
            }"
          ></i
        ></span>
        {{ $t('stacked.layer', { layer: layer.z + 1 }) }}
      </button>
    </div>
    <div class="layers">
      <section
        v-for="layer in layers"
        :key="layer.z"
        class="layer"
        :class="{ inactive: active !== layer.z }"
      >
        <h2>{{ $t('stacked.layer', { layer: layer.z + 1 }) }}</h2>
        <div v-if="placeholder" class="blank"></div>
        <QueensBoard
          v-else
          :layer="layer.z"
          :puzzle="layer.puzzle"
          :cells="layer.cells"
          :guidance="guidance"
          :paused="paused"
          :won="won"
          :reviewing="reviewing"
          :highlighted="layer.highlighted"
          :mistakes="layer.mistakes"
          :pillar-guided="layer.pillarGuided"
          :linked="layer.linked"
          :busy="busy"
          :can-resume="canResume"
          :pending-cells="layer.pending"
          :points="layer.points"
          :hovers="layer.hovers"
          @play="emit('play', layer.z * area + $event)"
          @mark="emit('mark', layer.z * area + $event)"
          @crown="emit('crown', layer.z * area + $event)"
          @hover="hover(layer.z, $event)"
        />
      </section>
    </div>
    <div v-if="placeholder"></div>
    <BoardPauseCover v-else-if="paused" :can-resume="canResume" @resume="emit('resume')" />
    <div v-else-if="won && !reviewing" class="cover result-cover"><slot name="result" /></div>
  </div>
  <BoardReviewBar v-if="won && reviewing" @end-review="emit('endReview')" />
</template>
<style scoped>
.stage {
  position: relative;
}
.layers {
  display: grid;
  /* A track is never narrower than a third of the row, so there are at most three columns. */
  grid-template-columns: repeat(
    auto-fit,
    minmax(min(100%, max(230px, calc((100% - 36px) / 3))), 1fr)
  );
  gap: 14px 18px;
}
.layer {
  container-type: inline-size;
  /* Sized from the layer's own width, since several layers share a row. */
  --mark-size: calc(52cqw / var(--n));
}
/* As large as a layer's board with its row and column numbers. Padding rather than a top margin, which would collapse into the heading's. */
.blank {
  box-sizing: content-box;
  margin-left: 24px;
  padding-top: 24px;
  aspect-ratio: 1;
}
.layer h2 {
  margin: 0 0 4px 24px;
  font-size: 12px;
  font-weight: 500;
  color: var(--muted);
}
.tabs {
  display: none;
  grid-template-columns: repeat(var(--n), 1fr);
  gap: 6px;
  margin-bottom: 12px;
}
.tab {
  display: grid;
  justify-items: center;
  gap: 4px;
  padding: 4px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: var(--surface);
  color: var(--muted);
  font-size: 10px;
  cursor: pointer;
}
.tab.selected {
  border-color: var(--accent);
  color: var(--accent);
}
.thumbnail {
  display: grid;
  grid-template-columns: repeat(var(--n), 1fr);
  width: min(100%, 60px);
  aspect-ratio: 1;
}
.thumbnail i {
  display: grid;
  place-items: center;
}
.thumbnail .crown::after {
  content: '';
  width: 55%;
  height: 55%;
  border-radius: 50%;
  background: var(--cell-ink);
}
.thumbnail .blocked {
  /* A small X drawn with two diagonal strokes over the region colour. */
  background-image:
    linear-gradient(45deg, transparent 42%, var(--cell-ink) 42% 58%, transparent 58%),
    linear-gradient(-45deg, transparent 42%, var(--cell-ink) 42% 58%, transparent 58%);
  background-size: 70% 70%;
  background-position: center;
  background-repeat: no-repeat;
}
.thumbnail .linked {
  outline: 1.5px solid var(--cell-accent);
  outline-offset: -1.5px;
}
.concealed {
  visibility: hidden;
}
.cover {
  position: absolute;
  inset: 0;
  z-index: 4;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 12px;
  border-radius: 5px;
  background: var(--subtle);
}
.result-cover {
  padding: 20px;
  background: var(--result-overlay);
}
@media (max-width: 650px) {
  .tabs {
    display: grid;
  }
  .layer.inactive {
    display: none;
  }
  /* The selected tab already names the layer; the heading stays for screen readers only. */
  .layer h2 {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
}
</style>
