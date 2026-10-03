// ─── 大老二畫面用純函式（無 React） ───

import { identifyCombo } from '@shared/rules/bigtwo';
import type { BigTwoCombo, BigTwoComboType } from '@shared/rules/bigtwo';
import type { BigTwoLogEntry, BigTwoPlay, Card } from '@shared/types';
import type { GameTranslationKey } from '../../game-i18n';

export function comboLabelKey(type: BigTwoComboType): GameTranslationKey {
  return `bigtwo.combo.${type}`;
}

export function sameCard(a: Card, b: Card): boolean {
  return a.suit === b.suit && a.rank === b.rank;
}

export function sameCardSet(a: readonly Card[], b: readonly Card[]): boolean {
  return a.length === b.length && a.every((card) => b.some((other) => sameCard(card, other)));
}

/** Adds the card to the selection, or removes it if already selected. */
export function toggleCard(selection: readonly Card[], card: Card): Card[] {
  return selection.some((c) => sameCard(c, card))
    ? selection.filter((c) => !sameCard(c, card)) : [...selection, card];
}

/** The play after the one matching the current selection (first play when none matches); empty when there are no plays. */
export function nextHint(plays: readonly BigTwoCombo[], selection: readonly Card[]): Card[] {
  if (plays.length === 0) return [];
  const index = plays.findIndex((play) => sameCardSet(play.cards, selection));
  return [...plays[(index + 1) % plays.length].cards];
}

export type BigTwoRoundEntry = Extract<BigTwoLogEntry, { type: 'play' | 'pass' }>;

/** Log entries since the last round end (plays and passes of the current round). */
export function currentRoundEntries(log: readonly BigTwoLogEntry[]): BigTwoRoundEntry[] {
  let start = 0;
  log.forEach((entry, index) => { if (entry.type === 'round_end') start = index + 1; });
  return log.slice(start).filter((entry): entry is BigTwoRoundEntry =>
    entry.type === 'play' || entry.type === 'pass');
}

export function lastPlayCombo(lastPlay: BigTwoPlay | null): BigTwoCombo | null {
  return lastPlay ? identifyCombo(lastPlay.cards) : null;
}

const SUPERSCRIPTS = ['⁰', '¹', '²', '³', '⁴'];

/** Penalty formula text, e.g. `5 × 2² = 20`. */
export function penaltyFormula(cardsLeft: number, twosLeft: number, score: number): string {
  return `${cardsLeft} × 2${SUPERSCRIPTS[twosLeft] ?? `^${twosLeft}`} = ${score}`;
}
