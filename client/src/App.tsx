// ─── 根元件 ───

import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { AccountNav } from './components/AccountNav';
import { useAccountConnection } from './hooks/use-account-connection';
import { restoreAccount, useAccountStore } from './stores/account-store';
import { useI18nStore } from './stores/i18n-store';
import { useRoomStore } from './stores/room-store';
import { connectSocket, disconnectSocket } from './socket';
import styles from './pages/AccountPages.module.css';

const LobbyPage = lazy(() => import('./pages/LobbyPage').then((page) => ({ default: page.LobbyPage })));
const RoomPage = lazy(() => import('./pages/RoomPage').then((page) => ({ default: page.RoomPage })));
const GamePage = lazy(() => import('./pages/GamePage').then((page) => ({ default: page.GamePage })));
const AuthPage = lazy(() => import('./pages/AuthPage').then((page) => ({ default: page.AuthPage })));
const AccountPage = lazy(() => import('./pages/AccountPage').then((page) => ({ default: page.AccountPage })));
const FriendsPage = lazy(() => import('./pages/FriendsPage').then((page) => ({ default: page.FriendsPage })));
const PlayerProfilePage = lazy(() => import('./pages/PlayerProfilePage')
  .then((page) => ({ default: page.PlayerProfilePage })));
const VoicePanel = lazy(() => import('./components/VoicePanel')
  .then((module) => ({ default: module.VoicePanel })));

function PageLoading(): ReactNode {
  const { t } = useI18nStore();
  return <main className={styles.status}><p role="status">{t('common.loading')}</p></main>;
}

function ProtectedRoute(): ReactNode {
  const accountId = useAccountStore((state) => state.account?.id);
  const connection = useAccountStore((state) => state.connection);
  const roomCode = useRoomStore((state) => state.currentRoomCode);
  const location = useLocation();
  const { t } = useI18nStore();
  if (!accountId) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return <>
    <AccountNav />
    <Suspense fallback={null}>{roomCode && <VoicePanel />}</Suspense>
    {connection === 'ready' ? <Suspense fallback={<PageLoading />}><Outlet /></Suspense>
      : <main className={styles.status}>
      <p role="status">{t(connection === 'error' ? 'auth.connectionError' : 'auth.connecting')}</p>
      {connection === 'error' && <button className="btn btn-primary"
        onClick={() => { disconnectSocket(); connectSocket(); }}>{t('common.retry')}</button>}
    </main>}
  </>;
}

function AppRoutes(): ReactNode {
  useAccountConnection();
  const status = useAccountStore((state) => state.status);
  const error = useAccountStore((state) => state.error);
  const { t } = useI18nStore();
  if (status === 'loading' || status === 'error') return <main className={styles.status}>
    <p role="status">{status === 'loading' ? t('common.loading') : error}</p>
    {status === 'error' && <button className="btn btn-primary" onClick={() => void restoreAccount()}>
      {t('common.retry')}</button>}
  </main>;
  return (
    <Suspense fallback={<PageLoading />}>
    <Routes>
      <Route path="/login" element={<AuthPage key="login" mode="login" />} />
      <Route path="/register" element={<AuthPage key="register" mode="register" />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<LobbyPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/friends" element={<FriendsPage />} />
        <Route path="/players/:accountId" element={<PlayerProfilePage />} />
        <Route path="/room/:roomCode" element={<RoomPage />} />
        <Route path="/game/:roomCode" element={<GamePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
}

export function App(): ReactNode {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
