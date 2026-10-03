// ─── 聊天型別定義 ───

import type { MediaId } from './account';
import type { EmojiRecord } from './emoji';
import type { PlayerInfo } from './player';

/** 聊天訊息 */
export interface ChatMessage {
  readonly id: string;
  readonly sender: PlayerInfo;
  readonly content: string;
  readonly timestamp: number;
  /** Large standalone image resolved from the sender's existing emoji library. */
  readonly sticker?: Pick<EmojiRecord, 'id' | 'name' | 'mediaId'>;
  /** Custom emoji used in `content` (name → media), resolved from the sender's library. */
  readonly emojis?: Record<string, MediaId>;
  /** System line: `content` is a client i18n key, `sender` the player it concerns. */
  readonly system?: true;
}
