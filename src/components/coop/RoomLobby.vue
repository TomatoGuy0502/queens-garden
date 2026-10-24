<script setup lang="ts">
import { MAX_ROOM_PLAYERS } from '../../../shared/coop'
import type { Player, RoomSettings } from '../../../shared/coop'
import type { Difficulty } from '../../queens/types'
const props = defineProps<{
  players: Player[]
  settings: RoomSettings
  meId: string
  hostId: string
  canStart: boolean
  pending: boolean
}>()
const emit = defineEmits<{ start: []; configure: [value: RoomSettings] }>()
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
      等待室 <span class="player-count">{{ players.length }} / {{ MAX_ROOM_PLAYERS }} 人</span>
    </h2>
    <p class="page-description">最多 {{ MAX_ROOM_PLAYERS }} 人。房主可直接開始，隊友可隨時加入。</p>
    <div class="players">
      <div v-for="player in players" :key="player.id" class="player-row">
        <span class="avatar">{{ Array.from(player.name)[0] }}</span>
        <div>
          <strong>{{ player.name }}{{ player.id === meId ? '（你）' : '' }}</strong
          ><span v-if="player.id === hostId" class="host-label">房主</span
          ><small>{{ player.connected ? '已連線' : '等待連線' }}</small>
        </div>
      </div>
      <div v-if="players.length < MAX_ROOM_PLAYERS" class="empty-seat">可繼續邀請隊友加入</div>
    </div>
    <div class="lobby-settings room-form">
      <label for="coop-size">棋盤大小</label
      ><select
        id="coop-size"
        :value="settings.size"
        :disabled="meId !== hostId || pending"
        @change="size"
      >
        <option v-for="n in [6, 7, 8, 9, 10, 12]" :key="n" :value="n">
          {{ n }} × {{ n }}
        </option></select
      ><label for="coop-difficulty">難度</label
      ><select
        id="coop-difficulty"
        :value="settings.difficulty"
        :disabled="meId !== hostId || pending"
        @change="difficulty"
      >
        <option value="easy">輕鬆</option>
        <option value="medium">適中</option>
        <option value="hard">挑戰</option>
      </select>
    </div>
    <div class="lobby-actions">
      <button
        v-if="meId === hostId"
        class="primary"
        :disabled="!canStart || pending"
        @click="emit('start')"
      >
        開始合作
      </button>
    </div>
    <p v-if="meId !== hostId" class="setting-note">等待房主開始，或分享房間連結邀請其他隊友。</p>
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
