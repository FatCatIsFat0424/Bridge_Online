import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { AccountProfile, AvatarId, MatchHistory } from '@shared/types';
import { apiRequest } from '../api';
import { resizeImage } from '../image-resize';
import { mediaUrl, uploadImage } from '../media';
import { clearAccount, useAccountStore } from '../stores/account-store';
import { useI18nStore } from '../stores/i18n-store';
import { Avatar, AVATARS } from '../components/Avatar';
import { MatchHistoryList } from '../components/MatchHistoryList';
import styles from './AccountPages.module.css';

type MediaField = 'avatarImage' | 'tableBackground';

const RESIZE = {
  avatarImage: { size: 256, square: true, quality: 0.9, fallbackType: 'image/png' },
  tableBackground: { size: 1920, square: false, quality: 0.85, fallbackType: 'image/jpeg' },
} as const;

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
  const [history, setHistory] = useState<MatchHistory | null>(null);
  const [historyError, setHistoryError] = useState('');
  const [mediaBusy, setMediaBusy] = useState<MediaField | 'matchesPublic' | null>(null);
  const [mediaError, setMediaError] = useState<{ field: MediaField | 'matchesPublic'; message: string } | null>(null);
  const avatarInput = useRef<HTMLInputElement>(null);
  const backgroundInput = useRef<HTMLInputElement>(null);
  const accountId = account?.id;

  useEffect(() => {
    if (!accountId) return;
    let active = true;
    void apiRequest<MatchHistory>(`/api/players/${encodeURIComponent(accountId)}/history`).then((result) => {
      if (!active) return;
      if (result.success) setHistory(result);
      else setHistoryError(result.error);
    });
    return () => { active = false; };
  }, [accountId]);

  if (!account) return null;

  /** Media and visibility settings save immediately, independent of the profile form. */
  const patchSetting = async (
    field: MediaField | 'matchesPublic',
    value: () => Promise<string | boolean | null>,
  ): Promise<void> => {
    setMediaError(null);
    setMediaBusy(field);
    try {
      const result = await apiRequest<{ account: AccountProfile }>('/api/auth/profile', 'PATCH', {
        [field]: await value(),
      });
      if (!result.success) throw new Error(result.error);
      setAccount(result.account);
    } catch (error) {
      setMediaError({ field, message: error instanceof Error ? error.message : t('common.error') });
    } finally {
      setMediaBusy(null);
    }
  };

  const chooseImage = (field: MediaField) => (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    void patchSetting(field, async () => uploadImage(await resizeImage(file, RESIZE[field]),
      field === 'avatarImage' ? 'avatar' : 'background'));
  };

  const mediaFeedback = (field: MediaField | 'matchesPublic'): ReactNode =>
    mediaError?.field === field && <p role="alert" className={styles.error}>{mediaError.message}</p>;

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
            <Avatar avatar={avatar} image={account?.avatarImage} color={color} size="large" />
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
              <div className={`${styles.actions} ${styles.section}`}>
                <input ref={avatarInput} type="file" accept="image/*" hidden
                  onChange={chooseImage('avatarImage')} />
                <button type="button" className="btn btn-outline" disabled={mediaBusy !== null}
                  onClick={() => avatarInput.current?.click()}>
                  {mediaBusy === 'avatarImage' ? t('profile.uploading') : t('profile.uploadAvatar')}
                </button>
                {account.avatarImage && <button type="button" className="btn btn-outline"
                  disabled={mediaBusy !== null}
                  onClick={() => void patchSetting('avatarImage', async () => null)}>
                  {t('profile.removeAvatar')}</button>}
              </div>
              {mediaFeedback('avatarImage')}
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
        <section className={styles.card}>
          <h2>{t('profile.background')}</h2>
          <p className={styles.hint}>{t('profile.backgroundHelp')}</p>
          {account.tableBackground && <img className={styles.backgroundPreview}
            src={mediaUrl(account.tableBackground)} alt="" />}
          <div className={`${styles.actions} ${styles.section}`}>
            <input ref={backgroundInput} type="file" accept="image/*" hidden
              onChange={chooseImage('tableBackground')} />
            <button type="button" className="btn btn-outline" disabled={mediaBusy !== null}
              onClick={() => backgroundInput.current?.click()}>
              {mediaBusy === 'tableBackground' ? t('profile.uploading') : t('profile.uploadBackground')}
            </button>
            {account.tableBackground && <button type="button" className="btn btn-outline"
              disabled={mediaBusy !== null}
              onClick={() => void patchSetting('tableBackground', async () => null)}>
              {t('profile.removeBackground')}</button>}
          </div>
          {mediaFeedback('tableBackground')}
        </section>
        <section className={`${styles.card} ${styles.wide}`}>
          <h2>{t('history.title')}</h2>
          <label className={styles.row}>
            <input type="checkbox" checked={account.matchesPublic} disabled={mediaBusy !== null}
              onChange={(event) => {
                const value = event.target.checked;
                void patchSetting('matchesPublic', async () => value);
              }} />
            {t('history.public')}
          </label>
          {mediaFeedback('matchesPublic')}
          {historyError ? <p className={styles.error} role="alert">{historyError}</p>
            : history === null ? <p role="status">{t('common.loading')}</p>
            : <MatchHistoryList matches={history.matches} players={history.players} />}
        </section>
      </div>
    </main>
  );
}
