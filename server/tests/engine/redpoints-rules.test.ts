import { describe, it, expect } from 'vitest';
import type { Card, Rank, Suit } from '@shared/types';
import {
  RP_HAND_SIZE,
  RP_TABLE_SIZE,
  rpCanPair,
  rpCardPoints,
  rpNeedsRedeal,
  rpPairOptions,
  rpScore,
} from '@shared/rules/redpoints';

const SUITS: Record<string, Suit> = { C: 'clubs', D: 'diamonds', H: 'hearts', S: 'spades' };
const RANKS: Record<string, Rank> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13, A: 14,
};

/** 'AH' → A♥, '10S' → 10♠ */
function c(code: string): Card {
  return { rank: RANKS[code.slice(0, -1)], suit: SUITS[code.slice(-1)] };
}

const ALL_RANKS = Object.keys(RANKS);

describe('red points rules', () => {
  it('exposes deal sizes', () => {
    expect(RP_HAND_SIZE).toBe(6);
    expect(RP_TABLE_SIZE).toBe(4);
  });

  it('pairs A-9 summing to 10 with A as 1', () => {
    expect(rpCanPair(c('AS'), c('9H'))).toBe(true);
    expect(rpCanPair(c('9H'), c('AS'))).toBe(true);
    expect(rpCanPair(c('2C'), c('8D'))).toBe(true);
    expect(rpCanPair(c('3C'), c('7D'))).toBe(true);
    expect(rpCanPair(c('4C'), c('6D'))).toBe(true);
    expect(rpCanPair(c('5C'), c('5D'))).toBe(true);
    expect(rpCanPair(c('AS'), c('AH'))).toBe(false);
    expect(rpCanPair(c('4C'), c('5D'))).toBe(false);
    expect(rpCanPair(c('9C'), c('9D'))).toBe(false);
  });

  it('pairs 10/J/Q/K only with the same rank', () => {
    for (const r of ['10', 'J', 'Q', 'K']) expect(rpCanPair(c(`${r}S`), c(`${r}H`))).toBe(true);
    for (const r of ['A', '2', '3', '4', '5', '6', '7', '8', '9']) {
      expect(rpCanPair(c('10S'), c(`${r}H`))).toBe(false);
      expect(rpCanPair(c(`${r}H`), c('10S'))).toBe(false);
    }
    expect(rpCanPair(c('JS'), c('QH'))).toBe(false);
    expect(rpCanPair(c('QS'), c('KH'))).toBe(false);
    expect(rpCanPair(c('10S'), c('JH'))).toBe(false);
  });

  it('lists table pairing options', () => {
    const table = [c('9H'), c('9C'), c('KD'), c('AS')];
    expect(rpPairOptions(c('AC'), table)).toEqual([c('9H'), c('9C')]);
    expect(rpPairOptions(c('KS'), table)).toEqual([c('KD')]);
    expect(rpPairOptions(c('5S'), table)).toEqual([]);
  });

  it('scores red cards per table', () => {
    expect(rpCardPoints(c('AH'))).toBe(20);
    expect(rpCardPoints(c('AD'))).toBe(20);
    expect(rpCardPoints(c('7H'))).toBe(7);
    expect(rpCardPoints(c('2D'))).toBe(2);
    for (const r of ['10', 'J', 'Q', 'K']) expect(rpCardPoints(c(`${r}H`))).toBe(10);
    for (const r of ALL_RANKS) {
      expect(rpCardPoints(c(`${r}S`))).toBe(0);
      expect(rpCardPoints(c(`${r}C`))).toBe(0);
    }
  });

  it('full deck totals 208', () => {
    const deck = Object.keys(SUITS).flatMap((s) => ALL_RANKS.map((r) => c(`${r}${s}`)));
    expect(deck).toHaveLength(52);
    expect(rpScore(deck)).toBe(208);
    expect(rpScore([])).toBe(0);
  });

  it('redeals when 3+ of a rank are face up', () => {
    expect(rpNeedsRedeal([c('5H'), c('5S'), c('5D'), c('KC')])).toBe(true);
    expect(rpNeedsRedeal([c('5H'), c('5S'), c('5D'), c('5C')])).toBe(true);
    expect(rpNeedsRedeal([c('5H'), c('5S'), c('KD'), c('KC')])).toBe(false);
    expect(rpNeedsRedeal([c('AH'), c('2S'), c('3D'), c('4C')])).toBe(false);
  });
});
