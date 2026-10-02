// ─── BiddingPanel 元件：叫牌面板（牌桌中央浮層） ───

import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import type { BidAction, BidLevel, BidSuit } from '@shared/types';
import { socket } from '../socket';
import { useGameStore } from '../stores/game-store';
import { useRoomStore } from '../stores/room-store';
import { useI18nStore } from '../stores/i18n-store';
import { BidLabel } from './AuctionTable';

import styles from './BiddingPanel.module.css';

const LEVELS: BidLevel[] = [1, 2, 3, 4, 5, 6, 7];
const SUITS: BidSuit[] = ['clubs', 'diamonds', 'hearts', 'spades', 'nt'];

export function BiddingPanel(): ReactNode {
  const log = useGameStore((state) => state.log);
  const currentTurnSeat = useGameStore((state) => state.currentTurnSeat);
  const mySeat = useRoomStore((state) => state.mySeat);
  const { t } = useI18nStore();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const isMyTurn = mySeat === currentTurnSeat;

  // 從 log 中提取叫牌歷史
  const bidEntries = log.filter((e) => e.type === 'bid');

  // 找出當前最高叫牌
  const lastBid = [...bidEntries].reverse().find((e) => e.type === 'bid' && e.action.type === 'bid');
  const highestBid = lastBid?.type === 'bid' && lastBid.action.type === 'bid'
    ? { level: lastBid.action.level, suit: lastBid.action.suit }
    : null;

  const isBidHigher = useCallback((level: BidLevel, suit: BidSuit): boolean => {
    if (!highestBid) return true;
    if (level > highestBid.level) return true;
    if (level === highestBid.level) {
      const suitOrder = SUITS;
      return suitOrder.indexOf(suit) > suitOrder.indexOf(highestBid.suit);
    }
    return false;
  }, [highestBid]);

  const handleBid = useCallback((action: BidAction): void => {
    setError('');
    setPending(true);
    socket.timeout(10000).emit('game:bid', { bid: action }, (timeout, response) => {
      setPending(false);
      if (timeout) setError(t('auth.connectionError'));
      else if (!response.success) setError(response.error ?? t('common.error'));
    });
  }, [t]);

  if (!isMyTurn) {
    return (
      <div className={styles.waitingPill} role="status">
        {t('table.waitingBid', { seat: currentTurnSeat ? t(`seat.${currentTurnSeat}`) : '...' })}
      </div>
    );
  }

  return (
    <div className={styles.biddingContainer}>
      <div className={styles.header}>
        <span className={styles.biddingTitle}>{t('table.yourBid')}</span>
        {highestBid && <span className={styles.highest}>
          {t('table.highest')} <BidLabel level={highestBid.level} suit={highestBid.suit} />
        </span>}
      </div>
      {error && <p className={styles.error} role="alert">{error}</p>}

      {/* 叫牌格子 */}
      <div className={styles.bidGrid}>
        {LEVELS.map((level) =>
          SUITS.map((suit) => {
            const enabled = isBidHigher(level, suit);
            return (
              <button
                key={`${level}${suit}`}
                className={styles.bidBtn}
                disabled={pending || !enabled}
                onClick={() => handleBid({ type: 'bid', level, suit })}
              >
                <BidLabel level={level} suit={suit} />
              </button>
            );
          }),
        )}
      </div>

      {/* Pass 按鈕 */}
      <button
        className={styles.passBtn}
        disabled={pending}
        onClick={() => handleBid({ type: 'pass' })}
      >
        {t('game.pass')}
      </button>
    </div>
  );
}
