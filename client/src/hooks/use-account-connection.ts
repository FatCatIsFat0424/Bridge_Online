import { useEffect } from 'react';
import { connectSocket, disconnectSocket, socket } from '../socket';
import { clearAccount, restoreAccount, useAccountStore } from '../stores/account-store';
import { applyPlayerSnapshot } from '../stores/player-snapshot';

export function useAccountConnection(): void {
  const accountId = useAccountStore((state) => state.account?.id);

  useEffect(() => {
    void restoreAccount();
    const handleFocus = (): void => { void restoreAccount(); };
    window.addEventListener('account:expired', clearAccount);
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('account:expired', clearAccount);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  useEffect(() => {
    if (!accountId) return;
    let active = true;
    const handleConnect = (): void => {
      useAccountStore.getState().setConnection('connecting');
      socket.timeout(10000).emit('player:resume', (error, snapshot) => {
        if (!active) return;
        if (error || !snapshot.success) {
          useAccountStore.getState().setConnection('error');
        } else {
          applyPlayerSnapshot(snapshot);
        }
      });
    };
    const handleDisconnect = (reason: string): void => {
      useAccountStore.getState().setConnection('connecting');
      if (reason === 'io server disconnect') {
        useAccountStore.getState().setConnection('error');
        void restoreAccount();
      }
    };
    const handleError = (): void => {
      useAccountStore.getState().setConnection('error');
      void restoreAccount();
    };
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleError);
    socket.on('player:state', applyPlayerSnapshot);
    connectSocket();
    if (socket.connected) handleConnect();
    return () => {
      active = false;
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleError);
      socket.off('player:state', applyPlayerSnapshot);
      disconnectSocket();
    };
  }, [accountId]);
}
