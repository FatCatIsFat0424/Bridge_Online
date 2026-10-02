import type { MediaId } from '../types/account';

export const EMOJI_NAME_PATTERN = /^[a-z0-9_]{2,32}$/;
export const MAX_EMOJIS_PER_ACCOUNT = 300;
export const MAX_MESSAGE_EMOJIS = 20;

const EMOJI_TOKEN = /:([a-z0-9_]{2,32}):/g;

export function isEmojiName(value: unknown): value is string {
  return typeof value === 'string' && EMOJI_NAME_PATTERN.test(value);
}

/** Unique `:name:` tokens in order of first appearance. */
export function extractEmojiNames(message: string): string[] {
  return [...new Set(Array.from(message.matchAll(EMOJI_TOKEN), (match) => match[1]))];
}

export type EmojiSegment = string | { readonly name: string; readonly mediaId: MediaId };

/** Splits a message into text and the emoji tokens present in `emojis`; unknown tokens stay text. */
export function splitEmojiText(message: string, emojis: Record<string, MediaId> = {}): EmojiSegment[] {
  const segments: EmojiSegment[] = [];
  let last = 0;
  for (const match of message.matchAll(EMOJI_TOKEN)) {
    const mediaId = Object.hasOwn(emojis, match[1]) ? emojis[match[1]] : undefined;
    if (!mediaId) continue;
    if (match.index > last) segments.push(message.slice(last, match.index));
    segments.push({ name: match[1], mediaId });
    last = match.index + match[0].length;
  }
  if (last < message.length) segments.push(message.slice(last));
  return segments;
}
