# Bridge Online — 專案級 Agent 規則

> 本文件定義所有 Agent 在本專案中必須遵守的全域規則。

---

## 專案概述

Bridge Online 是一款線上橋牌 PvP 網頁遊戲，採用前後端分離的 monorepo 架構。

- **前端**: React 18+ (Vite) + TypeScript + Zustand + CSS Modules
- **後端**: Node.js + Express + Socket.IO + TypeScript
- **共用層**: shared/ 目錄存放前後端共用的型別與常數
- **測試**: Vitest
- **語言**: TypeScript（前後端皆使用）

---

## 核心架構規則

### 模組依賴方向（嚴格遵守）

```
Socket 層 → Manager 層 → Engine 層 → Shared (types/constants)
```

- ❌ Engine 不得依賴 Manager 或 Socket
- ❌ Manager 不得依賴 Socket
- ❌ 任何模組不得反向依賴上層
- ✅ Socket 層作為膠水層，負責協調多個 Manager

### 設計風格

- **不使用 Class**：以模組（module）為邊界，使用函式與模組私有狀態
- **Engine 層為純函式**：無副作用、不持有狀態、輸入→輸出
- **Manager 層管理狀態**：維護記憶體中的 Map/Object
- **Socket 層為膠水層**：僅事件路由與 payload 轉換，不含業務邏輯
- **Server-Authoritative**：所有遊戲邏輯在後端執行，前端僅負責顯示與輸入

---

## 編碼規範

### TypeScript

- 使用 `type` 定義聯合型別與別名，使用 `interface` 定義物件結構
- 所有函式必須有明確的參數型別與回傳型別標注
- 禁止使用 `any`，必要時使用 `unknown` 並進行型別收窄
- 使用 `readonly` 修飾不應被修改的陣列與物件
- 匯出使用具名匯出（named export），避免 default export
- 字串使用單引號 `'`，結尾加分號 `;`

### 命名慣例

- **檔案名**: kebab-case（如 `player-manager.ts`）
- **型別/介面**: PascalCase（如 `PlayerInfo`）
- **函式/變數**: camelCase（如 `createPlayer`）
- **常數**: UPPER_SNAKE_CASE（如 `HAND_SIZE`）
- **CSS Module class**: camelCase（如 `.seatSlot`）

### 前端規範

- 使用 CSS Modules（`.module.css`），不使用 Tailwind
- 使用 Zustand 進行狀態管理
- CSS 變數定義在 `global.css` 中
- 元件檔案使用 PascalCase（如 `GameBoard.tsx`）

### 後端規範

- 帳號、Session、好友、對局紀錄與遊戲狀態透過非同步 Repository 寫入 JSON 資料庫；未來 SQL adapter 必須維持相同原子性與資料約束
- Manager 的 Map/Object 是執行期狀態；Socket 異動必須透過 runtime coordinator，成功儲存後才回應與廣播
- Socket.IO 事件使用 `namespace:action` 命名格式（如 `room:create`）
- 所有 Client→Server 事件使用 callback 回傳結果
- 錯誤回傳格式：`{ success: false, error: string }`

---

## 測試要求

- 所有 Engine 層函式必須有對應的單元測試
- 測試框架：Vitest
- 測試檔案放置在 `server/tests/engine/` 目錄
- 每個任務完成前必須通過：ESLint + TypeScript 型別檢查 + 單元測試

---

## 文件更新規則

- 任何程式碼的新增、刪除、修改都必須同步更新 `docs/wiki/` 相關頁面
- 任務完成時必須更新 `docs/tasks/progress.md` 進度
- 設計變更必須回溯更新對應的設計文件

---

## 參考文件

- [需求文件](file:///c:/Users/ben91/Desktop/Bridge_Online/docs/agents.md)
- [工程計劃](file:///c:/Users/ben91/Desktop/Bridge_Online/docs/proposal.md)
- [詳細設計](file:///c:/Users/ben91/Desktop/Bridge_Online/docs/design.md)
- [任務進度](file:///c:/Users/ben91/Desktop/Bridge_Online/docs/tasks/progress.md)
