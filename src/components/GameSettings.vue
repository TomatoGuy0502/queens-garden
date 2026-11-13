<script setup lang="ts">
import { ArrowRight, Shuffle } from '@lucide/vue'
import { shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { BOARD_SIZES, DIFFICULTIES } from '../queens/levels'
import BoardChoice from './BoardChoice.vue'
import type { Difficulty } from '../queens/types'
const props = withDefaults(
  defineProps<{
    busy: boolean
    initialSize: number
    initialDifficulty: Difficulty
    initialSeed: number
    currentSeed?: number
    sizes?: readonly number[]
    difficulties?: readonly Difficulty[]
    /** A stacked board has as many layers as rows. */
    stacked?: boolean
  }>(),
  { currentSeed: undefined, sizes: () => BOARD_SIZES, difficulties: () => DIFFICULTIES },
)
const emit = defineEmits<{
  start: [size: number, difficulty: Difficulty, seed: number]
  cancel: []
}>()
const { t } = useI18n()
const size = shallowRef(props.initialSize),
  difficulty = shallowRef<Difficulty>(props.initialDifficulty),
  seed = shallowRef(String(props.initialSeed)),
  invalid = shallowRef('')
watch(
  () => props.currentSeed,
  (value) => {
    if (value !== undefined) seed.value = String(value)
  },
)
function newSeed() {
  const previous = props.currentSeed ?? Number(seed.value)
  const random = crypto.getRandomValues(new Uint32Array(1))[0]
  seed.value = String(random === previous ? (random + 1) >>> 0 : random)
}
function start() {
  newSeed()
  loadSeed()
}
function loadSeed() {
  if (!/^\d+$/.test(seed.value) || Number(seed.value) > 0xffffffff) {
    invalid.value = t('settings.seed.invalid')
    return
  }
  invalid.value = ''
  emit('start', size.value, difficulty.value, Number(seed.value))
}
</script>
<template>
  <section class="settings-section" aria-labelledby="settings-title">
    <h2 id="settings-title">{{ $t('settings.title') }}</h2>
    <form @submit.prevent="start">
      <fieldset :disabled="busy">
        <BoardChoice
          v-model:size="size"
          v-model:difficulty="difficulty"
          :sizes="sizes"
          :difficulties="difficulties"
          :stacked="stacked"
        />
        <label for="seed"
          >{{ $t('settings.seed.label') }} <span>{{ $t('settings.seed.caption') }}</span></label
        >
        <div class="seed-field">
          <input
            id="seed"
            v-model="seed"
            inputmode="numeric"
            autocomplete="off"
            aria-describedby="seed-note"
          /><button
            type="button"
            :aria-label="$t('settings.seed.random')"
            :title="$t('settings.seed.randomTitle')"
            @click="newSeed"
          >
            <Shuffle :size="16" />
          </button>
        </div>
        <p id="seed-note" class="field-note">{{ $t('settings.seed.note') }}</p>
        <button type="button" class="text-button load-seed" @click="loadSeed">
          {{ $t('settings.seed.load') }}
        </button>
        <p v-if="invalid" role="alert" class="error-text">{{ invalid }}</p>
        <button class="primary new-game" type="submit">
          {{ busy ? $t('settings.searching') : $t('settings.start') }}<ArrowRight :size="17" />
        </button>
      </fieldset>
    </form>
    <button v-if="busy" type="button" class="text-button cancel" @click="emit('cancel')">
      {{ $t('settings.cancel') }}
    </button>
    <p class="generation-note">{{ $t('settings.note') }}</p>
  </section>
</template>
<style scoped>
.settings-section h2 {
  font-size: 18px;
  font-weight: 550;
  margin: 15px 0 25px;
}
fieldset {
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
input {
  width: 100%;
  border: 1px solid var(--control-border);
  border-radius: 5px;
  background: var(--surface);
  padding: 12px 13px;
  color: var(--ink);
  font: inherit;
  font-size: 13px;
}
.seed-field {
  position: relative;
}
.seed-field input {
  padding-right: 45px;
  font-family: ui-monospace, monospace;
}
.seed-field button {
  position: absolute;
  right: 5px;
  top: 5px;
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border: 0;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
}
.field-note {
  font-size: 10px;
  color: var(--muted);
  margin: 8px 0;
}
.load-seed {
  margin: 0 0 20px;
  color: var(--accent);
}
.new-game {
  width: 100%;
  justify-content: space-between;
}
.generation-note {
  font-size: 10px;
  color: var(--muted);
  line-height: 1.8;
  margin: 13px 0 0;
}
.cancel {
  width: 100%;
  margin-top: 10px;
}
.error-text {
  font-size: 12px;
  color: var(--error);
}
</style>
