import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlayerInfo } from '@shared/types';
import * as players from '../../src/managers/player-manager';

const profile: PlayerInfo = {
  id: 'account-one', username: 'north', nickname: 'North', color: '#123456', avatar: 'fox',
};

describe('account connection lifecycle', () => {
  beforeEach(() => players.restorePlayers([], true));
  afterEach(() => { vi.restoreAllMocks(); players.restorePlayers([], true); });

  it('should keep a shared account connected while another tab is still open', () => {
    players.attachPlayer('tab-one', profile);
    players.attachPlayer('tab-two', profile);
    players.markDisconnected('tab-one');
    expect(players.getPlayerState(profile.id)).toMatchObject({
      connectionStatus: 'connected', disconnectedAt: null, socketId: 'tab-two',
    });
    expect(players.getPlayerIdBySocketId('tab-one')).toBeNull();
    players.markDisconnected('tab-two');
    expect(players.getPlayerState(profile.id)?.disconnectedAt).toEqual(expect.any(Number));
  });

  it('should expire a disconnected player even when its disconnect write was rolled back', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    players.attachPlayer('tab-one', profile);
    const before = structuredClone(players.exportPlayers());
    players.markDisconnected('tab-one');
    players.restorePlayers(before);
    expect(players.getPlayerState(profile.id)?.disconnectedAt).toBe(1000);
    vi.spyOn(Date, 'now').mockReturnValue(61_000);
    expect(players.getExpiredPlayers(60_000).map((player) => player.info.id)).toEqual([profile.id]);
  });

  it('should remove a socket mapping created by an uncommitted first action', () => {
    players.attachPlayer('tab-one', profile);
    players.restorePlayers([]);
    expect(players.getPlayerIdBySocketId('tab-one')).toBeNull();
    players.attachPlayer('tab-one', profile);
    expect(players.getPlayerInfo(profile.id)).toEqual(profile);
  });
});
