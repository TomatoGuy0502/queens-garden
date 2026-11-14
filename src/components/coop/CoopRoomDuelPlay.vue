<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMessage } from '../../i18n/message'
import GameMeta from '../GameMeta.vue'
import Queens3DBoard from '../Queens3DBoard.vue'
import QueensBoard from '../QueensBoard.vue'
import GameToolbar from '../GameToolbar.vue'
import GameResult from '../GameResult.vue'
import type { PuzzleDefinition } from '../../queens/types'
import { isPuzzle3d } from '../../queens3d/play'
import { DEFAULT_GUIDANCE } from '../../queens/guidance'
import { boardLabel } from '../../queens/levels'
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
const puzzle = computed(() => game.state!.puzzle!)
const stacked = computed(() => isPuzzle3d(puzzle.value))
// The stacked board takes the flat board's props and events.
const board = computed(() => (stacked.value ? Queens3DBoard : QueensBoard))
// Crowns on a full board, which is where a progress bar ends.
const total = computed(() => puzzle.value.size ** (stacked.value ? 2 : 1))
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
// A rematch starts once both players ask; each sees whether they, or the other, already did.
const opponent = computed(() => room.room?.players.find((p) => p.id !== meId.value))
const rematch = computed(() => {
  const votes = game.state?.duel?.rematch ?? []
  if (!opponent.value) return { label: t('duel.rematch.alone'), disabled: true, note: '' }
  const asked = votes.includes(opponent.value.id)
  return votes.includes(meId.value ?? '')
    ? {
        label: t('duel.rematch.waiting', { name: opponent.value.name }),
        disabled: true,
        note: '',
      }
    : {
        label: asked ? t('duel.rematch.accept') : t('duel.rematch.ask'),
        disabled: false,
        note: asked ? t('duel.rematch.asked', { name: opponent.value.name }) : '',
      }
})
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
  <GameMeta
    :difficulty="puzzle.difficulty"
    :size="boardLabel(puzzle.size, stacked)"
    :time="game.time"
  />
  <ul class="duel-progress">
    <li v-for="racer in racers" :key="racer.id">
      <span class="duel-name">{{ racer.name }}{{ racer.id === meId ? $t('coop.you') : '' }}</span>
      <div
        class="duel-track"
        role="progressbar"
        :aria-label="$t('duel.progress.label', { name: racer.name })"
        aria-valuemin="0"
        :aria-valuemax="total"
        :aria-valuenow="racer.count"
        :data-player-id="racer.id"
      >
        <i :style="{ width: `${(racer.count / total) * 100}%` }"></i>
      </div>
      <span class="duel-count">{{
        $t('duel.progress.value', { count: racer.count, size: total })
      }}</span>
    </li>
  </ul>
  <component
    :is="board"
    :puzzle="puzzle as PuzzleDefinition"
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
        :next-disabled="rematch.disabled || !room.connected || !!room.pending"
        :next-label="rematch.label"
        @review="reviewing = true"
        @next="room.send({ type: 'rematch' })"
        ><p v-if="rematch.note" class="rematch-note" role="status">
          {{ rematch.note }}
        </p></GameResult
      ></template
    ></component
  >
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
.rematch-note {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--accent);
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
</style>
