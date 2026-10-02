// ─── RedPointsTable：撿紅點牌桌（桌面牌、牌堆翻牌、手牌、資訊欄、結算） ───

import { useState } from 'react';
import type { ReactNode } from 'react';
import { rpCardPoints, rpPairOptions } from '@shared/rules/redpoints';
import { RANK_DISPLAY, SUIT_SYMBOLS } from '@shared/constants';
import type { Card, RedPointsMatchResult, RedPointsVisibleState, Seat } from '@shared/types';
import { cardImageUrl } from '../../cards';
import { socket } from '../../socket';
import { useGameStore } from '../../stores/game-store';
import { useRoomStore } from '../../stores/room-store';
import { useI18nStore } from '../../stores/i18n-store';
import { CardHand } from '../../components/CardHand';
import { GameShell } from '../GameShell';
import styles from './RedPointsTable.module.css';

const SEATS: readonly Seat[] = ['N', 'E', 'S', 'W'];
const RECENT_MOVES = 8;

type ActionCallback = (timeout: Error | null, response?: { success: boolean; error?: string }) => void;

const sameCard = (a: Card, b: Card): boolean => a.suit === b.suit && a.rank === b.rank;
const cardLabel = (card: Card): string => `${SUIT_SYMBOLS[card.suit]}${RANK_DISPLAY[card.rank]}`;

function useSeatName(): (seat: Seat) => string {
  const seats = useRoomStore((state) => state.roomInfo?.seats);
  const { t } = useI18nStore();
  return (seat: Seat): string => seats?.[seat].player?.nickname ?? t(`seat.${seat}`);
}

function CardImage({ card, className }: { card: Card; className?: string }): ReactNode {
  return <img className={`${styles.card} ${className ?? ''}`} src={cardImageUrl(card)} alt={cardLabel(card)} draggable={false} />;
}

function Centre({ game, options, onCapture }: {
  game: RedPointsVisibleState; options: readonly Card[]; onCapture: ((card: Card) => void) | null;
}): ReactNode {
  const { t } = useI18nStore();
  const lastFlip = game.log.findLast((entry) => entry.type === 'flip');
  const flipped = game.pendingFlip ?? lastFlip?.card ?? null;
  return <div className={styles.centre}>
    <div className={styles.stockRow}>
      <div className={styles.stock} title={t('redpoints.stock')}>
        {game.stockCount > 0 && <span className={styles.back} aria-hidden="true" />}
        <span className={styles.stockCount}>{t('redpoints.stock')} {game.stockCount}</span>
      </div>
      {/* key 依翻牌次數，讓每次翻牌都重播翻面動畫 */}
      {flipped && <div key={`${game.log.length}-${game.pendingFlip ? 'pending' : 'done'}`}
        className={`${styles.flip} ${game.pendingFlip ? styles.flipPending : ''}`}>
        <CardImage card={flipped} className={styles.flipCard} />
      </div>}
    </div>
    <div className={styles.tableGrid}>
      {game.table.map((card) => {
        const pairable = options.some((option) => sameCard(option, card));
        return <button key={`${card.suit}-${card.rank}`} type="button"
          className={`${styles.tableCard} ${pairable ? styles.pairable : ''}`}
          disabled={!pairable || !onCapture} onClick={() => onCapture?.(card)}
          aria-label={cardLabel(card)}>
          <CardImage card={card} />
        </button>;
      })}
    </div>
  </div>;
}

function Info({ game }: { game: RedPointsVisibleState }): ReactNode {
  const { t } = useI18nStore();
  const seatName = useSeatName();
  const recent = game.log.slice(-RECENT_MOVES).reverse();
  return <aside className={styles.rail}>
    <section className={styles.box}>
      <p className={styles.turn}>{game.phase !== 'playing' ? t('game.scoring')
        : game.currentTurnSeat === game.mySeat ? t('redpoints.yourTurn')
          : t('redpoints.turnOf', { name: seatName(game.currentTurnSeat) })}</p>
      <p className={styles.note}>{t('redpoints.stock')} {game.stockCount}</p>
    </section>

    <section className={`${styles.box} ${styles.recentBox}`}>
      <h2 className={styles.caption}>{t('redpoints.recent')}</h2>
      {recent.length === 0 ? <p className={styles.note}>{t('redpoints.noMoves')}</p>
        : <ol className={styles.recentList}>{recent.map((entry) => (
          // 每張牌只會被出或翻一次
          <li key={cardLabel(entry.card)} className={styles.recentRow}>
            <span className={styles.recentName}>{seatName(entry.seat)}</span>
            <span>{t(entry.type === 'play' ? 'redpoints.logPlay' : 'redpoints.logFlip')}</span>
            <CardImage card={entry.card} className={styles.mini} />
            {entry.captured ? <>→<CardImage card={entry.captured} className={styles.mini} /></>
              : <span className={styles.stayTag}>{t('redpoints.logStay')}</span>}
          </li>
        ))}</ol>}
    </section>

    <details className={styles.box}>
      <summary className={styles.caption}>{t('redpoints.rules')}</summary>
      <p className={styles.note}>{t('redpoints.rulesPair')}</p>
      <p className={styles.note}>{t('redpoints.rulesTurn')}</p>
      <p className={styles.note}>{t('redpoints.rulesScore')}</p>
    </details>
  </aside>;
}

function ResultOverlay({ result, captured, pending, error, onBack }: {
  result: RedPointsMatchResult; captured: Record<Seat, Card[]>;
  pending: boolean; error: string; onBack: () => void;
}): ReactNode {
  const { t } = useI18nStore();
  const seatName = useSeatName();
  return <div className={styles.scoreOverlay}>
    <div className={styles.overlayCard}>
      <h2 className={styles.scoreTitle}>{t('redpoints.winner', { name: result.winners.map(seatName).join('、') })}</h2>
      <table className={styles.scoreTable}>
        <thead><tr><th>{t('redpoints.player')}</th><th>{t('redpoints.score')}</th></tr></thead>
        <tbody>{SEATS.map((seat) => {
          const red = captured[seat].filter((card) => rpCardPoints(card) > 0);
          return <tr key={seat} className={result.winners.includes(seat) ? styles.winnerRow : ''}>
            <td>
              <div>{result.winners.includes(seat) && '🏆 '}{seatName(seat)}</div>
              {red.length > 0 && <span className={styles.miniRow}>
                {red.map((card) => <CardImage key={`${card.suit}-${card.rank}`} card={card} className={styles.mini} />)}
              </span>}
            </td>
            <td className={styles.pointsCell}>{result.points[seat]}</td>
          </tr>;
        })}</tbody>
      </table>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <button className="btn btn-primary" disabled={pending} onClick={onBack}>{t('score.backToRoom')}</button>
    </div>
  </div>;
}

export function RedPointsTable(): ReactNode {
  const game = useGameStore((state) => state.redPoints);
  const { t } = useI18nStore();
  const seatName = useSeatName();
  const [selection, setSelection] = useState<Card | null>(null);
  const [actionError, setActionError] = useState('');
  const [actionPending, setActionPending] = useState(false);

  if (!game) return null;

  const playing = game.phase === 'playing';
  const isMyTurn = playing && game.currentTurnSeat === game.mySeat;
  const choosingFlip = isMyTurn && game.step === 'flip-choose' && game.pendingFlip !== null;
  const canPlay = isMyTurn && game.step === 'play' && !actionPending;
  // 輪到別人時不保留選取；只認仍在手上的牌
  const selected = canPlay && selection && game.myHand.some((card) => sameCard(card, selection)) ? selection : null;
  const options = choosingFlip && game.pendingFlip ? rpPairOptions(game.pendingFlip, game.table)
    : selected ? rpPairOptions(selected, game.table) : [];

  const handleActionResult: ActionCallback = (timeout, response) => {
    setActionPending(false);
    if (timeout) setActionError(t('auth.connectionError'));
    else if (!response?.success) setActionError(response?.error ?? t('common.error'));
  };

  const send = (capture: Card | null): void => {
    if (actionPending) return;
    setActionError('');
    setActionPending(true);
    if (choosingFlip && capture) {
      socket.timeout(10000).emit('game:redpoints:chooseFlip', { capture }, handleActionResult);
    } else if (selected) {
      socket.timeout(10000).emit('game:redpoints:play', capture ? { card: selected, capture } : { card: selected },
        (timeout, response) => {
          if (!timeout && response?.success) setSelection(null);
          handleActionResult(timeout, response);
        });
    } else {
      setActionPending(false);
    }
  };

  const backToRoom = (): void => {
    setActionError('');
    setActionPending(true);
    socket.timeout(10000).emit('game:continue', handleActionResult);
  };

  const prompt = !playing ? null
    : game.step === 'flip-choose' && game.pendingFlip
      ? choosingFlip ? t('redpoints.flipChoose', { card: cardLabel(game.pendingFlip) })
        : t('redpoints.flipWait', { name: seatName(game.currentTurnSeat) })
      : !isMyTurn ? t('redpoints.turnOf', { name: seatName(game.currentTurnSeat) })
        : !selected ? t('redpoints.pickCard')
          : options.length > 0 ? t('redpoints.pickCapture') : null;

  const handZone = <div className={styles.handArea}>
    <CardHand cards={game.myHand} selectedCards={selected ? [selected] : []} disabled={!canPlay}
      onCardClick={(card) => setSelection(selected && sameCard(selected, card) ? null : card)} />
    {playing && <div className={styles.controls}>
      {prompt && <span className={`${styles.prompt} ${isMyTurn ? styles.promptActive : ''}`}>{prompt}</span>}
      {selected && options.length === 0 && <button type="button" className={`btn btn-primary ${styles.ctrl}`}
        onClick={() => send(null)} disabled={actionPending}>{t('redpoints.discard')}</button>}
    </div>}
  </div>;

  return (
    <GameShell
      info={<Info game={game} />}
      centre={<Centre game={game} options={options} onCapture={options.length > 0 && !actionPending ? send : null} />}
      hand={handZone}
      overlay={game.phase === 'scoring' && game.result && <ResultOverlay result={game.result}
        captured={game.captured} pending={actionPending} error={actionError} onBack={backToRoom} />}
      error={game.phase !== 'scoring' ? actionError : undefined}
    />
  );
}
