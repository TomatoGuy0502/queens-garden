<script setup lang="ts">
import { computed, onMounted, shallowRef } from 'vue'
import { Clock3, Pause, Play, ArrowUpRight, Flower2, Check, Copy, LoaderCircle } from '@lucide/vue'
import CrownIcon from './CrownIcon.vue'
import QueensBoard from './QueensBoard.vue'
import GameSettings from './GameSettings.vue'
import GameToolbar from './GameToolbar.vue'
import GameRules from './GameRules.vue'
import GameResult from './GameResult.vue'
import { useQueensGame } from '../composables/useQueensGame'
import { GENERATOR_VERSION } from '../queens/generator'
import type { Difficulty } from '../queens/types'
const game = useQueensGame()
const {
  puzzle,
  cells,
  busy,
  assisting,
  paused,
  time,
  mode,
  queens,
  conflicts,
  won,
  history,
  future,
  moves,
  hints,
  message,
  error,
  hint,
  mistakes,
  blocked,
} = game
const params = new URLSearchParams(location.search)
const requestedSize = Number(params.get('size') ?? 8)
const initialSize = [6, 7, 8, 9, 10, 12].includes(requestedSize) ? requestedSize : 8
const requestedDifficulty = params.get('difficulty')
const initialDifficulty: Difficulty =
  requestedDifficulty === 'medium' || requestedDifficulty === 'hard' ? requestedDifficulty : 'easy'
const requestedSeed = params.get('seed')
const initialSeed =
  requestedSeed !== null && /^\d+$/.test(requestedSeed) && Number(requestedSeed) <= 0xffffffff
    ? Number(requestedSeed)
    : crypto.getRandomValues(new Uint32Array(1))[0]
const versionMismatch = shallowRef(params.has('v') && params.get('v') !== GENERATOR_VERSION)
const restartConfirm = shallowRef(false),
  copied = shallowRef(false)
const difficulties = { easy: '輕鬆', medium: '適中', hard: '挑戰' }
const highlighted = computed(() => (paused.value ? [] : (hint.value?.cells ?? [])))
const allMistakes = computed(() => [...new Set([...conflicts.value, ...mistakes.value])])
async function copyLink() {
  try {
    await navigator.clipboard.writeText(location.href)
    copied.value = true
  } catch {
    message.value = '無法自動複製，請從網址列複製關卡連結。'
  }
}
function startGame(size: number, difficulty: Difficulty, seed: number) {
  versionMismatch.value = false
  copied.value = false
  restartConfirm.value = false
  return game.newGame(size, difficulty, seed)
}
function confirmRestart() {
  game.restart()
  restartConfirm.value = false
}
function nextGame() {
  if (puzzle.value)
    void startGame(
      puzzle.value.size,
      puzzle.value.difficulty,
      crypto.getRandomValues(new Uint32Array(1))[0],
    )
}
onMounted(() => {
  if (!versionMismatch.value) void startGame(initialSize, initialDifficulty, initialSeed)
})
</script>
<template>
  <div class="app-shell">
    <header class="site-header">
      <a href="/" class="brand" aria-label="Queens 首頁"
        ><span class="brand-icon"><CrownIcon /></span
        ><span>queens<span class="brand-dot">.</span></span></a
      ><span class="brand-tagline">A LITTLE SPACE FOR YOUR MIND</span
      ><a class="how-to" href="#rules">玩法說明 <ArrowUpRight :size="14" /></a>
    </header>
    <main>
      <div class="page-intro">
        <div>
          <p class="eyebrow">THE LOGIC GARDEN <span class="intro-line"></span> 邏輯花園</p>
          <h1>給思緒，一點空間。</h1>
          <p class="intro-description">放慢腳步，用一點邏輯，安放每一頂皇冠。</p>
        </div>
        <Flower2 class="intro-flower" :size="61" :stroke-width="0.8" aria-hidden="true" />
      </div>
      <div class="game-layout">
        <section class="play-area" aria-label="遊戲區域" :aria-busy="busy">
          <div class="game-meta">
            <div class="puzzle-meta">
              <span class="difficulty-badge">{{
                puzzle ? difficulties[puzzle.difficulty] : '準備中'
              }}</span
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
          <div v-else-if="busy" class="empty-board" role="status">
            <div class="generating-art">
              <CrownIcon /><LoaderCircle class="spinner" :size="21" />
            </div>
            <h2>一個新的謎題，正在成形。</h2>
            <p>生成區域、驗證唯一解，再評估邏輯難度。</p>
            <span class="loading-bars"><i></i><i></i><i></i></span>
          </div>
          <QueensBoard
            v-else-if="puzzle"
            :key="puzzle.id"
            :puzzle="puzzle"
            :cells="cells"
            :paused="paused"
            :won="won"
            :highlighted="highlighted"
            :mistakes="allMistakes"
            :busy="busy"
            @play="game.edit($event)"
            @mark="game.edit($event, 'marked')"
            @resume="game.togglePause"
          />
          <div v-else class="empty-board">
            <CrownIcon />
            <h2>為下一個靈光，留個位置。</h2>
            <p>選擇棋盤與難度，開始一段安靜的挑戰。</p>
          </div>
          <div v-if="error" class="error-notice" role="alert">{{ error }}</div>
          <GameToolbar
            :mode="mode"
            :blocked="blocked || !puzzle"
            :assisting="assisting"
            :can-restart="!!puzzle && !busy"
            :can-undo="!!history.length && !busy && !paused"
            :can-redo="!!future.length && !busy && !paused"
            @mode="mode = $event"
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
          <div class="feedback" role="status" aria-live="polite" aria-atomic="true">
            <template v-if="message"
              ><span class="feedback-label">{{ hint ? '邏輯提示' : '遊戲訊息' }}</span>
              <p>{{ message }}</p>
              <button
                v-if="hint && !blocked"
                class="text-button apply-hint"
                @click="game.applyHint"
              >
                套用這一步 →
              </button></template
            >
            <p v-else-if="conflicts.length">皇冠有衝突。請檢查紅色斜紋的格子。</p>
            <p v-else class="quiet-note">
              {{ paused ? '休息片刻，靈感也需要呼吸。' : '不必急，每一頂皇冠都有自己的位置。' }}
            </p>
          </div>
          <GameResult v-if="won" :time="time" :moves="moves" :hints="hints" @next="nextGame" />
          <div v-if="puzzle" class="puzzle-footer">
            <span
              >SEED {{ puzzle.seed }} <span class="dot-separator">·</span> v{{ puzzle.version }}
              <span class="dot-separator">·</span> 難度分數 {{ puzzle.difficultyScore }}</span
            ><button class="text-button share-button" @click="copyLink">
              <Check v-if="copied" :size="12" /><Copy v-else :size="12" />{{
                copied ? '已複製' : '分享關卡'
              }}
            </button>
          </div>
        </section>
        <aside class="side-panel">
          <GameSettings
            :busy="busy"
            :initial-size="initialSize"
            :initial-difficulty="initialDifficulty"
            :initial-seed="initialSeed"
            @start="startGame"
            @cancel="game.cancelGeneration"
          /><GameRules />
        </aside>
      </div>
    </main>
    <footer class="site-footer">
      <span>一點專注，一點留白。</span
      ><span>CRAFTED FOR CURIOUS MINDS <span class="footer-star">✳</span></span>
    </footer>
  </div>
</template>
<style scoped>
.app-shell {
  max-width: 1096px;
  margin: 0 auto;
  padding: 0 44px;
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
  color: #9573a8;
}
.brand-tagline {
  font-size: 8px;
  letter-spacing: 1.65px;
  color: #9d949f;
  padding-top: 8px;
}
.how-to {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  font-size: 11px;
  text-decoration: none;
  color: var(--muted);
}
.page-intro {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 48px 0 39px;
}
.page-intro h1 {
  font-family: 'Iowan Old Style', 'Noto Serif TC', serif;
  font-weight: 500;
  font-size: 35px;
  letter-spacing: 2px;
  margin: 16px 0;
}
.page-intro .eyebrow {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 9px;
  letter-spacing: 1.7px;
}
.intro-line {
  display: inline-block;
  width: 22px;
  height: 1px;
  background: #b5a5be;
}
.intro-description {
  font-size: 12px;
  letter-spacing: 1px;
  color: var(--muted);
  margin: 0;
}
.intro-flower {
  color: #ac95b9;
  margin-right: 6px;
  transform: rotate(12deg);
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
  color: #725781;
  background: #ece5f1;
  padding: 5px 11px;
  border-radius: 4px;
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
  color: #6e577d;
}
.queen-count svg {
  width: 15px;
  height: 17px;
}
.queen-count > span {
  color: #a399a8;
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
  min-height: 82px;
  padding: 22px 2px 8px;
  font-size: 12px;
  line-height: 1.9;
}
.feedback p {
  margin: 5px 0;
}
.feedback-label {
  font-size: 10px;
  color: #865d9d;
  letter-spacing: 1px;
}
.quiet-note {
  text-align: center;
  color: #a199a5;
  font-size: 11px;
}
.apply-hint {
  margin-top: 6px;
  color: #754d90 !important;
}
.puzzle-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font:
    9px ui-monospace,
    monospace;
  color: #a29aa6;
  padding: 19px 0;
  border-top: 1px solid var(--line);
}
.share-button {
  display: flex;
  gap: 5px;
  align-items: center;
  font-size: 10px !important;
}
.dot-separator {
  margin: 0 5px;
}
.empty-board {
  width: 100%;
  aspect-ratio: 1;
  border: 1px solid #ded7e2;
  border-radius: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  background: #f0ecef;
  padding: 30px;
  text-align: center;
}
.empty-board > svg,
.generating-art > svg:first-child {
  width: 49px;
  height: 49px;
  color: #9a7daa;
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
  color: #9a7daa;
}
.loading-bars {
  display: flex;
  gap: 5px;
  margin-top: 18px;
}
.loading-bars i {
  width: 5px;
  height: 5px;
  background: #ad95b9;
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
  border: 1px solid #dab8c0;
  background: #f7e9eb;
  padding: 12px;
  margin: 15px 0;
  border-radius: 5px;
  color: #95374d;
}
.restart-confirm {
  padding: 17px;
  background: #eee7f3;
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
.site-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 10px;
  color: #aaa1ae;
  border-top: 1px solid var(--line);
  margin-top: 54px;
  padding: 25px 0 30px;
}
.site-footer > span:last-child {
  font-size: 8px;
  letter-spacing: 1.3px;
}
.footer-star {
  color: #a086b1;
  margin-left: 10px;
  font-size: 16px;
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
  .brand-tagline {
    display: none;
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
  .site-header {
    height: 78px;
  }
  .brand {
    font-size: 30px;
  }
  .brand-icon {
    width: 26px;
  }
  .page-intro {
    padding: 33px 0 30px;
  }
  .page-intro h1 {
    font-size: 28px;
    letter-spacing: 1px;
  }
  .intro-description {
    font-size: 11px;
    letter-spacing: 0.3px;
  }
  .intro-flower {
    width: 43px;
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
  .site-footer {
    margin-top: 33px;
  }
  .site-footer > span:last-child {
    font-size: 7px;
    letter-spacing: 0.7px;
  }
  .queen-count {
    font-size: 11px;
  }
  .empty-board h2 {
    font-size: 16px;
  }
}
</style>
