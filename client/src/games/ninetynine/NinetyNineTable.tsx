// ─── NinetyNineTable：99 牌桌（累計點數、方向、上一張、手牌、資訊欄、結算） ───

import { useState } from 'react';
import type { ReactNode } from 'react';
import { NN_MAX, nnApply, nnIsPlayable, nnRequiresChoice } from '@shared/rules/ninetynine';
import type { NnChoice } from '@shared/rules/ninetynine';
import { RANK_DISPLAY, SUIT_SYMBOLS } from '@shared/constants';
import type { Card, NinetyNineMatchResult, NinetyNineVisibleState, Seat } from '@shared/types';
import { cardImageUrl } from '../../cards';
import { socket } from '../../socket';
import { useGameStore } from '../../stores/game-store';
import { useRoomStore } from '../../stores/room-store';
import { useI18nStore } from '../../stores/i18n-store';
import { CardHand } from '../../components/CardHand';
import { GameShell } from '../GameShell';
import styles from './NinetyNineTable.module.css';

const SEATS: readonly Seat[] = ['N', 'E', 'S', 'W'];
const RECENT_MOVES = 8;

type ActionCallback = (timeout: Error | null, response?: { success: boolean; error?: string }) => void;

const sameCard = (a: Card, b: Card): boolean => a.suit === b.suit && a.rank === b.rank;
const cardLabel = (card: Card): string => `${SUIT_SYMBOLS[card.suit]}${RANK_DISPLAY[card.rank]}`;

/** 接近 99 時換色 */
function totalTone(total: number): string {
  if (total >= 90) return styles.danger;
  if (total >= 70) return styles.warning;
  return '';
}

function useSeatName(): (seat: Seat) => string {
  const seats = useRoomStore((state) => state.roomInfo?.seats);
  const { t } = useI18nStore();
  return (seat: Seat): string => seats?.[seat].player?.nickname ?? t(`seat.${seat}`);
}

function CardImage({ card, className }: { card: Card; className?: string }): ReactNode {
  return <img className={`${styles.card} ${className ?? ''}`} src={cardImageUrl(card)} alt={cardLabel(card)} draggable={false} />;
}

function Centre({ game }: { game: NinetyNineVisibleState }): ReactNode {
  const { t } = useI18nStore();
  const ccw = game.direction === 'ccw';
  return <div className={styles.centre}>
    <div className={styles.totalRow}>
      <span className={styles.direction} title={t(ccw ? 'ninetynine.directionCcw' : 'ninetynine.directionCw')}
        aria-label={t(ccw ? 'ninetynine.directionCcw' : 'ninetynine.directionCw')}>{ccw ? '⟲' : '⟳'}</span>
      {/* key 讓每次點數變化重播動畫 */}
      <span key={game.total} className={`${styles.total} ${totalTone(game.total)}`} title={t('ninetynine.total')}>
        {game.total}
      </span>
      <span className={styles.max}>/ {NN_MAX}</span>
    </div>
    <div className={styles.pileRow}>
      <div className={styles.pile} title={t('ninetynine.stock', { n: String(game.stockCount) })}>
        {game.stockCount > 0 && <span className={styles.back} aria-hidden="true" />}
        <span className={styles.pill}>{t('ninetynine.stock', { n: String(game.stockCount) })}</span>
      </div>
      {game.lastPlayed && <div className={styles.pile}>
        <CardImage key={cardLabel(game.lastPlayed)} card={game.lastPlayed} className={styles.lastCard} />
        <span className={styles.pill}>{t('ninetynine.lastPlayed')}</span>
      </div>}
    </div>
  </div>;
}

function Info({ game }: { game: NinetyNineVisibleState }): ReactNode {
  const { t } = useI18nStore();
  const seatName = useSeatName();
  const recent = game.log.slice(-RECENT_MOVES).reverse();
  return <aside className={styles.rail}>
    <section className={styles.box}>
      <p className={styles.turn}>{game.phase !== 'playing' ? t('game.scoring')
        : game.currentTurnSeat === game.mySeat ? t('ninetynine.yourTurn')
          : t('ninetynine.turnOf', { name: seatName(game.currentTurnSeat) })}</p>
      <p className={styles.note}>
        {t('ninetynine.total')} {game.total} · {t(game.direction === 'ccw' ? 'ninetynine.directionCcw' : 'ninetynine.directionCw')}
      </p>
    </section>

    <section className={`${styles.box} ${styles.recentBox}`}>
      <h2 className={styles.caption}>{t('ninetynine.recent')}</h2>
      {recent.length === 0 ? <p className={styles.note}>{t('ninetynine.noMoves')}</p>
        : <ol className={styles.recentList}>{recent.map((entry) => (
          <li key={`${entry.timestamp}-${entry.type === 'play' ? cardLabel(entry.card) : entry.seat}`} className={styles.recentRow}>
            <span className={styles.recentName}>{seatName(entry.seat)}</span>
            {entry.type === 'play' ? <>
              <CardImage card={entry.card} className={styles.mini} />
              {entry.target && <span>→ {seatName(entry.target)}</span>}
              <span className={styles.recentTotal}>{entry.total}</span>
            </> : <span className={styles.bustTag}>{t('ninetynine.logBusted')}</span>}
          </li>
        ))}</ol>}
    </section>

    <details className={styles.box}>
      <summary className={styles.caption}>{t('ninetynine.rules')}</summary>
      <p className={styles.note}>{t('ninetynine.rulesNumbers')}</p>
      <p className={styles.note}>{t('ninetynine.rulesSpecial')}</p>
      <p className={styles.note}>{t('ninetynine.rulesBust')}</p>
    </details>
  </aside>;
}

function ResultOverlay({ result, pending, error, onBack }: {
  result: NinetyNineMatchResult; pending: boolean; error: string; onBack: () => void;
}): ReactNode {
  const { t } = useI18nStore();
  const seatName = useSeatName();
  // 最後淘汰者第 2 名，以此類推
  const ranking = [result.winnerSeat, ...[...result.eliminationOrder].reverse()];
  return <div className={styles.scoreOverlay}>
    <div className={styles.overlayCard}>
      <h2 className={styles.scoreTitle}>{t('ninetynine.winner', { name: seatName(result.winnerSeat) })}</h2>
      <table className={styles.scoreTable}>
        <thead><tr><th>{t('ninetynine.rank')}</th><th>{t('ninetynine.player')}</th></tr></thead>
        <tbody>{ranking.map((seat, index) => (
          <tr key={seat} className={index === 0 ? styles.winnerRow : ''}>
            <td>{t('ninetynine.place', { n: String(index + 1) })}</td>
            <td>{index === 0 ? '🏆 ' : '💥 '}{seatName(seat)}</td>
          </tr>
        ))}</tbody>
      </table>
      <p className={styles.note}>{t('ninetynine.total')} {result.finalTotal}</p>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <button className="btn btn-primary" disabled={pending} onClick={onBack}>{t('score.backToRoom')}</button>
    </div>
  </div>;
}

export function NinetyNineTable(): ReactNode {
  const game = useGameStore((state) => state.ninetyNine);
  const { t } = useI18nStore();
  const seatName = useSeatName();
  /** 等待選擇 +/− 或指定對象的牌 */
  const [pendingCard, setPendingCard] = useState<Card | null>(null);
  const [actionError, setActionError] = useState('');
  const [actionPending, setActionPending] = useState(false);

  if (!game) return null;

  const playing = game.phase === 'playing';
  const isMyTurn = playing && game.currentTurnSeat === game.mySeat;
  const canPlay = isMyTurn && !actionPending;
  const playable = game.myHand.filter((card) => nnIsPlayable(game.total, card));
  const unplayable = game.myHand.filter((card) => !nnIsPlayable(game.total, card));
  const chosen = canPlay && pendingCard && game.myHand.some((card) => sameCard(card, pendingCard)) ? pendingCard : null;
  const targets = chosen?.rank === 5
    ? SEATS.filter((seat) => seat !== game.mySeat && !game.eliminated.includes(seat)) : [];

  const handleActionResult: ActionCallback = (timeout, response) => {
    setActionPending(false);
    if (timeout) setActionError(t('auth.connectionError'));
    else if (!response?.success) setActionError(response?.error ?? t('common.error'));
  };

  const send = (card: Card, choice?: NnChoice, target?: Seat): void => {
    if (actionPending) return;
    setActionError('');
    setActionPending(true);
    setPendingCard(null);
    socket.timeout(10000).emit('game:ninetynine:play', {
      card, ...(choice && { choice }), ...(target && { target }),
    }, handleActionResult);
  };

  const onCardClick = (card: Card): void => {
    if (nnRequiresChoice(card) || card.rank === 5) setPendingCard(chosen && sameCard(chosen, card) ? null : card);
    else send(card);
  };

  const backToRoom = (): void => {
    setActionError('');
    setActionPending(true);
    socket.timeout(10000).emit('game:continue', handleActionResult);
  };

  const prompt = !playing ? null
    : !isMyTurn ? t('ninetynine.turnOf', { name: seatName(game.currentTurnSeat) })
      : chosen?.rank === 5 ? t('ninetynine.pickTarget') : !chosen ? t('ninetynine.pickCard') : null;

  const delta = chosen?.rank === 10 ? 10 : 20;
  const handZone = <div className={styles.handArea}>
    <CardHand cards={game.myHand} playableCards={playable} disabled={!canPlay} onCardClick={onCardClick}
      markedCards={unplayable} markedLabel={t('ninetynine.unplayable')} />
    {playing && <div className={styles.controls}>
      {prompt && <span className={`${styles.prompt} ${isMyTurn ? styles.promptActive : ''}`}>{prompt}</span>}
      {chosen && nnRequiresChoice(chosen) && <div className={styles.choice} role="group" aria-label={cardLabel(chosen)}>
        <CardImage card={chosen} className={styles.mini} />
        {(['plus', 'minus'] as const).map((choice) => (
          <button key={choice} type="button" className={`btn btn-primary ${styles.ctrl}`}
            disabled={actionPending || nnApply(game.total, chosen, choice).total > NN_MAX}
            onClick={() => send(chosen, choice)}>
            {t(choice === 'plus' ? 'ninetynine.plus' : 'ninetynine.minus', { n: String(delta) })}
          </button>
        ))}
      </div>}
      {chosen && <button type="button" className={`btn btn-outline ${styles.ctrl}`}
        onClick={() => setPendingCard(null)}>{t('ninetynine.cancel')}</button>}
    </div>}
  </div>;

  return (
    <GameShell
      info={<Info game={game} />}
      centre={<Centre game={game} />}
      hand={handZone}
      pickableSeats={targets}
      onPickSeat={chosen ? (seat) => send(chosen, undefined, seat) : undefined}
      overlay={game.phase === 'scoring' && game.result && <ResultOverlay result={game.result}
        pending={actionPending} error={actionError} onBack={backToRoom} />}
      error={game.phase !== 'scoring' ? actionError : undefined}
    />
  );
}
