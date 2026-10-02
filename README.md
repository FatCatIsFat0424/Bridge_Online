# Bridge Online

線上四人橋牌遊戲，採用 React 19、TypeScript、Express、Socket.IO 與 npm workspaces。

## 功能

- 使用者名稱／密碼註冊與登入、七天 Session、登出所有裝置與修改密碼
- 可編輯暱稱、顏色與六種頭像；好友邀請、接受／拒絕／取消與移除好友
- 公開玩家個人頁，可從好友、房間與對局中的玩家入口開啟並管理好友關係
- 可選背景音樂：預設停止，支援播放／暫停、音量與跨頁持續播放
- 建立／加入房間、四方位選座、準備、聊天
- 牌桌四人語音、麥克風靜音與拒聽；等待房間及正式對局皆可文字聊天
- 發牌、倒牌重洗、叫牌、出牌、結算與永久對局紀錄
- 重新整理／斷線／伺服器重啟後恢復房間與手牌（60 秒重連窗口）
- 中文與 English
- JSON 持久化與非同步 Repository 介面，預留未來 SQL adapter

## 啟動

需要 Node.js 22.13+（建議 Node.js 24）與 npm。

```bash
npm ci
npm run dev:server
```

另一個終端啟動前端：

```bash
npm run dev:client
```

開啟 http://localhost:5173，建立帳號後即可使用。後端預設 port 3001；
前端透過 Vite proxy 存取 `/api` 與 `/socket.io`。
背景音樂需自行按播放，每次重新載入保持停止；瀏覽器僅記住音量。
進入房間後可按「加入語音」授權麥克風；靜音與拒聽各自控制，離開房間自動結束。
正式部署的語音需要 HTTPS；限制較嚴格的網路需設定 TURN。
可在 `client/.env.local` 設定 `VITE_WEBRTC_ICE_SERVERS`，格式與限制見[牌桌語音](docs/wiki/voice-chat.md)。

## 資料與設定

第一次啟動自動建立 `server/data/database.json`，儲存帳號、Session、好友、
房間、遊戲狀態、聊天與對局紀錄。此目錄不加入 Git。JSON adapter 每個資料檔
限一個 server process；所有寫入先驗證並原子替換，毀損檔案不會自動清空。

環境變數：

| 名稱 | 預設／用途 |
| --- | --- |
| `PORT` | `3001` |
| `HOST` | Optional listening IP; see [deployment](docs/wiki/deployment.md) |
| `TRUST_PROXY_LOOPBACK` | `false`; enable only for a trusted local reverse proxy |
| `DATABASE_PATH` | `server/data/database.json`；可指定絕對路徑 |
| `CLIENT_ORIGIN` | `http://localhost:5173,http://127.0.0.1:5173`；正式環境必填 |
| `NODE_ENV` | `production` 時 cookie 啟用 Secure，須使用 HTTPS |

請將變數設定於執行環境；`server/.env.example` 僅為範例，不會自動載入。
備份、還原、資料結構與未來 SQL 遷移步驟見
[帳號與資料庫](docs/wiki/accounts-and-storage.md)。

## 結構

```text
shared/src/         共用型別、帳號／Socket 契約與遊戲常數
server/src/
  auth/             密碼、Session、HTTP 驗證與限流
  database/         Repository、JSON adapter、schema 驗證
  http/             帳號與好友 HTTP API
  social/           好友生命週期
  runtime/          遊戲狀態儲存、還原與交易協調
  socket/           已認證的遊戲操作與狀態同步
  managers/         玩家、房間、遊戲、聊天執行期狀態
  engine/           橋牌純函式
server/tests/       引擎、帳號、資料庫、好友與完整對局測試
client/src/
  pages/            登入／註冊、大廳、房間、遊戲、帳號、好友、玩家個人頁
  audio/            原創背景音樂合成與 Web Audio 控制
  voice/            WebRTC 語音、音訊生命週期與 ICE 設定
  components/       頭像、導覽、叫牌、手牌、聊天等 UI
  hooks/            帳號 Session 與 Socket 狀態同步
  stores/           Zustand 狀態
docs/               需求、設計、任務進度與 Wiki
```

遊戲流程由伺服器控制；Socket 操作透過 runtime coordinator 儲存成功後，
才回應與傳送每位玩家自己的 `player:state`。密碼與 Session 不存入前端
localStorage；不會將其他玩家的手牌傳送給客戶端。

## 驗證

```bash
npm run typecheck
npm run lint
npm test
npm run build:client
```

測試涵蓋帳號與好友授權、毀損資料保護、並行寫入、失敗還原、
伺服器重啟後恢復對局、52 張牌完整出牌以及持久對局紀錄。

## 效能量測

```bash
npm run bench:database
npm run bench:socket
```

Benchmark 使用獨立暫存資料，不使用正式資料庫。測試分別涵蓋大型 JSON 查詢 / 持久寫入，
以及三房十二玩家的快照傳送、payload bytes 與 runtime 寫入次數。
索引、廣播範圍、前端載入的前後量測及限制見[效能與驗證](docs/wiki/performance.md)。

## 文件

- [Deploy with systemd at /bridge_online/](docs/wiki/deployment.md)
- [Wiki](docs/wiki/index.md)
- [API](docs/wiki/api-events.md)
- [帳號／JSON／SQL 遷移](docs/wiki/accounts-and-storage.md)
- [架構](docs/wiki/architecture.md)
- [效能與 Benchmark](docs/wiki/performance.md)
- [玩家個人頁與背景音樂](docs/wiki/player-profiles-and-music.md)
- [牌桌語音、靜音與拒聽](docs/wiki/voice-chat.md)
- [任務進度](docs/tasks/progress.md)

MIT License
