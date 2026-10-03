# 牌桌語音與文字聊天

> [返回目錄](./index.md) · [API](./api-events.md) · 更新：2026-10-03

## 操作

房間成員可主動加入語音，並授權瀏覽器使用麥克風。尚未加入時不開啟麥克風。
「靜音自己」停止傳送自己的聲音；「拒聽」停止播放其他玩家的語音，兩者獨立控制。
拒聽不會停止背景音樂，也不會隱藏文字聊天。

語音跟隨實際房間成員身分；等待房間進入對局或查看個人頁時可繼續通話。
離開語音、離開房間、登出或連線中斷會釋放麥克風與對等連線。
重新整理與重連後須自行再次加入，不會自動開啟麥克風。
同一帳號同時僅允許一個分頁加入語音，以避免重複收音。

等待房間與正式對局頁皆提供原有的文字聊天面板。文字訊息沿用帳號驗證、
房間隔離與最近 200 則持久紀錄；靜音及拒聽僅影響語音。

## 傳輸與部署

語音使用瀏覽器 WebRTC，在最多四位同房間玩家之間建立音訊連線。
Socket.IO 只轉送加入狀態與連線協商訊息，伺服器不錄音、不將語音寫入 JSON。
語音成員、靜音與拒聽狀態僅存在本次連線，不增加資料庫 schema。

麥克風需要 HTTPS 或 localhost 等安全環境及使用者授權；拒絕授權、沒有裝置、
裝置被占用或瀏覽器不支援時會顯示錯誤。若瀏覽器阻擋遠端音訊自動播放，
可透過介面的播放按鈕再次啟用。[MDN：getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)

一般網路透過 STUN 尋找直連路徑；限制較嚴格的 NAT / 防火牆可能需要 TURN 中繼。
實際跨網路可用性取決於部署的 ICE 伺服器，localhost 測試不代表所有網路皆能直連。
[WebRTC：Peer connections](https://webrtc.org/getting-started/peer-connections)

靜音使用音訊軌的 `enabled` 屬性，停用時產生無聲音訊。
拒聽則在本機靜音遠端播放，並不要求對方停止傳輸。
[MDN：MediaStreamTrack.enabled](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/enabled)

## ICE 設定

預設使用 `stun:stun.l.google.com:19302`。可在 `client/.env.local` 設定：

```dotenv
VITE_WEBRTC_ICE_SERVERS=[{"urls":"stun:stun.l.google.com:19302"},{"urls":"turn:turn.example.com:3478","username":"replace-me","credential":"replace-me"}]
```

修改後重新啟動 Vite；正式環境重新建置並部署前端。
JSON 陣列最多八個 server、合計十六個 URL，只接受 `stun:`、`stuns:`、`turn:`、`turns:`。
設定格式不合法時顯示錯誤，不會偷偷改用其他 server。
`client/.env.example` 提供範例。所有 `VITE_` 設定會進入公開前端，
TURN 憑證須使用適合瀏覽器的短效或限制用途憑證，不能放入私有應用程式金鑰。

## 隔離與生命週期

The panel distinguishes room membership from audio transport connectivity. Each
remote player has a connecting, connected, or failed state. Errors belong to a
peer ID and disappear when that peer leaves or rejoins with a fresh ID; another
player's success never hides remaining failures. Device/session errors stay separate.
A connected transport does not prove audible microphone input: also check mute,
per-player volume, output device, and the browser playback prompt.

**Rejoin voice** explicitly replaces failed connections while retaining device
and listening preferences. Refresh closes the old Socket.IO transport. If its
membership has not expired yet, a user-initiated join retries the duplicate-tab
response for up to 45 seconds. Cancel, leave, and disconnect stop that retry; it
never takes over another active tab. Refresh still requires explicitly joining
voice again and does not automatically enable a microphone.

Browser validation used three synthetic audio streams and real WebRTC connections
with a local signaling harness. All six connections exchanged RTP bytes; replacing
one participant restored its links without dropping the remaining pair. This does
not verify physical microphones or restrictive cross-network connectivity. TURN
is still needed when peers cannot connect directly; see ICE configuration above.

伺服器每次協商驗證來源與目標的 session、語音 peer 及已提交的房間身分。
新的加入週期取得新的 peer ID；過期協商不會接到新的通話。
同一分頁重複 join 保持原 peer ID，離開再加入才換 ID。
SDP / ICE 經過長度與欄位驗證，且只轉送給同房間的指定 peer。

Runtime 的 `inspect` 使用相同序列佇列讀取已提交資料，不複製或保存整個 runtime。
離開房間成功保存後才清除該帳號的語音；磁碟保存失敗時保留原房間與語音。
Socket 斷線與 session 撤銷則立即移除語音，避免麥克風在失去連線後繼續傳送。
語音最多四位玩家，每位最多三條遠端 WebRTC 連線；協商佇列與 ICE 緩衝均有上限。
同一 Socket 的加入、設定與離開操作依序處理，控制器重新建立也共用佇列，
避免舊的清理操作移除新通話。每個 peer 首次連線及中斷後等待上限為 30 秒；
失敗時釋放該連線，保留其他玩家通話，並提示離開後重新加入。

## 驗證

伺服器回歸測試覆蓋同房間四人、跨房間 / 未加入 / 過期 peer 拒絕、
來源不可偽造、session 撤銷、分頁限制、斷線、獨立限流、零語音寫入及保存失敗回復。
前端回歸測試覆蓋取消加入、權限失敗、晚到音軌清理、控制器替換競爭、靜音 / 拒聽、
自動播放恢復、SDP / ICE 順序、連線逾時及設定驗證。

完整 188 個測試（20 個檔案）、TypeScript、ESLint 與正式建置皆通過。
四個獨立 Edge context 以模擬麥克風完成實際 WebRTC 收送、跨頁 / 進入對局、
文字聊天與離開清理；390px 手機版無橫向溢出。
本機驗證未涵蓋實體音訊裝置與跨 NAT 網路，部署尚未配置 TURN。
詳細結果記錄於[語音任務](../tasks/11-table-voice-chat.md)。
