<script setup lang="ts">
import { computed, nextTick, shallowRef, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, Share2 } from '@lucide/vue'
import { boardLabel } from '../queens/levels'
import type { PuzzleDefinition } from '../queens/types'
import { puzzleLink } from '../services/puzzleLink'
const props = defineProps<{
  puzzle: Pick<PuzzleDefinition, 'size' | 'difficulty' | 'seed' | 'version'>
  stacked?: boolean
  /** The daily challenge's date, whose link opens that day's board for everyone. */
  daily: string | null
  time: string
  hints: number
  newBest?: boolean
  streak?: number
  rank?: number | null
}>()
const { t } = useI18n()
const status = shallowRef(''),
  manual = shallowRef(false),
  done = shallowRef(false)
const fallback = useTemplateRef<HTMLTextAreaElement>('fallback')
// Wordle-style: a few lines that read well in a chat, with a link to try the same board.
const text = computed(() => {
  const name = props.stacked ? '3D Queens' : 'Queens'
  const board = `${boardLabel(props.puzzle.size, props.stacked)} · ${t(`difficulty.${props.puzzle.difficulty}`)}`
  const facts = [`⏱ ${props.time}`, `💡 ${t('count.hints', props.hints)}`]
  if (props.newBest) facts.push(`⭐ ${t('resultShare.best')}`)
  if (props.streak) facts.push(`🔥 ${t('resultShare.streak', { days: props.streak })}`)
  if (props.rank) facts.push(`🏆 ${t('resultShare.rank', { rank: props.rank })}`)
  return [
    props.daily
      ? t('resultShare.daily', { name, date: props.daily, board })
      : t('resultShare.title', { name, board }),
    facts.join(' · '),
    puzzleLink(props.puzzle, props.stacked ? '/solo3d' : '/solo', props.daily),
  ].join('\n')
})
async function share() {
  // A phone hands the text to a chat app; a desktop copies it, as most people paste it there.
  if (typeof navigator.share === 'function' && matchMedia('(pointer: coarse)').matches) {
    try {
      await navigator.share({ text: text.value })
      status.value = t('resultShare.shared')
      done.value = true
      return
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
    }
  }
  try {
    await navigator.clipboard.writeText(text.value)
    status.value = t('resultShare.copied')
    done.value = true
  } catch {
    manual.value = true
    status.value = t('resultShare.manual')
    await nextTick()
    fallback.value?.select()
  }
}
</script>
<template>
  <!-- In the card's corner, so the summary keeps its height and stays on screen. -->
  <button type="button" class="text-button result-share" @click="share">
    <Check v-if="done" :size="14" aria-hidden="true" /><Share2
      v-else
      :size="14"
      aria-hidden="true"
    />{{ done ? $t('resultShare.done') : $t('resultShare.button') }}
  </button>
  <textarea
    v-if="manual"
    ref="fallback"
    class="result-share-text"
    :value="text"
    :aria-label="$t('resultShare.button')"
    readonly
    rows="3"
  ></textarea>
  <p class="sr-only" role="status" aria-live="polite">{{ status }}</p>
</template>
<style scoped>
.result-share {
  position: absolute;
  top: 12px;
  right: 12px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
}
.result-share-text {
  width: 100%;
  padding: 8px;
  border: 1px solid var(--control-border);
  border-radius: 5px;
  background: var(--surface);
  color: var(--ink);
  font:
    11px/1.6 ui-monospace,
    monospace;
  resize: none;
}
</style>
