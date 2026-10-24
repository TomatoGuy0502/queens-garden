<script setup lang="ts">
import { usePlayerName } from '../composables/usePlayerName'
import { computed, onMounted, onUnmounted, shallowRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Clock3, Pause, Play, MousePointer2, LoaderCircle, LogOut } from '@lucide/vue'
import AppHeader from '../components/AppHeader.vue'
import PlayerPresence from '../components/coop/PlayerPresence.vue'
import RoomToast from '../components/coop/RoomToast.vue'
import RoomLobby from '../components/coop/RoomLobby.vue'
import QueensBoard from '../components/QueensBoard.vue'
import GameToolbar from '../components/GameToolbar.vue'
import GameResult from '../components/GameResult.vue'
import GameRules from '../components/GameRules.vue'
import GameShare from '../components/GameShare.vue'
import GamePreferences from '../components/GamePreferences.vue'
import { useRoomStore } from '../stores/room'
import { useCoopGameStore } from '../stores/game'
import { useGamePreferences } from '../composables/useGamePreferences'
const props = defineProps<{ roomId: string }>()
const room = useRoomStore(),
  game = useCoopGameStore(),
  router = useRouter()
const { guidance, storageAvailable } = useGamePreferences()
const name = usePlayerName()
const joining = shallowRef(false),
  joinError = shallowRef(''),
  pointMode = shallowRef(false),
  resetConfirm = shallowRef(false)
const labels = { easy: '輕鬆', medium: '適中', hard: '挑戰' }
const blocked = computed(() => !room.connected || game.state?.phase !== 'playing')
const canResume = computed(() => room.connected)
const mistakes = computed(() => [...new Set([...game.conflicts, ...(game.state?.mistakes ?? [])])])
const timer = setInterval(() => room.clock(), 200)
watch(
  () => props.roomId,
  (id) => {
    room.restore(id)
    joinError.value = ''
    pointMode.value = false
  },
  { immediate: true },
)
function clearHover() {
  room.hover(null)
}
function onVisibility() {
  if (document.hidden) clearHover()
}
onMounted(() => {
  window.addEventListener('blur', clearHover)
  document.addEventListener('visibilitychange', onVisibility)
})
onUnmounted(() => {
  window.removeEventListener('blur', clearHover)
  document.removeEventListener('visibilitychange', onVisibility)
  clearInterval(timer)
  room.close()
})
async function join() {
  joining.value = true
  joinError.value = ''
  try {
    await room.join(props.roomId, name.value.trim())
  } catch (reason) {
    joinError.value = (reason as Error).message
  } finally {
    joining.value = false
  }
}
function play(index: number) {
  if (pointMode.value) {
    room.point(index)
    pointMode.value = false
  } else void room.edit(index)
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
async function leave() {
  await room.leave()
  await router.push('/')
}
async function reset() {
  resetConfirm.value = false
  pointMode.value = false
  await room.send({ type: 'reset' })
}
</script>
<template>
  <RoomToast :notice="room.notice" @dismiss="room.dismissNotice" />
  <main class="page-shell coop-page">
    <AppHeader
      ><GamePreferences v-model="guidance" :storage-available="storageAvailable"
    /></AppHeader>
    <div class="room-heading">
      <div>
        <h1>多人合作</h1>
        <p>
          房間
          <span class="room-code" role="group" :aria-label="`房間代碼 ${roomId}`"
            ><span v-for="(digit, index) in roomId" :key="index" aria-hidden="true">{{
              digit
            }}</span></span
          >
        </p>
      </div>
      <div class="room-heading-actions">
        <GameShare :room-id="roomId" /><button
          v-if="room.credentials"
          class="text-button leave-button"
          @click="leave"
        >
          <LogOut :size="15" />離開
        </button>
      </div>
    </div>
    <section v-if="!room.room" class="join-panel">
      <h2>{{ room.connecting ? '正在重新連線…' : '加入合作房間' }}</h2>
      <form v-if="!room.connecting" class="room-form" @submit.prevent="join">
        <label for="guest-name">你的暱稱</label
        ><input
          id="guest-name"
          v-model="name"
          required
          maxlength="24"
          autocomplete="nickname"
        /><button class="primary" :disabled="joining || !name.trim()">
          {{ joining ? '加入中…' : '加入房間' }}
        </button>
      </form>
      <p v-if="joinError || room.error" role="alert" class="error-notice">
        {{ joinError || room.error }}
      </p>
    </section>
    <template v-else>
      <PlayerPresence
        :players="room.room.players"
        :me-id="room.credentials?.playerId"
        :hovers="room.hovers"
        :size="game.state?.puzzle?.size ?? 0" />
      <p v-if="!room.connected" class="connection-notice" role="status">
        連線中斷，正在重新連線。重新連線後會同步最新棋盤。
        <button class="text-button" @click="room.reconnect">重新連線</button>
      </p>
      <p v-if="room.error" class="error-notice" role="alert">{{ room.error }}</p>
      <div class="coop-layout">
        <section class="coop-play">
          <RoomLobby
            v-if="game.state?.phase === 'waiting'"
            :players="room.room.players"
            :settings="room.room.settings"
            :me-id="room.credentials!.playerId"
            :host-id="room.room.hostId"
            :can-start="room.canStart"
            :pending="!!room.pending || !room.connected"
            @configure="room.send({ type: 'configure', settings: $event })"
            @start="room.send({ type: 'start' })"
          />
          <div
            v-else-if="game.state?.phase === 'generating'"
            class="generating-panel"
            role="status"
          >
            <LoaderCircle :size="30" class="spinner" />
            <h2>正在產生合作關卡</h2>
            <p>驗證唯一解、區域大小與邏輯難度。</p>
          </div>
          <template v-else-if="game.state?.puzzle"
            ><div class="coop-meta">
              <div>
                <span class="difficulty-badge">{{ labels[game.state.puzzle.difficulty] }}</span
                ><span>{{ game.state.puzzle.size }} × {{ game.state.puzzle.size }}</span
                ><span>{{ game.queens.length }} / {{ game.state.puzzle.size }} 皇冠</span>
              </div>
              <div>
                <Clock3 :size="15" /><span>{{ game.time }}</span
                ><button
                  class="icon-button"
                  :disabled="
                    !room.connected ||
                    game.state.phase === 'completed' ||
                    (game.state.phase === 'paused' && !canResume)
                  "
                  :aria-label="game.state.phase === 'paused' ? '繼續合作' : '暫停合作'"
                  @click="pause"
                >
                  <Play v-if="game.state.phase === 'paused'" :size="16" /><Pause
                    v-else
                    :size="16"
                  />
                </button>
              </div>
            </div>
            <QueensBoard
              :puzzle="game.state.puzzle"
              :cells="game.state.cells"
              :guidance="guidance"
              :paused="game.state.phase === 'paused'"
              :won="game.state.phase === 'completed'"
              :busy="!room.connected"
              :can-resume="!!canResume"
              :pending-cells="room.pendingCells"
              :points="room.points"
              :hovers="room.peerHovers"
              :highlighted="game.state.hint?.step?.cells ?? []"
              :mistakes="mistakes"
              @hover="room.hover"
              @play="play"
              @mark="room.edit($event, true)"
              @resume="pause"
              ><template #result
                ><GameResult
                  :time="game.time"
                  :moves="game.state.moves"
                  :hints="game.state.hints"
                  :next-disabled="!room.isHost || !room.connected"
                  :next-label="room.isHost ? '開啟下一局 →' : '等待房主開啟下一局'"
                  @next="reset" /></template
            ></QueensBoard>
            <div class="point-tools">
              <button
                class="secondary"
                :aria-pressed="pointMode"
                :class="{ active: pointMode }"
                :disabled="blocked"
                @click="pointMode = !pointMode"
              >
                <MousePointer2 :size="16" />{{ pointMode ? '取消指示' : '指示格子' }}</button
              ><span>{{
                pointMode ? '點選一格，向隊友指出位置。' : '指示不會改變皇冠或 X。'
              }}</span>
            </div>
            <GameToolbar
              :blocked="blocked"
              :assisting="room.assisting"
              :can-undo="
                !!room.undoAction &&
                room.connected &&
                ['playing', 'completed'].includes(game.state.phase)
              "
              :can-redo="
                !!room.redoAction &&
                room.connected &&
                ['playing', 'completed'].includes(game.state.phase)
              "
              :can-restart="room.isHost && room.connected && !room.pending"
              @undo="undo"
              @redo="redo"
              @restart="resetConfirm = true"
              @hint="room.assist('hint')"
              @check="room.assist('check')"
            />
            <div v-if="resetConfirm" class="reset-confirm">
              <p>結束這一局並回到等待室？房主可以直接開始下一局。</p>
              <button class="text-button" @click="resetConfirm = false">取消</button
              ><button class="primary" @click="reset">回到等待室</button>
            </div>
            <div class="coop-feedback" role="status" aria-live="polite">
              <p v-if="game.state.message">{{ game.state.message }}</p>
              <button
                v-if="game.state.hint?.step && !blocked"
                class="text-button"
                @click="applyHint"
              >
                套用這一步 →
              </button>
              <p v-if="game.conflicts.length">皇冠有衝突，請檢查斜紋格子。</p>
            </div>
            <div class="coop-footer">
              SEED {{ game.state.puzzle.seed }} · v{{ game.state.puzzle.version }} · 難度分數
              {{ game.state.puzzle.difficultyScore }}
            </div>
          </template>
          <p
            v-if="game.state?.phase === 'waiting' && game.state.message"
            role="status"
            class="error-notice"
          >
            {{ game.state.message }}
          </p>
        </section>
        <aside class="coop-aside">
          <h2>合作操作</h2>
          <p>皇冠與 X 即時同步。Undo／Redo 只處理自己的操作，已有後續修改的格子不能覆蓋。</p>
          <p>隊友隨時可加入或離開，不會中斷棋盤或計時。</p>
          <p>視覺引導各自設定，不會改動隊友的偏好。</p>
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
  background: #fffdfa;
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
  background: #fffdfa;
}
.join-panel h2 {
  font-size: 20px;
  margin: 0 0 20px;
  font-weight: 550;
}
.connection-notice {
  padding: 12px;
  background: #f4ecd4;
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
.coop-meta,
.coop-meta > div {
  display: flex;
  align-items: center;
  gap: 12px;
}
.coop-meta {
  justify-content: space-between;
  margin-bottom: 16px;
  font-size: 11px;
  color: var(--muted);
}
.difficulty-badge {
  background: #eee7f3;
  color: var(--accent);
  padding: 5px 9px;
  border-radius: 4px;
}
.generating-panel {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 15px;
  border: 1px solid var(--line);
  background: #f0ecef;
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
.spinner {
  animation: spin 1.5s linear infinite;
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
  background: #eee7f3;
  border-color: #a48cb5;
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
.reset-confirm {
  padding: 16px;
  background: #eee7f3;
  font-size: 12px;
  line-height: 1.8;
}
.reset-confirm button {
  margin: 6px 12px 0 0;
}
.reset-confirm .primary {
  font-size: 12px;
  padding: 8px 12px;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@media (max-width: 750px) {
  .coop-layout {
    grid-template-columns: 1fr;
    gap: 30px;
  }
  .coop-aside {
    padding: 25px 0 0;
    border-left: 0;
    border-top: 1px solid var(--line);
  }
  .coop-meta,
  .coop-meta > div {
    gap: 7px;
  }
  .room-heading h1 {
    font-size: 24px;
  }
  .room-heading-actions {
    gap: 14px;
  }
}
</style>
