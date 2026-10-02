// ─── Game Store：遊戲狀態管理 ───

import { create } from 'zustand';
import type {
  Card,
  Seat,
  BidAction,
  Contract,
  BiddingState,
  PlayingState,
  GamePhase,
  GameResult,
  GameLogEntry,
  GameType,
  BigTwoVisibleState,
  PlayerVisibleGameState,
  RedPointsVisibleState,
} from '@shared/types';
import { equalSnapshotValue, retainSnapshotValue } from './snapshot-equality';

/** Bridge state lives in the individual fields; other games keep their whole visible state in one field. */
interface GameStoreState {
  bigTwo: BigTwoVisibleState | null;
  redPoints: RedPointsVisibleState | null;
  gameType: GameType | null;
  phase: GamePhase | null;
  myHand: Card[];
  dealerSeat: Seat | null;
  currentTurnSeat: Seat | null;
  validCards: Card[];
  bidding: BiddingState | null;
  contract: Contract | null;
  playing: PlayingState | null;
  result: GameResult | null;
  log: GameLogEntry[];
  redealPendingSeat: Seat | null;
}

interface GameStoreActions {
  restore: (game: PlayerVisibleGameState) => void;
  setPhase: (phase: GamePhase) => void;
  setMyHand: (hand: Card[]) => void;
  setDealerSeat: (seat: Seat) => void;
  setCurrentTurn: (seat: Seat, validCards?: Card[]) => void;
  setBidding: (bidding: BiddingState | null) => void;
  addBid: (seat: Seat, action: BidAction) => void;
  setContract: (contract: Contract) => void;
  setPlaying: (playing: PlayingState | null) => void;
  setResult: (result: GameResult) => void;
  addLogEntry: (entry: GameLogEntry) => void;
  setRedealPendingSeat: (seat: Seat | null) => void;
  updateTrickEnd: (trickCountEW: number, trickCountNS: number) => void;
  playCard: (seat: Seat, card: Card) => void;
  reset: () => void;
}

const initialState: GameStoreState = {
  bigTwo: null,
  redPoints: null,
  gameType: null,
  phase: null,
  myHand: [],
  dealerSeat: null,
  currentTurnSeat: null,
  validCards: [],
  bidding: null,
  contract: null,
  playing: null,
  result: null,
  log: [],
  redealPendingSeat: null,
};

export const useGameStore = create<GameStoreState & GameStoreActions>((set) => ({
  ...initialState,
  restore: (game) => set((state) => {
    const nextState: GameStoreState = game.gameType === 'bigtwo' ? {
      ...initialState,
      gameType: 'bigtwo',
      phase: game.phase,
      currentTurnSeat: game.phase === 'playing' ? game.currentTurnSeat : null,
      bigTwo: retainSnapshotValue(state.bigTwo, game),
    } : game.gameType === 'redpoints' ? {
      ...initialState,
      gameType: 'redpoints',
      phase: game.phase,
      currentTurnSeat: game.phase === 'playing' ? game.currentTurnSeat : null,
      redPoints: retainSnapshotValue(state.redPoints, game),
    } : {
      bigTwo: null,
      redPoints: null,
      gameType: 'bridge',
      phase: game.phase,
      dealerSeat: game.dealerSeat,
      myHand: equalSnapshotValue(state.myHand, game.myHand) ? state.myHand : [...game.myHand],
      log: equalSnapshotValue(state.log, game.log) ? state.log : [...game.log],
      currentTurnSeat: game.playing?.currentTurnSeat ?? game.bidding?.currentBidderSeat ?? null,
      validCards: equalSnapshotValue(state.validCards, game.validCards)
        ? state.validCards : [...game.validCards],
      bidding: retainSnapshotValue(state.bidding, game.bidding),
      contract: retainSnapshotValue(state.contract, game.contract),
      playing: retainSnapshotValue(state.playing, game.playing),
      result: retainSnapshotValue(state.result, game.result),
      redealPendingSeat: game.redealPendingSeat,
    };
    return (Object.keys(nextState) as (keyof GameStoreState)[])
      .every((key) => Object.is(state[key], nextState[key])) ? state : nextState;
  }),
  setPhase: (phase) => set({ phase }),
  setMyHand: (hand) => set({ myHand: hand }),
  setDealerSeat: (seat) => set({ dealerSeat: seat }),
  setCurrentTurn: (seat, validCards) => set({ currentTurnSeat: seat, validCards: validCards ?? [] }),
  setBidding: (bidding) => set({ bidding }),
  addBid: (seat, action) =>
    set((state) => ({
      bidding: state.bidding
        ? {
            ...state.bidding,
            bids: [...state.bidding.bids, { seat, action }],
            currentBidderSeat: seat,
          }
        : null,
    })),
  setContract: (contract) => set({ contract, phase: 'playing' }),
  setPlaying: (playing) => set({ playing }),
  setResult: (result) => set({ result, phase: 'scoring' }),
  addLogEntry: (entry) =>
    set((state) => ({ log: [...state.log, entry] })),
  setRedealPendingSeat: (seat) => set({ redealPendingSeat: seat }),
  updateTrickEnd: (trickCountEW, trickCountNS) =>
    set((state) => ({
      playing: state.playing ? { ...state.playing, trickCountEW, trickCountNS, currentTrick: {} } : null,
    })),
  playCard: (seat, card) =>
    set((state) => {
      // 如果是自己的牌，從手牌移除
      const newHand = state.myHand.filter(
        (c) => !(c.suit === card.suit && c.rank === card.rank),
      );
      const newTrick = { ...(state.playing?.currentTrick ?? {}), [seat]: card };
      return {
        myHand: newHand.length < state.myHand.length ? newHand : state.myHand,
        playing: state.playing ? { ...state.playing, currentTrick: newTrick } : null,
      };
    }),
  reset: () => set((state) => (Object.keys(initialState) as (keyof GameStoreState)[])
    .every((key) => equalSnapshotValue(state[key], initialState[key])) ? state : initialState),
}));
