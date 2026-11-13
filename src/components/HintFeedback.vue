<script setup lang="ts">
import type { Message } from '../../shared/message'
import { useMessage } from '../i18n/message'
// What a hint or a check says: a label, the text, the reasoning behind it, and a way to apply it.
defineProps<{
  text: Message
  label?: string
  /** The reasoning behind the answer; leave it out until the answer is shown. */
  evidence?: { reason: Message }[]
  canApply: boolean
}>()
const emit = defineEmits<{ apply: [] }>()
const render = useMessage()
</script>
<template>
  <span v-if="label" class="feedback-label">{{ label }}</span>
  <p>{{ render(text) }}</p>
  <details v-if="evidence?.length" class="hint-evidence">
    <summary>
      {{ $t('game.feedback.evidence', { count: evidence.length }, evidence.length) }}
    </summary>
    <ol>
      <li v-for="(step, index) in evidence" :key="index">{{ render(step.reason) }}</li>
    </ol>
  </details>
  <button v-if="canApply" type="button" class="text-button apply-hint" @click="emit('apply')">
    {{ $t('game.feedback.apply') }}
  </button>
</template>
<style scoped>
p {
  margin: 5px 0;
}
.feedback-label {
  font-size: 10px;
  color: var(--accent);
  letter-spacing: 1px;
}
.hint-evidence {
  margin: 12px 0;
  font-size: 11px;
  color: var(--muted);
}
.hint-evidence summary {
  cursor: pointer;
}
.hint-evidence ol {
  padding-left: 20px;
}
.hint-evidence li {
  margin: 8px 0;
}
.apply-hint {
  margin-top: 6px;
  color: var(--accent) !important;
}
</style>
