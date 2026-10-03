# 元件清單

> [返回目錄](./index.md) · [系統架構](./architecture.md) · 更新：2026-10-03

以下按目錄列出目前模組；同名 `.module.css` 是對應元件的隔離樣式。
帳號、好友與儲存流程見[帳號與持久化儲存](./accounts-and-storage.md)。

Deployment configuration and commands are documented in [deployment](./deployment.md).
`client/src/deployment.ts` derives the Router, API, and Socket.IO paths from the
build-time base URL. `server/src/index.ts` validates the listening IP and optional
loopback proxy trust; the application uses that policy for per-client rate limits.

## Shared（`shared/src/`）

| 檔案 | 職責 |
| --- | --- |
| `types/account.ts` | 公開帳號 profile、預設頭像型別 |
| `types/social.ts` | 公開好友身分、申請、清單與回應型別 |
| `types/player.ts`、`types/room.ts` | 玩家身分、座位、房間與準備狀態 |
| `types/game.ts` | 牌、叫牌、出牌、結算、持久化遊戲與玩家可見快照、對局摘要 |
| `types/chat.ts` | 聊天訊息 |
| `types/socket-events.ts` | 客戶端 actions、callback 與 `player:state` 快照 |
| `constants/cards.ts`、`constants/game-rules.ts` | 花色、排序、牌點、遊戲與重連常數 |
| `index.ts`、`types/index.ts`、`constants/index.ts` | 共用匯出入口 |

## Server（`server/src/`）

| 檔案 / 群組 | 職責 |
| --- | --- |
| `index.ts` | 環境設定、repository 建立、啟動與正常關閉 |
| `app.ts` | Express、Socket.IO、HTTP middleware/routes 與 runtime 組合 |
| `database/repository.ts` | 非同步儲存介面與內部紀錄型別，作為未來 SQL adapter 邊界 |
| `database/json-repository.ts` | JSON 載入、受影響 collection 複製、完整驗證與原子替換 |
| `database/indexes.ts` | 按 collection 身分刷新的帳號、session、好友、歷史查詢索引 |
| `database/schema.ts` | 文件版本、欄位、唯一性與外鍵參照驗證 |
| `auth/password.ts` | 非同步 scrypt 雜湊與驗證、運算並行限制 |
| `auth/auth-service.ts` | 註冊、登入、profile、cookie session、密碼更新與撤銷 |
| `auth/http-middleware.ts` | Origin / JSON 檢查、登入驗證、HTTP 頻率限制 |
| `http/auth-routes.ts` | 帳號 HTTP endpoints、cookie、profile 與撤銷後的連線通知 |
| `http/friend-routes.ts` | 已驗證的好友查詢與異動 endpoints |
| `http/player-routes.ts` | 已驗證的公開玩家身分查詢，僅回傳 PublicAccount |
| `social/friend-service.ts` | 申請、接受、拒絕、取消、移除與公開身分投影 |
| `runtime/types.ts`、`runtime/validate.ts` | runtime 快照結構及有效性檢查 |
| `runtime/coordinator.ts` | 序列化遊戲操作、略過未改變狀態寫入、持久化 runtime / 對局、失敗回復 |
| `socket/context.ts` | 認證 action wrapper、callback、私人快照、操作者及受影響房間廣播 |
| `socket/connection.ts` | 握手驗證、session 到期、斷線清理、多分頁與 profile 同步 |
| `socket/room-handler.ts`、`socket/game-handler.ts`、`socket/chat-handler.ts` | 房間、遊戲、聊天事件的驗證和協調 |
| `managers/player-manager.ts` | 帳號對應玩家、記憶體 socket 對照、斷線與還原 |
| `managers/room-manager.ts` | 房間成員、座位、準備狀態、profile 與還原 |
| `managers/game-manager.ts` | 發牌至結算流程、倒牌決定、私人手牌、快照與還原 |
| `managers/chat-manager.ts` | 每房間最近聊天紀錄及還原 |
| `engine/deck.ts`、`engine/dealing.ts` | 純函式牌組、洗牌、發牌、排序與倒牌資格 |
| `engine/bidding.ts`、`engine/playing.ts`、`engine/scoring.ts` | 純函式叫牌、合法出牌、墩與結果計算 |
| `utils/id-generator.ts` | 房間代碼與訊息識別碼工具 |

`GET /api/account/history` 與健康檢查由 `app.ts` 提供。
`server/.env.example` 列出設定；預設 JSON 位於不納入 Git 的 `server/data/database.json`。

## Site icon

`client/public/fatcat_icon.svg` is the transparent cat favicon. The full-canvas
background path is omitted while white details within the cat remain intact.
Vite rewrites the icon path in `client/index.html` for subpath deployment.

## Client（`client/src/`）

Voice session state tracks connection status and errors per peer, with bounded
refresh rejoin handling. `VoicePanel` renders them and provides a rejoin action.
`RoomPage` applies personal table backgrounds while waiting; `GameShell` applies
them during play. Backgrounds are scoped to the waiting table area and the game centre column,
including floating player labels and hands. Headers, chat, and information panels
retain their original theme surfaces outside the image. The waiting room
fills the available desktop viewport with chat on the right; mobile stacks chat
below the ready button. `AuctionTable` maps calls by their actual seat, and bidding
controls read the current auction state rather than previous log entries.

Card dimensions fit the available table column instead of enforcing a fixed
magnification. `CardHand` uses the current card count and container dimensions to
keep the full hand visible. `GameShell` reserves space for all four seats and fits
centre content within the remaining area using `ResizeObserver`; the table and
hand do not scroll. Short landscape layouts compact seat labels and hide decorative
card backs while retaining remaining-card counts. Chat and history scroll independently.
The trick's lead badge sits below the card beside its seat label.

| 檔案 / 群組 | 職責 |
| --- | --- |
| `main.tsx`、`App.tsx` | React 入口、按需載入路由、登入與連線狀態保護 |
| `api.ts` | 帶 cookie 的 HTTP 請求、timeout 與帳號過期處理 |
| `socket.ts` | 帶 cookie 的 Socket.IO 連線、重試與斷線 |
| `hooks/use-account-connection.ts` | 還原 session、訂閱完整玩家快照並同步各 store |
| `pages/AuthPage.tsx` | `/login`、`/register` 的使用者名稱與密碼表單 |
| `pages/AccountPage.tsx` | `/account`：暱稱、顏色、頭像、密碼、登出所有裝置、歷史結果 |
| `pages/FriendsPage.tsx` | `/friends`：新增好友、申請清單與好友管理、刷新 |
| `pages/PlayerProfilePage.tsx` | `/players/:accountId`：公開身分、好友操作、自己的編輯入口及返回房間 |
| `pages/AccountPages.module.css` | 帳號頁面共用排版與表單樣式 |
| `pages/LobbyPage.tsx` | `/`：建立 / 加入房間與恢復現有房間 |
| `pages/RoomPage.tsx` | `/room/:roomCode`：四座位、準備、頭像、聊天 |
| `pages/GamePage.tsx` | `/game/:roomCode`：對局、玩家身分、手牌、叫牌、結算 |
| `components/AccountNav.tsx` | 大廳、帳號、好友導覽及登出 |
| `components/Avatar.tsx` | 六款共用預設頭像及無障礙名稱 |
| `components/PlayerLink.tsx` | 導覽、好友、房間與遊戲的玩家個人頁連結 |
| `components/MusicControl.tsx` | 路由外的雙語背景音樂控制、音量偏好與錯誤狀態 |
| `audio/music-loop.ts`、`audio/background-music.ts` | 原創循環合成、延後配置及重用 Web Audio 資源 |
| `audio/japanese-instruments.ts` | Seven reusable Japanese-inspired synthesis presets with evolving timbre, breath, vibrato and bell resonance |
| `components/CardHand.tsx`、`components/BiddingPanel.tsx` | 手牌、合法出牌提示、叫牌面板 |
| `components/TrickArea.tsx`、`components/ChatPanel.tsx` | 當前墩、得墩數、玩家聊天與頭像 |
| `components/LanguageSwitch.tsx` | 繁體中文 / 英文切換 |
| `stores/account-store.ts` | 帳號、session 還原與連線狀態 |
| `stores/player-snapshot.ts` | 驗證目前帳號並將完整玩家快照套用到各 store |
| `stores/snapshot-equality.ts` | 比較快照值，保留相等欄位參照並略過重複通知 |
| `stores/player-store.ts`、`stores/room-store.ts` | 目前玩家、房間及座位 |
| `stores/game-store.ts`、`stores/chat-store.ts` | 玩家可見遊戲快照、聊天訊息 |
| `stores/i18n-store.ts` | 語系與翻譯函式 |
| `i18n.ts`、`account-i18n.ts` | 原有遊戲及新增帳號 / 好友翻譯 |
| `player-i18n.ts` | 玩家個人頁翻譯 |
| `styles/global.css` | 全域 CSS 變數、主題與共用樣式 |

`use-account-connection.ts` 已取代 `use-game-events.ts` 和 `use-reconnect.ts`。
玩家暱稱與頭像顯示在房間、遊戲、聊天、好友與帳號導覽。

## 測試（`server/tests/`）

| 群組 | 驗證範圍 |
| --- | --- |
| `engine/*.test.ts` | 牌組、倒牌、叫牌、跟牌、墩與計分規則 |
| `database/json-repository.test.ts` | 持久化、資料隔離、唯一性、無效文件及寫入失敗 |
| `auth/auth-service.test.ts`、`auth/auth-routes.test.ts` | 認證、密碼、session、HTTP 與撤銷 |
| `social/friend-service.test.ts`、`social/friend-routes.test.ts` | 好友流程、並行競爭、權限、HTTP 與公開資料 |
| `social/player-routes.test.ts` | 玩家端點認證、ID、404、公開資料邊界與 profile 更新 |
| `runtime/application.test.ts` | 真實 HTTP / Socket 操作、重新啟動、私人手牌、完整對局、歷史與寫入回復 |
| `runtime/redeal-progress.test.ts` | 多位玩家拒絕倒牌後前進、還原與重新發牌後重設決定 |
| `runtime/player-manager.test.ts` | 多分頁連線、狀態還原與 socket 對照一致性 |
| `runtime/validation.test.ts` | runtime 結構、參照與遊戲快照有效性 |
| `performance/socket-delivery.test.ts` | 房間接收範圍、完整快照等價、多分頁、重複 resume 與真實連線寫入 |
| `performance/socket-harness.ts` | 真實 HTTP / Socket / JSON fixture 與傳送 / 寫入計數工具 |
| `client/player-snapshot.test.ts` | 前端 store 通知、相等快照、帳號隔離及變化欄位更新 |
| `client/background-music.test.ts` | 音訊樣本、首次配置、播放重用、音量、暫停與清理 |

使用 `npm run typecheck`、`npm run lint`、`npm test` 和 `npm run build:client` 執行專案檢查。

## Benchmark

| 檔案 | 執行方式 / 用途 |
| --- | --- |
| `server/tests/database/repository-benchmark.ts` | `npm run bench:database`：固定大型資料的查詢、複製、驗證、序列化及持久寫入 |
| `server/benchmarks/socket-benchmark.ts` | `npm run bench:socket`：三房十二玩家的快照、payload bytes 及 runtime 寫入 |

量測資料與解讀限制見[效能與驗證](./performance.md)。

## 牌桌語音

| 檔案 | 職責 |
| --- | --- |
| `shared/src/types/voice.ts` | 語音成員、設定、SDP / ICE 訊息與加入結果 |
| `server/src/managers/voice-manager.ts` | 每個應用程式的暫時語音成員與分頁限制 |
| `server/src/socket/voice-handler.ts` | 授權、驗證、同房間單播與成員清理 |
| `client/src/voice/ice-servers.ts` | ICE 環境設定驗證與 STUN 預設值 |
| `client/src/voice/voice-session.ts` | 麥克風、對等協商、播放、靜音、拒聽與媒體釋放 |
| `client/src/stores/voice-store.ts` | 單一語音 session 與 Zustand UI 狀態 |
| `client/src/components/VoicePanel.tsx` / `.module.css` | 跨頁牌桌控制列、玩家狀態與錯誤提示 |
| `client/src/voice-i18n.ts` | 語音繁體中文 / 英文文案 |
| `client/.env.example` | API 與公開 ICE 設定範例 |
| `server/tests/voice/voice-signaling.test.ts` | 真實 Socket 授權、隔離、生命週期、零寫入與失敗回復 |
| `server/tests/client/voice-session.test.ts` | 麥克風與媒體生命週期、靜音 / 拒聽、協商競爭、逾時與 ICE 設定 |

`GamePage` 共用既有 `ChatPanel`；文字聊天只捲動聊天紀錄，避免新訊息移動畫面。
`BiddingPanel` 疊在牌桌中央；語音控制移到頂部列的麥克風彈出面板。

## 主題與牌桌版面

| 檔案 | 用途 |
| --- | --- |
| `client/src/stores/theme-store.ts` | `dashboard`（現代）/ `felt`（經典）/ `paper`（紙感）主題；存 `localStorage['bridge.theme']`，`main.tsx` 在 render 前套用 `<html data-theme>` |
| `client/src/styles/global.css` | `:root` 為 dashboard；`[data-theme='felt' / 'paper']` 只覆寫 CSS 變數（桌面、桌框、牌背、字體、輪到誰光圈） |
| `client/src/components/TopBar.tsx` | 唯一頂部列：導覽、遊戲中合約／墩數、語音、音樂、主題、語言、登出；`VoicePanel` 常駐掛載只切換顯示 |
| `client/src/stores/music-store.ts` | 背景音樂單例，跨頁持續播放 |
| `client/src/components/{TableSeat,AuctionTable,GameInfoRail}.tsx` | 座位（牌背、張數、輪到、莊／發）、西北東南叫牌表、合約與墩數欄 |
| `client/src/game-view.ts` | `auctionRows`、`remainingCards`、`tablePosition` 純函式（測試：`server/tests/client/game-view.test.ts`） |
| `client/src/cards.ts` + `client/src/assets/cards/` | cardsJS 牌面 SVG（Vectorized Playing Cards 1.3，LGPL-3.0，授權檔同目錄）；以 Vite asset URL 載入，支援子路徑部署 |

元件不判斷主題；新視覺差異一律新增 CSS 變數。遊戲頁在 ≥1024px 為三欄、768–1023px 資訊欄浮層、<768px 資訊與聊天改為底部抽屜，桌機與手機皆不捲動頁面。

## 多遊戲與投票終止

- `GameType = 'bridge' | 'bigtwo' | 'redpoints' | 'ninetynine'`；房主（建立者，離開時順位遞補）可在等待中的房間切換遊戲，切換會清除所有人的準備狀態。
- 伺服器 `managers/game-manager.ts` 依 `gameType` 分派到 `managers/games/{bridge,bigtwo,redpoints,ninetynine}-game.ts`；遊戲狀態、可見狀態與對局結果都以 `gameType` 區分。資料庫 schema v3（`migrations.ts` 依序升級並保留 `.vN.bak`）。
- 大老二規則見 [big-two-rules.md](big-two-rules.md)，純函式在 `shared/src/rules/bigtwo.ts`（伺服器與前端共用：牌型判定、`legalPlays` 提示）。前端 `client/src/games/bigtwo/BigTwoTable.tsx`。
- 投票終止：遊戲中任一座位玩家可發起（`game:abortVote:start`），60 秒內 ≥3 人同意（`ABORT_VOTE_THRESHOLD`）即終止、不記錄對局、全員回房間；2 人反對或逾時即失敗。冷卻 3 分鐘，從發起時起算。
- 撿紅點、99 規則見 [red-points-rules.md](red-points-rules.md)、[ninety-nine-rules.md](ninety-nine-rules.md)；純函式在 `shared/src/rules/{redpoints,ninetynine}.ts`，前端 `client/src/games/{redpoints,ninetynine}/`。

### Bridge trick presentation

- `client/src/games/bridge/trick-presentation.ts` queues newly completed tricks for 1.5 seconds each while preserving current authoritative game snapshots. Restored history establishes a baseline instead of replaying old tricks; room changes, new games, and unmount cancel pending presentation.
- `client/src/games/bridge/use-trick-presentation.ts` observes game and room stores directly so batched React renders cannot skip completed tricks. `BridgeTable` disables local play during the hold and postpones the final score overlay until the last trick has been shown.
- `client/src/games/bridge/TrickHistory.tsx` and its CSS Module display every completed trick in lead-first clockwise order, with all four cards, seats, lead, and winner. History is available in the information rail and inside the score overlay.

### Music catalog

`audio/music-tracks.ts` combines the existing catalog with seven original loops in
`audio/new-music-tracks.ts` and four additional Japanese-inspired tracks in
`audio/japanese-music-tracks.ts`. `audio/music-categories.ts` defines genre and energy
metadata; `MusicControl` groups the catalog and displays BPM and energy. See
[player profiles and music](./player-profiles-and-music.md) for playback behavior.

### Turn reminder

`hooks/use-turn-sound.ts` connects the global toolbar to turn notifications and
user-gesture audio activation. `stores/turn-sound-store.ts` persists the separate
on/off preference exposed by `MusicControl`. Audio and notification lifecycle
logic live in `audio/turn-*.ts`; see [music settings](./player-profiles-and-music.md).
