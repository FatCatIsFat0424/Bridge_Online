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

## Client（`client/src/`）

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
`BiddingPanel` 改用正常頁面排列，避免遮住牌桌語音控制。
