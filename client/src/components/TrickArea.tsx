// ─── TrickArea 元件：當前墩顯示 ───

import type { ReactNode } from 'react';
import type { Card, Seat } from '@shared/types';
import { SUIT_SYMBOLS, RANK_DISPLAY } from '@shared/constants';
import { cardImageUrl } from '../cards';
import { tablePosition } from '../game-view';
import { useI18nStore } from '../stores/i18n-store';
import styles from './TrickArea.module.css';

interface TrickAreaProps {
  currentTrick: Partial<Record<Seat, Card>>;
  leadSeat: Seat;
  bottomSeat: Seat;
  myTurn: boolean;
}

const SEATS: readonly Seat[] = ['N', 'E', 'S', 'W'];

export function TrickArea({ currentTrick, leadSeat, bottomSeat, myTurn }: TrickAreaProps): ReactNode {
  const { t } = useI18nStore();

  return (
    <div className={styles.trickContainer}>
      {SEATS.map((seat) => {
        const card = currentTrick[seat];
        const slotClass = `${styles.slot} ${styles[tablePosition(seat, bottomSeat)]}`;
        if (!card) {
          return seat === bottomSeat && myTurn
            ? <div key={seat} className={`${slotClass} ${styles.placeholder}`}>{t('table.yourCard')}</div>
            : null;
        }
        return (
          <div key={seat} className={slotClass}>
            <div className={styles.trickCard} role="img"
              aria-label={`${t(`seat.${seat}`)} ${RANK_DISPLAY[card.rank]}${SUIT_SYMBOLS[card.suit]}`}>
              <img src={cardImageUrl(card)} alt="" draggable={false} />
            </div>
            <span className={styles.who}>
              {t(`seat.${seat}`)}
              {seat === leadSeat && <span className={styles.lead}>{t('table.lead')}</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}
