// ─── Chat Manager：聊天訊息管理 ───

import type { RoomCode, ChatMessage, EmojiRecord, MediaId, PlayerInfo } from '@shared/types';
import { MAX_MESSAGE_EMOJIS, extractEmojiNames } from '@shared/constants';
import { generateMessageId } from '../utils/id-generator';

/** Maps the `:name:` tokens found in the sender's library (first MAX_MESSAGE_EMOJIS) to media. */
export function resolveMessageEmojis(
  content: string,
  library: readonly Pick<EmojiRecord, 'name' | 'mediaId'>[],
): Record<string, MediaId> {
  const owned = new Map(library.map((emoji) => [emoji.name, emoji.mediaId]));
  const used = extractEmojiNames(content).filter((name) => owned.has(name))
    .slice(0, MAX_MESSAGE_EMOJIS);
  return Object.fromEntries(used.map((name) => [name, owned.get(name) as MediaId]));
}

// ─── 模組私有狀態 ───

/** roomCode → 訊息列表 */
const chatHistory: Map<RoomCode, ChatMessage[]> = new Map();

// ─── 匯出函式 ───

/**
 * 初始化房間聊天
 */
export function initRoomChat(roomCode: RoomCode): void {
  chatHistory.set(roomCode, []);
}

/**
 * 新增聊天訊息
 */
export function addMessage(
  roomCode: RoomCode,
  sender: PlayerInfo,
  content: string,
  library: readonly Pick<EmojiRecord, 'name' | 'mediaId'>[] = [],
): ChatMessage {
  const emojis = resolveMessageEmojis(content, library);
  const message: ChatMessage = {
    id: generateMessageId(),
    sender,
    content,
    timestamp: Date.now(),
    ...(Object.keys(emojis).length > 0 && { emojis }),
  };

  append(roomCode, message);
  return message;
}

/** Adds a system line; `key` is translated by the client, `subject` is the player it concerns. */
export function addSystemMessage(roomCode: RoomCode, subject: PlayerInfo, key: string): void {
  append(roomCode, {
    id: generateMessageId(), sender: subject, content: key, timestamp: Date.now(), system: true,
  });
}

function append(roomCode: RoomCode, message: ChatMessage): void {
  const history = chatHistory.get(roomCode);
  if (history) {
    history.push(message);
    if (history.length > 200) history.splice(0, history.length - 200);
  }
}

/**
 * 取得房間聊天歷史
 */
export function getChatHistory(roomCode: RoomCode): ChatMessage[] {
  return chatHistory.get(roomCode) ?? [];
}

/**
 * 清除房間聊天（房間銷毀時）
 */
export function clearRoomChat(roomCode: RoomCode): void {
  chatHistory.delete(roomCode);
}

export function exportChat(): { roomCode: string; messages: ChatMessage[] }[] {
  return [...chatHistory].map(([roomCode, messages]) => ({ roomCode, messages }));
}

export function restoreChat(records: { roomCode: string; messages: ChatMessage[] }[]): void {
  chatHistory.clear();
  for (const record of records) chatHistory.set(record.roomCode, record.messages);
}

/** Resolves stickers exclusively from the authenticated sender's library. */
export function addSticker(
  roomCode: RoomCode, sender: PlayerInfo, stickerId: string, library: readonly EmojiRecord[],
): ChatMessage | null {
  const asset = library.find((emoji) => emoji.id === stickerId && emoji.accountId === sender.id);
  if (!asset) return null;
  const message: ChatMessage = {
    id: generateMessageId(), sender, content: '', timestamp: Date.now(),
    sticker: { id: asset.id, name: asset.name, mediaId: asset.mediaId },
  };
  append(roomCode, message);
  return message;
}
