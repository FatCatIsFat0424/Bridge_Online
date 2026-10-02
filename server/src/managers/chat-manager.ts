// ─── Chat Manager：聊天訊息管理 ───

import type { RoomCode, ChatMessage, PlayerInfo } from '@shared/types';
import { generateMessageId } from '../utils/id-generator';

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
): ChatMessage {
  const message: ChatMessage = {
    id: generateMessageId(),
    sender,
    content,
    timestamp: Date.now(),
  };

  const history = chatHistory.get(roomCode);
  if (history) {
    history.push(message);
    if (history.length > 200) history.splice(0, history.length - 200);
  }

  return message;
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
