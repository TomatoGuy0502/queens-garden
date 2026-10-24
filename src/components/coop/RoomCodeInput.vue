<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { parseRoomCode, ROOM_CODE_LENGTH } from '../../../shared/roomCode'
const model = defineModel<string>({ required: true })
const inputs = useTemplateRef<HTMLInputElement[]>('inputs')
const digits = computed(() =>
  Array.from({ length: ROOM_CODE_LENGTH }, (_, i) => model.value[i]?.trim() ?? ''),
)
function focus(index: number) {
  inputs.value?.[Math.max(0, Math.min(ROOM_CODE_LENGTH - 1, index))]?.focus()
}
function update(index: number, text: string) {
  const value = text.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const next = [...digits.value]
  if (!value) next[index] = ''
  else
    for (let i = 0; i < value.length && index + i < ROOM_CODE_LENGTH; i++)
      next[index + i] = value[i]
  model.value = next
    .map((d) => d || ' ')
    .join('')
    .trimEnd()
  if (value) focus(index + value.length)
}
function input(index: number, event: Event) {
  const target = event.target as HTMLInputElement
  update(index, target.value)
  target.value = digits.value[index]
}
function paste(index: number, event: ClipboardEvent) {
  const text = event.clipboardData?.getData('text') ?? ''
  const code = parseRoomCode(text)
  update(code ? 0 : index, code ?? text)
}
function key(index: number, event: KeyboardEvent) {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault()
    focus(index + (event.key === 'ArrowLeft' ? -1 : 1))
  } else if (event.key === 'Backspace' && !digits.value[index] && index > 0) {
    event.preventDefault()
    update(index - 1, '')
    focus(index - 1)
  }
}
</script>
<template>
  <fieldset class="room-code-input">
    <legend>房間代碼</legend>
    <div class="code-digits">
      <input
        v-for="(_, index) in digits"
        :key="index"
        ref="inputs"
        :value="digits[index]"
        :aria-label="`房間代碼第 ${index + 1} 碼`"
        type="text"
        inputmode="text"
        maxlength="5"
        pattern="[A-Za-z0-9]"
        required
        :autocomplete="index === 0 ? 'one-time-code' : 'off'"
        autocapitalize="characters"
        :spellcheck="false"
        @input="input(index, $event)"
        @paste.prevent="paste(index, $event)"
        @keydown="key(index, $event)"
        @focus="($event.target as HTMLInputElement).select()"
      />
    </div>
    <p>輸入 5 碼英數字，也可以貼上房間連結。</p>
  </fieldset>
</template>
<style scoped>
.room-code-input {
  margin: 0;
  padding: 0;
  border: 0;
  min-width: 0;
}
legend {
  font-size: 12px;
  margin-bottom: 14px;
  padding: 0;
}
.code-digits {
  display: flex;
  gap: 10px;
}
.code-digits input {
  width: 48px;
  min-width: 0;
  height: 54px;
  padding: 0;
  text-align: center;
  font:
    500 24px ui-monospace,
    monospace;
  text-transform: uppercase;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: #fffdfa;
  color: var(--ink);
}
.code-digits input:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}
p {
  margin: 14px 0 0;
  font-size: 11px;
  line-height: 1.7;
  color: var(--muted);
}
@media (max-width: 360px) {
  .code-digits {
    gap: 7px;
  }
  .code-digits input {
    width: 43px;
  }
}
</style>
