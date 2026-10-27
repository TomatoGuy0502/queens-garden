# Neon 與 Render 部署

## 本次 Neon 設定

此專案已連接既有 Neon project `muddy-field-64537471` 的 `production` branch，組織為 `org-frosty-cake-60958912`。未建立替代專案。Neon CLI 8.11.1 已完成登入與以下指令：

```sh
npm i -g neon@latest
neon init -y --org-id org-frosty-cake-60958912 --project-id muddy-field-64537471 --branch production --services postgres
neon deploy
```

`neon.ts` 是 CLI 產生的服務設定。CLI 在 `.env.local` 拉取 `DATABASE_URL`、`DATABASE_URL_UNPOOLED`、`NEON_BRANCH`；`.env.local` 與 `.neon` 皆忽略提交。不要將密碼或連線網址貼進 Git、前端 Vite 變數或公開日誌。

Render 的長駐 Node 服務透過 `pg.Pool` 與 Drizzle 使用 TCP 連線，無需 serverless HTTP driver。應用使用 Neon **pooled** `DATABASE_URL`；migration 使用 **direct** `DATABASE_URL_UNPOOLED`。Neon 的 TLS 連線明確驗證憑證。環境變數優先於本地 env 檔；本地自動讀取 `.env.local` 與 `.env`，不改寫 CLI 管理的檔案。

本次 migration 先在 production 複製的暫存分支測試，再套用到 production；暫存分支已刪除。之後變更 schema 時也應先在 Neon 開發／測試分支演練 migration，再部署 production。

```sh
npm run db:generate  # 僅在修改 schema 後產生並審閱 migration
npm run db:migrate  # 本地只使用 LOCAL_DATABASE_URL_UNPOOLED／LOCAL_DATABASE_URL
# 正式部署由 Render NODE_ENV=production 決定；手動執行 production migration 必須明確指定：
DATABASE_TARGET=production npm run db:migrate
```

資料表為 `coop_rooms`、`coop_room_events`，migration ledger 為 `drizzle.__queens_migrations`。資料表包含私有房間憑證 hash 與解答，不能透過前端直接存取。房間快照與事件在同一交易寫入；事件保留操作及完成摘要，房間過期時 cascade 清除。

## Render

Repository 已提供 `render.yaml` Blueprint，**尚未建立或部署 Render 服務**。

1. 在 Render 建立 Blueprint，選取此 repository 與 `render.yaml`。
2. 設定 `DATABASE_URL` 為 Neon production 的 pooled URL，`DATABASE_URL_UNPOOLED` 為同一分支的 direct URL。這兩個值不會從本機自動同步到 Render。
3. 使用 Node 24，單一 instance。Blueprint 設定 Starter、Singapore、`WORKER_CONCURRENCY=1`；方案會產生 Render 費用。
4. Build 為 `npm ci --include=dev && npm run build`（`NODE_ENV=production` 會讓 `npm ci` 略過 devDependencies，而 vite、vue-tsc、esbuild 與 drizzle-kit 都在其中），start 為 `npm run db:migrate && npm start`。Health check 為 `/api/health`。
5. 預設允許 Render 的 `RENDER_EXTERNAL_URL` 來源。自訂網域時設定 `PUBLIC_ORIGIN=https://你的網域`，不可包含路徑。
6. 限流只信任 `X-Forwarded-For` 中最後 `TRUST_PROXY_HOPS`（預設 1）個代理加上的位址，否則用戶可偽造標頭繞過限流。部署後確認前面實際有幾層代理；層數比設定多會讓所有人共用同一個限流額度，比設定少則可被偽造。
7. 確認首頁與 `/rooms/<id>` 深層連結可開啟，最多 8 位玩家可加入同房並同步格子，重新整理可恢復同分頁身份。

前後端由同一個 Node 服務提供；`PORT` 使用 Render 提供的值、監聽 `0.0.0.0`。Socket.IO 使用 WebSocket，無需另一個前端環境變數或獨立 websocket host。靜態檔案與 health check 不套用建立／加入房間的 API 限流。

不要調高 instance 數：目前 presence、房間序列佇列與廣播只存在單一 process；資料庫 CAS 不是跨 instance 協作 adapter。未設定 `DATABASE_URL` 時正式服務會直接拒絕啟動，開發模式才允許本地檔案。

## 驗證

```sh
npm test
npm run lint
npm run format:check
npm run build
LOCAL_TEST_MODE=1 NODE_ENV=production PORT=3002 PUBLIC_ORIGIN=http://127.0.0.1:3002 npm start
# 在另一個 terminal；使用正式建置搭配隔離的本地檔案測試
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3002 npm run e2e
```

E2E 會實際建立測試房間與事件、操作棋盤、完成團隊關卡並驗證重連。使用測試分支進行例行 CI；初次 Neon 設定曾依指定於 production 驗證，測試房間隨 3 小時閒置期限清除；之後本地測試改用隔離檔案／PGlite，不寫入 production。資料庫 URL 只會出現在 Node 環境，前端 build 不包含它。

參考：[Neon 選擇連線方式](https://neon.com/docs/connect/choose-connection)、[Neon connection pooling](https://neon.com/docs/connect/connection-pooling)、[Render WebSockets](https://render.com/docs/websocket)。

## 本地與 production 隔離

`npm run dev` 預設只讀寫 `.data/rooms.json`。Neon CLI 寫入 `.env.local` 的 `DATABASE_URL` 與 `DATABASE_URL_UNPOOLED` 即使存在，也不會被本地應用或本地 migration 採用。若需要本地 PostgreSQL，請先準備獨立的開發分支／資料庫，設定 `LOCAL_DATABASE_URL`（pooled）與 `LOCAL_DATABASE_URL_UNPOOLED`（direct）。沒有開發連線時，本地 `db:migrate` 會明確拒絕執行。

只有 `NODE_ENV=production` 的服務使用 `DATABASE_URL`。`LOCAL_TEST_MODE=1` 優先於其他設定，連 production build 都強制使用本地檔案，供端到端測試使用；此模式也會拒絕任何 migration。Playwright 自動執行 production build，使用獨立的 5174 Node 服務及檔案，不會重用 5173／3001 的開發服務。

本次合作流程與代碼格式修改僅調整 JSON 快照資料，無新增 SQL schema migration；舊 12 碼房間直接停止接受，不轉換或沿用舊連結。

## 題庫 migration 與預生成

新增 migration `0002_strange_the_renegades.sql`，只新增 `puzzle_catalog`、`puzzle_recipes` 與索引，不改寫或刪除既有房間資料。已在本地 PGlite PostgreSQL 套用完整 migration journal 並驗證保存、去重、領題、Seed 重播與房間清除後仍保留題庫；另於 production 的隔離臨時 Neon 分支驗證 migration、8 個並行領題僅 1 個成功、以及精確 Seed 重播；測試分支已刪除。未直接套用 production migration。Render 仍於 start command 的 `npm run db:migrate` 使用 direct URL 套用已提交 migration。

Blueprint 預設 `PUZZLE_PREFILL=1`、`PUZZLE_STOCK_TARGET=3`，8×8 各難度共最多 9 題未使用庫存。設定為 `0` 可暫停背景補貨，不影響存題、Seed 查詢或即時生成。滿庫後不繼續輪詢題庫；原有房間過期清理排程維持原樣。

本地／E2E 的題庫預設為 `${ROOM_FILE}.puzzles.json`，不會使用 production credentials。Playwright 關閉自動補貨，另以真實 Node Worker、檔案儲存及 PGlite 測試補貨與玩家優先處理，避免一般 E2E 依賴隨機背景時序。

## Google 登入（Neon Auth）

登入使用 Neon 託管的 Neon Auth（Better Auth），由 Fastify 在 `/api/auth/*` 代理 `get-session`、`sign-in/social`、`sign-out` 三個端點。代理把 Neon 回傳的 cookie 改寫成本站 first-party cookie（拿掉 `Domain`／`Partitioned`，`SameSite=Lax`），所以不依賴第三方 cookie，Safari 也能維持登入。其餘 Neon Auth 端點（email 註冊等）不經過本站。

- 需要同時有資料庫與 `NEON_AUTH_BASE_URL` 才啟用；本地沒設 `LOCAL_DATABASE_URL` 時不顯示登入按鈕。
- 每個 Neon branch 的 Auth 各自獨立，URL 用 `neon neon-auth status --branch <name>` 查。開發用 branch `dev-auth`（2026-11-26 到期）已啟用 Auth，連線字串與 `NEON_AUTH_BASE_URL` 寫在 `.env.local`。
- 玩家自己的資料表只存 `user_id`（`neon_auth.user.id`），不對 `neon_auth` 建外鍵；`drizzle.config.ts` 以 `schemaFilter: ['public']` 避免 migration 碰到 Neon 管理的 schema。
- 託管版不開放 `delete-user`，刪除帳號只刪本站資料（暱稱、成績、排行榜），Google 登入紀錄留在 Neon Auth。

上線前：

1. production branch 啟用 Auth：`neon deploy`（`neon.ts` 已設 `auth: true`）或 `neon neon-auth enable --branch production`，再把 Base URL 設到 Render 的 `NEON_AUTH_BASE_URL`。
2. 加入正式網域：`neon neon-auth domain add https://<app>.onrender.com --branch production`。
3. 目前使用 Neon 共用的 Google key，同意畫面會顯示 Neon 的名稱。要換成自己的：在 Google Cloud 建 OAuth client，redirect URI 填 `neon neon-auth oauth-provider list` 顯示的 callback（共用 key 時為 `https://neonauth.<region>.aws.neon.tech/auth/oauth/callback/google`，自有 key 依 Neon 文件為 `{NEON_AUTH_BASE_URL}/callback/google`），再用 `neon neon-auth oauth-provider` 設定並發布同意畫面。
4. 建議關閉用不到的 email/password 登入：`neon neon-auth config email-password`。
