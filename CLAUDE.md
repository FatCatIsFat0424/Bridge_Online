# CLAUDE.md — Bridge Online 專案指引

本文件為 AI 助手提供本專案的完整上下文，以便快速理解專案結構與開發規範。

---

## 專案概述

**Bridge Online** 是一款線上橋牌 PvP 網頁遊戲。玩家透過瀏覽器進入遊戲，輸入暱稱後即可建立或加入房間，與其他玩家進行標準橋牌對局。

### 核心功能

- 使用者名稱／密碼帳號、持久 Session、可編輯暱稱／顏色／頭像、好友邀請與對局紀錄
- 房間制度（建立/加入/座位選擇/準備）
- 完整橋牌規則（發牌、倒牌重洗、叫牌、出牌、結算）
- 即時聊天（房間級別）
- 斷線重連（60 秒超時）
- 中英文雙語介面（i18n）

---

## 技術棧

| 層級 | 技術 |
|------|------|
| 前端 | React 18+ (Vite) + TypeScript + Zustand + CSS Modules |
| 後端 | Node.js + Express + Socket.IO + TypeScript |
| 共用 | `shared/` 目錄（型別 + 常數） |
| 測試 | Vitest |
| i18n | 型別化中英文辭典 + Zustand |
| 套件管理 | npm（monorepo with workspaces） |

---

## 專案結構

```
Bridge_Online/
├── .agents/               # Agent 規則、Skills、Hooks
├── docs/                  # 設計文件與 Wiki
│   ├── agents.md          # 原始需求
│   ├── proposal.md        # 工程計劃
│   ├── design.md          # 詳細設計（shared + server）
│   ├── tasks/             # 8 個 Phase 的任務分解
│   └── wiki/              # 自動維護的 Wiki
├── shared/src/            # 前後端共用型別與常數
├── server/src/            # 後端原始碼
│   ├── engine/            # 遊戲引擎（純函式）
│   ├── managers/          # 業務邏輯（狀態管理）
│   ├── socket/            # Socket 事件處理（膠水層）
│   └── utils/             # 工具函式
├── server/tests/          # 後端測試
├── client/src/            # 前端原始碼
│   ├── pages/             # 頁面元件
│   ├── components/        # UI 元件
│   ├── stores/            # Zustand 狀態管理
│   ├── hooks/             # 自訂 Hooks
│   └── styles/            # CSS Modules 樣式
├── CLAUDE.md              # 本文件
└── README.md              # 專案 README
```

---

## 核心架構規則

### 模組依賴方向（嚴格單向）

```
Socket 層 → Manager 層 → Engine 層 → Shared (types/constants)
```

- ❌ Engine 不得依賴 Manager 或 Socket
- ❌ Manager 不得依賴 Socket
- ❌ Manager 之間不得直接呼叫（由 Socket 層協調）
- ✅ `game-manager` 可依賴所有 Engine 模組

### 設計原則

1. **不使用 Class** — 以模組函式 + 模組私有 Map 為邊界
2. **Engine = 純函式** — 無副作用、不持有狀態、輸入→輸出
3. **Manager = 狀態持有者** — 維護記憶體中的 Map，對外暴露函式
4. **Socket = 膠水層** — 僅事件路由與 payload 轉換，不含業務邏輯
5. **Server-Authoritative** — 所有遊戲邏輯在後端執行

---

## 編碼規範

### TypeScript

- 使用 `type` 定義聯合型別/別名，`interface` 定義物件結構
- 所有函式必須有明確的參數型別與回傳型別
- **禁止** `any`、**禁止** `class`、**禁止** `default export`
- 字串用單引號，語句結尾加分號

### 命名慣例

| 類別 | 風格 | 範例 |
|------|------|------|
| 檔案名 | kebab-case | `player-manager.ts` |
| 型別/介面 | PascalCase | `PlayerInfo` |
| 函式/變數 | camelCase | `createPlayer` |
| 常數 | UPPER_SNAKE_CASE | `HAND_SIZE` |
| CSS class | camelCase | `.seatSlot` |

### 前端

- CSS Modules（`.module.css`），不使用 Tailwind
- Zustand 狀態管理
- CSS 變數定義在 `global.css`

### 後端

- 帳號、Session、好友、對局紀錄與遊戲狀態存於版本化 JSON 資料庫；透過非同步 Repository 隔離，預留 SQL 遷移
- Manager 異動透過 runtime coordinator 序列化；儲存成功後才 ACK／廣播，失敗還原
- 詳見 [帳號與資料庫](docs/wiki/accounts-and-storage.md)，目前 JSON adapter 限單一 server process
- Socket.IO 事件格式：`namespace:action`（如 `room:create`）
- 所有 Client→Server 事件使用 callback 回傳
- 錯誤格式：`{ success: false, error: string }`

---

## 測試要求

- 所有 Engine 層函式必須有對應的單元測試
- 測試框架：Vitest
- 測試路徑：`server/tests/engine/`
- 每個任務完成前必須通過：ESLint + TypeScript 型別檢查 + 單元測試

---

## 文件更新規則

- 程式碼新增/刪除/修改 → 同步更新 `docs/wiki/` 相關頁面
- 任務完成 → 更新 `docs/tasks/progress.md`
- 設計變更 → 回溯更新對應設計文件

---

## 開發階段

| Phase | 內容 | 依賴 |
|-------|------|------|
| 0 | 專案初始化、共用型別與常數 | 無 |
| 1 | 大廳 + 房間系統 | Phase 0 |
| 2 | 聊天功能 | Phase 1 |
| 3 | 發牌 + 叫牌引擎 | Phase 1（可與 Phase 2 並行） |
| 4 | 出牌 + 結算引擎 | Phase 3 |
| 5 | 斷線重連 | Phase 4 |
| 6 | i18n 多語系 | Phase 4（可與 Phase 5 並行） |
| 7 | 視覺打磨 + 整合測試 | 全部 |

---

## 常用命令

```bash
# 開發模式
cd client && npm run dev          # 前端開發伺服器
cd server && npx tsx src/index.ts  # 後端開發伺服器

# 測試
cd server && npx vitest run        # 執行所有測試
cd server && npx vitest            # Watch 模式

# 型別檢查
cd shared && npx tsc --noEmit
cd server && npx tsc --noEmit
cd client && npx tsc --noEmit

# Lint
npx eslint "shared/src/**/*.ts" "server/src/**/*.ts" "client/src/**/*.{ts,tsx}"

# 建置
cd client && npx vite build
```

---

## 參考文件

- [原始需求](docs/agents.md)
- [工程計劃](docs/proposal.md)
- [詳細設計](docs/design.md)
- [任務進度](docs/tasks/progress.md)
- [Wiki](docs/wiki/index.md)
