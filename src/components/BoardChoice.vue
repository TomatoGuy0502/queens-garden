<script setup lang="ts">
import { useId } from 'vue'
import { boardLabel } from '../queens/levels'
import type { Difficulty } from '../queens/types'
// The size and difficulty of a board to play, as the settings panel and a room's lobby offer them.
const size = defineModel<number>('size', { required: true })
const difficulty = defineModel<Difficulty>('difficulty', { required: true })
defineProps<{
  sizes: readonly number[]
  difficulties: readonly Difficulty[]
  /** A stacked board has as many layers as rows. */
  stacked?: boolean
  disabled?: boolean
}>()
const id = useId()
</script>
<template>
  <fieldset class="board-choice" :disabled="disabled">
    <label :for="`${id}-size`"
      >{{ $t('settings.size.label') }} <span>{{ $t('settings.size.caption') }}</span></label
    >
    <select :id="`${id}-size`" v-model="size">
      <option v-for="n in sizes" :key="n" :value="n">
        {{ boardLabel(n, stacked) }}{{ n === 12 ? ` · ${$t('settings.size.advanced')}` : '' }}
      </option>
    </select>
    <label
      >{{ $t('settings.difficulty.label') }}
      <span>{{ $t('settings.difficulty.caption') }}</span></label
    >
    <div class="difficulty-options" role="group" :aria-label="$t('settings.difficulty.label')">
      <button
        v-for="item in difficulties"
        :key="item"
        type="button"
        :aria-pressed="difficulty === item"
        :class="{ selected: difficulty === item }"
        @click="difficulty = item"
      >
        {{ $t(`difficulty.${item}`) }}
      </button>
    </div>
  </fieldset>
</template>
<style scoped>
.board-choice {
  border: 0;
  padding: 0;
  margin: 0;
  min-width: 0;
}
label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 19px 0 9px;
  font-size: 12px;
  font-weight: 600;
}
label span {
  font-size: 9px;
  letter-spacing: 1px;
  color: var(--muted);
  font-weight: 400;
}
label:first-child {
  margin-top: 0;
}
select {
  width: 100%;
  height: 43px;
  border: 1px solid var(--control-border);
  border-radius: 5px;
  background: var(--surface);
  padding: 12px 13px;
  color: var(--ink);
  font: inherit;
  font-size: 13px;
}
.difficulty-options {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}
.difficulty-options button {
  border: 1px solid var(--control-border);
  background: transparent;
  border-radius: 5px;
  padding: 10px 2px;
  font-size: 12px;
  color: var(--muted);
  cursor: pointer;
}
.difficulty-options .selected {
  background: var(--accent-soft);
  border-color: var(--accent-border);
  color: var(--accent);
  font-weight: 600;
}
</style>
