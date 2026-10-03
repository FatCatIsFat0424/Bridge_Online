# 玩家個人頁與背景音樂

> [返回目錄](./index.md) · [API](./api-events.md) · [任務 10](../tasks/10-player-profiles-and-music.md) · 更新：2026-10-03

## 玩家個人頁

登入後可開啟 `/players/:accountId`，查看公開頭像、顏色、暱稱與 `@username`。
導覽列、自己的帳號設定、好友 / 申請清單、房間已入座玩家及遊戲玩家均提供入口。
查看個人頁不會離開目前房間；頁面提供返回房間或對局的捷徑。

自己的個人頁連到 `/account` 編輯資料；其他玩家依好友狀態提供：

| 關係 | 可用操作 |
| --- | --- |
| 尚無關係 | 傳送好友申請 |
| 收到申請 | 接受或拒絕 |
| 已送出申請 | 取消申請 |
| 已成為好友 | 確認後移除好友 |

這些操作使用既有好友 API 和授權檢查。頁面按需載入，處理載入中、找不到玩家、
讀取失敗及重試；切換玩家或卸載後不套用過期的非同步讀取結果，重新取得焦點時刷新。
介面支援繁體中文與英文。

`GET /api/players/:accountId` 需要有效 session，回傳 `{ success: true, account }`。
`account` 僅包含 `id`、`username`、`nickname`、`color`、`avatar` 五個 `PublicAccount` 欄位。
無效 ID 回傳 400、未登入回傳 401、不存在回傳 404。
登入者可查看其他帳號的公開個人頁，不需要先成為好友。
端點不提供密碼、session、時間戳、私人手牌或他人的對局歷史。

## 背景音樂

全域控制列提供播放 / 暫停與 0–100% 音量。每次載入頁面都預設停止，
只有使用者按下播放後才建立 Web Audio 音訊資源；切換路由不重啟音樂。
暫停保留播放位置，再次播放會繼續。音量 0 為靜音。

音量保存在目前瀏覽器的 `localStorage` 鍵 `bridge.music.volume`，初始值為 25%。
播放狀態不保存，不會因重新整理自動播放。瀏覽器不允許儲存設定時仍可使用控制列。
這是本機偏好，不修改帳號設定或 JSON schema。

Music is original instrumental audio synthesized locally by `audio/music-loop.ts`.
The catalog in `audio/music-tracks.ts` contains 18 tracks: the original seven,
seven compositions from `audio/new-music-tracks.ts` (punk, kawaii EDM, ambient,
8-bit/chiptune, Celtic, Japanese-inspired, and house), and four more Japanese-inspired
compositions from `audio/japanese-music-tracks.ts`. The Japanese-inspired group has
five tracks, spanning calm garden and rain moods, a spring melody, and festival rhythm. Each composition has its own
melody, accompaniment, rhythm, and synthesized timbres.

The five Japanese arrangements share seven procedural presets in
`audio/japanese-instruments.ts`: koto, shamisen, shakuhachi, shinobue, taiko,
shime-daiko, and suzu bells. Brightness decay softens plucked-string attacks,
separate noise decay shapes picks and drum strikes, delayed vibrato gives wind
notes movement, and inharmonic partials add metallic bell resonance. These are
stylized synthesized instruments, not recordings of acoustic instruments.

| Arrangement | Instrument roles |
| --- | --- |
| Moonlit Courtyard | Koto melody, shamisen responses, low shakuhachi phrases and sparse bells |
| Lantern Procession | Shinobue lead, shamisen rhythm, alternating low taiko and high shime-daiko |
| Rain on Paper | Soft koto with long shakuhachi responses and quiet rain accents |
| Petals on the River | Three-beat koto arpeggios, shinobue, shamisen responses and occasional bells |
| Moss and Stillness | Spacious shakuhachi, sparse koto and a soft drone without percussion |

Track identifiers and playlist order remain stable when arrangements change,
so saved selections continue to work.

`audio/music-categories.ts` defines bilingual genre and energy labels. The music
menu groups tracks by genre and shows energy (calm, steady, energetic) and BPM.
The current track displays the same attributes. Classification does not change
playlist order: repeat-one, sequential, shuffle, previous, and next retain their
existing behavior. Track and mode preferences use `bridge.music.track` and
`bridge.music.mode`; playback never starts automatically after a refresh.

Tracks render into 22,050 Hz mono buffers on first selection and reuse the shared
audio context and cached buffers. Loop tails and echoes wrap around the boundary;
track changes use a 1.5-second crossfade. No music downloads or external music
service is needed. Volume changes use a smooth GainNode transition.

瀏覽器不支援 Web Audio 或拒絕播放時，控制列顯示雙語錯誤並允許再次嘗試。
音樂純屬前端體驗，不參與認證、遊戲判定或網路同步。

## Turn reminder

The music menu also includes a separate, enabled-by-default your-turn sound switch.
Its preference is saved as `bridge.sound.turn`; pausing music or setting music volume
to zero does not disable turn reminders. The reminder uses a short original
synthesized chime instead of an external audio file.

The browser must first receive a pointer or keyboard gesture to enable audio.
Blocked audio never interrupts gameplay and old reminders are not queued for later
playback. The controller tracks actionable turn changes rather than component
renders, so unrelated snapshots do not repeat the sound.

## 實作與驗證

| 檔案 | 職責 |
| --- | --- |
| `server/src/http/player-routes.ts` | 公開玩家資料端點與 session 驗證 |
| `client/src/pages/PlayerProfilePage.tsx` | 個人頁、好友狀態及返回房間 |
| `client/src/components/PlayerLink.tsx` | 共用玩家身分連結 |
| `client/src/player-i18n.ts` | 個人頁繁體中文 / 英文文案 |
| `client/src/audio/music-loop.ts` | 合成可循環的音訊 samples |
| `client/src/audio/background-music.ts` | 延後建立、重用、暫停與釋放音訊資源 |
| `client/src/components/MusicControl.tsx` | 全域控制列、音量偏好與雙語狀態 |
| `client/src/main.tsx` | 在路由外掛載單一音樂控制列 |

`server/tests/social/player-routes.test.ts` 驗證授權、ID、404、公開欄位與最新 profile。
`server/tests/client/background-music.test.ts` 驗證樣本、延後配置、重用、音量、暫停與清理。
其餘帳號、好友及完整對局回歸沿用原測試；最終瀏覽器與整體檢查在[任務進度](../tasks/progress.md)記錄。
