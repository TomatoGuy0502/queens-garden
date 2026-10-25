<script setup lang="ts">
import { computed } from 'vue'
import CrownIcon from './CrownIcon.vue'
import { i18n } from '../i18n'
import type { GuidanceReason } from '../queens/guidance'
import type { CellState } from '../queens/types'
const props = defineProps<{
  index: number
  size: number
  region: number
  state: CellState
  guidanceReasons: GuidanceReason[]
  pointNames?: string[]
  hoverNames?: string[]
  active: boolean
  highlighted: boolean
  mistake: boolean
  disabled: boolean
  readOnly?: boolean
}>()
// A board holds up to 144 cells, so they read the shared translator instead of each calling useI18n.
const { t } = i18n.global
const participantLabel = computed(() =>
  [
    ...(props.pointNames ?? []).map((name) => t('cell.point', { name })),
    ...(props.hoverNames ?? []).map((name) => t('cell.hover', { name })),
  ].join(t('cell.people')),
)
const cellLabel = computed(() => {
  const { index, size, region, state, guidanceReasons } = props
  const stateLabel = t(
    `cell.${state === 'queen' ? 'queen' : state === 'marked' ? 'marked' : 'empty'}`,
  )
  const guidanceLabel = guidanceReasons.length
    ? t('cell.guidance', {
        reasons: guidanceReasons.map((reason) => t(`guidance.${reason}`)).join(t('cell.list')),
      })
    : ''
  return t('cell.label', {
    row: Math.floor(index / size) + 1,
    col: (index % size) + 1,
    region: String.fromCharCode(65 + region),
    state: stateLabel,
    guidance: guidanceLabel,
  })
})
const emit = defineEmits<{
  play: [index: number]
  crown: [index: number]
  navigate: [index: number, event: KeyboardEvent]
  focus: [index: number]
  hover: [index: number | null]
}>()
</script>
<template>
  <button
    type="button"
    class="cell"
    role="gridcell"
    :data-index="index"
    :data-region="region"
    :data-state="state"
    :data-hovered="!!hoverNames?.length"
    :data-pointed="!!pointNames?.length"
    :data-guided="guidanceReasons.length > 0"
    :class="{
      queen: state === 'queen',
      guided: guidanceReasons.length > 0,
      highlighted,
      mistake,
      pointing: !!pointNames?.length,
      hovering: !!hoverNames?.length,
    }"
    :style="{ backgroundColor: `var(--region-${region})` }"
    :tabindex="active ? 0 : -1"
    :disabled="disabled"
    :aria-label="cellLabel"
    :aria-readonly="readOnly || undefined"
    :aria-selected="state === 'queen'"
    @click="!readOnly && emit('play', index)"
    @contextmenu.prevent="!readOnly && emit('crown', index)"
    @keydown="emit('navigate', index, $event)"
    @focus="emit('focus', index)"
    @blur="emit('hover', null)"
    @pointerenter="$event.pointerType !== 'touch' && emit('hover', index)"
    @pointerleave="$event.pointerType !== 'touch' && emit('hover', null)"
  >
    <span v-if="participantLabel" class="point-label" :title="participantLabel">{{
      participantLabel
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
  box-shadow: inset 0 0 0 0.5px var(--cell-grid);
  color: var(--cell-ink);
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
    repeating-linear-gradient(
      135deg,
      transparent,
      transparent 5px,
      var(--guidance-line) 5px,
      var(--guidance-line) 7px
    ),
    linear-gradient(var(--guidance-wash), var(--guidance-wash));
}
.hovering::before {
  content: '';
  position: absolute;
  inset: 5px;
  border: 2px solid var(--cell-accent);
  border-radius: 2px;
  pointer-events: none;
}
.pointing::after {
  content: '';
  position: absolute;
  inset: 3px;
  border: 2px dashed var(--cell-accent);
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
  background: var(--cell-tag);
  color: var(--cell-accent);
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
  opacity: var(--region-label-opacity);
}
.highlighted {
  box-shadow: inset 0 0 0 4px var(--cell-accent);
  z-index: 1;
}
.mistake {
  background-image: repeating-linear-gradient(
    135deg,
    transparent,
    transparent 8px,
    var(--mistake-stripe) 8px,
    var(--mistake-stripe) 11px
  );
  box-shadow: inset 0 0 0 3px var(--error);
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
