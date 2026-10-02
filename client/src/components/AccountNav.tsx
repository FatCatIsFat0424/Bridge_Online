import { useState } from 'react';
import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { apiRequest } from '../api';
import { clearAccount, useAccountStore } from '../stores/account-store';
import { useI18nStore } from '../stores/i18n-store';
import { LanguageSwitch } from './LanguageSwitch';
import styles from './AccountNav.module.css';

export function AccountNav(): ReactNode {
  const { t } = useI18nStore();
  const accountId = useAccountStore((state) => state.account?.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const signOut = async (): Promise<void> => {
    setBusy(true);
    const result = await apiRequest('/api/auth/logout', 'POST');
    if (result.success) clearAccount();
    else setError(result.error);
    setBusy(false);
  };
  return (
    <header className={styles.header}>
      <NavLink to="/" className={styles.brand}>♠ Bridge Online</NavLink>
      <nav className={styles.links}>
        <NavLink to="/" end>{t('nav.lobby')}</NavLink>
        <NavLink to="/friends">{t('nav.friends')}</NavLink>
        {accountId && <NavLink to={`/players/${encodeURIComponent(accountId)}`}>
          {t('player.myProfile')}</NavLink>}
        <NavLink to="/account">{t('nav.account')}</NavLink>
        <LanguageSwitch />
        <button className="btn btn-outline" onClick={() => void signOut()} disabled={busy}>
          {busy ? t('common.loading') : t('auth.signOut')}
        </button>
      </nav>
      {error && <p className={styles.error} role="alert">{error}</p>}
    </header>
  );
}
