import type { ReactNode } from 'react';
import type { AvatarId, MediaId } from '@shared/types';
import { mediaUrl } from '../media';
import { useI18nStore } from '../stores/i18n-store';
import styles from './Avatar.module.css';

export const AVATARS: readonly AvatarId[] = ['cat', 'fox', 'owl', 'bear', 'rabbit', 'panda'];
const AVATAR_SYMBOLS: Record<AvatarId, string> = {
  cat: '🐱', fox: '🦊', owl: '🦉', bear: '🐻', rabbit: '🐰', panda: '🐼',
};

interface AvatarProps {
  avatar: AvatarId;
  /** Uploaded picture; replaces the preset emoji when present. */
  image?: MediaId | null;
  color?: string;
  size?: 'small' | 'medium' | 'large';
}

export function Avatar({ avatar, image, color, size = 'medium' }: AvatarProps): ReactNode {
  const { t } = useI18nStore();
  return (
    <span className={`${styles.avatar} ${styles[size]}`} role="img" aria-label={t(`avatar.${avatar}`)}>
      {color && <svg className={styles.ring} viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="47" fill="none" stroke={color} strokeWidth="5" />
      </svg>}
      {image ? <img className={styles.image} src={mediaUrl(image)} alt="" /> : AVATAR_SYMBOLS[avatar]}
    </span>
  );
}
