<script setup lang="ts">
import { computed } from 'vue'
import CrownIcon from './CrownIcon.vue'
import { GUIDANCE_LABELS, type GuidanceReason } from '../queens/guidance'
import type { CellState } from '../queens/types'
const props = defineProps<{
  index: number
  size: number
  region: number
  state: CellState
  guidanceReasons: GuidanceReason[]
  pointNames?: string[]
  active: boolean
  highlighted: boolean
  mistake: boolean
  disabled: boolean
}>()
const cellLabel = computed(() => {
  const { index, size, region, state, guidanceReasons } = props
  const stateLabel = state === 'queen' ? '皇冠' : state === 'marked' ? 'X 標記' : '空格'
  const guidanceLabel = guidanceReasons.length
    ? `，皇冠排除範圍：${guidanceReasons.map((reason) => GUIDANCE_LABELS[reason]).join('、')}`
    : ''
  return `第 ${Math.floor(index / size) + 1} 列，第 ${(index % size) + 1} 欄，區域 ${String.fromCharCode(65 + region)}，${stateLabel}${guidanceLabel}`
})
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
    :data-pointed="!!pointNames?.length"
    :data-guided="guidanceReasons.length > 0"
    :class="{
      queen: state === 'queen',
      guided: guidanceReasons.length > 0,
      highlighted,
      mistake,
      pointing: !!pointNames?.length,
    }"
    :style="{ backgroundColor: colors[region] }"
    :tabindex="active ? 0 : -1"
    :disabled="disabled"
    :aria-label="cellLabel"
    :aria-selected="state === 'queen'"
    @click="emit('play', index)"
    @contextmenu.prevent="emit('mark', index)"
    @keydown="emit('navigate', index, $event)"
    @focus="emit('focus', index)"
  >
    <span v-if="pointNames?.length" class="point-label" aria-live="polite">{{
      pointNames.join('、')
    }}</span>
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
.guided {
  background-image:
    repeating-linear-gradient(135deg, transparent, transparent 5px, #39333b28 5px, #39333b28 7px),
    linear-gradient(#f8f7f344, #f8f7f344);
}
.pointing::after {
  content: '';
  position: absolute;
  inset: 3px;
  border: 2px dashed #76528b;
  pointer-events: none;
}
.point-label {
  position: absolute;
  bottom: 2px;
  right: 2px;
  max-width: calc(100% - 4px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 9px;
  padding: 1px 3px;
  background: #fffdfae8;
  color: #634078;
  z-index: 1;
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
