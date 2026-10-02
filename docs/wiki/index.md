# Bridge Online Wiki

> 與程式碼同步維護的專案導覽。更新：2026-10-03。

## 目錄

- [系統架構](./architecture.md) — HTTP、Socket、遊戲流程與儲存邊界
- [HTTP 與 Socket API](./api-events.md) — 帳號、好友、歷史 endpoints 與玩家狀態快照
- [帳號、好友與持久化儲存](./accounts-and-storage.md) — 登入、JSON 資料、設定、備份與未來 SQL 遷移
- [效能與驗證](./performance.md) — Repository 索引、快照接收範圍、前端更新與可重現量測
- [玩家個人頁與背景音樂](./player-profiles-and-music.md) — 公開身分、好友操作與可選音樂控制
- [牌桌語音與文字聊天](./voice-chat.md) — 四人語音、靜音、拒聽與 WebRTC 部署
- [遊戲規則](./game-rules.md) — 橋牌規則、狀態機與對局流程
- [元件清單](./components.md) — Shared、Server、Client 模組及測試位置

## 專案概述

Bridge Online 是四人線上橋牌遊戲。玩家先以使用者名稱與密碼註冊或登入，
再建立或加入房間、選座並準備。帳號有可修改的暱稱、顏色與預設頭像，
支援好友申請、好友管理及個人完成對局歷史。介面提供繁體中文與英文。
玩家身分可開啟公開個人頁；全域背景音樂可自行播放、暫停及調整音量，預設停止。

伺服器決定遊戲狀態，透過 `player:state` 快照同步各玩家可見的資料。
JSON 資料庫保存帳號、七天 session、好友、房間、遊戲、聊天與歷史結果；
重新整理和伺服器重啟可還原現有狀態。SQL 遷移將透過相同的 repository 介面實作。

## 技術與開發

| 層級 | 技術 |
| --- | --- |
| 前端 | React、Vite、TypeScript、Zustand、CSS Modules |
| 後端 | Node.js、Express、Socket.IO、TypeScript |
| 儲存 | 具 schema 驗證與原子替換的 JSON repository |
| 共用 | `shared/` 型別與常數 |
| 測試 | Vitest，涵蓋 engine、資料庫、認證、好友與完整應用程式 |
| 多語系 | 專案內的翻譯字典與 Zustand 語系 store |

安裝與啟動方式見 [README](../../README.md)。預設前端為 `http://localhost:5173`，
後端為 `http://localhost:3001`，Vite 代理 `/api` 與 `/socket.io`。
環境變數和資料備份步驟見[儲存說明](./accounts-and-storage.md)。

## 最近更新

| 日期 | 異動 |
| --- | --- |
| 2026-10-03 | 新增公開玩家個人頁、跨頁玩家入口與好友操作，以及預設停止的全域背景音樂 |
| 2026-10-03 | 牌桌 WebRTC 語音、獨立麥克風靜音與拒聽，正式對局加入原有文字聊天面板 |
| 2026-10-03 | 效能優化：按需資料索引、局部複製、同房間快照、未改變 resume 省略寫入、路由延後載入與 store 快照去重；新增 benchmark 與回歸測試 |
| 2026-10-03 | 新增持久化 JSON repository、帳號與 session、好友、暱稱 / 頭像、完成對局歷史及重啟還原；即時通訊統一為完整玩家快照 |
| 2026-07-18 | 初始化 Wiki 結構 |
