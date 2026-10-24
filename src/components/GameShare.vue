<script setup lang="ts">
import { computed, shallowRef, useTemplateRef } from 'vue'
import QRCode from 'qrcode'
import { Share2, Copy, Check, X } from '@lucide/vue'
import type { PuzzleDefinition } from '../queens/types'
const props = defineProps<{ puzzle?: PuzzleDefinition; roomId?: string }>()
const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const linkInput = useTemplateRef<HTMLInputElement>('linkInput')
const status = shallowRef(''),
  copied = shallowRef(false)
const canShare = typeof navigator.share === 'function'
const shareTitle = computed(() => (props.roomId ? '邀請隊友' : '分享關卡'))
const shareUrl = computed(() => {
  if (props.roomId) return new URL(`/rooms/${props.roomId}`, location.origin).href
  if (!props.puzzle) throw new Error('分享目標不存在。')
  const url = new URL(location.pathname, location.origin)
  url.search = new URLSearchParams({
    size: String(props.puzzle.size),
    difficulty: props.puzzle.difficulty,
    seed: String(props.puzzle.seed),
    v: props.puzzle.version,
  }).toString()
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
    status.value = props.roomId ? '已複製房間連結。' : '已複製關卡連結。'
  } catch {
    linkInput.value?.focus()
    linkInput.value?.select()
    status.value = '無法自動複製，請複製已選取的連結。'
  }
}
async function share() {
  try {
    await navigator.share({
      title: props.roomId ? 'Queens 合作關卡' : 'Queens 關卡',
      url: shareUrl.value,
    })
    status.value = '已分享關卡。'
  } catch (error) {
    if (!(error instanceof DOMException && error.name === 'AbortError'))
      status.value = '無法開啟系統分享，請使用複製連結。'
  }
}
</script>
<template>
  <button class="text-button share-button" @click="open">
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
      <button class="icon-button" aria-label="關閉分享" @click="dialog?.close()">
        <X :size="19" />
      </button>
    </div>
    <p id="share-description">
      {{
        roomId
          ? '分享連結或 QR Code，邀請隊友加入房間。'
          : '連結包含棋盤大小、難度與種子，開啟後會得到相同關卡。'
      }}
    </p>
    <figure class="share-qr">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        :viewBox="`-4 -4 ${qr.size + 8} ${qr.size + 8}`"
        width="224"
        height="224"
        role="img"
        :aria-label="roomId ? '房間 QR Code' : '關卡 QR Code'"
        shape-rendering="crispEdges"
      >
        <rect x="-4" y="-4" :width="qr.size + 8" :height="qr.size + 8" fill="#fff" />
        <path :d="qr.path" fill="#30263a" />
      </svg>
      <figcaption>{{ roomId ? '掃描加入房間' : '掃描開啟相同關卡' }}</figcaption>
    </figure>
    <label for="share-link">{{ roomId ? '房間連結' : '關卡連結' }}</label>
    <input
      id="share-link"
      ref="linkInput"
      :value="shareUrl"
      readonly
      @focus="linkInput?.select()"
    />
    <div class="share-actions">
      <button class="primary" @click="copy">
        <Check v-if="copied" :size="16" /><Copy v-else :size="16" />{{
          copied ? '已複製' : '複製連結'
        }}</button
      ><button v-if="canShare" class="native-share" @click="share">
        <Share2 :size="16" />系統分享
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
