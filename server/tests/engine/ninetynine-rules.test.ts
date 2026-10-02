import { describe, it, expect } from 'vitest';
import type { Card, Rank, Suit } from '@shared/types';
import {
  NN_HAND_SIZE,
  NN_MAX,
  nnApply,
  nnHasPlayable,
  nnIsPlayable,
  nnRequiresChoice,
} from '@shared/rules/ninetynine';

const SUITS: Record<string, Suit> = { C: 'clubs', D: 'diamonds', H: 'hearts', S: 'spades' };
const RANKS: Record<string, Rank> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13, A: 14,
};

/** 'AH' → A♥, '10S' → 10♠ */
function c(code: string): Card {
  return { rank: RANKS[code.slice(0, -1)], suit: SUITS[code.slice(-1)] };
}

const plain = { reverse: false, skip: false, designate: false };

describe('ninety-nine rules', () => {
  it('exposes constants', () => {
    expect(NN_HAND_SIZE).toBe(5);
    expect(NN_MAX).toBe(99);
  });

  it('requires a choice only for 10 and Q', () => {
    expect(nnRequiresChoice(c('10H'))).toBe(true);
    expect(nnRequiresChoice(c('QS'))).toBe(true);
    for (const r of ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'J', 'K']) {
      expect(nnRequiresChoice(c(`${r}C`))).toBe(false);
    }
    expect(() => nnApply(10, c('10H'))).toThrow();
  });

  it('adds face value for 2,3,6,7,8,9', () => {
    for (const r of ['2', '3', '6', '7', '8', '9']) {
      expect(nnApply(50, c(`${r}D`))).toEqual({ total: 50 + RANKS[r], ...plain });
    }
  });

  it('aces add 1 except the ace of spades which resets to 0', () => {
    expect(nnApply(50, c('AH'))).toEqual({ total: 51, ...plain });
    expect(nnApply(50, c('AD'))).toEqual({ total: 51, ...plain });
    expect(nnApply(50, c('AC'))).toEqual({ total: 51, ...plain });
    expect(nnApply(50, c('AS'))).toEqual({ total: 0, ...plain });
  });

  it('4 reverses, 5 designates, J skips, all keeping the total', () => {
    expect(nnApply(42, c('4H'))).toEqual({ total: 42, reverse: true, skip: false, designate: false });
    expect(nnApply(42, c('5H'))).toEqual({ total: 42, reverse: false, skip: false, designate: true });
    expect(nnApply(42, c('JH'))).toEqual({ total: 42, reverse: false, skip: true, designate: false });
  });

  it('K sets the total to 99', () => {
    expect(nnApply(3, c('KS'))).toEqual({ total: 99, ...plain });
    expect(nnApply(99, c('KS'))).toEqual({ total: 99, ...plain });
  });

  it('10 and Q add or subtract, minus floors at 0', () => {
    expect(nnApply(30, c('10H'), 'plus').total).toBe(40);
    expect(nnApply(30, c('10H'), 'minus').total).toBe(20);
    expect(nnApply(5, c('10H'), 'minus').total).toBe(0);
    expect(nnApply(30, c('QH'), 'plus').total).toBe(50);
    expect(nnApply(30, c('QH'), 'minus').total).toBe(10);
    expect(nnApply(15, c('QH'), 'minus').total).toBe(0);
  });

  it('checks playability against 99', () => {
    expect(nnIsPlayable(90, c('9C'))).toBe(true);
    expect(nnIsPlayable(91, c('9C'))).toBe(false);
    expect(nnIsPlayable(99, c('AH'))).toBe(false);
    expect(nnIsPlayable(99, c('AS'))).toBe(true);
    expect(nnIsPlayable(99, c('10H'))).toBe(true);
    expect(nnIsPlayable(99, c('QH'))).toBe(true);
    expect(nnIsPlayable(99, c('KH'))).toBe(true);
    for (const r of ['4', '5', 'J']) expect(nnIsPlayable(99, c(`${r}D`))).toBe(true);
  });

  it('detects elimination', () => {
    const hand = [c('9C'), c('8H'), c('7D'), c('6C'), c('9D')];
    expect(nnHasPlayable(95, hand)).toBe(false);
    expect(nnHasPlayable(95, [...hand.slice(0, 4), c('4S')])).toBe(true);
    expect(nnHasPlayable(90, hand)).toBe(true);
    expect(nnHasPlayable(0, [])).toBe(false);
  });
});
