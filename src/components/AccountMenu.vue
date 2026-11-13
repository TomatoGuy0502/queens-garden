<script setup lang="ts">
import { shallowRef, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { UserRound } from '@lucide/vue'
import BaseModalDialog from './BaseModalDialog.vue'
import { useAccount } from '../composables/useAccount'
import { usePlayerName } from '../composables/usePlayerName'
import { useMessage } from '../i18n/message'
import { LocalizedError, errorMessage, type Message } from '../../shared/message'
const { enabled, account, ready, signIn, signOut, setNickname, deleteAccount } = useAccount()
const { t } = useI18n()
const render = useMessage()
const dialog = useTemplateRef('dialog')
const nickname = shallowRef('')
const busy = shallowRef(false)
const error = shallowRef<Message | null>(null)
const playerName = usePlayerName()
function open() {
  nickname.value = account.value?.nickname ?? playerName.value
  error.value = null
  dialog.value?.showModal()
}
// A player without a public name is asked for one on every visit; the dialog only exists once
// `ready` has rendered it, hence the post flush.
watch(
  [ready, account],
  ([isReady, value]) => {
    if (isReady && value && !value.nickname) open()
  },
  { flush: 'post' },
)
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
</script>
<template>
  <!-- Holds the button's place while the session loads, so the header does not jump. -->
  <span v-if="!ready" class="account-placeholder" aria-hidden="true"></span>
  <template v-else-if="enabled">
    <button
      v-if="!account"
      type="button"
      class="text-button account-button"
      :aria-label="$t('account.signIn')"
      @click="run(signIn)"
    >
      <UserRound :size="18" /><span>{{ $t('account.signIn') }}</span>
    </button>
    <button
      v-else
      type="button"
      class="text-button account-button"
      :aria-label="$t('account.open')"
      :title="account.nickname ?? undefined"
      @click="open"
    >
      <img v-if="account.image" :src="account.image" alt="" referrerpolicy="no-referrer" />
      <UserRound v-else :size="18" /><span>{{ account.nickname ?? $t('account.open') }}</span>
    </button>
    <p v-if="error && !account" class="account-error" role="alert">{{ render(error) }}</p>
    <BaseModalDialog
      ref="dialog"
      class="account-dialog"
      :title="$t('account.title')"
      :close-label="$t('account.close')"
      :width="400"
    >
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
    </BaseModalDialog>
  </template>
</template>
<style scoped>
.account-button {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 36px;
  max-width: 140px;
}
.account-button span {
  /* A flex item only shrinks below its text, and so truncates a long nickname, with this. */
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.account-placeholder {
  width: 32px;
  height: 36px;
}
.account-button:hover {
  color: var(--accent);
}
.account-button img {
  width: 22px;
  height: 22px;
  border-radius: 50%;
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
/* A long, truncated nickname fits from about 780px in the widest locale; below that, icon only. */
@media (max-width: 800px) {
  .account-button {
    width: 32px;
    justify-content: center;
  }
  .account-button span {
    display: none;
  }
}
</style>
