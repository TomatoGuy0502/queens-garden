<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { failureMessage } from '../../shared/message'
import { useMessage } from '../i18n/message'
import { useRoute, useRouter } from 'vue-router'
import { usePlayerName } from '../composables/usePlayerName'
import RoomCodeInput from '../components/coop/RoomCodeInput.vue'
import { parseRoomCode } from '../../shared/roomCode'
import AppHeader from '../components/AppHeader.vue'
import { useRoomStore } from '../stores/room'
import type { RoomSettings } from '../../shared/coop'
import { BOARD_SIZES, DIFFICULTIES } from '../queens/levels'
import type { Difficulty } from '../queens/types'
const { t } = useI18n()
const render = useMessage()
const room = useRoomStore(),
  router = useRouter(),
  route = useRoute()
const duel = computed(() => route.query.mode === 'duel')
const name = usePlayerName()
const size = shallowRef<RoomSettings['size']>(8),
  difficulty = shallowRef<Difficulty>('easy'),
  code = shallowRef(''),
  busy = shallowRef(false),
  error = shallowRef('')
async function create() {
  busy.value = true
  error.value = ''
  try {
    const id = await room.create(
      name.value.trim(),
      { size: size.value, difficulty: difficulty.value },
      duel.value ? 'duel' : 'coop',
    )
    await router.push(`/rooms/${id}`)
  } catch (reason) {
    error.value = render(failureMessage(reason))
  } finally {
    busy.value = false
  }
}
async function join() {
  const id = parseRoomCode(code.value)
  if (!id) {
    error.value = t('coop.join.invalidCode')
    return
  }
  await router.push(`/rooms/${id}`)
}
</script>
<template>
  <main class="page-shell">
    <AppHeader />
    <h1>{{ duel ? $t('duel.title') : $t('coop.title') }}</h1>
    <div class="room-forms">
      <section>
        <h2>{{ $t('coop.create.heading') }}</h2>
        <p class="page-description">
          {{ duel ? $t('duel.createIntro') : $t('coop.create.intro') }}
        </p>
        <form class="room-form" @submit.prevent="create">
          <label for="player-name">{{ $t('coop.create.name') }}</label
          ><input
            id="player-name"
            v-model="name"
            required
            maxlength="24"
            autocomplete="nickname"
          /><label for="room-size">{{ $t('coop.create.size') }}</label
          ><select id="room-size" v-model="size">
            <option v-for="n in BOARD_SIZES" :key="n" :value="n">{{ n }} × {{ n }}</option></select
          ><label for="room-difficulty">{{ $t('coop.create.difficulty') }}</label
          ><select id="room-difficulty" v-model="difficulty">
            <option v-for="item in DIFFICULTIES" :key="item" :value="item">
              {{ $t(`difficulty.${item}`) }}
            </option></select
          ><button type="submit" class="primary" :disabled="busy || !name.trim()">
            {{ busy ? $t('coop.create.submitting') : $t('coop.create.submit') }}
          </button>
        </form>
      </section>
      <section>
        <h2>{{ $t('coop.join.heading') }}</h2>
        <form class="room-form" @submit.prevent="join">
          <RoomCodeInput v-model="code" />
          <button type="submit" class="secondary" :disabled="!parseRoomCode(code)">
            {{ $t('coop.join.go') }}
          </button>
        </form>
      </section>
    </div>
    <p v-if="error" class="error-notice" role="alert">{{ error }}</p>
  </main>
</template>
<style scoped>
h1 {
  font-size: 29px;
  font-weight: 500;
  margin: 40px 0 30px;
}
h2 {
  font-size: 19px;
  font-weight: 550;
  margin: 0 0 15px;
}
.room-forms {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 50px;
}
.room-forms > section + section {
  border-left: 1px solid var(--line);
  padding-left: 40px;
}
@media (max-width: 650px) {
  .room-forms {
    grid-template-columns: 1fr;
    gap: 32px;
  }
  .room-forms > section + section {
    border-left: 0;
    border-top: 1px solid var(--line);
    padding: 28px 0 0;
  }
}
</style>
