// ─── CardHand 元件：手牌顯示（扇形） ───

import type { CSSProperties, ReactNode } from 'react';
import type { Card } from '@shared/types';
import { SUIT_SYMBOLS, RANK_DISPLAY } from '@shared/constants';
import { cardImageUrl } from '../cards';
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

export function CardHand({ cards, playableCards, onCardClick, disabled }: CardHandProps): ReactNode {
  const middle = (cards.length - 1) / 2;
  return (
    <div className={styles.handContainer}>
      {cards.map((card, index) => {
        const playable = isCardPlayable(card, playableCards);
        const cardClasses = [
          styles.card,
          playable && !disabled ? styles.cardPlayable : '',
        ].filter(Boolean).join(' ');

        return (
          <button
            key={`${card.suit}-${card.rank}`}
            className={cardClasses}
            style={{ '--fan': index - middle } as CSSProperties}
            onClick={() => playable && onCardClick?.(card)}
            disabled={disabled || !playable}
            aria-label={`${RANK_DISPLAY[card.rank]}${SUIT_SYMBOLS[card.suit]}`}
          >
            <img src={cardImageUrl(card)} alt="" draggable={false} />
          </button>
        );
      })}
    </div>
  );
}
