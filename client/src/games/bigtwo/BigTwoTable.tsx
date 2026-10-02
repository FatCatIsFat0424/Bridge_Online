// ─── BigTwoTable：大老二牌桌（Task B3 實作） ───

import type { ReactNode } from 'react';
import { useI18nStore } from '../../stores/i18n-store';
import { GameShell } from '../GameShell';
import styles from './BigTwoTable.module.css';

export function BigTwoTable(): ReactNode {
  const { t } = useI18nStore();
  return (
    <GameShell
      info={<div />}
      centre={<p className={styles.centreText}>{t('gameType.comingSoon')}</p>}
      hand={null}
    />
  );
}
