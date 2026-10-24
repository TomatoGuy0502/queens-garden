<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef, watch } from 'vue'
import { Clock3, Pause, Play, LoaderCircle } from '@lucide/vue'
import CrownIcon from './CrownIcon.vue'
import QueensBoard from './QueensBoard.vue'
import GameSettings from './GameSettings.vue'
import GameToolbar from './GameToolbar.vue'
import GameRules from './GameRules.vue'
import GameResult from './GameResult.vue'
import GameShare from './GameShare.vue'
import GamePreferences from './GamePreferences.vue'
import LanguageSwitcher from './LanguageSwitcher.vue'
import ThemeToggle from './ThemeToggle.vue'
import DailyChallenge from './DailyChallenge.vue'
import TutorialPrompt from './TutorialPrompt.vue'
import ResumePrompt from './ResumePrompt.vue'
import { useGamePreferences } from '../composables/useGamePreferences'
import { useGameStats } from '../composables/useGameStats'
import { useProgressAutosave } from '../composables/useProgressAutosave'
import { useSoloProgress } from '../composables/useSoloProgress'
import { restoreProgress, sameGame, type SavedProgress } from '../queens/progress'
import {
  DAILY_MAX_ATTEMPTS,
  dailyConfig,
  dailySeed,
  dailyStreak,
  dateKey,
  isDailyPuzzle,
  isDateKey,
} from '../queens/daily'
import { useSoloGameStore } from '../stores/solo'
import { storeToRefs } from 'pinia'
import { GENERATOR_VERSION } from '../queens/version'
import { DIFFICULTIES, DIFFICULTY_LABELS } from '../queens/levels'
import type { Difficulty } from '../queens/types'
const game = useSoloGameStore()
useProgressAutosave(game)
const progress = useSoloProgress()
onUnmounted(() => game.$dispose())
const { guidance, expandedBoard, storageAvailable } = useGamePreferences()
const {
  puzzle,
  cells,
  busy,
  assisting,
  paused,
  time,
  seconds,
  attempt,
  daily,
  queens,
  conflicts,
  won,
  history,
  future,
  moves,
  hints,
  error,
  hint,
  hintLevel,
  hintRevealed,
  hintCells,
  feedback,
  mistakes,
  blocked,
} = storeToRefs(game)
const params = new URLSearchParams(location.search)
const requestedSize = Number(params.get('size') ?? 8)
const initialSize = [6, 7, 8, 9, 10, 12].includes(requestedSize) ? requestedSize : 8
const requestedDifficulty = params.get('difficulty')
const initialDifficulty: Difficulty =
  DIFFICULTIES.find((difficulty) => difficulty === requestedDifficulty) ?? 'easy'
const displayDifficulty = shallowRef<Difficulty>(initialDifficulty)
const requestedSeed = params.get('seed')
const initialSeed =
  requestedSeed !== null && /^\d+$/.test(requestedSeed) && Number(requestedSeed) <= 0xffffffff
    ? Number(requestedSeed)
    : crypto.getRandomValues(new Uint32Array(1))[0]
const dailyParam = params.get('daily')
// A link only counts as today's challenge when it really is today's board; old days stay closed.
const linkedDaily =
  isDateKey(dailyParam) &&
  dailyParam === dateKey() &&
  isDailyPuzzle(dailyParam, {
    size: initialSize,
    difficulty: initialDifficulty,
    seed: initialSeed,
  })
    ? dailyParam
    : null
const versionMismatch = shallowRef(params.has('v') && params.get('v') !== GENERATOR_VERSION)
const restartConfirm = shallowRef(false)
const reviewing = shallowRef(false)
watch([won, () => puzzle.value?.id], () => {
  reviewing.value = false
})
const { record: recordStats, stats } = useGameStats()
const lastRecord = shallowRef<{
  newBest: boolean
  previousBest: number | null
  streak?: number
} | null>(null)
let scored = ''
// Score each attempt once; undo then redo of the final move must not count as a new win.
watch(won, (isWon) => {
  const current = puzzle.value
  if (!isWon || !current) return
  const key = `${current.id}#${attempt.value}`
  if (scored === key) return
  scored = key
  const { newBest, previousBest } = recordStats({
    size: current.size,
    difficulty: current.difficulty,
    seconds: seconds.value,
    moves: moves.value,
    hints: hints.value,
    daily: daily.value ?? undefined,
  })
  lastRecord.value = {
    newBest,
    previousBest,
    streak: daily.value ? dailyStreak(stats.value.dailies, daily.value) : undefined,
  }
})
watch(
  () => `${puzzle.value?.id}#${attempt.value}`,
  () => {
    lastRecord.value = null
  },
)
const difficulties = DIFFICULTY_LABELS
const highlighted = computed(() => (paused.value ? [] : hintCells.value))
const allMistakes = computed(() => [...new Set([...conflicts.value, ...mistakes.value])])
// The daily challenge is a fixed board, so its page offers no settings until the player leaves it.
const inDaily = shallowRef(false)
// An unfinished game found in storage, waiting for the player to continue or discard it.
const pendingResume = shallowRef<SavedProgress | null>(null)
function startGame(
  size: number,
  difficulty: Difficulty,
  seed: number,
  dailyDate: string | null = null,
  saved?: SavedProgress,
) {
  pendingResume.value = null
  inDaily.value = dailyDate !== null
  displayDifficulty.value = difficulty
  versionMismatch.value = false
  restartConfirm.value = false
  return game.newGame(size, difficulty, seed, dailyDate, saved && restoreProgress(saved))
}
function resume(saved: SavedProgress) {
  // Only today's challenge keeps its daily label; an older unfinished day is a normal puzzle.
  const dailyDate = saved.daily === dateKey() ? saved.daily : null
  return startGame(saved.size, saved.difficulty, saved.seed, dailyDate, saved)
}
function discardSaved() {
  progress.clear()
  void startGame(initialSize, initialDifficulty, initialSeed)
}
async function startDaily() {
  const key = dateKey()
  const { size, difficulty } = dailyConfig(key)
  // A seed can exhaust the generation budget; everyone walks the same fixed fallback seeds.
  for (let attempt = 0; attempt < DAILY_MAX_ATTEMPTS; attempt++) {
    const status = await startGame(size, difficulty, dailySeed(key, attempt), key)
    if (status !== 'failed') return
  }
}
function confirmRestart() {
  game.restart()
  restartConfirm.value = false
}
function nextGame() {
  void startGame(
    puzzle.value?.size ?? initialSize,
    puzzle.value?.difficulty ?? initialDifficulty,
    crypto.getRandomValues(new Uint32Array(1))[0],
  )
}
onMounted(() => {
  const saved = progress.read()
  if (dailyParam === 'today') {
    const today = dateKey()
    if (saved?.daily === today && isDailyPuzzle(today, saved)) void resume(saved)
    else void startDaily()
  } else if (versionMismatch.value) return
  else if (
    saved &&
    params.has('seed') &&
    sameGame(saved, { size: initialSize, difficulty: initialDifficulty, seed: initialSeed })
  )
    void resume(saved)
  // Without a specific puzzle in the link, ask before replacing the unfinished game.
  else if (saved && !params.has('seed')) pendingResume.value = saved
  else void startGame(initialSize, initialDifficulty, initialSeed, linkedDaily)
})
</script>
<template>
  <div class="app-shell">
    <header class="site-header">
      <RouterLink to="/" class="brand" aria-label="Queens 首頁"
        ><span class="brand-icon"><CrownIcon /></span
        ><span>queens<span class="brand-dot">.</span></span></RouterLink
      >
      <div class="header-actions">
        <RouterLink to="/tutorial" class="text-button coop-link">新手教學</RouterLink>
        <RouterLink to="/stats" class="text-button coop-link">我的成績</RouterLink>
        <RouterLink to="/rooms/new" class="text-button coop-link">多人合作</RouterLink>
        <LanguageSwitcher />
        <ThemeToggle />
        <GamePreferences v-model="guidance" :storage-available="storageAvailable" />
      </div>
    </header>
    <main>
      <div class="page-intro"><h1>Queens 益智遊戲</h1></div>
      <div class="game-layout" :class="{ expanded: expandedBoard }">
        <section class="play-area" aria-label="遊戲區域" :aria-busy="busy">
          <div class="game-meta">
            <div class="puzzle-meta">
              <span v-if="daily" class="difficulty-badge daily-badge">每日挑戰</span
              ><span class="difficulty-badge">{{ difficulties[displayDifficulty] }}</span
              ><span class="board-size"
                >{{ puzzle?.size ?? initialSize }} × {{ puzzle?.size ?? initialSize }}</span
              ><span v-if="puzzle" class="queen-count"
                ><CrownIcon /> {{ queens.length }}<span>/ {{ puzzle.size }}</span></span
              >
            </div>
            <div class="timer">
              <Clock3 :size="15" /><span>{{ time }}</span
              ><button
                class="icon-button pause-button"
                :aria-label="paused ? '繼續遊戲' : '暫停遊戲'"
                :disabled="!puzzle || busy || won"
                @click="game.togglePause"
              >
                <Play v-if="paused" :size="15" /><Pause v-else :size="15" />
              </button>
            </div>
          </div>
          <div v-if="versionMismatch" class="empty-board">
            <CrownIcon />
            <h2>此連結使用不同版本的生成器</h2>
            <p>
              目前版本 {{ GENERATOR_VERSION }} 無法保證重現舊版本的關卡。請從右側設定開始新遊戲。
            </p>
          </div>
          <ResumePrompt
            v-else-if="pendingResume"
            :saved="pendingResume"
            @resume="resume(pendingResume)"
            @discard="discardSaved"
          />
          <div v-else-if="busy" class="empty-board" role="status">
            <div class="generating-art">
              <CrownIcon /><LoaderCircle class="spinner" :size="21" />
            </div>
            <h2>正在產生關卡</h2>
            <p>生成區域、驗證唯一解，再評估邏輯難度。</p>
            <span class="loading-bars"><i></i><i></i><i></i></span>
          </div>
          <QueensBoard
            v-else-if="puzzle"
            :key="puzzle.id"
            :puzzle="puzzle"
            :cells="cells"
            :guidance="guidance"
            :paused="paused"
            :won="won"
            :reviewing="reviewing"
            :highlighted="highlighted"
            :mistakes="allMistakes"
            :busy="busy"
            @end-review="reviewing = false"
            @play="game.edit($event)"
            @mark="game.edit($event, 'mark')"
            @resume="game.togglePause"
          >
            <template #result>
              <GameResult
                :time="time"
                :moves="moves"
                :hints="hints"
                :record="lastRecord ?? undefined"
                :next-label="inDaily ? '自由遊玩 →' : undefined"
                @next="nextGame"
                @review="reviewing = true"
              />
            </template>
          </QueensBoard>
          <div v-else class="empty-board">
            <CrownIcon />
            <h2>尚未開始遊戲</h2>
            <p>選擇棋盤大小與難度後開始。</p>
          </div>
          <div v-if="error" class="error-notice" role="alert">{{ error }}</div>
          <GameToolbar
            :blocked="blocked || !puzzle"
            :assisting="assisting"
            :hint-level="hintLevel"
            :hint-revealed="hintRevealed"
            :can-restart="!!puzzle && !busy"
            :can-undo="!!history.length && !busy && !paused && !reviewing"
            :can-redo="!!future.length && !busy && !paused && !reviewing"
            @undo="game.undo"
            @redo="game.redo"
            @restart="restartConfirm = true"
            @hint="game.assist('hint')"
            @check="game.assist('check')"
          />
          <div v-if="restartConfirm" class="restart-confirm">
            <p>清空棋盤並重新計時？</p>
            <div>
              <button class="text-button" @click="restartConfirm = false">繼續這局</button
              ><button class="primary" @click="confirmRestart">重新開始</button>
            </div>
          </div>
          <div
            :class="{ 'has-feedback': feedback || conflicts.length }"
            class="feedback"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <template v-if="feedback"
              ><span class="feedback-label">{{
                hint ? `邏輯提示 ${hintLevel} / 3` : '遊戲訊息'
              }}</span>
              <p>{{ feedback }}</p>
              <details v-if="hintRevealed && hint?.evidence?.length" class="hint-evidence">
                <summary>展開假設推理的 {{ hint.evidence.length }} 個步驟</summary>
                <ol>
                  <li v-for="(step, index) in hint.evidence" :key="index">{{ step.reason }}</li>
                </ol>
              </details>
              <button
                v-if="hintRevealed && !blocked"
                class="text-button apply-hint"
                @click="game.applyHint"
              >
                套用這一步 →
              </button></template
            >
            <p v-else-if="conflicts.length">皇冠有衝突。請檢查紅色斜紋的格子。</p>
          </div>
          <div v-if="puzzle" class="puzzle-footer">
            <span
              >SEED {{ puzzle.seed }} <span class="dot-separator">·</span> v{{ puzzle.version }}
              <span class="dot-separator">·</span> 難度分數 {{ puzzle.difficultyScore }}</span
            >
            <GameShare :puzzle="puzzle" />
          </div>
        </section>
        <aside class="side-panel">
          <button v-if="inDaily" class="text-button free-play" :disabled="busy" @click="nextGame">
            離開每日挑戰，自由遊玩
          </button>
          <template v-else>
            <TutorialPrompt />
            <DailyChallenge class="daily-panel" in-game :busy="busy" @start="startDaily" />
            <GameSettings
              :busy="busy"
              :initial-size="initialSize"
              :initial-difficulty="initialDifficulty"
              :initial-seed="initialSeed"
              :current-seed="puzzle?.seed"
              @start="startGame"
              @cancel="game.cancelGeneration"
            />
          </template>
          <GameRules />
        </aside>
      </div>
    </main>
  </div>
</template>
<style scoped>
.app-shell {
  max-width: 1096px;
  margin: 0 auto;
  padding: 0 44px 44px;
}
.site-header {
  height: 104px;
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--line);
  gap: 28px;
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--ink);
  font-family: Georgia, serif;
  font-size: 34px;
  font-weight: 600;
  letter-spacing: -1.7px;
  text-decoration: none;
}
.brand-icon {
  width: 30px;
  height: 34px;
}
.brand-dot {
  color: var(--accent);
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-left: auto;
}
.page-intro {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 0;
}
.page-intro h1 {
  font-family: 'Iowan Old Style', 'Noto Serif TC', serif;
  font-weight: 500;
  font-size: 35px;
  letter-spacing: 2px;
  margin: 16px 0;
}
.game-layout {
  display: grid;
  grid-template-columns: minmax(0, 548px) minmax(230px, 1fr);
  gap: 65px;
  align-items: start;
}
.side-panel {
  padding-left: 31px;
  border-left: 1px solid var(--line);
}
.game-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 0 0 17px;
  height: 29px;
}
.puzzle-meta {
  display: flex;
  align-items: center;
  gap: 12px;
}
.difficulty-badge {
  font-size: 10px;
  color: var(--accent);
  background: var(--accent-soft);
  padding: 5px 11px;
  border-radius: 4px;
}
.daily-badge {
  color: var(--surface);
  background: var(--accent);
}
.daily-panel {
  margin-bottom: 27px;
}
.free-play {
  display: block;
  margin: 0 auto 27px;
}
.board-size {
  font-size: 12px;
  color: var(--muted);
  letter-spacing: 1px;
}
.queen-count {
  display: flex;
  gap: 6px;
  align-items: center;
  font:
    12px ui-monospace,
    monospace;
  color: var(--accent);
}
.queen-count svg {
  width: 15px;
  height: 17px;
}
.queen-count > span {
  color: var(--muted);
}
.timer {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--muted);
}
.timer > span {
  font:
    13px ui-monospace,
    monospace;
  color: var(--ink);
  min-width: 42px;
}
.pause-button {
  width: 25px !important;
  height: 27px !important;
  margin-left: 4px;
}
.feedback {
  font-size: 12px;
  line-height: 1.9;
}
.has-feedback {
  padding: 18px 2px;
}
.feedback p {
  margin: 5px 0;
}
.hint-evidence {
  margin: 12px 0;
  font-size: 11px;
  color: var(--muted);
}
.hint-evidence summary {
  cursor: pointer;
}
.hint-evidence ol {
  padding-left: 20px;
}
.hint-evidence li {
  margin: 8px 0;
}
.feedback-label {
  font-size: 10px;
  color: var(--accent);
  letter-spacing: 1px;
}
.apply-hint {
  margin-top: 6px;
  color: var(--accent) !important;
}
.puzzle-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font:
    9px ui-monospace,
    monospace;
  color: var(--muted);
  padding: 19px 0;
  border-top: 1px solid var(--line);
}
.dot-separator {
  margin: 0 5px;
}
.empty-board {
  width: 100%;
  aspect-ratio: 1;
  border: 1px solid var(--line);
  border-radius: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  background: var(--subtle);
  padding: 30px;
  text-align: center;
}
.empty-board > svg,
.generating-art > svg:first-child {
  width: 49px;
  height: 49px;
  color: var(--accent);
}
.empty-board h2 {
  font-size: 18px;
  font-weight: 500;
  margin-top: 26px;
}
.empty-board p {
  font-size: 11px;
  color: var(--muted);
  line-height: 1.9;
}
.generating-art {
  display: flex;
  align-items: center;
  gap: 19px;
}
.spinner {
  animation: spin 1.4s linear infinite;
  color: var(--accent);
}
.loading-bars {
  display: flex;
  gap: 5px;
  margin-top: 18px;
}
.loading-bars i {
  width: 5px;
  height: 5px;
  background: var(--accent);
  border-radius: 50%;
  animation: pulse 1.4s ease-in-out infinite;
}
.loading-bars i:nth-child(2) {
  animation-delay: 0.2s;
}
.loading-bars i:nth-child(3) {
  animation-delay: 0.4s;
}
.error-notice {
  font-size: 12px;
  line-height: 1.9;
  border: 1px solid var(--error-border);
  background: var(--error-bg);
  padding: 12px;
  margin: 15px 0;
  border-radius: 5px;
  color: var(--error);
}
.restart-confirm {
  padding: 17px;
  background: var(--accent-soft);
  margin-top: 17px;
  border-radius: 5px;
}
.restart-confirm p {
  margin: 0 0 12px;
  font-size: 12px;
}
.restart-confirm > div {
  display: flex;
  justify-content: flex-end;
  gap: 15px;
}
.restart-confirm .primary {
  font-size: 12px;
  padding: 8px 13px;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@keyframes pulse {
  50% {
    opacity: 0.25;
  }
}
.game-layout.expanded {
  display: flex;
  flex-direction: column;
  gap: 28px;
}
.game-layout.expanded > .play-area,
.game-layout.expanded > .side-panel {
  width: 100%;
}
.game-layout.expanded > .side-panel {
  border-left: 0;
  padding-left: 0;
  border-top: 1px solid var(--line);
  padding-top: 28px;
}
@media (min-width: 1200px) {
  .app-shell {
    max-width: 1140px;
  }
  .game-layout {
    grid-template-columns: minmax(0, 550px) minmax(230px, 1fr);
    gap: 77px;
  }
  .side-panel {
    padding-left: 37px;
  }
}
@media (max-width: 800px) {
  .app-shell {
    padding: 0 25px;
  }
  .game-layout {
    gap: 30px;
    grid-template-columns: minmax(0, 1fr) 235px;
  }
  .side-panel {
    padding-left: 22px;
  }
  .page-intro h1 {
    font-size: 30px;
  }
  .puzzle-meta {
    gap: 8px;
  }
}
@media (max-width: 650px) {
  .app-shell {
    padding: 0 18px;
  }
  .header-actions {
    flex: 1 1 auto;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 6px 12px;
  }
  .coop-link {
    white-space: nowrap;
  }
  .site-header {
    flex-wrap: wrap;
    gap: 4px 12px;
    height: auto;
    min-height: 78px;
    padding: 10px 0;
  }
  .brand {
    font-size: 30px;
  }
  .brand-icon {
    width: 26px;
  }
  .page-intro {
    padding: 20px 0;
  }
  .page-intro h1 {
    font-size: 28px;
    letter-spacing: 1px;
  }
  .game-layout {
    display: flex;
    flex-direction: column;
    gap: 28px;
  }
  .play-area,
  .side-panel {
    width: 100%;
  }
  .side-panel {
    border-left: 0;
    padding-left: 0;
    border-top: 1px solid var(--line);
    padding-top: 28px;
    display: grid;
    grid-template-columns: 1fr;
    gap: 0;
  }
  .game-meta {
    margin-bottom: 13px;
  }
  .puzzle-footer {
    font-size: 8px;
  }
  .queen-count {
    font-size: 11px;
  }
  .empty-board h2 {
    font-size: 16px;
  }
}
</style>
