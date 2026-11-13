<script setup lang="ts">
import { maxPlayers } from '../../../shared/coop'
import type { Player, RoomMode, RoomSettings } from '../../../shared/coop'
import { Crown, Layers } from '@lucide/vue'
import { computed, shallowRef, watch } from 'vue'
import { BOARD_SIZES, DIFFICULTIES, boardLabel } from '../../queens/levels'
import { BOARD_SIZES_3D } from '../../queens3d/version'
import type { Difficulty } from '../../queens/types'
const props = defineProps<{
  mode: RoomMode
  players: Player[]
  settings: RoomSettings
  meId: string
  hostId: string
  canStart: boolean
  /** A change is on its way to the room; starting waits for it, editing does not. */
  pending: boolean
  connected: boolean
}>()
const emit = defineEmits<{ start: []; configure: [value: RoomSettings] }>()
// A change shows at once and gives way to the room's settings when the server has answered, or
// has refused: the round trip to the room's storage can take a moment.
const choice = shallowRef<RoomSettings | null>(null)
watch(
  () => props.pending,
  (busy) => {
    if (!busy) choice.value = null
  },
)
const view = computed(() => choice.value ?? props.settings)
const sizes = computed(() => (view.value.stacked ? BOARD_SIZES_3D : BOARD_SIZES))
// Expert has no measured threshold on stacked boards yet.
const difficulties = computed(() =>
  view.value.stacked ? DIFFICULTIES.filter((item) => item !== 'expert') : DIFFICULTIES,
)
const kinds = [
  { stacked: false, icon: Crown, label: 'coop.create.flat' },
  { stacked: true, icon: Layers, label: 'coop.create.stackedBoard' },
]
function configure(settings: RoomSettings) {
  choice.value = settings
  emit('configure', settings)
}
function board(stacked: boolean) {
  configure({
    ...view.value,
    stacked,
    size: stacked ? 5 : 8,
    difficulty: stacked && view.value.difficulty === 'expert' ? 'hard' : view.value.difficulty,
  })
}
function size(event: Event) {
  configure({
    ...view.value,
    size: Number((event.target as HTMLSelectElement).value) as RoomSettings['size'],
  })
}
function difficulty(event: Event) {
  configure({
    ...view.value,
    difficulty: (event.target as HTMLSelectElement).value as Difficulty,
  })
}
</script>
<template>
  <section class="lobby" aria-labelledby="lobby-title">
    <h2 id="lobby-title">
      {{ $t('coop.lobby.title') }}
      <span class="player-count">{{
        $t('coop.lobby.count', { count: players.length, max: maxPlayers(mode) })
      }}</span>
    </h2>
    <p class="page-description">
      {{
        mode === 'duel'
          ? $t('duel.lobby.intro')
          : $t('coop.lobby.intro', { max: maxPlayers('coop') })
      }}
    </p>
    <div class="players">
      <div v-for="player in players" :key="player.id" class="player-row">
        <span class="avatar">{{ Array.from(player.name)[0] }}</span>
        <div>
          <strong>{{ player.name }}{{ player.id === meId ? $t('coop.you') : '' }}</strong
          ><span v-if="player.id === hostId" class="host-label">{{ $t('coop.lobby.host') }}</span
          ><small>{{
            player.connected ? $t('coop.lobby.connected') : $t('coop.lobby.waiting')
          }}</small>
        </div>
      </div>
      <div v-if="players.length < maxPlayers(mode)" class="empty-seat">
        {{ mode === 'duel' ? $t('duel.lobby.invite') : $t('coop.lobby.invite') }}
      </div>
    </div>
    <div class="lobby-settings room-form">
      <fieldset
        v-if="mode === 'coop'"
        class="board-kinds"
        :disabled="meId !== hostId || !connected"
        :class="{ locked: meId !== hostId }"
      >
        <legend>{{ $t('coop.create.board') }}</legend>
        <label
          v-for="kind in kinds"
          :key="String(kind.stacked)"
          class="kind-card"
          :class="{ selected: !!view.stacked === kind.stacked }"
        >
          <input
            type="radio"
            name="board-kind"
            :checked="!!view.stacked === kind.stacked"
            @change="board(kind.stacked)"
          />
          <component :is="kind.icon" :size="22" aria-hidden="true" />
          <span>{{ $t(kind.label) }}</span>
          <span v-if="kind.stacked" class="badge">{{ $t('play.new') }}</span>
        </label>
      </fieldset>
      <label for="coop-size">{{ $t('coop.create.size') }}</label
      ><select
        id="coop-size"
        :value="view.size"
        :disabled="meId !== hostId || !connected"
        @change="size"
      >
        <option v-for="n in sizes" :key="n" :value="n">
          {{ boardLabel(n, view.stacked) }}
        </option></select
      ><label for="coop-difficulty">{{ $t('coop.create.difficulty') }}</label
      ><select
        id="coop-difficulty"
        :value="view.difficulty"
        :disabled="meId !== hostId || !connected"
        @change="difficulty"
      >
        <option v-for="item in difficulties" :key="item" :value="item">
          {{ $t(`difficulty.${item}`) }}
        </option>
      </select>
    </div>
    <div class="lobby-actions">
      <button
        v-if="meId === hostId"
        type="button"
        class="primary"
        :disabled="!canStart || pending"
        @click="emit('start')"
      >
        {{ mode === 'duel' ? $t('duel.lobby.start') : $t('coop.lobby.start') }}
      </button>
    </div>
    <p v-if="meId !== hostId" class="setting-note">
      {{ mode === 'duel' ? $t('duel.lobby.waitingHost') : $t('coop.lobby.waitingHost') }}
    </p>
  </section>
</template>
<style scoped>
.board-kinds {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}
.board-kinds legend {
  grid-column: 1 / -1;
  padding: 0;
  margin-bottom: 10px;
  font-size: 12px;
}
.kind-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 0;
  padding: 12px 14px;
  border: 1px solid var(--control-border);
  border-radius: 7px;
  background: var(--surface);
  color: var(--muted);
  font-size: 13px;
  cursor: pointer;
}
.kind-card.selected {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent);
}
.kind-card:has(:focus-visible) {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.board-kinds.locked .kind-card {
  cursor: default;
  opacity: 0.7;
}
.badge {
  margin-left: auto;
  padding: 3px 8px;
  border-radius: 4px;
  background: var(--accent);
  color: var(--surface);
  font-size: 10px;
  font-weight: 600;
  line-height: 1.4;
  letter-spacing: 1px;
}
/* The card is the control; the radio stays for keyboards and screen readers. */
.kind-card input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  border: 0;
  opacity: 0;
}
.lobby {
  padding: 28px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 7px;
}
.lobby h2 {
  font-size: 21px;
  font-weight: 550;
  margin: 0 0 14px;
}
.player-count {
  font-size: 12px;
  color: var(--muted);
  font-weight: 400;
  margin-left: 10px;
}
.players {
  margin: 24px 0;
}
.player-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 15px 0;
  border-bottom: 1px solid var(--line);
}
.player-row > div {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
.avatar {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  background: var(--accent-soft);
  color: var(--accent);
  width: 37px;
  height: 37px;
  border-radius: 50%;
  font-size: 14px;
}
.player-row strong {
  font-size: 13px;
  font-weight: 550;
}
.player-row small {
  display: block;
  color: var(--muted);
  font-size: 11px;
  margin-top: 3px;
}
.host-label {
  font-size: 9px;
  color: var(--accent);
  margin-left: 9px;
}

.empty-seat {
  padding: 20px 0;
  color: var(--muted);
  font-size: 12px;
}
.lobby-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 24px;
}
.setting-note {
  font-size: 11px;
  color: var(--muted);
  margin: 18px 0 0;
}
</style>
