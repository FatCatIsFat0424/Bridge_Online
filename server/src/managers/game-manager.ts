// ─── Game Manager：遊戲流程管理 ───

import { randomUUID } from 'node:crypto';
import type {
  RoomCode,
  Seat,
  Card,
  BidAction,
  Contract,
  GameState,
  GameResult,
  GameLogEntry,
  PlayerVisibleGameState,
  PlayerInfo,
} from '@shared/types';
import { SEAT_ORDER_CLOCKWISE } from '@shared/constants';
import { createDeck, shuffleDeck } from '../engine/deck';
import { dealCards, sortHand, findRedealEligibleSeat, isRedealEligible as isRedealEligibleCheck } from '../engine/dealing';
import {
  createBiddingState,
  validateBid,
  applyBid,
  checkBiddingEnd,
  getNextSeat,
} from '../engine/bidding';
import {
  createPlayingState,
  validatePlay,
  applyPlay,
  determineTrickWinner,
  completeTrick,
  isPlayingComplete,
  removeCardFromHand,
  getValidPlays,
} from '../engine/playing';
import { calculateGameResult } from '../engine/scoring';

// ─── 模組私有狀態 ───

/** roomCode → GameState */
const games: Map<RoomCode, GameState> = new Map();

// ─── Callbacks（由 Socket 層註冊） ───

interface GameCallbacks {
  onDealt: (roomCode: RoomCode, hands: Record<Seat, Card[]>) => void;
  onRedealAvailable: (roomCode: RoomCode, seat: Seat) => void;
  onRedealt: (roomCode: RoomCode, hands: Record<Seat, Card[]>) => void;
  onBiddingStart: (roomCode: RoomCode, startSeat: Seat) => void;
  onBidMade: (roomCode: RoomCode, seat: Seat, action: BidAction) => void;
  onBiddingEnd: (roomCode: RoomCode, contract: Contract) => void;
  onTurnStart: (roomCode: RoomCode, seat: Seat, validCards: Card[]) => void;
  onCardPlayed: (roomCode: RoomCode, seat: Seat, card: Card) => void;
  onTrickEnd: (roomCode: RoomCode, winner: Seat, cards: Record<Seat, Card>, trickCountEW: number, trickCountNS: number) => void;
  onGameEnded: (roomCode: RoomCode, result: GameResult) => void;
  onGameAborted: (roomCode: RoomCode, reason: string) => void;
  onLogEntry: (roomCode: RoomCode, entry: GameLogEntry) => void;
}

let callbacks: GameCallbacks | null = null;

// ─── 匯出函式 ───

/**
 * 註冊 callback（Socket 層呼叫）
 */
export function registerCallbacks(cb: GameCallbacks): void {
  callbacks = cb;
}

/**
 * 開始新遊戲
 */
export function startGame(roomCode: RoomCode, players: Record<Seat, PlayerInfo>): void {
  const dealerIdx = Math.floor(Math.random() * 4);
  const dealerSeat = SEAT_ORDER_CLOCKWISE[dealerIdx];

  const deck = shuffleDeck(createDeck());
  const rawHands = dealCards(deck);

  // 排序手牌
  const hands: Record<Seat, Card[]> = {
    N: sortHand(rawHands.N),
    E: sortHand(rawHands.E),
    S: sortHand(rawHands.S),
    W: sortHand(rawHands.W),
  };

  const gameState: GameState = {
    id: randomUUID(),
    startedAt: Date.now(),
    players: structuredClone(players),
    roomCode,
    phase: 'dealing',
    hands,
    dealerSeat,
    bidding: null,
    contract: null,
    playing: null,
    result: null,
    log: [],
    redealPendingSeat: null,
    redealDeclinedSeats: [],
  };

  games.set(roomCode, gameState);

  // 通知發牌
  callbacks?.onDealt(roomCode, hands);

  // 檢查倒牌重洗
  const biddingStartSeat = getNextSeat(dealerSeat);
  const redealSeat = findRedealEligibleSeat(hands, biddingStartSeat);

  if (redealSeat) {
    gameState.phase = 'redeal_pending';
    gameState.redealPendingSeat = redealSeat;
    callbacks?.onRedealAvailable(roomCode, redealSeat);
  } else {
    startBidding(roomCode, biddingStartSeat);
  }
}

/**
 * 處理倒牌重洗回應
 */
export function handleRedealResponse(
  roomCode: RoomCode,
  seat: Seat,
  accept: boolean,
): { success: true } | { success: false; reason: string } {
  const game = games.get(roomCode);
  if (!game) return { success: false, reason: 'Game not found' };
  if (game.phase !== 'redeal_pending') return { success: false, reason: 'Not in redeal phase' };
  if (game.redealPendingSeat !== seat) return { success: false, reason: 'Not your turn to respond' };

  addLog(game, { type: 'redeal', seat, accepted: accept, timestamp: Date.now() });

  if (accept) {
    game.redealDeclinedSeats = [];
    // 重洗牌
    const deck = shuffleDeck(createDeck());
    const rawHands = dealCards(deck);
    game.hands = {
      N: sortHand(rawHands.N),
      E: sortHand(rawHands.E),
      S: sortHand(rawHands.S),
      W: sortHand(rawHands.W),
    };

    callbacks?.onRedealt(roomCode, game.hands);

    // 再次檢查倒牌重洗
    const biddingStartSeat = getNextSeat(game.dealerSeat);
    const nextRedealSeat = findRedealEligibleSeat(game.hands, biddingStartSeat);

    if (nextRedealSeat) {
      game.redealPendingSeat = nextRedealSeat;
      callbacks?.onRedealAvailable(roomCode, nextRedealSeat);
    } else {
      startBidding(roomCode, biddingStartSeat);
    }
  } else {
    game.redealDeclinedSeats.push(seat);
    // 拒絕：繼續檢查下一位
    const biddingStartSeat = getNextSeat(game.dealerSeat);
    const nextSeat = getNextSeat(seat);

    // 從下一位開始繼續搜尋
    let foundNext = false;
    const startIdx = SEAT_ORDER_CLOCKWISE.indexOf(nextSeat);

    for (let i = 0; i < 4; i++) {
      const checkSeat = SEAT_ORDER_CLOCKWISE[(startIdx + i) % 4];
      // 已經檢查過的不再檢查
      if (game.redealDeclinedSeats.includes(checkSeat)) continue;

      const hand = game.hands[checkSeat];
      if (isRedealEligibleCheck(hand)) {
        game.redealPendingSeat = checkSeat;
        callbacks?.onRedealAvailable(roomCode, checkSeat);
        foundNext = true;
        break;
      }
    }

    if (!foundNext) {
      startBidding(roomCode, biddingStartSeat);
    }
  }

  return { success: true };
}

/**
 * 處理叫牌
 */
export function handleBid(
  roomCode: RoomCode,
  seat: Seat,
  action: BidAction,
): { success: true } | { success: false; reason: string } {
  const game = games.get(roomCode);
  if (!game) return { success: false, reason: 'Game not found' };
  if (game.phase !== 'bidding') return { success: false, reason: 'Not in bidding phase' };
  if (!game.bidding) return { success: false, reason: 'Bidding state not initialized' };

  const validation = validateBid(game.bidding, seat, action);
  if (!validation.valid) return { success: false, reason: validation.reason };

  game.bidding = applyBid(game.bidding, seat, action);
  addLog(game, { type: 'bid', seat, action, timestamp: Date.now() });
  callbacks?.onBidMade(roomCode, seat, action);

  // 檢查叫牌結束
  const endResult = checkBiddingEnd(game.bidding);

  if (endResult === 'all_pass') {
    // 首輪全 pass → 重新發牌
    addLog(game, { type: 'system', message: 'All pass - redealing', timestamp: Date.now() });
    restartDeal(roomCode);
  } else if (endResult === 'contract') {
    // 合約確定
    const highest = game.bidding.highestBid!;
    const contract: Contract = {
      level: highest.level,
      suit: highest.suit,
      declarer: highest.seat,
    };
    game.contract = contract;
    callbacks?.onBiddingEnd(roomCode, contract);
    startPlaying(roomCode, contract);
  }

  return { success: true };
}

/**
 * 處理出牌
 */
export function handlePlayCard(
  roomCode: RoomCode,
  seat: Seat,
  card: Card,
): { success: true } | { success: false; reason: string } {
  const game = games.get(roomCode);
  if (!game) return { success: false, reason: 'Game not found' };
  if (game.phase !== 'playing') return { success: false, reason: 'Not in playing phase' };
  if (!game.playing || !game.contract) return { success: false, reason: 'Playing state not initialized' };

  const hand = game.hands[seat];
  const validation = validatePlay(hand, game.playing, seat, card);
  if (!validation.valid) return { success: false, reason: validation.reason };

  // 移除手牌
  game.hands[seat] = removeCardFromHand(hand, card);

  // 套用出牌
  game.playing = applyPlay(game.playing, seat, card);
  addLog(game, { type: 'play', seat, card, timestamp: Date.now() });
  callbacks?.onCardPlayed(roomCode, seat, card);

  // 檢查是否一墩結束（4 張牌）
  if (Object.keys(game.playing.currentTrick).length === 4) {
    const trick = game.playing.currentTrick as Record<Seat, Card>;
    const winner = determineTrickWinner(trick, game.playing.trickLeadSeat, game.contract.suit);
    game.playing = completeTrick(game.playing, winner, trick, game.playing.trickLeadSeat);

    const trickIdx = game.playing.completedTricks.length;
    addLog(game, { type: 'trick_end', winnerSeat: winner, trickIndex: trickIdx, timestamp: Date.now() });
    callbacks?.onTrickEnd(roomCode, winner, trick, game.playing.trickCountEW, game.playing.trickCountNS);

    // 檢查遊戲結束
    if (isPlayingComplete(game.playing)) {
      game.phase = 'scoring';
      const result = calculateGameResult(
        game.contract,
        game.playing.trickCountEW,
        game.playing.trickCountNS,
      );
      game.result = result;
      callbacks?.onGameEnded(roomCode, result);
      return { success: true };
    }

    // 下一墩開始
    const validCards = getValidPlays(game.hands[winner], game.playing);
    callbacks?.onTurnStart(roomCode, winner, validCards);
  } else {
    // 同一墩下一位出牌
    const nextSeat = game.playing.currentTurnSeat;
    const validCards = getValidPlays(game.hands[nextSeat], game.playing);
    callbacks?.onTurnStart(roomCode, nextSeat, validCards);
  }

  return { success: true };
}

/**
 * 中止遊戲
 */
export function abortGame(roomCode: RoomCode, reason: string): void {
  const game = games.get(roomCode);
  if (!game) return;

  addLog(game, { type: 'system', message: `Game aborted: ${reason}`, timestamp: Date.now() });
  callbacks?.onGameAborted(roomCode, reason);
  games.delete(roomCode);
}

/**
 * 取得給特定玩家的可見狀態
 */
export function getPlayerVisibleState(
  roomCode: RoomCode,
  seat: Seat,
): PlayerVisibleGameState | null {
  const game = games.get(roomCode);
  if (!game) return null;

  return {
    validCards: game.playing && game.phase === 'playing' && game.playing.currentTurnSeat === seat
      ? getValidPlays(game.hands[seat], game.playing) : [],
    phase: game.phase,
    myHand: game.hands[seat],
    mySeat: seat,
    dealerSeat: game.dealerSeat,
    bidding: game.bidding,
    contract: game.contract,
    playing: game.playing,
    result: game.result,
    log: game.log,
    redealPendingSeat: game.redealPendingSeat,
  };
}

/**
 * 取得遊戲內部狀態
 */
export function getGameState(roomCode: RoomCode): GameState | null {
  return games.get(roomCode) ?? null;
}

/**
 * 移除遊戲
 */
export function removeGame(roomCode: RoomCode): void {
  games.delete(roomCode);
}

/**
 * 是否有進行中的遊戲
 */
export function hasActiveGame(roomCode: RoomCode): boolean {
  return games.has(roomCode);
}

export function exportGames(): GameState[] {
  return [...games.values()];
}

export function restoreGames(records: GameState[]): void {
  games.clear();
  for (const game of records) games.set(game.roomCode, game);
}

// ─── 內部輔助函式 ───

function addLog(game: GameState, entry: GameLogEntry): void {
  game.log.push(entry);
  callbacks?.onLogEntry(game.roomCode, entry);
}

function startBidding(roomCode: RoomCode, startSeat: Seat): void {
  const game = games.get(roomCode);
  if (!game) return;

  game.phase = 'bidding';
  game.bidding = createBiddingState(startSeat);
  game.redealPendingSeat = null;

  addLog(game, { type: 'system', message: `Bidding starts from ${startSeat}`, timestamp: Date.now() });
  callbacks?.onBiddingStart(roomCode, startSeat);
}

function startPlaying(roomCode: RoomCode, contract: Contract): void {
  const game = games.get(roomCode);
  if (!game) return;

  // 莊家逆時鐘第一位開始出牌
  const declarerIdx = SEAT_ORDER_CLOCKWISE.indexOf(contract.declarer);
  const leadSeat = SEAT_ORDER_CLOCKWISE[(declarerIdx + 3) % 4]; // 逆時鐘 = index - 1 = (index + 3) % 4

  game.phase = 'playing';
  game.playing = createPlayingState(leadSeat);

  addLog(game, { type: 'system', message: `Playing starts. Lead: ${leadSeat}. Contract: ${contract.level}${contract.suit} by ${contract.declarer}`, timestamp: Date.now() });

  const validCards = getValidPlays(game.hands[leadSeat], game.playing);
  callbacks?.onTurnStart(roomCode, leadSeat, validCards);
}

function restartDeal(roomCode: RoomCode): void {
  const game = games.get(roomCode);
  if (!game) return;
  game.redealDeclinedSeats = [];

  const deck = shuffleDeck(createDeck());
  const rawHands = dealCards(deck);
  game.hands = {
    N: sortHand(rawHands.N),
    E: sortHand(rawHands.E),
    S: sortHand(rawHands.S),
    W: sortHand(rawHands.W),
  };
  game.bidding = null;

  callbacks?.onRedealt(roomCode, game.hands);

  const biddingStartSeat = getNextSeat(game.dealerSeat);
  const redealSeat = findRedealEligibleSeat(game.hands, biddingStartSeat);

  if (redealSeat) {
    game.phase = 'redeal_pending';
    game.redealPendingSeat = redealSeat;
    callbacks?.onRedealAvailable(roomCode, redealSeat);
  } else {
    startBidding(roomCode, biddingStartSeat);
  }
}
