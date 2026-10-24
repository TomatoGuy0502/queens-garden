# Queens

Vue 3、TypeScript、Vite 與 UnoCSS 建立的 Queens 邏輯遊戲。關卡由純 TypeScript 演算法即時生成，沒有固定題庫。所有交付給玩家的棋盤都通過連通性、唯一解與邏輯難度驗證。

## 執行

建議 Node.js 24。

```sh
npm ci
npm run dev
```

前端預設開啟 http://localhost:5173 ，Node API 與 Socket.IO 使用 3001，由 Vite 代理。開發模式預設使用忽略提交的 `.data/rooms.json`，即使 Neon `.env.local` 存在 production `DATABASE_URL` 也會忽略。只有明確設定 `LOCAL_DATABASE_URL` 才會連接開發資料庫。正式環境使用 `DATABASE_URL`，必須設定 PostgreSQL。可直接使用以下網址重現一局：

```text
http://localhost:5173/?size=8&difficulty=easy&seed=42&v=2.0.0
```

```sh
npm run typecheck
npm run lint
npm run format:check
npm test
npx playwright install chromium
npm run e2e
npm run build
```

`npm run format` 使用 Oxfmt 寫入格式化結果；`npm run lint` 先執行 Oxlint，再執行 ESLint，兩者皆不允許警告。可用 `npm run lint:oxlint` 與 `npm run lint:eslint` 分別執行。

- `.oxlintrc.json` 明確設定 Oxlint 的 correctness 規則與啟用的 plugins。
- `eslint.config.js` 使用 `@vue/eslint-config-typescript` 的 `withVueTs` / `recommendedTypeChecked` 與 `eslint-plugin-vue` 的 `flat/recommended`，涵蓋 Vue template、SFC 與型別感知 TypeScript 檢查。
- `eslint-plugin-oxlint` 依實際 `.oxlintrc.json` 停用重複的 ESLint 規則，Vue template 檢查仍保留。僅為 `App.vue` 入口元件豁免多單字元件名稱規則。
- `eslint-config-prettier` 只負責停用與格式化衝突的規則，不會執行 Prettier；格式化工具仍為 Oxfmt。型別檢查另由 `vue-tsc` 執行。

圖示使用 `@lucide/vue`。Vue Router 負責首頁、單人模式與合作房間；Pinia 分離單人遊戲、合作房間連線與共享棋盤狀態。

套件均於建立時從 npm 的 `latest` 安裝，唯獨 TypeScript 使用 **6.0.3**：目前 npm latest TypeScript 7 的 package exports 與最新版 vue-tsc 3.3.13 不相容（`ERR_PACKAGE_PATH_NOT_EXPORTED: typescript/lib/tsc`）。沒有使用 force/legacy-peer-deps 隱藏此問題。package-lock.json 固定實際驗證過的版本；未來需與 vue-tsc 一起升級 TypeScript。

## 遊戲

- 每一列、每一欄、每個區域各一頂皇冠，任何兩頂皇冠不能八方向直接相鄰。**較遠的對角線不受限制。**
- 點擊或觸控依序切換「空格 → 皇冠 → X → 空格」，不需要切換操作模式。桌面右鍵可直接切換 X 標記。
- 方向鍵移動焦點，Home/End 到列首尾，空白鍵/Enter 循環皇冠、X、空格，X 鍵標記。
- Undo/Redo、重新開始、暫停/繼續、計時、檢查錯誤、提示。完成摘要會直接疊在棋盤中央，顯示時間、操作次數、提示次數與下一局按鈕，並移動鍵盤焦點；手機橫向捲動大棋盤時仍完整顯示。分享視窗直接顯示 QR Code，支援複製連結與瀏覽器提供的系統分享；無剪貼簿權限時可手動複製。分享內容取自目前關卡，不受未套用的表單值影響。
- 頁首「遊玩設定」可開啟皇冠排除範圍引導，分別選擇同列、同欄、同色區與周圍八格。以淺色斜線保留色區底色，不會自動新增 X 或禁止點擊；移除皇冠與 Undo/Redo 即時更新。預設關閉，設定儲存於此瀏覽器，儲存被拒絕時仍可於本次遊戲套用。
- 單人模式切換瀏覽器分頁自動暫停，合作模式持續進行。大棋盤在手機可橫向滑動，格子至少 40px 寬。
- 區域除了色彩也有字母與實線邊界；具 ARIA 格子描述、roving tabindex、可見焦點、狀態宣告與 reduced-motion 支援。
- 「開始新遊戲」會自動換成不同 Seed；手動輸入 Seed 後按「載入此種子」可重現指定關卡。生成過程可取消；生成失敗時顯示錯誤，請調整 Seed 或設定再試，不會偷偷降級難度。

## 架構與資料責任

```text
src/
  queens/                  純 TypeScript 核心，無 Vue/DOM 相依
    types.ts               PuzzleDefinition / QueensPuzzle / session cell / deduction types
    version.ts             生成器版本
    random.ts              Mulberry32、shuffle、有限節點隨機回溯 Queen 配置
    regionGrower.ts        連通區域生長與安全邊界變異
    solver.ts              獨立計數 Solver、唯一解驗證
    validator.ts           連通性、配置合法性、直接衝突
    guidance.ts            由玩家已放皇冠計算視覺引導範圍，無解答相依
    generator.ts           有限預算生成、變異、驗證與精確難度篩選
    deductions/            每種推理策略一個函式
    difficulty.ts          策略順序、權重、完整推理評估與提示
    protocol.ts / worker.ts 生成、提示與檢查的 Worker 通訊
  composables/useQueensGame.ts 遊戲生命週期、Worker、history、timer、操作
  composables/useGamePreferences.ts 視覺引導設定、儲存與安全預設值
  components/
    QueensGame.vue         薄的功能組合、網址與設定協調
    QueensBoard.vue        區域邊界、棋盤與鍵盤焦點；傳入定義與狀態，傳出操作
    QueensCell.vue         單格顯示與操作事件，不持有遊戲邏輯
    GameSettings.vue       設定表單；傳出 size/difficulty/seed
    GameToolbar.vue        操作按鈕；傳出 action
    GameRules.vue          規則與操作說明
    GameResult.vue         接收時間、操作與提示次數，顯示摘要
    GameShare.vue          目前關卡的重現連結、QR Code、複製與系統分享
    GamePreferences.vue    遊玩設定 Modal 與視覺引導範圍開關
  tests/                   核心 Vitest 測試
 e2e/                      桌面 Chromium 與 Pixel 7 模擬的 Playwright 測試
```

`QueensPuzzle` 包含解答與完整推理紀錄，只存在生成 API/Worker。Worker 回傳給 Vue 的是移除 `solution` 與 `analysis` 的 `PuzzleDefinition`。UI 棋盤無解答 prop，也沒有供測試使用的揭答後門。Session 的格子狀態、歷史與計時與 Puzzle Definition 分離。

資料都是可 JSON 序列化的值。分享 URL 重現預設預算下同版本、同大小、同難度、同 Seed 的棋盤。核心 API 也會保存 `generation` recipe，以重現自訂的嘗試與變異預算；改動演算法或分級規則時應提升生成器版本。舊版本連結會顯示版本不相容，讓玩家明確開始新版遊戲。

## 關卡生成與唯一解

1. Mulberry32 seeded PRNG 驅動所有隨機選擇，不使用 Math.random 或牆鐘時間作為生成條件。
2. Randomized backtracking 產生不重複的欄排列；相鄰列欄差必須大於 1，最多搜尋 200,000 節點。
3. 每個皇冠格建立一個區域，以隨機加權 frontier 生長填滿棋盤。只能從上下左右加入未分配格，連通性由構造保證。優先擴張尚未達到最小面積的區域，再以軟性面積平衡與隨機偏好完成剩餘格子。輕鬆每區至少 2 格、適中至少 3 格、挑戰至少 4 格；任何單格色區都不合格。若區域被包圍而無法達標，整張盤面會被拒絕並重新生成。
4. 用最多 24 解的計數作為局部搜尋目標，優先轉移替代解中的非目標皇冠格，以消除已知多解，分數相同時使用 Seed 決定順序。只接受不增加解數的盤面。皇冠 seed 格不移動；每次檢查 donor 的連通性與最小面積，recipient 因正交相鄰保持連通。
5. 候選唯一盤面再次以最多 **2 解**的獨立 Solver 驗證，必須只有一解、搜尋未超限、找到的解逐列等於原始皇冠配置，並驗證整張盤面連通性與最小區域面積，才可繼續難度驗證。
6. 推理引擎完整解出且分級精確符合目標時，再依實際難度驗證最小區域面積才接受；否則重新生成。面積限制不取代邏輯難度評估。生成器版本為 2.0.0，舊版連結不會被當成相同關卡。

Solver 使用 row-by-row DFS、column/region bitmask 和相鄰列剪枝；每次最多 2,000,000 節點。到達節點上限時回傳 `exhausted`，不得當成唯一解成功。一般唯一解檢查找到第二組解立刻終止。

預設每局最多 160 次初始區域生成，每次最多 100 次邊界變異。這是固定工作預算，不是速度依賴的 timeout，結果可重現。所有運算在 Worker 執行，取消會 terminate Worker。預算用盡拋出明確錯誤，**不回傳未驗證棋盤，也不回傳錯誤難度**。

核心 API 範例：

```ts
import { generatePuzzle } from './src/queens/generator'
const puzzle = generatePuzzle({ size: 8, seed: 42, difficulty: 'hard' })
console.log(puzzle.analysis.steps) // strategy、level、place/eliminate、cells、reason、可選 evidence
```

## 難度與提示

策略依固定順序使用；只要較低級能推進，就不使用高級策略。

| 分級             | 實際策略                                       | 權重                         |
| ---------------- | ---------------------------------------------- | ---------------------------- |
| Easy / Level 1   | 單一候選與所有候選位置的共同八鄰格排除         | 放置 1；相鄰排除 1 + 格數    |
| Medium / Level 2 | 區域/列/欄交集與 locked candidates             | 4 + 排除格數                 |
| Hard / Level 3   | 不同單位家族間的 2/3 組 Hall sets；深度 1 反證 | Hall 10 / 反證 16 + 排除格數 |

總分加總每一步權重，記錄在 `difficultyScore`；權重集中於 `STRATEGY_WEIGHTS`，步驟保存在 `analysis.steps`。每步皇冠放置自動排除所有同行、同欄、同區與八鄰格候選。若某格會與某單位的所有候選位置直接相鄰，基礎相鄰排除可安全將其標 X，避免輕鬆關卡依賴單格色區。反證只在一個候選格假設放皇冠，然後進行單一候選/相鄰排除/交集推理；如導出矛盾才排除該格，並保留子步驟與具體矛盾單位，提示中可展開查看。**不以暴力搜尋節點數計算難度。**

最多進行 2N² 個推理步驟；反證分支也最多 2N² 步。未能完整解完的盤面標示 `unrated` 並拒絕交付。分級表示「目前固定策略順序與範圍下需要的最高層級」，不是經玩家實測校準的心理難度，也不保證是理論上最低的解題難度。

提示以目前皇冠與 X 建立候選集合。先確認不存在衝突或無法完成的配置，再找下一個推理步驟。沒有可安全解釋的策略時明確回報，完全不依解答隨機揭格。提示先說明與框選，再由玩家選擇套用；只有「檢查錯誤」會在 Worker 內對照唯一解，包含錯誤皇冠與把答案位置標 X 的情況。

## 驗證與限制

測試涵蓋 59 個 Vitest 核心測試、22 個後端測試及 36 個 Playwright E2E（桌面與手機）；TypeScript、Oxlint＋ESLint、Oxfmt format check 與 production build 通過。E2E 包含 browser console errors 與 uncaught page errors 檢查。

測試包含：獨立 permutation oracle 與 Solver 的全解對照、無解/多解/唯一解、遠距對角線、跨 Seed/大小批次生成、250 次邊界變異的連通性、各難度最小面積與變異下限、完整 recipe 序列化重現、所有難度標籤與最低層級驗證、提示/排除的解保留、Hall sets 與基礎相鄰排除的多解安全性，以及預算耗盡的明確失敗。E2E 另驗證自動換 Seed、指定 Seed 重現、分享連結、實際解碼畫面上的 QR Code、剪貼簿拒絕時的備用操作與提示區間距。另測試視覺引導各範圍、標記保留、Undo/Redo 更新、重新載入後的偏好設定與儲存權限被拒絕時的行為。

18 種大小（6/7/8/9/10/12）與難度組合皆以 Seed 42 在預設預算下成功；2026-10-24 本機單獨執行矩陣測試，6～9 格約 2～140ms、10 格約 36～899ms、12 格約 1.9～6.6s。這是單一 Seed 的樣本測量，不代表每一個 Seed 都會成功，也不是裝置效能保證。可重跑：

```sh
npx vitest run src/tests/generation-matrix.test.ts --disableConsoleIntercept
```

已知限制：

- 部分 Seed 與難度組合仍可能用盡預算；UI 明確回報失敗，沒有預設題庫 fallback。
- 區域有連通性與軟性面積平衡，但沒有美觀最佳化目標，可能出現細長或較大的區域；最小面積依難度強制為 2/3/4 格。
- Hall sets 限 2/3 組，反證限單層；不包含所有人類策略。Unrated 關卡不提供遊玩。
- 分享連結使用目前開啟的網域；localhost 僅適用本機，跨裝置掃描請使用已部署網址或同一網路可存取的網址。
- 單人遊戲進度與 Undo/Redo 不跨重新整理儲存；重載分享 URL 重開相同關卡。合作進度儲存在資料庫，重載同分頁可恢復身份。操作歷史保留最近 1,000 步。
- E2E 使用桌面 Chromium 與同引擎的 Pixel 7 模擬，尚未驗證實體手機、Safari 或 Firefox；可見焦點與 ARIA 已實作，但沒有實體螢幕閱讀器使用者測試。
- TypeScript 7 與 vue-tsc 相容性例外如上；其餘依賴使用安裝時 npm latest。

技術文件：[Vue](https://vuejs.org/guide/)、[Vite](https://vite.dev/guide/)、[UnoCSS Vite integration](https://unocss.dev/integrations/vite)。

## 線上合作

首頁可選單人或多人合作。房主建立房間並分享連結／QR Code，其他玩家輸入暱稱加入；最多 8 人，無需準備，房主一人即可開始新局。所有玩家直接操作同一盤棋，點擊仍是皇冠 → X → 清除。「指示格子」只傳送短暫的指示標籤，不修改格子。提示、錯誤檢查、計時與完成狀態由團隊共享，視覺引導設定則保留為各人的偏好。

- 同一格同時修改時，由伺服器接受第一個符合格子版本的操作；較晚送出者會收到衝突訊息與最新棋盤。不同格的操作可以一起接受。
- Undo/Redo 只處理自己的操作；若格子已被隊友接續修改，不能覆寫隊友的進度。套用提示作為一次可復原的批次操作。
- 隊友加入、斷線、離開與重新連線都不會自動暫停棋盤或計時；玩家仍可手動暫停與繼續，不需等待其他人上線。瀏覽器同一分頁重整會使用 sessionStorage 的房間憑證恢復身份。邀請連結不包含憑證或答案。
- 房主可變更下一局設定、重設並開始新局；不需要準備確認。離開房間會釋放自己的席位，房主離開或離線時優先移交給在線隊友。離線訪客保留席位 5 分鐘，房間最多保留到 24 小時閒置到期。

新增架構：

```text
shared/coop.ts             Zod 協定、公開快照、Socket.IO 事件型別
server/
  app.ts / index.ts        Fastify API、Socket.IO、靜態前端與 graceful shutdown
  rooms.ts / model.ts      房間權限、版本控制、去重、計時與合作操作
  compute.ts / worker.ts   有上限的 Node Worker 生成與提示運算
  repository.ts / schema.ts PostgreSQL 交易、revision CAS 與事件紀錄
  env.ts / databaseUrl.ts  環境載入與 Neon TLS 驗證
  tests/                  真實 socket、房間規則與 PGlite PostgreSQL 整合測試
src/
  router.ts               首頁、/solo、/rooms/new、/rooms/:roomId
  stores/                 soloGame、room、game，分離連線與棋盤
  services/roomClient.ts   Socket.IO 連線、ack、重連與快照同步
  views/                  首頁、建立房間、等待室／合作棋盤
  components/coop/         等待室與隊友狀態
```

每個已接受的房間操作都先在 PostgreSQL 交易寫入快照與事件，再廣播；revision 條件避免舊快照覆寫。完成事件另外保留團隊成績，因此開始下一局不會刪除上一局的結果。答案與完整推理只存在伺服器資料庫／Worker，公開快照不包含這些資料。提示運算在 Worker 中執行並檢查盤面版本，避免把舊提示套用到已變動的棋盤。

房間代碼固定為 5 碼英數字（統一顯示大寫），加入畫面提供五格輸入、鍵盤移動、退格與貼上整碼或分享連結。代碼由安全亂數產生，碰撞會在固定 16 次預算內重新取得，不覆寫既有房間。舊 12 碼連結不再支援。暱稱存於 localStorage，建立／加入房間時自動帶入；房間身份仍保存在 sessionStorage，兩者分離。瀏覽器拒絕儲存時仍可手動輸入並遊玩。

目前限單一 Node instance，尚未實作跨 instance 的廣播與 presence adapter，也沒有帳號、公開配對或永久個人成績頁。重連憑證僅存在原分頁；新分頁／另一台裝置使用邀請連結會被視為新的加入者。房間與事件閒置 24 小時後清除，完成事件不是永久成績庫。非正常關機後恢復原本的遊玩／手動暫停狀態；進行中計時仍包含斷線與服務重啟的經過時間。

Neon 設定、Render 部署與正式服務驗證方式見 [部署說明](docs/DEPLOYMENT.md)。

本地 E2E 自動建置並使用獨立的 Node 服務 5174 與 `.data/e2e-rooms-v2.json`，不重用平時開發服務；`LOCAL_TEST_MODE=1` 強制使用檔案，忽略所有資料庫 URL。後端 PostgreSQL 整合測試使用記憶體內 PGlite，不連接 Neon production。
