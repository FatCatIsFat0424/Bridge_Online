import type { ReactNode } from 'react';
import type { MatchHistory } from '@shared/types';
import { SUIT_SYMBOLS } from '@shared/constants';
import { useI18nStore } from '../stores/i18n-store';
import { PlayerLink } from './PlayerLink';
import styles from './MatchHistoryList.module.css';

export function MatchHistoryList({ matches, players }: MatchHistory): ReactNode {
  const { t, locale } = useI18nStore();
  if (matches.length === 0) return <p className={styles.empty}>{t('history.empty')}</p>;
  return <ul className={styles.list}>{matches.map((match) => (
    <li key={match.id} className={styles.match}>
      <div className={styles.summary}>
        <span>{t('room.title')} {match.roomCode}</span>
        <span>{match.result.contract.level}{match.result.contract.suit === 'nt' ? 'NT'
          : SUIT_SYMBOLS[match.result.contract.suit]} · {match.result.declarerTeamTricks}
          /{match.result.requiredTricks} · {t(match.result.declarerTeamWins
            ? 'score.declarerWins' : 'score.defenderWins')}</span>
        <time dateTime={new Date(match.finishedAt).toISOString()} className={styles.time}>
          {new Date(match.finishedAt).toLocaleString(locale)}
        </time>
      </div>
      <div className={styles.players}>
        {match.accountIds.map((id) => players[id] && <PlayerLink key={id} player={players[id]} />)}
      </div>
    </li>
  ))}</ul>;
}
