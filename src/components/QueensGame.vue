<script setup lang="ts">
import { SOLO_ONLY } from '../deployment'
import { useRoute } from 'vue-router'
import { computed, onMounted, onUnmounted, shallowRef, useTemplateRef, watch } from 'vue'
import { Pause, Play, LoaderCircle } from '@lucide/vue'
import BaseIconCrown from './BaseIconCrown.vue'
import QueensBoard from './QueensBoard.vue'
import Queens3DBoard from './Queens3DBoard.vue'
import BaseConfirmInline from './BaseConfirmInline.vue'
import GameMeta from './GameMeta.vue'
import HintFeedback from './HintFeedback.vue'
import GameSettings from './GameSettings.vue'
import GameToolbar from './GameToolbar.vue'
import GameRules from './GameRules.vue'
import GameResult from './GameResult.vue'
import GameShare from './GameShare.vue'
import AppHeader from './AppHeader.vue'
import DailyChallenge from './DailyChallenge.vue'
import TutorialPrompt from './TutorialPrompt.vue'
import ResumePrompt from './ResumePrompt.vue'
import { useMessage } from '../i18n/message'
import { useGamePreferences } from '../composables/useGamePreferences'
import { useSoloScoring } from '../composables/useSoloScoring'
import { useRankedDaily } from '../composables/useRankedDaily'
import { useProgressAutosave } from '../composables/useProgressAutosave'
import { useSoloProgress } from '../composables/useSoloProgress'
import { restoreProgress, sameGame, type SavedProgress } from '../queens/progress'
import {
  DAILY_MAX_ATTEMPTS,
  dailyConfig,
  dailySeed,
  dateKey,
  isDailyPuzzle,
  isDateKey,
} from '../queens/daily'
import { useSoloGameStore } from '../stores/solo'
import { useSolo3dGameStore } from '../stores/solo3d'
import { BOARD_SIZES_3D, GENERATOR_3D_VERSION } from '../queens3d/version'
import { blankPuzzle3d } from '../queens3d/play'
import { storeToRefs } from 'pinia'
import { GENERATOR_VERSION } from '../queens/version'
import { BOARD_SIZES, DIFFICULTIES, boardLabel } from '../queens/levels'
import type { Difficulty } from '../queens/types'
import type { RunStart } from '../../shared/account'
const props = defineProps<{
  /** Plays the stacked (3D) board: no daily challenge, tutorial or stats, and its own save. */
  stacked?: boolean
}>()
const render = useMessage()
// The stacked store differs only in its puzzle's regions, which just the board component reads.
const game = (props.stacked ? useSolo3dGameStore() : useSoloGameStore()) as ReturnType<
  typeof useSoloGameStore
>
const kind = props.stacked
  ? {
      version: GENERATOR_3D_VERSION,
      sizes: BOARD_SIZES_3D as readonly number[],
      // Expert has no measured threshold on stacked boards yet.
      difficulties: DIFFICULTIES.filter((item) => item !== 'expert'),
      defaultSize: 5,
      cellCount: (size: number) => size ** 3,
    }
  : {
      version: GENERATOR_VERSION,
      sizes: BOARD_SIZES as readonly number[],
      difficulties: [...DIFFICULTIES],
      defaultSize: 8,
      cellCount: (size: number) => size ** 2,
    }
const progress = props.stacked
  ? useSoloProgress('queens3d:solo-progress:v1', kind)
  : useSoloProgress()
useProgressAutosave(game, progress)
onUnmounted(() => game.$dispose())
const { guidance, expandedBoard } = useGamePreferences()
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
  ranked,
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
const params = new URLSearchParams(
  Object.entries(useRoute().query).flatMap(([key, value]) =>
    typeof value === 'string' ? [[key, value]] : [],
  ),
)
const requestedSize = Number(params.get('size') ?? kind.defaultSize)
const initialSize = kind.sizes.find((size) => size === requestedSize) ?? kind.defaultSize
const requestedDifficulty = params.get('difficulty')
const initialDifficulty: Difficulty =
  kind.difficulties.find((difficulty) => difficulty === requestedDifficulty) ?? 'easy'
const displayDifficulty = shallowRef<Difficulty>(initialDifficulty)
const requestedSeed = params.get('seed')
const initialSeed =
  requestedSeed !== null && /^\d+$/.test(requestedSeed) && Number(requestedSeed) <= 0xffffffff
    ? Number(requestedSeed)
    : crypto.getRandomValues(new Uint32Array(1))[0]
const dailyParam = props.stacked ? null : params.get('daily')
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
const versionMismatch = shallowRef(params.has('v') && params.get('v') !== kind.version)
const restartConfirm = shallowRef(false)
const reviewing = shallowRef(false)
watch([won, () => puzzle.value?.id], () => {
  reviewing.value = false
})
const { lastRecord } = useSoloScoring(
  { won, puzzle, attempt, seconds, moves, hints, daily },
  props.stacked,
)
const ranking = useRankedDaily({ won, ranked, daily, puzzle, runLog: () => game.runLog() })
const { preparing, result: rankedResult, notice: rankedNotice } = ranking
const highlighted = computed(() => (paused.value ? [] : hintCells.value))
const allMistakes = computed(() => [...new Set([...conflicts.value, ...mistakes.value])])
// The daily challenge is a fixed board, so its page offers no settings until the player leaves it.
const inDaily = shallowRef(false)
// An unfinished game found in storage, waiting for the player to continue or discard it.
const pendingResume = shallowRef<SavedProgress | null>(null)
// While the resume question is open the header describes that game, not the link's defaults.
const shown = computed(() =>
  pendingResume.value
    ? {
        size: pendingResume.value.size,
        difficulty: pendingResume.value.difficulty,
        daily: pendingResume.value.daily === dateKey(),
      }
    : {
        size: puzzle.value?.size ?? initialSize,
        difficulty: displayDifficulty.value,
        daily: !!daily.value,
      },
)
async function startGame(
  size: number,
  difficulty: Difficulty,
  seed: number,
  dailyDate: string | null = null,
  saved?: SavedProgress,
  run?: RunStart | null,
) {
  pendingResume.value = null
  rankedResult.value = null
  if (!dailyDate) rankedNotice.value = null
  inDaily.value = dailyDate !== null
  displayDifficulty.value = difficulty
  versionMismatch.value = false
  restartConfirm.value = false
  const status = await game.newGame(
    size,
    difficulty,
    seed,
    dailyDate,
    saved && restoreProgress(saved, kind.cellCount),
  )
  if (status === 'ready' && run) game.startRanked(run.elapsedMs, saved?.log)
  return status
}
// Before a stacked board exists, a hidden blank one holds its place, so the prompts shown over
// it are exactly as tall as the board that follows and nothing jumps.
const placeholder = computed(() =>
  props.stacked &&
  (versionMismatch.value || pendingResume.value || busy.value || preparing.value || !puzzle.value)
    ? blankPuzzle3d(shown.value.size)
    : null,
)
const playArea = useTemplateRef<HTMLElement>('playArea')
/** The settings can sit below the board, so a game started from them brings the board back into view. */
function startFromSettings(size: number, difficulty: Difficulty, seed: number) {
  if (playArea.value && playArea.value.getBoundingClientRect().top < 0)
    playArea.value.scrollIntoView()
  return startGame(size, difficulty, seed)
}
async function resume(saved: SavedProgress) {
  // Only today's challenge keeps its daily label; an older unfinished day is a normal puzzle.
  const dailyDate = saved.daily === dateKey() ? saved.daily : null
  // Only a board played ranked from the start has the log the server needs.
  const run = dailyDate && saved.log ? await ranking.start(dailyDate) : null
  return startGame(saved.size, saved.difficulty, saved.seed, dailyDate, saved, run)
}
function discardSaved() {
  progress.clear()
  void startGame(initialSize, initialDifficulty, initialSeed)
}
async function startDaily() {
  const key = dateKey()
  const { size, difficulty } = dailyConfig(key)
  rankedNotice.value = null
  const run = await ranking.start(key)
  // A seed can exhaust the generation budget; everyone walks the same fixed fallback seeds.
  for (let attempt = 0; attempt < DAILY_MAX_ATTEMPTS; attempt++) {
    const status = await startGame(size, difficulty, dailySeed(key, attempt), key, undefined, run)
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
  // A link to today's board starts the daily like its card does, so a signed-in run is ranked.
  else if (linkedDaily) void startDaily()
  else void startGame(initialSize, initialDifficulty, initialSeed)
})
</script>
<template>
  <div class="page-shell">
    <AppHeader />
    <main>
      <h1>{{ $t(stacked ? 'stacked.nav' : 'nav.solo') }}</h1>
      <div class="game-layout" :class="{ expanded: expandedBoard || stacked }">
        <section ref="playArea" class="play-area" :aria-label="$t('game.area')" :aria-busy="busy">
          <GameMeta
            :difficulty="shown.difficulty"
            :size="boardLabel(shown.size, stacked)"
            :time="time"
            :badge="shown.daily ? $t(ranked ? 'ranked.badge' : 'game.dailyBadge') : undefined"
          >
            <span v-if="puzzle" class="queen-count"
              ><BaseIconCrown /> {{ queens.length
              }}<span>/ {{ stacked ? puzzle.size ** 2 : puzzle.size }}</span></span
            >
            <template #actions>
              <button
                v-if="!ranked"
                type="button"
                class="icon-button pause-button"
                :aria-label="paused ? $t('game.resume') : $t('game.pause')"
                :disabled="!puzzle || busy || won"
                @click="game.togglePause"
              >
                <Play v-if="paused" :size="15" /><Pause v-else :size="15" />
              </button>
            </template>
          </GameMeta>
          <div class="board-slot" :class="{ reserved: placeholder }">
            <Queens3DBoard
              v-if="placeholder"
              placeholder
              inert
              aria-hidden="true"
              :puzzle="placeholder"
              :cells="Array(placeholder.size ** 3).fill('empty')"
              :guidance="guidance"
              :paused="false"
              :won="false"
              :highlighted="[]"
              :mistakes="[]"
              :busy="false"
            />
            <div v-if="versionMismatch" class="empty-board">
              <BaseIconCrown />
              <h2>{{ $t('game.versionMismatch.title') }}</h2>
              <p>{{ $t('game.versionMismatch.body', { version: kind.version }) }}</p>
            </div>
            <ResumePrompt
              v-else-if="pendingResume"
              :saved="pendingResume"
              @resume="resume(pendingResume)"
              @discard="discardSaved"
            />
            <div v-else-if="busy || preparing" class="empty-board" role="status">
              <div class="generating-art">
                <BaseIconCrown /><LoaderCircle class="spinner" :size="21" />
              </div>
              <h2>{{ $t('game.generating.title') }}</h2>
              <p>{{ $t('game.generating.body') }}</p>
              <span class="loading-bars"><i></i><i></i><i></i></span>
            </div>
            <component
              :is="stacked ? Queens3DBoard : QueensBoard"
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
              @crown="game.edit($event, 'queen')"
              @resume="game.togglePause"
            >
              <template #result>
                <GameResult
                  :time="time"
                  :moves="moves"
                  :hints="hints"
                  :record="lastRecord ?? undefined"
                  :next-label="inDaily ? $t('game.freePlay') : undefined"
                  @next="nextGame"
                  @review="reviewing = true"
                >
                  <p v-if="rankedResult === 'pending'" class="ranked-status" role="status">
                    {{ $t('ranked.submitting') }}
                  </p>
                  <p v-else-if="rankedResult" class="ranked-status" role="status">
                    {{
                      rankedResult.rank
                        ? $t('ranked.rank', { rank: rankedResult.rank })
                        : $t('ranked.recorded')
                    }}
                  </p>
                  <template v-else-if="ranked && rankedNotice">
                    <p class="ranked-status" role="alert">{{ render(rankedNotice) }}</p>
                    <button type="button" class="text-button" @click="ranking.submit">
                      {{ $t('ranked.retry') }}
                    </button>
                  </template>
                  <RouterLink
                    v-if="daily && !SOLO_ONLY"
                    :to="{ path: '/leaderboard', query: { day: daily } }"
                    >{{ $t('ranked.leaderboard') }}</RouterLink
                  >
                </GameResult>
              </template>
            </component>
            <div v-else class="empty-board">
              <BaseIconCrown />
              <h2>{{ $t('game.idle.title') }}</h2>
              <p>{{ $t('game.idle.body') }}</p>
            </div>
          </div>
          <div v-if="error" class="error-notice" role="alert">{{ render(error) }}</div>
          <p v-if="ranked && !won" class="ranked-note">{{ $t('ranked.clock') }}</p>
          <p v-else-if="rankedNotice && !won" class="ranked-note" role="status">
            {{ render(rankedNotice) }}
          </p>
          <GameToolbar
            :blocked="blocked || !puzzle"
            :assisting="assisting"
            :hint-level="hintLevel"
            :hint-revealed="hintRevealed"
            :can-restart="!!puzzle && !busy && !ranked"
            :can-undo="!!history.length && !busy && !paused && !reviewing"
            :can-redo="!!future.length && !busy && !paused && !reviewing"
            @undo="game.undo"
            @redo="game.redo"
            @restart="restartConfirm = true"
            @hint="game.assist('hint')"
            @check="game.assist('check')"
          />
          <BaseConfirmInline
            v-if="restartConfirm"
            :prompt="$t('game.restart.prompt')"
            :keep-label="$t('game.restart.keep')"
            :confirm-label="$t('game.restart.confirm')"
            @keep="restartConfirm = false"
            @confirm="confirmRestart"
          />
          <div
            :class="{ 'has-feedback': feedback || conflicts.length }"
            class="feedback"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <HintFeedback
              v-if="feedback"
              :text="feedback"
              :label="
                hint ? $t('game.feedback.hint', { level: hintLevel }) : $t('game.feedback.message')
              "
              :evidence="hintRevealed ? hint?.evidence : undefined"
              :can-apply="hintRevealed && !blocked"
              @apply="game.applyHint"
            />
            <p v-else-if="conflicts.length">{{ $t('game.feedback.conflict') }}</p>
          </div>
          <div v-if="puzzle" class="puzzle-footer">
            <span
              >SEED {{ puzzle.seed }} <span class="dot-separator">·</span> v{{ puzzle.version }}
              <span class="dot-separator">·</span>
              {{ $t('game.score', { score: puzzle.difficultyScore }) }}</span
            >
            <GameShare :puzzle="puzzle" :path="stacked ? '/solo3d' : '/solo'" />
          </div>
        </section>
        <aside class="side-panel">
          <button
            v-if="inDaily"
            type="button"
            class="text-button free-play"
            :disabled="busy"
            @click="nextGame"
          >
            {{ $t('game.leaveDaily') }}
          </button>
          <template v-else>
            <TutorialPrompt v-if="!stacked" />
            <DailyChallenge
              v-if="!stacked"
              class="daily-panel"
              in-game
              :busy="busy"
              @start="startDaily"
            />
            <GameSettings
              :busy="busy"
              :initial-size="initialSize"
              :initial-difficulty="initialDifficulty"
              :initial-seed="initialSeed"
              :current-seed="puzzle?.seed"
              :sizes="kind.sizes"
              :difficulties="kind.difficulties"
              :stacked="stacked"
              @start="startFromSettings"
              @cancel="game.cancelGeneration"
            />
          </template>
          <GameRules :stacked="stacked" />
        </aside>
      </div>
    </main>
  </div>
</template>
<style scoped>
.ranked-note {
  margin: 12px 0 0;
  font-size: 12px;
  color: var(--muted);
}
.ranked-status {
  margin: 0;
  color: var(--accent);
}
.page-shell h1 {
  margin-bottom: 24px;
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
.daily-panel {
  margin-bottom: 27px;
}
.free-play {
  display: block;
  margin: 0 auto 27px;
}
.queen-count {
  white-space: nowrap;
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
.puzzle-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font:
    11px ui-monospace,
    monospace;
  color: var(--muted);
  padding: 19px 0;
  border-top: 1px solid var(--line);
}
.dot-separator {
  margin: 0 5px;
}
.board-slot.reserved {
  position: relative;
}
.reserved > .empty-board {
  position: absolute;
  inset: 0;
  z-index: 5;
  width: auto;
  aspect-ratio: auto;
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
  .game-layout {
    grid-template-columns: minmax(0, 550px) minmax(230px, 1fr);
    gap: 77px;
  }
  .side-panel {
    padding-left: 37px;
  }
}
@media (max-width: 800px) {
  .game-layout {
    gap: 30px;
    grid-template-columns: minmax(0, 1fr) 235px;
  }
  .side-panel {
    padding-left: 22px;
  }
}
@media (max-width: 400px) {
  .pause-button {
    margin-left: 0;
  }
}
@media (max-width: 650px) {
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
  .puzzle-footer {
    font-size: 10px;
  }
  .queen-count {
    font-size: 11px;
  }
  .empty-board h2 {
    font-size: 16px;
  }
}
</style>
