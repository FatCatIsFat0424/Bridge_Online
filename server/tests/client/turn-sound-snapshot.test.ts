import { afterEach, describe, expect, it, vi } from 'vitest';
import { getTurnSoundSnapshot } from '../../../client/src/hooks/use-turn-sound';
import { useAccountStore } from '../../../client/src/stores/account-store';
import { useGameStore } from '../../../client/src/stores/game-store';
import { useRoomStore } from '../../../client/src/stores/room-store';

vi.mock('../../../client/src/stores/account-store', async () => {
  const { create } = await import('zustand');
  return { useAccountStore: create(() => ({ status: 'authenticated', connection: 'ready' })) };
});

afterEach(() => {
  useGameStore.getState().reset();
  useRoomStore.getState().leaveRoom();
  useAccountStore.setState({ status: 'authenticated', connection: 'ready' });
});

describe('turn sound snapshot', () => {
  it('should identify only actionable owned turns and ignore unrelated updates', () => {
    useRoomStore.setState({ currentRoomCode: 'ROOM', mySeat: 'N' });
    useGameStore.setState({ gameType: 'bridge', phase: 'bidding', currentTurnSeat: 'N' });
    const turn = getTurnSoundSnapshot().turn;
    expect(turn).not.toBeNull();
    useGameStore.getState().addLogEntry({ type: 'system', message: 'unchanged', timestamp: 1 });
    expect(getTurnSoundSnapshot().turn).toBe(turn);
    useGameStore.getState().setPhase('scoring');
    expect(getTurnSoundSnapshot().turn).toBeNull();
    useGameStore.getState().setPhase('playing');
    useAccountStore.setState({ connection: 'connecting' });
    expect(getTurnSoundSnapshot().turn).toBeNull();
    useAccountStore.setState({ connection: 'ready' });
    useRoomStore.setState({ mySeat: null });
    expect(getTurnSoundSnapshot().turn).toBeNull();
    useRoomStore.getState().leaveRoom();
    expect(getTurnSoundSnapshot().turn).toBeNull();
  });
});
