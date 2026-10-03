import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { PublicAccount } from '@shared/types';
import { useI18nStore } from '../stores/i18n-store';
import { Avatar } from './Avatar';
import styles from './PlayerLink.module.css';

interface PlayerLinkProps {
  player: PublicAccount;
  showUsername?: boolean;
  size?: 'small' | 'medium';
}

export function PlayerLink({ player, showUsername = false, size = 'small' }: PlayerLinkProps): ReactNode {
  const { t } = useI18nStore();
  return (
    <Link className={styles.link} to={`/players/${encodeURIComponent(player.id)}`}
      aria-label={t('player.view', { nickname: player.nickname })}>
      <Avatar avatar={player.avatar} image={player.avatarImage} color={player.color} size={size} />
      <span className={styles.identity}>
        <span className={styles.nickname}>{player.nickname}</span>
        {showUsername && <span className={styles.username}>@{player.username}</span>}
      </span>
    </Link>
  );
}
