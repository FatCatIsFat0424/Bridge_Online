// ─── BiddingPanel 元件：叫牌面板 ───

import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import type { BidAction, BidLevel, BidSuit } from '@shared/types';
import { SUIT_SYMBOLS } from '@shared/constants';
import { socket } from '../socket';
import { useGameStore } from '../stores/game-store';
import { useRoomStore } from '../stores/room-store';
import { useI18nStore } from '../stores/i18n-store';

import styles from './BiddingPanel.module.css';

const BID_SUIT_LABELS: Record<BidSuit, string> = {
  clubs: SUIT_SYMBOLS.clubs,
  diamonds: SUIT_SYMBOLS.diamonds,
  hearts: SUIT_SYMBOLS.hearts,
  spades: SUIT_SYMBOLS.spades,
  nt: 'NT',
};

function suitLabel(suit: BidSuit): ReactNode {
  const red = suit === 'hearts' || suit === 'diamonds';
  return <span className={red ? styles.suitRed : undefined}>{BID_SUIT_LABELS[suit]}</span>;
}

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

  return (
    <div className={styles.biddingContainer}>
      <div className={styles.biddingTitle}>{t('game.bidding')}</div>
      {error && <p className={styles.error} role="alert">{error}</p>}

      {/* 叫牌歷史 */}
      <div className={styles.bidHistory}>
        {bidEntries.map((entry, i) => {
          if (entry.type !== 'bid') return null;
          const action = entry.action;
          return (
            <span
              key={i}
              className={`${styles.bidHistoryItem} ${action.type === 'pass' ? styles.bidHistoryPass : ''}`}
            >
              {entry.seat}: {action.type === 'pass' ? 'Pass' : <>{action.level}{suitLabel(action.suit)}</>}
            </span>
          );
        })}
      </div>

      {isMyTurn ? (
        <>
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
                    {level}{suitLabel(suit)}
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
        </>
      ) : (
        <div className={styles.waitingMsg}>
          {t('game.waitingFor', { seat: currentTurnSeat ?? '...' })} ({t('game.bidding')})
        </div>
      )}
    </div>
  );
}
