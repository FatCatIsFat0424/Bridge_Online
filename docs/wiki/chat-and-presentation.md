# Stickers and game presentation

## Shared emoji and sticker library

The account page's `EmojiLibrary` manages one uploaded image library. Chat uses
the same assets as inline `:name:` emoji or standalone stickers; no separate
sticker upload or media copy is required. File and folder imports retain the
existing emoji upload limits and image processing, including GIF preservation.

Static uploads are resized to a maximum 128-pixel long edge and encoded as WebP
with quality 0.9 (PNG fallback); GIF uploads retain their original bytes. Stickers
use a 160-pixel display box, so previously downscaled images can appear soft when
enlarged. Sending an existing asset does not re-encode it.

`ChatPanel` offers searchable emoji and sticker tabs. Selecting an emoji inserts
its token at the text cursor. Selecting a sticker sends it immediately and keeps
any text draft. Pending sends disable sticker choices and reject duplicate clicks;
success closes the picker, while errors leave it open for retry. Missing assets
display an accessible unavailable label. Escape or an outside click closes the picker.

## Chat contract

`chat:send` accepts `{ message: string }` or `{ stickerId: string }` with the
existing callback. Text is trimmed and must contain 1–500 characters. Sticker
requests require a nonempty string ID and reject additional payload keys,
including a mixed text/sticker request. The server resolves the ID exclusively
from the authenticated sender's library and checks asset ownership; clients
cannot supply a media URL or impersonate another sender.

Stored sticker messages have empty `content` and a `sticker` snapshot containing
`id`, `name`, and `mediaId`. Text messages carry only the server-resolved `emojis`
mapping for supported inline tokens. Rendering keeps ordinary text as text.
If loading the library fails, text still sends without custom emoji images;
sticker sending fails because ownership cannot be established. Messages use the
existing persisted room history and `player:state` snapshots.

## Authoritative presentation timeline

`shared/src/game-presentation.ts` derives sequential public frames from the
accepted action's log entries. Presentation metadata contains `id`, `startedAt`,
and `logStart`; outgoing visible state additionally carries `serverNow`.
Private hands and stock never enter presentation frames.

| Game | Frame | Duration |
| --- | --- | --- |
| Bridge | Play | 400 ms |
| Bridge | Completed trick, cards and winner | 2,000 ms |
| Big Two | Play / pass | 400 / 350 ms |
| Big Two | Round winner, last cards and passed seats | 2,000 ms |
| Red Points | Played or flipped card, capture and points | 1,900 ms per log entry |
| Ninety-Nine | Play, total change and card effect | 1,900 ms |
| Ninety-Nine | Elimination | 2,500 ms |
| All four | Finish before score overlay | 3,000 ms |

Durations add together for an action. For example, a Bridge play that completes
a trick presents the play and trick in sequence; a final trick also adds the
finish frame. Big Two automatic passes are separate server actions after a
uniformly random 0–3,000 ms wait following the preceding presentation. The wait
is separate from the 350 ms PASS frame; see [automatic pass rules](./big-two-rules.md).

The server commits the game result immediately, then rejects further play, pass,
and capture-choice actions until the timeline ends. `game:continue` additionally
requires scoring and an expired timeline. The client disables matching controls
and delays score overlays while frames run. No client completion acknowledgment
or background server timer is required to release the presentation deadline.
Big Two uses a separate server scheduler for delayed automatic passes.

## Resume and accessibility

`presentation-state.ts` maps server time to local receipt time. Refresh, resume,
and delayed background-tab timers skip expired frames and show only remaining
time. Repeated snapshots do not restart a presentation; CSS animation offsets
continue from the current frame's elapsed time.

`GamePresentation` supplies readable player, card, effect, and result labels in
a polite live status region. Reduced motion disables movement while preserving
information and the server deadline. The preference is stored in
`bridge.ui.reducedMotion`; its initial value falls back to the system preference,
and CSS also respects `prefers-reduced-motion`.

The shared turn-sound hook waits until the complete timeline ends before checking
whether the local player can act. It retains the independent sound preference,
gesture-based audio unlock, and cleanup on unmount.

Bridge snapshots without presentation metadata retain the legacy local
1.5-second completed-trick queue. Current server snapshots use the shared
timeline above. Trick history remains available during play and scoring.

## Current-game history

All four games expose history in the information panel and score overlay. History
is reconstructed from the current game's public records and returns with the
existing restored game snapshot; it introduces no separate cross-match archive
or storage schema.

| Game | History contents |
| --- | --- |
| Bridge | Existing completed-trick history, cards in play order, seats and winner |
| Big Two | Rounds containing plays, passes and the next round's leader |
| Red Points | Played and flipped cards, captured cards and capture points |
| Ninety-Nine | Each play's running total and any eliminations |

`round-history.ts` derives the three non-Bridge history views from public logs;
`RoundHistory.tsx` renders them. Bridge retains `TrickHistory.tsx`.
