// ─── 遊戲規則常數 ───

import type { Seat, BidSuit, Team, GameType } from '../types';

/** 所有遊戲類型 */
export const GAME_TYPES: readonly GameType[] = ['bridge', 'bigtwo', 'redpoints'];

/** 投票終止：同意票達此數即通過 */
export const ABORT_VOTE_THRESHOLD = 3;

/** 投票終止：投票時限（毫秒） */
export const ABORT_VOTE_DURATION_MS = 60_000;

/** 投票終止：自發起起算的冷卻時間（毫秒） */
export const ABORT_VOTE_COOLDOWN_MS = 180_000;

/** 每位玩家的手牌數量 */
export const HAND_SIZE = 13;

/** 每局總墩數 */
export const TOTAL_TRICKS = 13;

/** 合約基礎墩數 */
export const CONTRACT_BASE_TRICKS = 6;

/** 座位順時鐘順序 */
export const SEAT_ORDER_CLOCKWISE: readonly Seat[] = ['N', 'E', 'S', 'W'];

/** 隊伍劃分 */
export const TEAM_SEATS: Record<Team, readonly [Seat, Seat]> = {
  EW: ['E', 'W'],
  NS: ['N', 'S'],
};

/** 叫牌花色大小順序（小到大） */
export const BID_SUIT_ORDER: readonly BidSuit[] = ['clubs', 'diamonds', 'hearts', 'spades', 'nt'];

/** 倒牌重洗條件：無 A 且總點數 ≤ 此值 */
export const REDEAL_MAX_POINTS = 4;

/** 斷線重連超時（毫秒） */
export const RECONNECT_TIMEOUT_MS = 60_000;

/** 房間代碼長度 */
export const ROOM_CODE_LENGTH = 6;

/** 暱稱最大長度 */
export const NICKNAME_MAX_LENGTH = 20;
