<script setup lang="ts">
import { shallowRef, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { LogIn, UserRound, X } from '@lucide/vue'
import { useAccount } from '../composables/useAccount'
import { usePlayerName } from '../composables/usePlayerName'
import { useMessage } from '../i18n/message'
import { LocalizedError, errorMessage, type Message } from '../../shared/message'
const { enabled, account, signIn, signOut, setNickname, deleteAccount } = useAccount()
const { t } = useI18n()
const render = useMessage()
const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const nickname = shallowRef('')
const busy = shallowRef(false)
const error = shallowRef<Message | null>(null)
const playerName = usePlayerName()
function open() {
  nickname.value = account.value?.nickname ?? playerName.value
  error.value = null
  dialog.value?.showModal()
}
// A first sign-in has no public name yet; ask for one straight away.
watch(account, (value) => {
  if (value && !value.nickname) open()
})
async function run(action: () => Promise<unknown>) {
  busy.value = true
  error.value = null
  try {
    await action()
    return true
  } catch (failure) {
    error.value =
      failure instanceof LocalizedError ? failure.localized : errorMessage('SERVER_ERROR')
    return false
  } finally {
    busy.value = false
  }
}
async function save() {
  if (await run(() => setNickname(nickname.value))) dialog.value?.close()
}
async function leave() {
  if (await run(signOut)) dialog.value?.close()
}
async function remove() {
  if (!confirm(t('account.deleteConfirm'))) return
  if (await run(deleteAccount)) dialog.value?.close()
}
// A click on the dialog itself, outside its box, can only have landed on the backdrop.
function closeOnBackdrop(event: MouseEvent) {
  const element = dialog.value
  if (!element || event.target !== element) return
  const box = element.getBoundingClientRect()
  if (
    event.clientX < box.left ||
    event.clientX > box.right ||
    event.clientY < box.top ||
    event.clientY > box.bottom
  )
    element.close()
}
</script>
<template>
  <template v-if="enabled">
    <button v-if="!account" type="button" class="text-button account-button" @click="run(signIn)">
      <LogIn :size="17" /><span>{{ $t('account.signIn') }}</span>
    </button>
    <button
      v-else
      type="button"
      class="text-button account-button"
      :aria-label="$t('account.open')"
      @click="open"
    >
      <img v-if="account.image" :src="account.image" alt="" referrerpolicy="no-referrer" />
      <UserRound v-else :size="18" /><span>{{ account.nickname ?? $t('account.open') }}</span>
    </button>
    <p v-if="error && !account" class="account-error" role="alert">{{ render(error) }}</p>
    <dialog
      ref="dialog"
      class="account-dialog"
      aria-labelledby="account-title"
      @click="closeOnBackdrop"
    >
      <div class="account-header">
        <h2 id="account-title">{{ $t('account.title') }}</h2>
        <button
          type="button"
          class="icon-button"
          :aria-label="$t('account.close')"
          @click="dialog?.close()"
        >
          <X :size="19" />
        </button>
      </div>
      <form class="room-form" @submit.prevent="save">
        <label for="account-nickname">{{ $t('account.nickname') }}</label>
        <input
          id="account-nickname"
          v-model="nickname"
          required
          maxlength="24"
          autocomplete="nickname"
          aria-describedby="account-nickname-note"
        />
        <small id="account-nickname-note">{{ $t('account.nicknameNote') }}</small>
        <p v-if="error" class="account-error" role="alert">{{ render(error) }}</p>
        <button type="submit" class="primary" :disabled="busy">{{ $t('account.save') }}</button>
      </form>
      <div class="account-actions">
        <button type="button" class="text-button" :disabled="busy" @click="leave">
          {{ $t('account.signOut') }}
        </button>
        <button type="button" class="text-button danger" :disabled="busy" @click="remove">
          {{ $t('account.delete') }}
        </button>
      </div>
    </dialog>
  </template>
</template>
<style scoped>
.account-button {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 36px;
  max-width: 160px;
}
.account-button span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.account-button:hover {
  color: var(--accent);
}
.account-button img {
  width: 22px;
  height: 22px;
  border-radius: 50%;
}
.account-dialog {
  width: min(400px, calc(100% - 36px));
  max-height: calc(100dvh - 36px);
  overflow-y: auto;
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
.account-dialog::backdrop {
  background: var(--backdrop);
}
.account-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}
.account-header h2 {
  margin: 0;
  font-size: 19px;
  font-weight: 550;
}
small {
  color: var(--muted);
  font-size: 11px;
}
.account-error {
  margin: 0;
  color: var(--error);
}
.account-actions {
  display: flex;
  justify-content: space-between;
  margin-top: 22px;
  padding-top: 16px;
  border-top: 1px solid var(--line);
}
.danger {
  color: var(--error);
}
@media (max-width: 650px) {
  .account-button span {
    display: none;
  }
}
</style>
