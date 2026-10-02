// ─── 遊戲型別定義 ───

import type { RoomCode } from './room';
import type { PlayerInfo, Seat } from './player';
import type { BigTwoComboType } from '../rules/bigtwo';

/** 花色 */
export type Suit = 'clubs' | 'diamonds' | 'hearts' | 'spades';

/** 叫牌花色（含 NT） */
export type BidSuit = Suit | 'nt';

/** 牌面數字：2-14（11=J, 12=Q, 13=K, 14=A） */
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

/** 一張牌 */
export interface Card {
  readonly suit: Suit;
  readonly rank: Rank;
}

/** 叫牌等級（1-7） */
export type BidLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** 叫牌動作 */
export type BidAction =
  | { readonly type: 'bid'; readonly level: BidLevel; readonly suit: BidSuit }
  | { readonly type: 'pass' };

/** 合約（叫牌結束後確定） */
export interface Contract {
  readonly level: BidLevel;
  readonly suit: BidSuit;
  readonly declarer: Seat;
}

/** 遊戲階段 */
export type GamePhase =
  | 'dealing'
  | 'redeal_pending'
  | 'bidding'
  | 'playing'
  | 'scoring';

/** 一墩的記錄 */
export interface TrickRecord {
  readonly cards: Record<Seat, Card>;
  readonly leadSeat: Seat;
  readonly winnerSeat: Seat;
}

/** 遊戲動作日誌項目 */
export type GameLogEntry =
  | { readonly type: 'bid'; readonly seat: Seat; readonly action: BidAction; readonly timestamp: number }
  | { readonly type: 'play'; readonly seat: Seat; readonly card: Card; readonly timestamp: number }
  | { readonly type: 'trick_end'; readonly winnerSeat: Seat; readonly trickIndex: number; readonly timestamp: number }
  | { readonly type: 'redeal'; readonly seat: Seat; readonly accepted: boolean; readonly timestamp: number }
  | { readonly type: 'system'; readonly message: string; readonly timestamp: number };

/** 遊戲結算結果 */
export interface GameResult {
  readonly contract: Contract;
  readonly declarerTeamTricks: number;
  readonly defenderTeamTricks: number;
  readonly requiredTricks: number;
  readonly declarerTeamWins: boolean;
}

/** 隊伍劃分：東西 vs 南北 */
export type Team = 'EW' | 'NS';

/** 出牌階段狀態 */
export interface PlayingState {
  readonly currentTrick: Partial<Record<Seat, Card>>;
  readonly trickLeadSeat: Seat;
  readonly currentTurnSeat: Seat;
  readonly completedTricks: readonly TrickRecord[];
  readonly trickCountEW: number;
  readonly trickCountNS: number;
}

/** 叫牌階段狀態 */
export interface BiddingState {
  readonly bids: ReadonlyArray<{ readonly seat: Seat; readonly action: BidAction }>;
  readonly currentBidderSeat: Seat;
  readonly highestBid: { readonly level: BidLevel; readonly suit: BidSuit; readonly seat: Seat } | null;
  readonly consecutivePassCount: number;
  readonly isFirstRound: boolean;
}

/** 完整橋牌遊戲狀態（伺服器內部） */
export interface BridgeGameState {
  readonly gameType: 'bridge';
  readonly id: string;
  readonly startedAt: number;
  readonly players: Record<Seat, PlayerInfo>;
  readonly roomCode: RoomCode;
  phase: GamePhase;
  hands: Record<Seat, Card[]>;
  readonly dealerSeat: Seat;
  bidding: BiddingState | null;
  contract: Contract | null;
  playing: PlayingState | null;
  result: GameResult | null;
  log: GameLogEntry[];
  redealPendingSeat: Seat | null;
  redealDeclinedSeats: Seat[];
}

/** 給特定玩家的可見橋牌狀態（隱藏他人手牌） */
export interface BridgeVisibleState {
  readonly gameType: 'bridge';
  readonly validCards: readonly Card[];
  readonly phase: GamePhase;
  readonly myHand: readonly Card[];
  readonly mySeat: Seat;
  readonly dealerSeat: Seat;
  readonly bidding: BiddingState | null;
  readonly contract: Contract | null;
  readonly playing: PlayingState | null;
  readonly result: GameResult | null;
  readonly log: readonly GameLogEntry[];
  readonly redealPendingSeat: Seat | null;
}

// ─── 大老二 ───

export interface BigTwoPlay {
  readonly seat: Seat;
  readonly cards: Card[];
  readonly comboType: BigTwoComboType;
}

export type BigTwoLogEntry =
  | { readonly type: 'play'; readonly seat: Seat; readonly cards: Card[]; readonly comboType: BigTwoComboType; readonly timestamp: number }
  | { readonly type: 'pass'; readonly seat: Seat; readonly timestamp: number }
  | { readonly type: 'round_end'; readonly leaderSeat: Seat; readonly timestamp: number }
  | { readonly type: 'dragon'; readonly seat: Seat; readonly timestamp: number };

export interface BigTwoMatchResult {
  readonly gameType: 'bigtwo';
  readonly winnerSeat: Seat;
  readonly dragon: boolean;
  readonly cardsLeft: Record<Seat, number>;
  readonly twosLeft: Record<Seat, number>;
  /** 贏家為 0 */
  readonly scores: Record<Seat, number>;
}

export type BigTwoPhase = 'playing' | 'scoring';

export interface BigTwoGameState {
  readonly gameType: 'bigtwo';
  readonly id: string;
  readonly startedAt: number;
  readonly players: Record<Seat, PlayerInfo>;
  readonly roomCode: RoomCode;
  phase: BigTwoPhase;
  hands: Record<Seat, Card[]>;
  currentTurnSeat: Seat;
  /** null = 自由出牌 */
  lastPlay: BigTwoPlay | null;
  lockedSeats: Seat[];
  /** 首手仍須含 ♣3 */
  firstPlay: boolean;
  log: BigTwoLogEntry[];
  result: BigTwoMatchResult | null;
}

export interface BigTwoVisibleState {
  readonly gameType: 'bigtwo';
  readonly phase: BigTwoPhase;
  readonly mySeat: Seat;
  readonly myHand: readonly Card[];
  readonly handCounts: Record<Seat, number>;
  readonly currentTurnSeat: Seat;
  readonly lastPlay: BigTwoPlay | null;
  readonly lockedSeats: readonly Seat[];
  readonly firstPlay: boolean;
  readonly log: readonly BigTwoLogEntry[];
  readonly result: BigTwoMatchResult | null;
  /** 結算時公開所有手牌 */
  readonly revealedHands: Record<Seat, Card[]> | null;
}

// ─── 跨遊戲 ───

export type AnyGameState = BridgeGameState | BigTwoGameState;

export type PlayerVisibleGameState = BridgeVisibleState | BigTwoVisibleState;

export type MatchResult = ({ readonly gameType: 'bridge' } & GameResult) | BigTwoMatchResult;

export interface MatchSummary {
  readonly id: string;
  readonly roomCode: RoomCode;
  /** 依座位 N, E, S, W 排序 */
  readonly accountIds: readonly string[];
  readonly result: MatchResult;
  readonly finishedAt: number;
}
