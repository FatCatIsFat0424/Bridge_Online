import type { MediaId } from './account';

/** A custom chat emoji in one account's library; used in chat as `:name:`. */
export interface EmojiRecord {
  readonly id: string;
  readonly accountId: string;
  readonly name: string;
  readonly mediaId: MediaId;
  readonly createdAt: number;
}
