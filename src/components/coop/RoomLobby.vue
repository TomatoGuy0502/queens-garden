<script setup lang="ts">
import { maxPlayers } from '../../../shared/coop'
import type { Player, RoomMode, RoomSettings } from '../../../shared/coop'
import { computed } from 'vue'
import { BOARD_SIZES, DIFFICULTIES } from '../../queens/levels'
import { BOARD_SIZES_3D } from '../../queens3d/version'
import type { Difficulty } from '../../queens/types'
const props = defineProps<{
  mode: RoomMode
  players: Player[]
  settings: RoomSettings
  meId: string
  hostId: string
  canStart: boolean
  pending: boolean
}>()
const emit = defineEmits<{ start: []; configure: [value: RoomSettings] }>()
const sizes = computed(() => (props.settings.stacked ? BOARD_SIZES_3D : BOARD_SIZES))
// Expert has no measured threshold on stacked boards yet.
const difficulties = computed(() =>
  props.settings.stacked ? DIFFICULTIES.filter((item) => item !== 'expert') : DIFFICULTIES,
)
function board(event: Event) {
  const stacked = (event.target as HTMLSelectElement).value === 'stacked'
  emit('configure', {
    ...props.settings,
    stacked,
    size: stacked ? 5 : 8,
    difficulty:
      stacked && props.settings.difficulty === 'expert' ? 'hard' : props.settings.difficulty,
  })
}
function size(event: Event) {
  emit('configure', {
    ...props.settings,
    size: Number((event.target as HTMLSelectElement).value) as RoomSettings['size'],
  })
}
function difficulty(event: Event) {
  emit('configure', {
    ...props.settings,
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
      <template v-if="mode === 'coop'"
        ><label for="coop-board">{{ $t('coop.create.board') }}</label
        ><select
          id="coop-board"
          :value="settings.stacked ? 'stacked' : 'flat'"
          :disabled="meId !== hostId || pending"
          @change="board"
        >
          <option value="flat">{{ $t('coop.create.flat') }}</option>
          <option value="stacked">{{ $t('coop.create.stackedBoard') }}</option>
        </select></template
      >
      <label for="coop-size">{{ $t('coop.create.size') }}</label
      ><select
        id="coop-size"
        :value="settings.size"
        :disabled="meId !== hostId || pending"
        @change="size"
      >
        <option v-for="n in sizes" :key="n" :value="n">
          {{ n }} × {{ n }}{{ settings.stacked ? ` × ${n}` : '' }}
        </option></select
      ><label for="coop-difficulty">{{ $t('coop.create.difficulty') }}</label
      ><select
        id="coop-difficulty"
        :value="settings.difficulty"
        :disabled="meId !== hostId || pending"
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
