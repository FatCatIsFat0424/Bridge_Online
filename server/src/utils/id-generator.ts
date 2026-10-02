// ─── ID 生成工具 ───

import { randomInt, randomUUID } from 'node:crypto';
import type { RoomCode } from '@shared/types';
import { ROOM_CODE_LENGTH } from '@shared/constants';

/**
 * 生成房間代碼
 * 格式：6 碼大寫英數字（排除易混淆字元 0/O/I/1）
 * 碰撞檢查由呼叫者負責
 */
export function generateRoomCode(): RoomCode {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += chars.charAt(randomInt(chars.length));
  }
  return code;
}

/**
 * 生成聊天訊息 ID
 * 格式：UUID v4
 */
export function generateMessageId(): string {
  return randomUUID();
}
