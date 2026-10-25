<script setup lang="ts">
import { onMounted, onUnmounted, shallowRef } from 'vue'
import { RotateCw, X } from '@lucide/vue'
const CHECK_INTERVAL = 5 * 60 * 1000
// Every deploy renames the hashed entry script, so a different one in the served page is a newer build.
const entryOf = (root: ParentNode) =>
  root.querySelector('script[type="module"][src]')?.getAttribute('src') ?? null
const current = entryOf(document)
const available = shallowRef(false)
let timer: ReturnType<typeof setInterval> | undefined
const check = () => void refresh()
async function refresh() {
  if (available.value || document.visibilityState !== 'visible') return
  try {
    const response = await fetch('/', { cache: 'no-store' })
    if (!response.ok) return
    const latest = entryOf(new DOMParser().parseFromString(await response.text(), 'text/html'))
    if (latest && latest !== current) {
      available.value = true
      stop()
    }
  } catch {
    /* Offline or mid-deploy; the next check tries again. */
  }
}
function stop() {
  document.removeEventListener('visibilitychange', check)
  clearInterval(timer)
}
onMounted(() => {
  // The dev server serves source modules, not a hashed build.
  if (import.meta.env.DEV || !current) return
  document.addEventListener('visibilitychange', check)
  timer = setInterval(check, CHECK_INTERVAL)
})
onUnmounted(stop)
const reload = () => location.reload()
</script>
<template>
  <Teleport to="body">
    <div class="update-host" role="status" aria-live="polite" aria-atomic="true">
      <Transition name="update">
        <div v-if="available" class="update-toast">
          <span>{{ $t('update.available') }}</span>
          <button type="button" class="primary" @click="reload">
            <RotateCw :size="15" />{{ $t('update.reload') }}
          </button>
          <button
            type="button"
            class="icon-button"
            :aria-label="$t('update.dismiss')"
            @click="available = false"
          >
            <X :size="17" />
          </button>
        </div>
      </Transition>
    </div>
  </Teleport>
</template>
<style scoped>
/* At the top, so it never covers a room notice at the bottom. */
.update-host {
  position: fixed;
  top: max(16px, env(safe-area-inset-top));
  left: 50%;
  transform: translateX(-50%);
  width: max-content;
  max-width: calc(100vw - 32px);
  z-index: 100;
  pointer-events: none;
}
.update-toast {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 10px 10px 18px;
  border: 1px solid var(--accent-border);
  background: var(--surface);
  color: var(--ink);
  box-shadow: 0 4px 18px #30263a18;
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.7;
  pointer-events: auto;
}
.update-toast .primary {
  flex-shrink: 0;
  padding: 7px 12px;
  gap: 6px;
}
.update-toast .icon-button {
  flex-shrink: 0;
}
.update-enter-active,
.update-leave-active {
  transition:
    opacity 0.15s,
    transform 0.15s;
}
.update-enter-from,
.update-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
@media (prefers-reduced-motion: reduce) {
  .update-enter-active,
  .update-leave-active {
    transition: none;
  }
}
</style>
