// ─── 聊天型別定義 ───

import type { MediaId } from './account';
import type { PlayerInfo } from './player';

/** 聊天訊息 */
export interface ChatMessage {
  readonly id: string;
  readonly sender: PlayerInfo;
  readonly content: string;
  readonly timestamp: number;
  /** Custom emoji used in `content` (name → media), resolved from the sender's library. */
  readonly emojis?: Record<string, MediaId>;
}
