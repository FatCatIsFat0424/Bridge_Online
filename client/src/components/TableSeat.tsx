// ─── TableSeat 元件：牌桌座位（名牌、徽章、牌背） ───

import type { ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Seat } from '@shared/types';
import { remainingCards } from '../game-view';
import type { TablePosition } from '../game-view';
import { useGameStore } from '../stores/game-store';
import { useI18nStore } from '../stores/i18n-store';
import { useRoomStore } from '../stores/room-store';
import { PlayerLink } from './PlayerLink';
import styles from './TableSeat.module.css';

const MAX_BACKS = 6;

interface TableSeatProps {
  seat: Seat;
  position: TablePosition;
}

export function TableSeat({ seat, position }: TableSeatProps): ReactNode {
  const { t } = useI18nStore();
  const player = useRoomStore((state) => state.roomInfo?.seats[seat].player ?? null);
  const isMe = useRoomStore((state) => state.mySeat === seat);
  const { phase, turn, declarer, dealer, playing } = useGameStore(useShallow((state) => ({
    phase: state.phase,
    turn: state.currentTurnSeat === seat,
    declarer: state.contract?.declarer === seat,
    dealer: state.dealerSeat === seat,
    playing: state.playing,
  })));
  const active = turn && (phase === 'bidding' || phase === 'playing');
  const cards = remainingCards(seat, playing);

  return (
    <div className={`${styles.seat} ${styles[position]} ${active ? styles.turn : ''}`}>
      <div className={styles.plate}>
        {player ? <PlayerLink player={player} size="medium" /> : <span className={styles.empty}>—</span>}
        <span className={styles.tags}>
          <span className={styles.seatLabel}>{t(`seat.${seat}`)}</span>
          {isMe && <span className={styles.me}>{t('common.me')}</span>}
          {declarer && <span className={styles.declarer}>{t('table.declarer')}</span>}
          {dealer && phase === 'bidding' && <span className={styles.dealer}>{t('table.dealer')}</span>}
        </span>
        {active && <span className={styles.turnFlag}>{t('table.turn')}</span>}
      </div>
      {position !== 'bottom' && cards > 0 && <div className={styles.backs}>
        <span className={styles.fan} aria-hidden="true">
          {Array.from({ length: Math.min(cards, MAX_BACKS) }, (_, i) => <span key={i} className={styles.back} />)}
        </span>
        <span className={styles.count}>{t('table.cards', { n: String(cards) })}</span>
      </div>}
    </div>
  );
}
