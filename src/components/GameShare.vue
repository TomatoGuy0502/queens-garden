<script setup lang="ts">
import { SOLO_ONLY } from '../deployment'
import { computed, shallowRef, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import QRCode from 'qrcode'
import { Share2, Copy, Check, X } from '@lucide/vue'
import type { PuzzleDefinition } from '../queens/types'
const props = defineProps<{
  puzzle?: Pick<PuzzleDefinition, 'size' | 'difficulty' | 'seed' | 'version'>
  roomId?: string
  /** Route of the board being shared, for builds that keep the route in the hash. */
  path?: string
}>()
const { t } = useI18n()
const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const linkInput = useTemplateRef<HTMLInputElement>('linkInput')
const status = shallowRef(''),
  copied = shallowRef(false)
const canShare = typeof navigator.share === 'function'
const shareTitle = computed(() => t(props.roomId ? 'share.room' : 'share.puzzle'))
const shareUrl = computed(() => {
  if (props.roomId) return new URL(`/rooms/${props.roomId}`, location.origin).href
  if (!props.puzzle) throw new Error('Nothing to share.')
  const url = new URL(location.pathname, location.origin)
  const query = new URLSearchParams({
    size: String(props.puzzle.size),
    difficulty: props.puzzle.difficulty,
    seed: String(props.puzzle.seed),
    v: props.puzzle.version,
  }).toString()
  if (SOLO_ONLY) url.hash = `${props.path ?? '/solo'}?${query}`
  else url.search = query
  return url.href
})
const qr = computed(() => {
  const { modules } = QRCode.create(shareUrl.value, { errorCorrectionLevel: 'M' })
  const paths: string[] = []
  for (let row = 0; row < modules.size; row++) {
    for (let col = 0; col < modules.size; col++) {
      if (modules.get(row, col)) paths.push(`M${col} ${row}h1v1h-1z`)
    }
  }
  return { size: modules.size, path: paths.join('') }
})
function open() {
  status.value = ''
  copied.value = false
  dialog.value?.showModal()
}
async function copy() {
  try {
    await navigator.clipboard.writeText(shareUrl.value)
    copied.value = true
    status.value = t(props.roomId ? 'share.roomCopied' : 'share.puzzleCopied')
  } catch {
    linkInput.value?.focus()
    linkInput.value?.select()
    status.value = t('share.copyFailed')
  }
}
async function share() {
  try {
    await navigator.share({
      title: t(props.roomId ? 'share.roomTitle' : 'share.puzzleTitle'),
      url: shareUrl.value,
    })
    status.value = t('share.shared')
  } catch (error) {
    if (!(error instanceof DOMException && error.name === 'AbortError'))
      status.value = t('share.shareFailed')
  }
}
</script>
<template>
  <button type="button" class="text-button share-button" @click="open">
    <Share2 :size="14" />{{ shareTitle }}
  </button>
  <dialog
    ref="dialog"
    class="share-dialog"
    aria-labelledby="share-title"
    aria-describedby="share-description"
  >
    <div class="share-header">
      <h2 id="share-title">{{ shareTitle }}</h2>
      <button
        type="button"
        class="icon-button"
        :aria-label="$t('share.close')"
        @click="dialog?.close()"
      >
        <X :size="19" />
      </button>
    </div>
    <p id="share-description">
      {{ $t(roomId ? 'share.roomDescription' : 'share.puzzleDescription') }}
    </p>
    <figure class="share-qr">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        :viewBox="`-4 -4 ${qr.size + 8} ${qr.size + 8}`"
        width="224"
        height="224"
        role="img"
        :aria-label="$t(roomId ? 'share.roomQr' : 'share.puzzleQr')"
        shape-rendering="crispEdges"
      >
        <rect x="-4" y="-4" :width="qr.size + 8" :height="qr.size + 8" fill="#fff" />
        <path :d="qr.path" fill="#30263a" />
      </svg>
      <figcaption>{{ $t(roomId ? 'share.roomScan' : 'share.puzzleScan') }}</figcaption>
    </figure>
    <label for="share-link">{{ $t(roomId ? 'share.roomLink' : 'share.puzzleLink') }}</label>
    <input
      id="share-link"
      ref="linkInput"
      :value="shareUrl"
      readonly
      @focus="linkInput?.select()"
    />
    <div class="share-actions">
      <button type="button" class="primary" @click="copy">
        <Check v-if="copied" :size="16" /><Copy v-else :size="16" />{{
          copied ? $t('share.copied') : $t('share.copy')
        }}</button
      ><button v-if="canShare" type="button" class="native-share" @click="share">
        <Share2 :size="16" />{{ $t('share.native') }}
      </button>
    </div>
    <p class="share-status" role="status" aria-live="polite">{{ status }}</p>
  </dialog>
</template>
<style scoped>
.share-button {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  font-size: 11px;
}
.share-dialog {
  width: min(460px, calc(100% - 36px));
  padding: 24px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--page);
  color: var(--ink);
  font:
    13px/1.8 Inter,
    'PingFang TC',
    system-ui,
    sans-serif;
  box-shadow: 0 16px 60px #30263a22;
}
.share-dialog::backdrop {
  background: var(--backdrop);
}
.share-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}
.share-header h2 {
  margin: 0;
  font-size: 19px;
  font-weight: 550;
}
.share-dialog p {
  color: var(--muted);
}
.share-dialog label {
  display: block;
  font-size: 12px;
  margin: 20px 0 7px;
}
.share-dialog input {
  width: 100%;
  border: 1px solid var(--control-border);
  border-radius: 5px;
  padding: 11px;
  background: var(--surface);
  color: var(--ink);
  font:
    12px/1.5 ui-monospace,
    monospace;
}
.share-qr {
  margin: 20px 0;
  text-align: center;
}
.share-qr svg {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 0 auto;
  border: 1px solid var(--line);
  border-radius: 5px;
}
.share-qr figcaption {
  font-size: 11px;
  color: var(--muted);
  margin-top: 8px;
}
.share-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 20px;
}
.native-share {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border: 1px solid var(--control-border);
  border-radius: 5px;
  background: transparent;
  padding: 11px 15px;
  color: var(--ink);
  cursor: pointer;
}
.share-status {
  min-height: 22px;
  margin: 14px 0 0;
  font-size: 12px;
}
</style>
