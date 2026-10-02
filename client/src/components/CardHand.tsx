// ─── CardHand 元件：手牌顯示 ───

import type { ReactNode } from 'react';
import type { Card } from '@shared/types';
import { SUIT_SYMBOLS, RANK_DISPLAY } from '@shared/constants';
import styles from './CardHand.module.css';

interface CardHandProps {
  cards: readonly Card[];
  playableCards?: readonly Card[];
  onCardClick?: (card: Card) => void;
  disabled?: boolean;
}

function isCardPlayable(card: Card, playableCards?: readonly Card[]): boolean {
  if (!playableCards) return false;
  return playableCards.some((c) => c.suit === card.suit && c.rank === card.rank);
}

function getSuitColorClass(suit: Card['suit']): string {
  return suit === 'hearts' || suit === 'diamonds' ? styles.suitRed : styles.suitBlack;
}

export function CardHand({ cards, playableCards, onCardClick, disabled }: CardHandProps): ReactNode {
  return (
    <div className={styles.handContainer}>
      {cards.map((card) => {
        const playable = isCardPlayable(card, playableCards);
        const cardClasses = [
          styles.card,
          getSuitColorClass(card.suit),
          playable ? styles.cardPlayable : '',
          disabled ? styles.cardDisabled : '',
        ].filter(Boolean).join(' ');

        return (
          <button
            key={`${card.suit}-${card.rank}`}
            className={cardClasses}
            onClick={() => playable && onCardClick?.(card)}
            disabled={disabled || !playable}
            aria-label={`${RANK_DISPLAY[card.rank]}${SUIT_SYMBOLS[card.suit]}`}
          >
            <span className={styles.rankText}>{RANK_DISPLAY[card.rank]}</span>
            <span className={styles.suitIcon}>{SUIT_SYMBOLS[card.suit]}</span>
          </button>
        );
      })}
    </div>
  );
}
