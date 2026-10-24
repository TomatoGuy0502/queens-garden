<script setup lang="ts">
import { ArrowRight, Shuffle } from '@lucide/vue'
import { shallowRef, watch } from 'vue'
import { DIFFICULTIES, DIFFICULTY_LABELS } from '../queens/levels'
import type { Difficulty } from '../queens/types'
const props = defineProps<{
  busy: boolean
  initialSize: number
  initialDifficulty: Difficulty
  initialSeed: number
  currentSeed?: number
}>()
const emit = defineEmits<{
  start: [size: number, difficulty: Difficulty, seed: number]
  cancel: []
}>()
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
    invalid.value = 'Seed 請輸入 0～4294967295 的整數。'
    return
  }
  invalid.value = ''
  emit('start', size.value, difficulty.value, Number(seed.value))
}
</script>
<template>
  <section class="settings-section" aria-labelledby="settings-title">
    <h2 id="settings-title">遊戲設定</h2>
    <form @submit.prevent="start">
      <fieldset :disabled="busy">
        <label for="size">棋盤大小 <span>BOARD SIZE</span></label>
        <select id="size" v-model="size">
          <option v-for="n in [6, 7, 8, 9, 10, 12]" :key="n" :value="n">
            {{ n }} × {{ n }}{{ n === 12 ? ' · 進階' : '' }}
          </option>
        </select>
        <label for="difficulty">難度 <span>DIFFICULTY</span></label>
        <div id="difficulty" class="difficulty-options" role="group" aria-label="難度">
          <button
            v-for="item in DIFFICULTIES"
            :key="item"
            type="button"
            :aria-pressed="difficulty === item"
            :class="{ selected: difficulty === item }"
            @click="difficulty = item"
          >
            {{ DIFFICULTY_LABELS[item] }}
          </button>
        </div>
        <label for="seed">關卡種子 <span>SEED</span></label>
        <div class="seed-field">
          <input
            id="seed"
            v-model="seed"
            inputmode="numeric"
            autocomplete="off"
            aria-describedby="seed-note"
          /><button type="button" aria-label="產生隨機 Seed" title="隨機 Seed" @click="newSeed">
            <Shuffle :size="16" />
          </button>
        </div>
        <p id="seed-note" class="field-note">新遊戲會自動換種子；指定種子請按「載入此種子」。</p>
        <button type="button" class="text-button load-seed" @click="loadSeed">載入此種子</button>
        <p v-if="invalid" role="alert" class="error-text">{{ invalid }}</p>
        <button class="primary new-game" type="submit">
          {{ busy ? '正在尋找唯一解…' : '開始新遊戲' }}<ArrowRight :size="17" />
        </button>
      </fieldset>
    </form>
    <button v-if="busy" class="text-button cancel" @click="emit('cancel')">取消生成</button>
    <p class="generation-note">
      每一道關卡即時生成，並經過唯一解驗證。部分大小與難度可能需要更長時間。
    </p>
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
select,
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
select {
  height: 43px;
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
