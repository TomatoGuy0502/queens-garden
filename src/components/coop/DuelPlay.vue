<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { Clock3 } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import { useMessage } from '../../i18n/message'
import QueensBoard from '../QueensBoard.vue'
import GameToolbar from '../GameToolbar.vue'
import GameResult from '../GameResult.vue'
import type { PuzzleDefinition } from '../../queens/types'
import { DEFAULT_GUIDANCE } from '../../queens/guidance'
import { duelProgress } from '../../queens/duel'
import { useCoopGameStore } from '../../stores/game'
import { useDuelStore } from '../../stores/duel'
import { useRoomStore } from '../../stores/room'
const emit = defineEmits<{ change: [] }>()
const { t } = useI18n()
const render = useMessage()
const room = useRoomStore(),
  game = useCoopGameStore(),
  duel = useDuelStore()
const reviewing = shallowRef(false)
watch([() => game.state?.id, () => game.state?.phase], () => {
  reviewing.value = false
})
// A duel is always on the flat board.
const puzzle = computed(() => game.state!.puzzle! as PuzzleDefinition)
const meId = computed(() => room.credentials?.playerId)
const finished = computed(() => game.state?.phase === 'completed')
const racers = computed(() =>
  (room.room?.players ?? []).map((player) => ({
    ...player,
    // The viewer's own bar follows their board at once; the opponent's comes from the server.
    count:
      player.id === meId.value
        ? duelProgress(duel.cells, puzzle.value.size)
        : (game.state?.duel?.progress[player.id] ?? 0),
  })),
)
const winner = computed(() => room.room?.players.find((p) => p.id === game.state?.duel?.winnerId))
const won = computed(() => winner.value?.id === meId.value)
const summary = computed(() =>
  won.value
    ? t('duel.result.winTime', { time: game.time })
    : t('duel.result.loseTime', { name: winner.value?.name ?? '', time: game.time }),
)
// Exclusion hints would hand a duelist the answer, so the saved preference is never applied.
const guidance = { ...DEFAULT_GUIDANCE, enabled: false }
const idle = computed(() => !room.connected || game.state?.phase !== 'playing')
</script>
<template>
  <div class="duel-meta">
    <div>
      <span class="difficulty-badge">{{ $t(`difficulty.${puzzle.difficulty}`) }}</span
      ><span>{{ puzzle.size }} × {{ puzzle.size }}</span>
    </div>
    <div>
      <Clock3 :size="15" /><span>{{ game.time }}</span>
    </div>
  </div>
  <ul class="duel-progress">
    <li v-for="racer in racers" :key="racer.id">
      <span class="duel-name">{{ racer.name }}{{ racer.id === meId ? $t('coop.you') : '' }}</span>
      <div
        class="duel-track"
        role="progressbar"
        :aria-label="$t('duel.progress.label', { name: racer.name })"
        aria-valuemin="0"
        :aria-valuemax="puzzle.size"
        :aria-valuenow="racer.count"
        :data-player-id="racer.id"
      >
        <i :style="{ width: `${(racer.count / puzzle.size) * 100}%` }"></i>
      </div>
      <span class="duel-count">{{
        $t('duel.progress.value', { count: racer.count, size: puzzle.size })
      }}</span>
    </li>
  </ul>
  <QueensBoard
    :puzzle="puzzle"
    :cells="duel.cells"
    :guidance="guidance"
    :paused="false"
    :won="finished"
    :reviewing="reviewing"
    :busy="!room.connected"
    :highlighted="[]"
    :mistakes="[]"
    @end-review="reviewing = false"
    @play="duel.edit($event)"
    @mark="duel.edit($event, 'mark')"
    @crown="duel.edit($event, 'queen')"
    ><template #result
      ><GameResult
        :time="game.time"
        :title="won ? $t('duel.result.win') : $t('duel.result.lose')"
        :summary="summary"
        :next-disabled="!room.isHost || !room.connected"
        :next-label="room.isHost ? $t('coop.room.next') : $t('coop.room.waitHost')"
        @review="reviewing = true"
        @next="room.send({ type: 'reset' })" /></template
  ></QueensBoard>
  <GameToolbar
    duel
    :blocked="idle"
    :assisting="false"
    :can-undo="!idle && duel.past.length > 0"
    :can-redo="!idle && duel.future.length > 0"
    :can-restart="false"
    @undo="duel.undo"
    @redo="duel.redo"
  />
  <button
    v-if="room.isHost"
    type="button"
    class="text-button change-round"
    :disabled="!room.connected || !!room.pending"
    @click="emit('change')"
  >
    {{ $t('coop.room.changeRound') }}
  </button>
  <p v-if="game.state?.message" class="duel-notice" role="status" aria-live="polite">
    {{ render(game.state.message) }}
  </p>
</template>
<style scoped>
.duel-meta,
.duel-meta > div {
  display: flex;
  align-items: center;
  gap: 12px;
}
.duel-meta {
  justify-content: space-between;
  margin-bottom: 16px;
  font-size: 11px;
  color: var(--muted);
}
.difficulty-badge {
  background: var(--accent-soft);
  color: var(--accent);
  padding: 5px 9px;
  border-radius: 4px;
}
.duel-progress {
  list-style: none;
  margin: 0 0 18px;
  padding: 0;
  display: grid;
  gap: 10px;
}
.duel-progress li {
  display: grid;
  grid-template-columns: minmax(70px, 120px) 1fr auto;
  align-items: center;
  gap: 12px;
  font-size: 12px;
}
.duel-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.duel-track {
  height: 8px;
  border-radius: 4px;
  background: var(--line);
  overflow: hidden;
}
.duel-track > i {
  display: block;
  height: 100%;
  background: var(--accent);
  transition: width 0.2s;
}
.duel-count {
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
.change-round {
  margin-top: 14px;
}
.duel-notice {
  font-size: 12px;
  line-height: 1.9;
  margin: 16px 0;
}
@media (max-width: 750px) {
  .duel-meta,
  .duel-meta > div {
    gap: 7px;
  }
}
</style>
