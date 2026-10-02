import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { io as connectSocket } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccountProfile, ClientToServerEvents, Seat, ServerToClientEvents } from '@shared/types';
import type { PlayerSnapshot } from '@shared/types/socket-events';
import { createApplication } from '../../src/app';
import { createJsonRepository } from '../../src/database/json-repository';
import type { Repository } from '../../src/database/repository';

const ORIGIN = 'http://localhost:5173';
const SEATS: readonly Seat[] = ['N', 'E', 'S', 'W'];
type Client = Socket<ServerToClientEvents, ClientToServerEvents>;
type Application = Awaited<ReturnType<typeof createApplication>>;

interface RegisteredAccount {
  account: AccountProfile;
  cookie: string;
}

describe('persistent authenticated application', () => {
  let directory: string;
  let filePath: string;
  let repository: Repository;
  let application: Application | null;
  let baseUrl: string;
  const clients: Client[] = [];

  async function start(trustProxyLoopback: boolean = false): Promise<void> {
    repository = await createJsonRepository(filePath);
    application = await createApplication(repository, {
      allowedOrigins: [ORIGIN], trustProxyLoopback,
    });
    const server = application.httpServer;
    await new Promise<void>((resolve, reject): void => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Expected server address');
    baseUrl = `http://127.0.0.1:${address.port}`;
  }

  async function stop(): Promise<void> {
    await application?.close();
    application = null;
    for (const client of clients.splice(0)) client.disconnect();
  }

  beforeEach(async (): Promise<void> => {
    directory = await mkdtemp(join(tmpdir(), 'bridge-application-'));
    filePath = join(directory, 'database.json');
    await start();
  });

  afterEach(async (): Promise<void> => {
    vi.restoreAllMocks();
    await stop();
    await rm(directory, { recursive: true, force: true });
  });

  function headers(cookie?: string): Record<string, string> {
    return {
      Origin: ORIGIN,
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    };
  }

  async function register(username: string): Promise<RegisteredAccount> {
    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ username, password: 'A valid test password 123', nickname: username }),
    });
    expect(response.status).toBe(201);
    const body = await response.json() as { success: boolean; account: AccountProfile };
    expect(body.success).toBe(true);
    const cookie = response.headers.get('set-cookie')?.split(';')[0];
    if (!cookie) throw new Error('Expected session cookie');
    return { account: body.account, cookie };
  }

  async function connect(cookie?: string): Promise<Client> {
    const client: Client = connectSocket(baseUrl, {
      autoConnect: false, forceNew: true, reconnection: false, transports: ['websocket'],
      extraHeaders: headers(cookie),
    });
    clients.push(client);
    await new Promise<void>((resolve, reject): void => {
      client.once('connect', (): void => resolve());
      client.once('connect_error', reject);
      client.connect();
    });
    return client;
  }

  async function resume(client: Client): Promise<PlayerSnapshot> {
    const snapshot = await client.timeout(5_000).emitWithAck('player:resume');
    expect(snapshot.success).toBe(true);
    return snapshot;
  }

  async function connectPlayers(accounts: RegisteredAccount[]): Promise<Client[]> {
    const players: Client[] = [];
    for (const account of accounts) {
      const client = await connect(account.cookie);
      await resume(client);
      players.push(client);
    }
    return players;
  }

  it('should ignore spoofed forwarded addresses when proxy trust is disabled', async () => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { ...headers(), 'X-Forwarded-For': `192.0.2.${attempt + 1}` },
        body: '{}',
      });
      expect(response.status).toBe(400);
    }
    const blocked = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { ...headers(), 'X-Forwarded-For': '198.51.100.1' },
      body: '{}',
    });
    expect(blocked.status).toBe(429);
  });

  it('should rate limit clients separately behind a trusted loopback proxy', async () => {
    await stop();
    await start(true);
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { ...headers(), 'X-Forwarded-For': '192.0.2.1' },
        body: '{}',
      });
      expect(response.status).toBe(400);
    }
    const blocked = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { ...headers(), 'X-Forwarded-For': '192.0.2.1' },
      body: '{}',
    });
    expect(blocked.status).toBe(429);
    const otherClient = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { ...headers(), 'X-Forwarded-For': '198.51.100.1' },
      body: '{}',
    });
    expect(otherClient.status).toBe(400);
  });

  it('should reject anonymous sockets and revoke a connected socket on logout', async () => {
    await expect(connect()).rejects.toThrow('Sign in');
    const registered = await register('session_player');
    const client = await connect(registered.cookie);
    expect((await resume(client)).player?.id).toBe(registered.account.id);
    const disconnected = new Promise<string>((resolve): void => {
      client.once('disconnect', resolve);
    });
    const response = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST', headers: headers(registered.cookie),
    });
    expect(response.status).toBe(200);
    expect(await disconnected).toBe('io server disconnect');
    expect(client.connected).toBe(false);
    await expect(connect(registered.cookie)).rejects.toThrow('Sign in');
    const session = await fetch(`${baseUrl}/api/auth/me`, { headers: headers(registered.cookie) });
    expect(session.status).toBe(401);
  }, 15_000);

  it('should reject malformed first actions and still allow a valid authenticated action', async () => {
    const registered = await register('payload_player');
    const client = await connect(registered.cookie);
    const invalid = await client.timeout(5_000).emitWithAck('room:changeSeat',
      null as unknown as { seat: Seat });
    expect(invalid).toMatchObject({ success: false, error: 'Invalid seat.' });
    expect((await resume(client)).player?.id).toBe(registered.account.id);
    const created = await client.timeout(5_000).emitWithAck('room:create', { gameType: 'bridge' });
    expect(created.success).toBe(true);
    client.emit('chat:send', { message: 'ignored without a valid callback' },
      null as unknown as (response: { success: boolean }) => void);
    const snapshot = await resume(client);
    expect(snapshot.room?.code).toBe(created.roomCode);
    expect(snapshot.chatHistory).toEqual([]);
  }, 15_000);

  it('should roll back a failed durable write and allow the same connection to retry', async () => {
    const registered = await register('rollback_player');
    const client = await connect(registered.cookie);
    const logged = vi.spyOn(console, 'error').mockImplementation((): void => undefined);
    const persist = vi.spyOn(repository, 'saveRuntime').mockRejectedValueOnce(new Error('Disk full'));
    const failed = await client.timeout(5_000).emitWithAck('room:create', { gameType: 'bridge' });
    expect(failed).toMatchObject({ success: false, error: expect.stringContaining('save') });
    expect(logged).toHaveBeenCalled();
    expect(await repository.loadRuntime()).toBeNull();
    expect((await resume(client)).room).toBeUndefined();
    const created = await client.timeout(5_000).emitWithAck('room:create', { gameType: 'bridge' });
    expect(created.success).toBe(true);
    const stored = await repository.loadRuntime();
    expect(stored?.rooms).toHaveLength(1);
    expect(stored?.rooms[0].info.code).toBe(created.roomCode);
    expect(stored?.players).toHaveLength(1);
    expect(persist).toHaveBeenCalledTimes(3);
  }, 15_000);

  it('should preserve ready rooms, private hands and active games across restarts and record a completed game', async () => {
    const accounts: RegisteredAccount[] = [];
    for (const username of ['north_player', 'east_player', 'south_player', 'west_player']) {
      accounts.push(await register(username));
    }
    let players = await connectPlayers(accounts);
    const created = await players[0].timeout(5_000).emitWithAck('room:create', { gameType: 'bridge' });
    expect(created.success).toBe(true);
    const roomCode = created.roomCode;
    if (!roomCode) throw new Error('Expected room code');
    for (let index = 0; index < 4; index += 1) {
      if (index > 0) {
        expect(await players[index].timeout(5_000).emitWithAck('room:join', { roomCode }))
          .toMatchObject({ success: true });
      }
      expect(await players[index].timeout(5_000).emitWithAck('room:changeSeat', { seat: SEATS[index] }))
        .toEqual({ success: true });
      if (index < 3) expect(await players[index].timeout(5_000).emitWithAck('room:ready'))
        .toEqual({ success: true });
    }
    expect(await players[0].timeout(5_000).emitWithAck('chat:send', { message: 'Keep this table chat' }))
      .toEqual({ success: true });
    const waiting = await resume(players[0]);
    expect(waiting.room?.status).toBe('waiting');
    expect(Object.values(waiting.room!.seats).map((seat) => seat.isReady)).toEqual([true, true, true, false]);

    await stop();
    await start();
    players = await connectPlayers(accounts);
    const restored = await resume(players[0]);
    expect(restored.room).toEqual(waiting.room);
    expect(restored.chatHistory).toEqual(waiting.chatHistory);
    expect(restored.gameState).toBeUndefined();
    expect(await players[3].timeout(5_000).emitWithAck('room:ready')).toEqual({ success: true });

    let snapshot = await resume(players[0]);
    for (let attempt = 0; snapshot.gameState?.phase === 'redeal_pending' && attempt < 30; attempt += 1) {
      const seat = snapshot.gameState.redealPendingSeat;
      if (!seat) throw new Error('Expected player choosing whether to redeal');
      expect(await players[SEATS.indexOf(seat)].timeout(5_000)
        .emitWithAck('game:redealResponse', { accept: true })).toEqual({ success: true });
      snapshot = await resume(players[0]);
    }
    expect(snapshot.gameState?.phase).toBe('bidding');
    const dealt = await Promise.all(players.map(resume));
    const allCards = dealt.flatMap((state, index) => {
      expect(state.gameState?.mySeat).toBe(SEATS[index]);
      expect(state.gameState?.myHand).toHaveLength(13);
      expect(state.gameState).not.toHaveProperty('hands');
      expect(state.gameState).not.toHaveProperty('players');
      expect(Object.values(state.room!.seats).every((seat) => seat.isReady)).toBe(true);
      return state.gameState!.myHand.map((card) => `${card.suit}:${card.rank}`);
    });
    expect(new Set(allCards).size).toBe(52);

    for (let bidIndex = 0; bidIndex < 4; bidIndex += 1) {
      const bidder = snapshot.gameState?.bidding?.currentBidderSeat;
      if (!bidder) throw new Error('Expected current bidder');
      const bid = bidIndex === 0 ? { type: 'bid' as const, level: 1 as const, suit: 'clubs' as const }
        : { type: 'pass' as const };
      expect(await players[SEATS.indexOf(bidder)].timeout(5_000).emitWithAck('game:bid', { bid }))
        .toEqual({ success: true });
      snapshot = await resume(players[0]);
    }
    expect(snapshot.gameState?.phase).toBe('playing');
    expect(await players[0].timeout(5_000).emitWithAck('game:continue')).toMatchObject({ success: false });
    expect((await resume(players[0])).gameState).toEqual(snapshot.gameState);

    const firstTurn = snapshot.gameState?.playing?.currentTurnSeat;
    if (!firstTurn) throw new Error('Expected current player');
    const firstPlayer = players[SEATS.indexOf(firstTurn)];
    const firstState = await resume(firstPlayer);
    const firstCard = firstState.gameState?.validCards[0];
    if (!firstCard) throw new Error('Expected playable card');
    expect(await firstPlayer.timeout(5_000).emitWithAck('game:playCard', { card: firstCard }))
      .toEqual({ success: true });
    const active = await Promise.all(players.map(resume));
    expect(active.reduce((total, state) => total + state.gameState!.myHand.length, 0)).toBe(51);

    players[0].disconnect();
    players[0] = await connect(accounts[0].cookie);
    const refreshed = await resume(players[0]);
    expect(refreshed.gameState).toEqual(active[0].gameState);
    expect(refreshed.chatHistory).toEqual(waiting.chatHistory);

    await stop();
    await start();
    players = await connectPlayers(accounts);
    const resumed = await Promise.all(players.map(resume));
    for (let index = 0; index < 4; index += 1) {
      expect(resumed[index].room).toEqual(active[index].room);
      expect(resumed[index].gameState).toEqual(active[index].gameState);
      expect(resumed[index].chatHistory).toEqual(waiting.chatHistory);
    }

    snapshot = resumed[0];
    for (let played = 0; snapshot.gameState?.phase === 'playing' && played < 52; played += 1) {
      const seat = snapshot.gameState.playing?.currentTurnSeat;
      if (!seat) throw new Error('Expected player turn');
      const client = players[SEATS.indexOf(seat)];
      const state = await resume(client);
      const card = state.gameState?.validCards[0];
      if (!card) throw new Error('Expected a legal card');
      expect(await client.timeout(5_000).emitWithAck('game:playCard', { card })).toEqual({ success: true });
      snapshot = await resume(players[0]);
    }
    expect(snapshot.gameState?.phase).toBe('scoring');
    expect(snapshot.room?.status).toBe('waiting');
    expect(Object.values(snapshot.room!.seats).every((seat) => !seat.isReady)).toBe(true);
    const stored = await repository.loadRuntime();
    expect(stored?.games[0].result).toEqual(snapshot.gameState?.result);
    for (const registered of accounts) {
      const response = await fetch(`${baseUrl}/api/account/history`, { headers: headers(registered.cookie) });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.matches).toHaveLength(1);
      expect(body.matches[0]).toMatchObject({
        roomCode, result: { ...snapshot.gameState?.result, gameType: 'bridge' },
      });
      expect(body.matches[0].accountIds).toEqual(accounts.map(({ account }) => account.id));
    }

    await stop();
    await start();
    const finalPlayer = await connect(accounts[0].cookie);
    expect((await resume(finalPlayer)).gameState?.result).toEqual(snapshot.gameState?.result);
    expect(await repository.listMatches(accounts[0].account.id)).toHaveLength(1);
  }, 30_000);

  it('should switch game type as host and abort a game by vote without a match record', async () => {
    const accounts: RegisteredAccount[] = [];
    for (const username of ['vote_north', 'vote_east', 'vote_south', 'vote_west']) {
      accounts.push(await register(username));
    }
    const players = await connectPlayers(accounts);
    const created = await players[0].timeout(5_000).emitWithAck('room:create', { gameType: 'bigtwo' });
    const roomCode = created.roomCode;
    if (!roomCode) throw new Error('Expected room code');
    for (let index = 0; index < 4; index += 1) {
      if (index > 0) await players[index].timeout(5_000).emitWithAck('room:join', { roomCode });
      await players[index].timeout(5_000).emitWithAck('room:changeSeat', { seat: SEATS[index] });
    }
    const readyAll = async (): Promise<(typeof created)[]> => {
      const results = [];
      for (const client of players) results.push(await client.timeout(5_000).emitWithAck('room:ready'));
      return results;
    };
    expect((await resume(players[1])).room).toMatchObject({
      gameType: 'bigtwo', hostId: accounts[0].account.id, abortVote: null,
    });
    expect((await readyAll())[3]).toEqual({ success: false, error: 'Big Two is not available yet.' });
    expect((await resume(players[0])).room?.status).toBe('waiting');

    expect(await players[1].timeout(5_000).emitWithAck('room:setGameType', { gameType: 'bridge' }))
      .toMatchObject({ success: false });
    expect(await players[0].timeout(5_000).emitWithAck('room:setGameType', { gameType: 'bridge' }))
      .toEqual({ success: true });
    const switched = await resume(players[0]);
    expect(switched.room?.gameType).toBe('bridge');
    expect(Object.values(switched.room!.seats).every((seat) => !seat.isReady)).toBe(true);
    expect((await readyAll()).every((result) => result.success)).toBe(true);
    expect((await resume(players[0])).gameState?.gameType).toBe('bridge');

    expect(await players[0].timeout(5_000).emitWithAck('game:abortVote:start')).toEqual({ success: true });
    expect(await players[1].timeout(5_000).emitWithAck('game:abortVote:start')).toMatchObject({ success: false });
    expect(await players[0].timeout(5_000).emitWithAck('game:abortVote:cast', { agree: true }))
      .toEqual({ success: false, error: 'You have already voted.' });
    expect(await players[1].timeout(5_000).emitWithAck('game:abortVote:cast', { agree: true }))
      .toEqual({ success: true });
    expect((await resume(players[3])).room?.abortVote).toMatchObject({
      startedBy: accounts[0].account.id, yes: [accounts[0].account.id, accounts[1].account.id], no: [],
    });
    expect(await players[2].timeout(5_000).emitWithAck('game:abortVote:cast', { agree: true }))
      .toEqual({ success: true });

    const aborted = await resume(players[3]);
    expect(aborted.gameState).toBeUndefined();
    expect(aborted.room).toMatchObject({ status: 'waiting', abortVote: null });
    expect(Object.values(aborted.room!.seats).every((seat) => !seat.isReady)).toBe(true);
    expect(aborted.chatHistory?.map((message) => [message.system, message.content])).toEqual([
      [true, 'abortVote.started'], [true, 'abortVote.passed'],
    ]);
    expect(await repository.listMatches(accounts[0].account.id)).toEqual([]);
    expect((await repository.loadRuntime())?.games).toEqual([]);
  }, 20_000);
});
