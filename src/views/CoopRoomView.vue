<script setup lang="ts">
import { usePlayerName } from '../composables/usePlayerName'
import { computed, onUnmounted, shallowRef, watch } from 'vue'
import { useEventListener, useIntervalFn } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { failureMessage } from '../../shared/message'
import type { RoomMode } from '../../shared/coop'
import type { PuzzleDefinition } from '../queens/types'
import { useMessage } from '../i18n/message'
import { useRouter } from 'vue-router'
import { Pause, Play, MousePointer2, LoaderCircle, LogOut } from '@lucide/vue'
import AppHeader from '../components/AppHeader.vue'
import PlayerPresence from '../components/coop/PlayerPresence.vue'
import RoundConfirmation from '../components/coop/RoundConfirmation.vue'
import RoomToast from '../components/coop/RoomToast.vue'
import RoomLobby from '../components/coop/RoomLobby.vue'
import DuelPlay from '../components/coop/DuelPlay.vue'
import GameMeta from '../components/GameMeta.vue'
import HintFeedback from '../components/HintFeedback.vue'
import QueensBoard from '../components/QueensBoard.vue'
import Queens3DBoard from '../components/Queens3DBoard.vue'
import GameToolbar from '../components/GameToolbar.vue'
import GameResult from '../components/GameResult.vue'
import GameRules from '../components/GameRules.vue'
import GameShare from '../components/GameShare.vue'
import { HINT_LEVELS, hintView } from '../queens/strategies'
import { boardLabel } from '../queens/levels'
import { hintView3d, isPuzzle3d } from '../queens3d/play'
import { useLeaveGuard } from '../composables/useLeaveGuard'
import { useRoomStore } from '../stores/room'
import { useCoopGameStore } from '../stores/game'
import { useGamePreferences } from '../composables/useGamePreferences'
const props = defineProps<{ roomId: string }>()
const { t } = useI18n()
const render = useMessage()
const room = useRoomStore(),
  game = useCoopGameStore(),
  router = useRouter()
const { guidance, expandedBoard } = useGamePreferences()
const name = usePlayerName()
// Before joining, the room's mode comes from a lookup by code; afterwards from the room itself.
const knownMode = shallowRef<RoomMode | null>(null)
const duel = computed(() => (room.room?.mode ?? knownMode.value) === 'duel')
const joining = shallowRef(false),
  joinError = shallowRef(''),
  pointMode = shallowRef(false)
const reviewing = shallowRef(false)
const stacked = computed(() => !!room.room?.settings.stacked)
// The stacked board takes the flat board's props and events.
const board = computed(() =>
  game.state?.puzzle && isPuzzle3d(game.state.puzzle) ? Queens3DBoard : QueensBoard,
)
watch([() => game.state?.id, () => game.state?.phase], () => {
  reviewing.value = false
})
const confirmation = shallowRef<{ kind: 'restart' | 'new'; gameId: string } | null>(null)
const blocked = computed(() => !room.connected || game.state?.phase !== 'playing')
const canResume = computed(() => room.connected)
// The shared hint is revealed in levels; the whole room sees the same level.
const hintInfo = computed(() => {
  const shared = game.state?.hint
  const puzzle = game.state?.puzzle
  if (!shared?.step || !puzzle) return null
  return isPuzzle3d(puzzle)
    ? hintView3d(shared.step, shared.level, puzzle.regions)
    : hintView(shared.step, shared.level, puzzle.regions)
})
const hintLevel = computed(() => (hintInfo.value ? game.state!.hint!.level : 0))
const hintRevealed = computed(() => hintLevel.value >= HINT_LEVELS)
const feedback = computed(() => hintInfo.value?.text ?? game.state?.message ?? null)
const mistakes = computed(() => [...new Set([...game.conflicts, ...(game.state?.mistakes ?? [])])])
useIntervalFn(() => room.clock(), 200)
watch(
  () => props.roomId,
  (id) => {
    knownMode.value = null
    fetch(`/api/rooms/${encodeURIComponent(id)}`)
      .then((response) => (response.ok ? (response.json() as Promise<{ mode: RoomMode }>) : null))
      .then((found) => {
        if (id === props.roomId && found) knownMode.value = found.mode
      })
      .catch(() => undefined)
    room.restore(id)
    joinError.value = ''
    pointMode.value = false
  },
  { immediate: true },
)
watch(
  () => game.state?.id,
  () => {
    confirmation.value = null
    pointMode.value = false
  },
)
watch(
  () => room.isHost && room.connected,
  (allowed) => {
    if (!allowed) confirmation.value = null
  },
)
function confirmRound(kind: 'restart' | 'new') {
  if (game.state && room.isHost && room.connected && !room.pending)
    confirmation.value = { kind, gameId: game.state.id }
}
async function applyRoundAction() {
  const context = confirmation.value
  if (!context) return
  const applied = await room.send({
    type: context.kind === 'restart' ? 'restart' : 'reset',
    gameId: context.gameId,
  })
  if (applied && confirmation.value === context) confirmation.value = null
}
function clearHover() {
  room.hover(null)
}
function onVisibility() {
  if (document.hidden) clearHover()
}
useEventListener(window, 'blur', clearHover)
useEventListener(document, 'visibilitychange', onVisibility)
onUnmounted(() => room.close())
async function join() {
  joining.value = true
  joinError.value = ''
  try {
    await room.join(props.roomId, name.value.trim())
  } catch (reason) {
    joinError.value = render(failureMessage(reason))
  } finally {
    joining.value = false
  }
}
function play(index: number) {
  // Pointing is a mode the player switches off again, so several cells can be shown in a row.
  if (pointMode.value) room.point(index)
  else void room.edit(index)
}
function pause() {
  if (game.state)
    void room.send({ type: 'pause', gameId: game.state.id, paused: game.state.phase !== 'paused' })
}
function undo() {
  if (game.state && room.undoAction)
    void room.send({ type: 'undo', gameId: game.state.id, targetId: room.undoAction.id })
}
function redo() {
  if (game.state && room.redoAction)
    void room.send({ type: 'redo', gameId: game.state.id, targetId: room.redoAction.id })
}
function applyHint() {
  if (game.state?.hint?.step)
    void room.send({ type: 'applyHint', gameId: game.state.id, hintId: game.state.hint.id })
}
// A joined player who closes the page cannot come back as the same player, so ask first.
const guard = useLeaveGuard(
  () => !!room.me,
  () => (duel.value ? t('duel.leaveConfirm') : t('coop.room.leaveConfirm')),
)
async function leave() {
  if (!guard.confirmLeave()) return
  await room.leave()
  await router.push('/')
}
async function reset() {
  pointMode.value = false
  await room.send({ type: 'reset' })
}
</script>
<template>
  <RoomToast :notice="room.notice" @dismiss="room.dismissNotice" />
  <RoundConfirmation
    v-if="confirmation"
    :kind="confirmation.kind"
    :busy="!!room.pending"
    @confirm="applyRoundAction"
    @cancel="confirmation = null"
  />
  <main class="page-shell coop-page">
    <AppHeader />
    <div class="room-heading">
      <div>
        <h1>{{ duel ? $t('duel.title') : $t('coop.title') }}</h1>
        <p>
          {{ $t('coop.room.label') }}
          <span class="room-code" role="group" :aria-label="$t('coop.code.group', { code: roomId })"
            ><span v-for="(digit, index) in roomId" :key="index" aria-hidden="true">{{
              digit
            }}</span></span
          >
        </p>
      </div>
      <div class="room-heading-actions">
        <GameShare :room-id="roomId" /><button
          v-if="room.credentials"
          type="button"
          class="text-button leave-button"
          @click="leave"
        >
          <LogOut :size="15" />{{ $t('coop.room.leave') }}
        </button>
      </div>
    </div>
    <section v-if="!room.room" class="join-panel">
      <h2>{{ room.connecting ? $t('coop.join.reconnecting') : $t('coop.join.panel') }}</h2>
      <form v-if="!room.connecting" class="room-form" @submit.prevent="join">
        <label for="guest-name">{{ $t('coop.create.name') }}</label
        ><input
          id="guest-name"
          v-model="name"
          required
          maxlength="24"
          autocomplete="nickname"
        /><button type="submit" class="primary" :disabled="joining || !name.trim()">
          {{ joining ? $t('coop.join.submitting') : $t('coop.join.submit') }}
        </button>
      </form>
      <p v-if="joinError || room.error" role="alert" class="error-notice">
        {{ joinError || render(room.error) }}
      </p>
    </section>
    <template v-else>
      <PlayerPresence
        :players="room.room.players"
        :me-id="room.credentials?.playerId"
        :hovers="room.hovers"
        :size="game.state?.puzzle?.size ?? 0"
        :stacked="stacked"
        :show-position="!duel" />
      <p v-if="!room.connected" class="connection-notice" role="status">
        {{ $t('coop.room.disconnected') }}
        <button type="button" class="text-button" @click="room.reconnect">
          {{ $t('coop.room.reconnect') }}
        </button>
      </p>
      <p v-if="room.error" class="error-notice" role="alert">{{ render(room.error) }}</p>
      <div class="coop-layout" :class="{ expanded: expandedBoard || stacked }">
        <section class="coop-play">
          <RoomLobby
            v-if="game.state?.phase === 'waiting'"
            :mode="room.room.mode"
            :players="room.room.players"
            :settings="room.room.settings"
            :me-id="room.credentials!.playerId"
            :host-id="room.room.hostId"
            :can-start="room.canStart"
            :pending="!!room.pending"
            :connected="room.connected"
            @configure="room.send({ type: 'configure', settings: $event })"
            @start="room.send({ type: 'start' })"
          />
          <div
            v-else-if="game.state?.phase === 'generating'"
            class="generating-panel"
            role="status"
          >
            <LoaderCircle :size="30" class="spinner" />
            <h2>{{ duel ? $t('duel.generating') : $t('coop.room.generating.title') }}</h2>
            <p>{{ $t('coop.room.generating.body') }}</p>
          </div>
          <DuelPlay v-else-if="duel && game.state?.puzzle" @change="confirmRound('new')" />
          <template v-else-if="game.state?.puzzle"
            ><GameMeta
              :difficulty="game.state.puzzle.difficulty"
              :size="boardLabel(game.state.puzzle.size, stacked)"
              :time="game.time"
            >
              <span class="crown-count">{{
                $t('coop.room.crowns', {
                  count: game.crowns,
                  size: game.state.puzzle.size ** (stacked ? 2 : 1),
                })
              }}</span>
              <template #actions>
                <button
                  type="button"
                  class="icon-button"
                  :disabled="
                    !room.connected ||
                    game.state.phase === 'completed' ||
                    (game.state.phase === 'paused' && !canResume)
                  "
                  :aria-label="
                    game.state.phase === 'paused' ? $t('coop.room.resume') : $t('coop.room.pause')
                  "
                  @click="pause"
                >
                  <Play v-if="game.state.phase === 'paused'" :size="16" /><Pause
                    v-else
                    :size="16"
                  />
                </button>
              </template>
            </GameMeta>
            <component
              :is="board"
              :puzzle="game.state.puzzle as PuzzleDefinition"
              :cells="game.cells"
              :guidance="guidance"
              :paused="game.state.phase === 'paused'"
              :won="game.state.phase === 'completed'"
              :reviewing="reviewing"
              :busy="!room.connected"
              :can-resume="!!canResume"
              :pending-cells="room.pendingCells"
              :points="room.points"
              :hovers="room.peerHovers"
              :highlighted="hintInfo?.cells ?? []"
              :mistakes="mistakes"
              @end-review="reviewing = false"
              @hover="room.hover"
              @play="play"
              @mark="room.edit($event, 'mark')"
              @crown="room.edit($event, 'queen')"
              @resume="pause"
              ><template #result
                ><GameResult
                  :time="game.time"
                  :moves="game.state.moves"
                  :hints="game.state.hints"
                  :next-disabled="!room.isHost || !room.connected"
                  :next-label="room.isHost ? $t('coop.room.next') : $t('coop.room.waitHost')"
                  @review="reviewing = true"
                  @next="reset" /></template
            ></component>
            <div class="point-tools">
              <button
                type="button"
                class="secondary"
                :aria-pressed="pointMode"
                :class="{ active: pointMode }"
                :disabled="blocked"
                @click="pointMode = !pointMode"
              >
                <MousePointer2 :size="16" />{{
                  pointMode ? $t('coop.point.end') : $t('coop.point.start')
                }}</button
              ><span>{{ $t(pointMode ? 'coop.point.active' : 'coop.point.idle') }}</span>
            </div>
            <GameToolbar
              :blocked="blocked"
              :assisting="room.assisting"
              :can-undo="
                !reviewing &&
                !!room.undoAction &&
                room.connected &&
                ['playing', 'completed'].includes(game.state.phase)
              "
              :can-redo="
                !reviewing &&
                !!room.redoAction &&
                room.connected &&
                ['playing', 'completed'].includes(game.state.phase)
              "
              :can-restart="room.isHost && room.connected && !room.pending"
              :hint-level="hintLevel"
              :hint-revealed="hintRevealed"
              @undo="undo"
              @redo="redo"
              @restart="confirmRound('restart')"
              @hint="room.assist('hint')"
              @check="room.assist('check')"
            />
            <button
              v-if="room.isHost"
              type="button"
              class="text-button change-round"
              :disabled="!room.connected || !!room.pending"
              @click="confirmRound('new')"
            >
              {{ $t('coop.room.changeRound') }}
            </button>
            <div class="coop-feedback" role="status" aria-live="polite">
              <HintFeedback
                v-if="feedback"
                :text="feedback"
                :label="hintInfo ? $t('game.feedback.hint', { level: hintLevel }) : undefined"
                :evidence="hintRevealed ? game.state.hint?.step?.evidence : undefined"
                :can-apply="hintRevealed && !blocked"
                @apply="applyHint"
              />
              <p v-if="game.conflicts.length">{{ $t('coop.room.conflict') }}</p>
            </div>
            <div class="coop-footer">
              SEED {{ game.state.puzzle.seed }} · v{{ game.state.puzzle.version }} ·
              {{ $t('game.score', { score: game.state.puzzle.difficultyScore }) }}
            </div>
          </template>
          <p
            v-if="game.state?.phase === 'waiting' && game.state.message"
            role="status"
            class="error-notice"
          >
            {{ render(game.state.message) }}
          </p>
        </section>
        <aside class="coop-aside">
          <template v-if="duel">
            <h2>{{ $t('duel.aside.title') }}</h2>
            <p>{{ $t('duel.aside.race') }}</p>
            <p>{{ $t('duel.aside.progress') }}</p>
            <p>{{ $t('duel.aside.nohelp') }}</p>
            <p>{{ $t('duel.aside.leave') }}</p>
          </template>
          <template v-else>
            <h2>{{ $t('coop.room.aside.title') }}</h2>
            <p>{{ $t('coop.room.aside.sync') }}</p>
            <p>{{ $t('coop.room.aside.join') }}</p>
            <p>{{ $t('coop.room.aside.guidance') }}</p>
          </template>
          <GameRules />
        </aside></div
    ></template>
  </main>
</template>
<style scoped>
.room-heading {
  display: flex;
  justify-content: space-between;
  gap: 15px;
  align-items: center;
  margin-bottom: 25px;
}
.room-heading h1 {
  font-size: 28px;
  font-weight: 500;
  margin: 0 0 10px;
}
.room-heading p {
  font-size: 11px;
  color: var(--muted);
  margin: 0;
}
.room-code {
  display: inline-flex;
  gap: 4px;
  margin-left: 5px;
  vertical-align: middle;
  font-family: ui-monospace, monospace;
}
.room-code > span {
  display: grid;
  place-items: center;
  width: 22px;
  height: 27px;
  border: 1px solid var(--line);
  border-radius: 3px;
  background: var(--surface);
  font-size: 13px;
  color: var(--ink);
}
.room-heading-actions {
  display: flex;
  gap: 20px;
  align-items: center;
}
.leave-button {
  display: flex;
  gap: 7px;
  align-items: center;
}
.join-panel {
  max-width: 420px;
  padding: 26px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: var(--surface);
}
.join-panel h2 {
  font-size: 20px;
  margin: 0 0 20px;
  font-weight: 550;
}
.connection-notice {
  padding: 12px;
  background: var(--warning-bg);
  font-size: 12px;
  line-height: 1.8;
}
.coop-layout {
  display: grid;
  grid-template-columns: minmax(0, 550px) minmax(220px, 1fr);
  gap: 55px;
}
.coop-aside {
  border-left: 1px solid var(--line);
  padding-left: 28px;
}
.coop-aside h2 {
  font-size: 17px;
  font-weight: 550;
  margin-top: 0;
}
.coop-aside > p {
  font-size: 12px;
  line-height: 1.9;
  color: var(--muted);
}
.crown-count {
  font-size: 12px;
  color: var(--muted);
}
.generating-panel {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 15px;
  border: 1px solid var(--line);
  background: var(--subtle);
  border-radius: 6px;
  color: var(--muted);
}
.generating-panel h2 {
  font-size: 18px;
  color: var(--ink);
  margin: 0;
}
.generating-panel p {
  font-size: 12px;
}
.point-tools {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 18px;
}
.point-tools > span {
  font-size: 11px;
  color: var(--muted);
}
.point-tools .active {
  background: var(--accent-soft);
  border-color: var(--accent-border);
}
.coop-feedback {
  font-size: 12px;
  line-height: 1.9;
}
.coop-feedback p {
  margin: 16px 0;
}
.coop-footer {
  font:
    9px ui-monospace,
    monospace;
  color: var(--muted);
  padding: 18px 0;
  border-top: 1px solid var(--line);
}
.change-round {
  margin-top: 14px;
}
.coop-layout.expanded {
  grid-template-columns: minmax(0, 1fr);
  gap: 30px;
}
.coop-layout.expanded > .coop-aside {
  padding: 25px 0 0;
  border-left: 0;
  border-top: 1px solid var(--line);
}
@media (max-width: 750px) {
  .coop-layout {
    grid-template-columns: minmax(0, 1fr);
    gap: 30px;
  }
  .coop-aside {
    padding: 25px 0 0;
    border-left: 0;
    border-top: 1px solid var(--line);
  }
  .room-heading h1 {
    font-size: 24px;
  }
  .room-heading-actions {
    gap: 14px;
  }
}
</style>
