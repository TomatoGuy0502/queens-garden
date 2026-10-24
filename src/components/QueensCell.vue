<script setup lang="ts">
import CrownIcon from './CrownIcon.vue'
import type { CellState } from '../queens/types'
defineProps<{
  index: number
  size: number
  region: number
  state: CellState
  edges: boolean[]
  active: boolean
  highlighted: boolean
  mistake: boolean
  disabled: boolean
}>()
const emit = defineEmits<{
  play: [index: number]
  mark: [index: number]
  navigate: [index: number, event: KeyboardEvent]
  focus: [index: number]
}>()
const colors = [
  '#dbcaed',
  '#f4d5a7',
  '#bcd8cd',
  '#eebfbe',
  '#bfcee9',
  '#eee1a3',
  '#c5e0e0',
  '#e8c9dc',
  '#cfd8ad',
  '#d4c7b8',
  '#bfc6e0',
  '#f0cba9',
]
</script>
<template>
  <button
    class="cell"
    role="gridcell"
    :data-index="index"
    :data-region="region"
    :data-state="state"
    :class="{
      queen: state === 'queen',
      highlighted,
      mistake,
      'edge-top': edges[0],
      'edge-right': edges[1],
      'edge-bottom': edges[2],
      'edge-left': edges[3],
    }"
    :style="{ backgroundColor: colors[region] }"
    :tabindex="active ? 0 : -1"
    :disabled="disabled"
    :aria-label="`第 ${Math.floor(index / size) + 1} 列，第 ${(index % size) + 1} 欄，區域 ${String.fromCharCode(65 + region)}，${state === 'queen' ? '皇冠' : state === 'marked' ? 'X 標記' : '空格'}`"
    :aria-selected="state === 'queen'"
    @click="emit('play', index)"
    @contextmenu.prevent="emit('mark', index)"
    @keydown="emit('navigate', index, $event)"
    @focus="emit('focus', index)"
  >
    <span class="region-label" aria-hidden="true">{{ String.fromCharCode(65 + region) }}</span>
    <CrownIcon v-if="state === 'queen'" filled class="cell-crown" />
    <span v-else-if="state === 'marked'" class="cell-mark" aria-hidden="true">×</span>
  </button>
</template>
<style scoped>
.cell {
  position: relative;
  display: grid;
  place-items: center;
  aspect-ratio: 1;
  width: 100%;
  padding: 0;
  border: 0;
  box-shadow: inset 0 0 0 0.5px #30263a22;
  color: #30263a;
  cursor: pointer;
  touch-action: manipulation;
  transition: filter 0.13s;
}
.cell:hover:not(:disabled) {
  filter: brightness(1.045);
}
.cell:focus-visible {
  outline: 3px solid #fff;
  outline-offset: -6px;
  z-index: 2;
}
.cell:disabled {
  opacity: 1;
  cursor: default;
}
.cell-crown {
  width: 57%;
  height: 57%;
  animation: appear 0.18s ease-out;
}
.cell-mark {
  font-size: clamp(20px, 4.6vw, 39px);
  font-weight: 300;
  line-height: 1;
  opacity: 0.65;
}
.region-label {
  position: absolute;
  left: 5px;
  top: 3px;
  font:
    500 9px/1.1 ui-sans-serif,
    system-ui;
  opacity: 0.55;
}
.edge-top {
  border-top: 2px solid #39333b;
}
.edge-right {
  border-right: 2px solid #39333b;
}
.edge-bottom {
  border-bottom: 2px solid #39333b;
}
.edge-left {
  border-left: 2px solid #39333b;
}
.highlighted {
  box-shadow: inset 0 0 0 4px #774695;
  z-index: 1;
}
.mistake {
  background-image: repeating-linear-gradient(
    135deg,
    transparent,
    transparent 8px,
    #9f263b33 8px,
    #9f263b33 11px
  );
  box-shadow: inset 0 0 0 3px #a12c45;
  z-index: 1;
}
@keyframes appear {
  from {
    transform: scale(0.6);
    opacity: 0.3;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}
</style>
