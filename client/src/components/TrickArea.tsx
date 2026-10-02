// ─── TrickArea 元件：當前墩顯示 ───

import type { ReactNode } from 'react';
import type { Card, Seat } from '@shared/types';
import { SUIT_SYMBOLS, RANK_DISPLAY } from '@shared/constants';
import styles from './TrickArea.module.css';

interface TrickAreaProps {
  currentTrick: Partial<Record<Seat, Card>>;
  trickCountEW: number;
  trickCountNS: number;
}

const SEAT_STYLE_MAP: Record<Seat, string> = {
  N: styles.trickCardN,
  E: styles.trickCardE,
  S: styles.trickCardS,
  W: styles.trickCardW,
};

function getSuitColorClass(suit: Card['suit']): string {
  return suit === 'hearts' || suit === 'diamonds' ? styles.suitRed : styles.suitBlack;
}

export function TrickArea({ currentTrick, trickCountEW, trickCountNS }: TrickAreaProps): ReactNode {
  const seats: Seat[] = ['N', 'E', 'S', 'W'];

  return (
    <div className={styles.trickContainer}>
      {seats.map((seat) => {
        const card = currentTrick[seat];
        if (!card) return null;

        return (
          <div
            key={seat}
            className={`${styles.trickCard} ${SEAT_STYLE_MAP[seat]} ${getSuitColorClass(card.suit)}`}
          >
            <span className={styles.rankText}>{RANK_DISPLAY[card.rank]}</span>
            <span className={styles.suitIcon}>{SUIT_SYMBOLS[card.suit]}</span>
          </div>
        );
      })}

      <div className={styles.trickInfo}>
        <div className={styles.trickScore}>
          NS: {trickCountNS} | EW: {trickCountEW}
        </div>
      </div>
    </div>
  );
}
