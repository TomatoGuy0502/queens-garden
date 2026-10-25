import { useEventListener } from '@vueuse/core'
import { onBeforeRouteLeave } from 'vue-router'

/**
 * Asks the browser to confirm before the page goes away while `active()` is true: closing or
 * reloading the tab uses the browser's own prompt, and in-app navigation uses a confirm window.
 */
export function useLeaveGuard(active: () => boolean, message: () => string) {
  let allowed = false
  const guarded = () => active() && !allowed
  function beforeUnload(event: BeforeUnloadEvent) {
    if (!guarded()) return
    // Browsers ignore custom text here; preventing the default is what raises their prompt.
    event.preventDefault()
    event.returnValue = ''
  }
  useEventListener(window, 'beforeunload', beforeUnload)
  onBeforeRouteLeave(() => !guarded() || window.confirm(message()))
  return {
    /** Confirm now, so an explicit leave button does not ask a second time on navigation. */
    confirmLeave(): boolean {
      if (!active() || window.confirm(message())) {
        allowed = true
        return true
      }
      return false
    },
  }
}
