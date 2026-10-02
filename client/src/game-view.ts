// ─── 牌桌畫面用純函式（無 React） ───

import type { BidAction, PlayingState, Seat } from '@shared/types';

export const AUCTION_COLUMNS: readonly Seat[] = ['W', 'N', 'E', 'S'];

export interface AuctionCall { readonly seat: Seat; readonly action: BidAction }

/** Rows of 4 cells in W,N,E,S order; null = empty cell. First row is padded before the dealer's column; last row padded to 4. */
export function auctionRows(calls: readonly AuctionCall[], dealer: Seat): (AuctionCall | null)[][] {
  if (calls.length === 0) return [];
  const cells: (AuctionCall | null)[] = [
    ...new Array<null>(AUCTION_COLUMNS.indexOf(dealer)).fill(null),
    ...calls,
  ];
  while (cells.length % 4 !== 0) cells.push(null);
  const rows: (AuctionCall | null)[][] = [];
  for (let i = 0; i < cells.length; i += 4) rows.push(cells.slice(i, i + 4));
  return rows;
}

export type TablePosition = 'bottom' | 'left' | 'top' | 'right';
const CLOCKWISE: readonly Seat[] = ['N', 'E', 'S', 'W'];
const POSITIONS: readonly TablePosition[] = ['bottom', 'left', 'top', 'right'];

/** Screen position of a seat when `bottomSeat` (me) sits at the bottom of the table. */
export function tablePosition(seat: Seat, bottomSeat: Seat): TablePosition {
  return POSITIONS[(CLOCKWISE.indexOf(seat) - CLOCKWISE.indexOf(bottomSeat) + 4) % 4];
}

/** Cards left in a seat's hand: 13 before play; during play 13 - completed tricks - (1 if the seat has a card in the current trick). */
export function remainingCards(seat: Seat, playing: PlayingState | null): number {
  if (!playing) return 13;
  return 13 - playing.completedTricks.length - (playing.currentTrick[seat] ? 1 : 0);
}
