# HTTP 與 Socket API

> [返回目錄](./index.md) · [帳號與持久化儲存](./accounts-and-storage.md) · 更新：2026-10-03

## HTTP 共通規則

API 前綴為 `/api`，回傳 JSON。成功包含 `{ success: true, ... }`；失敗包含
`{ success: false, error: string }` 與對應 HTTP 狀態碼。需登入的端點使用 session cookie。
所有異動請求需要允許的 `Origin` 與 `Content-Type: application/json`，無欄位時可送 `{}`。
API 回應禁止快取。密碼、session 儲存、cookie 與設定詳見[帳號說明](./accounts-and-storage.md)。

### 帳號

| 方法與路徑 | 請求資料 | 成功回應 / 行為 |
| --- | --- | --- |
| `POST /api/auth/register` | `{ username, password, nickname?, color?, avatar? }` | `201 { success, account }`；建立帳號與登入 cookie |
| `POST /api/auth/login` | `{ username, password }` | `{ success, account }`；建立登入 cookie |
| `GET /api/auth/me` | — | `{ success, account }`；還原目前帳號 |
| `PATCH /api/auth/profile` | `{ nickname?, color?, avatar? }` | `{ success, account }`；更新個人資料與已連線玩家 |
| `POST /api/auth/password` | `{ currentPassword, newPassword }` | `{ success }`；撤銷所有 session，需要重新登入 |
| `POST /api/auth/logout` | `{}` | `{ success }`；撤銷目前 session 並清除 cookie |
| `POST /api/auth/logout-all` | `{}` | `{ success }`；撤銷此帳號所有 session |
| `GET /api/account/history` | — | `{ success, matches }`；目前帳號最近最多 50 場完成對局 |

`account` 為 `AccountProfile`，包含 `id`、`username`、`nickname`、`color`、`avatar`、
`createdAt`、`updatedAt`。使用者名稱比對不分大小寫。公開資料不含密碼雜湊或 session token。
對局摘要包含 `id`、`roomCode`、四個 `accountIds`、`result` 與 `finishedAt`。

### 好友（全部需要登入）

| 方法與路徑 | 請求資料 | 成功回應 / 行為 |
| --- | --- | --- |
| `GET /api/friends` | — | `{ success, friends, incoming, outgoing }` |
| `GET /api/friends/search?username=...` | 完整使用者名稱 | `{ success, account }`；不存在時 `account: null` |
| `POST /api/friends/requests` | `{ username }` | `201 { success, request }`；送出申請 |
| `POST /api/friends/requests/:id/accept` | `{}` | `{ success }`；僅收件人可接受 |
| `DELETE /api/friends/requests/:id` | `{}` | `{ success }`；收件人拒絕或寄件人取消待處理申請 |
| `DELETE /api/friends/:accountId` | `{}` | `{ success }`；移除與指定帳號的已接受好友關係 |

`friends` 是 `PublicAccount[]`，欄位為 `id`、`username`、`nickname`、`color`、`avatar`。
`incoming`、`outgoing` 的每筆申請包含 `id`、`requester`、`recipient`、`createdAt`；
雙方身分也使用 `PublicAccount`。自我申請、重複或反向重複關係、無權操作均會拒絕。

### 玩家個人頁（需要登入）

`GET /api/players/:accountId` 回傳 `{ success: true, account: PublicAccount }`。
公開欄位僅有 `id`、`username`、`nickname`、`color`、`avatar`；不公開其他帳號的歷史、
時間戳或認證資料。ID 必須是 1–128 個英數字、底線或連字號。
無效 ID 為 400、無有效 session 為 401、不存在為 404。
前端入口與好友操作見[玩家個人頁](./player-profiles-and-music.md)。

### 健康檢查

`GET /health` 不需要登入，回傳 `{ status: 'ok' }`。

## Client → Server Socket actions

Socket.IO 握手必須來自允許的 Origin 並帶有效 session cookie。所有 action 使用最後一個
callback 參數回覆，無 payload 的 action 直接傳 callback。操作會再次驗證 session 和權限，
成功持久化後才回覆與廣播。缺少有效 callback 的封包不執行操作。
未改變 runtime 的 `player:resume` 可略過重複寫入，但仍執行認證、回覆 callback 與房間同步。
需要持久化的真實狀態變化仍以成功保存作為回覆前提。

| 事件 | Payload | 成功 callback / 行為 |
| --- | --- | --- |
| `player:resume` | — | `PlayerSnapshot`；附加帳號連線並還原目前狀態 |
| `room:create` | `{ gameType: 'bridge' }` | `{ success, roomCode }` |
| `room:join` | `{ roomCode }` | `{ success, room }` |
| `room:leave` | — | `{ success }`；進行中離開會中止對局 |
| `room:changeSeat` | `{ seat: 'N' \| 'E' \| 'S' \| 'W' }` | `{ success }` |
| `room:ready` | — | `{ success }`；四座全部準備後開始遊戲 |
| `room:unready` | — | `{ success }`；等待中的房間可取消準備 |
| `game:redealResponse` | `{ accept: boolean }` | `{ success }`；目前被詢問的玩家回覆倒牌重洗 |
| `game:bid` | `{ bid: BidAction }` | `{ success }` |
| `game:playCard` | `{ card: Card }` | `{ success }`；驗證輪次與合法出牌 |
| `game:continue` | — | `{ success }`；僅結算階段可清除該場遊戲、回到房間 |
| `chat:send` | `{ message: string }` | `{ success }`；去除首尾空白後需有 1–500 字元 |

失敗 callback 一律為 `{ success: false, error: string }`。玩家身分由 session 決定，
不接受客戶端傳入的帳號 ID 取代認證。暱稱與頭像透過 HTTP profile API 更新。

## Server → Client：`player:state`

伺服器使用單一 `player:state` 事件傳送完整的權威狀態；payload 與 `player:resume`
成功 callback 相同：

```typescript
interface PlayerSnapshot {
  success: boolean;
  error?: string;
  player?: PlayerInfo;
  room?: RoomInfo;
  gameState?: PlayerVisibleGameState;
  chatHistory?: ChatMessage[];
}
```

客戶端以快照取代對應 store 狀態；缺少 `room`、`gameState` 時清除舊房間或遊戲。
`gameState` 提供 `mySeat`、`myHand`、`validCards`、叫牌、合約、公開墩紀錄、結果與日誌，
不含其他玩家尚未出的手牌。聊天快照提供該房間保留的最近最多 200 則訊息。
重新整理或重連也使用同一流程，不使用獨立的匿名玩家 reconnect token。

快照接收者限操作者與受影響的舊 / 新房間成員，包含同帳號的所有已連線分頁。
離開或逾時移除玩家時，原房間成員仍會收到更新；無關房間不接收該次操作的快照。
Client 保留相等資料的既有 store 參照，避免重複通知；協定 payload 不變。
接收範圍與功能等價證據見[效能與驗證](./performance.md)。

具體型別位於 `shared/src/types/socket-events.ts`、`account.ts`、`social.ts`、`game.ts`。

## 牌桌語音協商

語音使用獨立 `voice:*` 事件，不改變 `player:state` 格式。
每個 action 重新驗證 session，並依已提交的房間成員身分授權。
聲音本身透過 WebRTC 傳輸，不經 Socket.IO；語音 action 不寫入 JSON。

| Client → Server | Payload | 成功 callback |
| --- | --- | --- |
| `voice:join` | `{ muted: boolean, deafened: boolean }` | `{ success, peerId, state }` |
| `voice:leave` | 無 | `{ success }` |
| `voice:settings` | `{ muted: boolean, deafened: boolean }` | `{ success }` |
| `voice:signal` | `{ targetPeerId, description?, candidate? }` | `{ success }` |

`description` 與 `candidate` 必須恰有一種。SDP 僅接受 offer / answer，限制 12,000 字元；
ICE candidate 限制 2,048 字元並驗證相關欄位。來源 peer ID 一律由伺服器指定，
目標必須已加入同一房間語音；同一帳號同時只允許一個分頁加入。

| Server → Client | Payload | 用途 |
| --- | --- | --- |
| `voice:state` | `{ roomCode, participants }` | 同房間已加入語音的玩家狀態 |
| `voice:signal` | `{ fromPeerId, description?, candidate? }` | 轉送給單一已驗證的對等玩家 |
| `voice:left` | `{ reason }` | 結束該分頁語音 |

`participants` 的每筆資料為 `{ peerId, accountId, muted, deafened }`。
每次重新加入配置新的 peer ID；已離開的 peer 無法繼續協商。
語音每連線每分鐘 1,200 次限流，與原有遊戲每分鐘 240 次限額分開。
型別見 `shared/src/types/voice.ts`；操作、媒體清理與部署見[牌桌語音](./voice-chat.md)。
