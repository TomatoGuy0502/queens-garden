<script setup lang="ts">
import { computed } from 'vue'
import type { Hover, Player } from '../../../shared/coop'
const props = defineProps<{ players: Player[]; meId?: string; hovers: Hover[]; size: number }>()
const positions = computed(
  () =>
    new Map(
      props.hovers
        .filter((hover) => hover.index !== null)
        .map((hover) => [hover.playerId, hover.index!]),
    ),
)
function position(id: string) {
  const index = positions.value.get(id)
  return index === undefined || !props.size
    ? '位置 —'
    : `停在 ${Math.floor(index / props.size) + 1},${(index % props.size) + 1}`
}
</script>
<template>
  <div class="presence-bar" aria-label="房間玩家">
    <span v-for="player in players" :key="player.id" :class="{ offline: !player.connected }">
      <i aria-hidden="true"></i>{{ player.name }}{{ player.id === meId ? '（你）' : '' }}
      <small>{{ player.connected ? '已連線' : '離線' }}</small>
      <small class="hover-position" :data-player-id="player.id">{{ position(player.id) }}</small>
    </span>
  </div>
</template>
<style scoped>
.presence-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 20px;
  padding: 15px 0;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  margin-bottom: 28px;
}
.presence-bar > span {
  min-width: 0;
  overflow-wrap: anywhere;
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
}
.presence-bar i {
  width: 6px;
  height: 6px;
  flex-shrink: 0;
  background: #6d987e;
  border-radius: 50%;
}
.presence-bar .offline i {
  background: #aaa;
}
.presence-bar small {
  font-size: 10px;
  color: var(--muted);
}
.hover-position {
  width: 66px;
  flex-shrink: 0;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
</style>
