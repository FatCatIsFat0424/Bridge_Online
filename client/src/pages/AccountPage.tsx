import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { AccountProfile, AvatarId, MatchSummary } from '@shared/types';
import { SUIT_SYMBOLS } from '@shared/constants';
import { apiRequest } from '../api';
import { clearAccount, useAccountStore } from '../stores/account-store';
import { useI18nStore } from '../stores/i18n-store';
import { Avatar, AVATARS } from '../components/Avatar';
import styles from './AccountPages.module.css';

export function AccountPage(): ReactNode {
  const account = useAccountStore((state) => state.account);
  const setAccount = useAccountStore((state) => state.setAccount);
  const { t, locale } = useI18nStore();
  const navigate = useNavigate();
  const [nickname, setNickname] = useState(account?.nickname ?? '');
  const [color, setColor] = useState(account?.color ?? '#4a9eff');
  const [avatar, setAvatar] = useState<AvatarId>(account?.avatar ?? 'cat');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileError, setProfileError] = useState('');
  const [securityError, setSecurityError] = useState('');
  const [saved, setSaved] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [securityBusy, setSecurityBusy] = useState(false);
  const [matches, setMatches] = useState<MatchSummary[] | null>(null);
  const [historyError, setHistoryError] = useState('');

  useEffect(() => {
    let active = true;
    void apiRequest<{ matches: MatchSummary[] }>('/api/account/history').then((result) => {
      if (!active) return;
      if (result.success) setMatches(result.matches);
      else setHistoryError(result.error);
    });
    return () => { active = false; };
  }, []);

  if (!account) return null;

  const saveProfile = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setProfileError('');
    setSaved(false);
    setProfileBusy(true);
    const result = await apiRequest<{ account: AccountProfile }>('/api/auth/profile', 'PATCH', {
      nickname: nickname.trim(), color, avatar,
    });
    setProfileBusy(false);
    if (result.success) {
      setAccount(result.account);
      setNickname(result.account.nickname);
      setSaved(true);
    } else setProfileError(result.error);
  };

  const changePassword = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSecurityError('');
    if (newPassword !== confirmPassword) {
      setSecurityError(t('auth.passwordMismatch'));
      return;
    }
    setSecurityBusy(true);
    const result = await apiRequest('/api/auth/password', 'POST', { currentPassword, newPassword });
    setSecurityBusy(false);
    if (result.success) {
      clearAccount();
      navigate('/login', { replace: true, state: { passwordChanged: true } });
    } else setSecurityError(result.error);
  };

  const signOutAll = async (): Promise<void> => {
    setSecurityBusy(true);
    setSecurityError('');
    const result = await apiRequest('/api/auth/logout-all', 'POST');
    setSecurityBusy(false);
    if (result.success) clearAccount();
    else setSecurityError(result.error);
  };

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>{t('profile.title')}</h1>
      <p className={styles.subtitle}>{t('profile.description')}</p>
      <p className={styles.subtitle}>
        <Link to={`/players/${encodeURIComponent(account.id)}`}>{t('player.viewOwn')}</Link>
      </p>
      <div className={styles.grid}>
        <section className={styles.card}>
          <div className={styles.identity}>
            <Avatar avatar={avatar} color={color} size="large" />
            <div><h2>{nickname || account.username}</h2><small>@{account.username}</small>
              <small>{t('profile.joined')} {new Date(account.createdAt).toLocaleDateString(locale)}</small>
            </div>
          </div>
          <form className={styles.form} onSubmit={(event) => void saveProfile(event)}>
            <div className={styles.field}>
              <label htmlFor="profile-nickname">{t('lobby.nickname')}</label>
              <input id="profile-nickname" autoComplete="nickname" value={nickname}
                onChange={(event) => { setNickname(event.target.value); setSaved(false); }}
                required minLength={1} maxLength={20} aria-describedby="nickname-help" />
              <p id="nickname-help" className={styles.hint}>{t('profile.nicknameHelp')}</p>
            </div>
            <fieldset className={styles.avatarField}>
              <legend className={styles.legend}>{t('profile.avatar')}</legend>
              <div className={styles.avatarGrid}>
                {AVATARS.map((option) => (
                  <button key={option} type="button" className={styles.avatarChoice}
                    aria-pressed={avatar === option} aria-label={t(`avatar.${option}`)}
                    onClick={() => { setAvatar(option); setSaved(false); }}>
                    <Avatar avatar={option} />
                  </button>
                ))}
              </div>
            </fieldset>
            <div className={styles.field}>
              <label htmlFor="profile-color">{t('lobby.color')}</label>
              <input id="profile-color" type="color" className={styles.colorInput} value={color}
                onChange={(event) => { setColor(event.target.value); setSaved(false); }} />
            </div>
            {profileError && <p role="alert" className={styles.error}>{profileError}</p>}
            {saved && <p role="status" className={styles.success}>{t('profile.saved')}</p>}
            <button type="submit" className="btn btn-primary" disabled={profileBusy || !nickname.trim()}>
              {profileBusy ? t('common.loading') : t('common.save')}
            </button>
          </form>
        </section>
        <section className={styles.card}>
          <h2>{t('profile.security')}</h2>
          <form className={styles.form} onSubmit={(event) => void changePassword(event)}>
            <div className={styles.field}>
              <label htmlFor="current-password">{t('profile.currentPassword')}</label>
              <input id="current-password" type="password" autoComplete="current-password"
                value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)}
                required maxLength={128} />
            </div>
            <div className={styles.field}>
              <label htmlFor="new-password">{t('profile.newPassword')}</label>
              <input id="new-password" type="password" autoComplete="new-password"
                value={newPassword} onChange={(event) => setNewPassword(event.target.value)}
                required minLength={10} maxLength={128} aria-describedby="new-password-help" />
              <p id="new-password-help" className={styles.hint}>{t('auth.passwordHelp')}</p>
            </div>
            <div className={styles.field}>
              <label htmlFor="new-password-confirm">{t('auth.confirmPassword')}</label>
              <input id="new-password-confirm" type="password" autoComplete="new-password"
                value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)}
                required minLength={10} maxLength={128} />
            </div>
            <p className={styles.hint}>{t('profile.passwordNotice')}</p>
            {securityError && <p role="alert" className={styles.error}>{securityError}</p>}
            <button type="submit" className="btn btn-primary" disabled={securityBusy}>
              {securityBusy ? t('common.loading') : t('profile.changePassword')}
            </button>
            <button type="button" className="btn btn-outline" disabled={securityBusy}
              onClick={() => void signOutAll()}>{t('auth.signOutAll')}</button>
          </form>
        </section>
        <section className={`${styles.card} ${styles.wide}`}>
          <h2>{t('history.title')}</h2>
          {historyError ? <p className={styles.error} role="alert">{historyError}</p>
            : matches === null ? <p role="status">{t('common.loading')}</p>
            : matches.length === 0 ? <p className={styles.empty}>{t('history.empty')}</p>
            : <ul className={styles.list}>{matches.map((match) => (
              <li key={match.id} className={styles.history}>
                <span>{t('room.title')} {match.roomCode}</span>
                <span>{match.result.contract.level}{match.result.contract.suit === 'nt' ? 'NT'
                  : SUIT_SYMBOLS[match.result.contract.suit]} · {match.result.declarerTeamTricks}
                  /{match.result.requiredTricks} · {t(match.result.declarerTeamWins
                    ? 'score.declarerWins' : 'score.defenderWins')}</span>
                <time dateTime={new Date(match.finishedAt).toISOString()} className={styles.hint}>
                  {new Date(match.finishedAt).toLocaleString(locale)}
                </time>
              </li>
            ))}</ul>}
        </section>
      </div>
    </main>
  );
}
