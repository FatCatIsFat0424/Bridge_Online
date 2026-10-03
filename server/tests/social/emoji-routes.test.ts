import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { io as connectSocket } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type {
  AccountProfile, ClientToServerEvents, EmojiRecord, ServerToClientEvents,
} from '@shared/types';
import { createApplication } from '../../src/app';
import { createJsonRepository } from '../../src/database/json-repository';
import type { Repository } from '../../src/database/repository';

const ORIGIN = 'http://localhost:5173';
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);
type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

describe('custom emoji routes and chat', () => {
  let directory: string;
  let repository: Repository;
  let application: Awaited<ReturnType<typeof createApplication>>;
  let baseUrl: string;
  const clients: Client[] = [];

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'bridge-emoji-'));
    repository = await createJsonRepository(join(directory, 'database.json'));
    application = await createApplication(repository, {
      allowedOrigins: [ORIGIN], mediaDirectory: join(directory, 'media'),
    });
    await new Promise<void>((resolve) => {
      application.httpServer.listen(0, '127.0.0.1', resolve);
    });
    const address = application.httpServer.address();
    if (!address || typeof address === 'string') throw new Error('Expected HTTP server address.');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    for (const client of clients.splice(0)) client.disconnect();
    await application.close();
    await rm(directory, { recursive: true, force: true });
  });

  function headers(cookie?: string): Record<string, string> {
    return { Origin: ORIGIN, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) };
  }

  async function register(username: string): Promise<{ account: AccountProfile; cookie: string }> {
    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ username, password: 'A valid test password 123', nickname: username }),
    });
    expect(response.status).toBe(201);
    const body = await response.json() as { account: AccountProfile };
    const cookie = response.headers.get('set-cookie')?.split(';')[0];
    if (!cookie) throw new Error('Expected session cookie');
    return { account: body.account, cookie };
  }

  async function api(
    cookie: string, path: string, method = 'GET', body?: object,
  ): Promise<{ status: number; body: Record<string, unknown> }> {
    const response = await fetch(`${baseUrl}${path}`, {
      method, headers: headers(cookie), body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, body: await response.json() as Record<string, unknown> };
  }

  async function connect(cookie: string): Promise<Client> {
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
    expect((await client.timeout(5_000).emitWithAck('player:resume')).success).toBe(true);
    return client;
  }

  it('should manage a library of uploaded emoji per account', async () => {
    const alice = await register('emoji_alice');
    const bob = await register('emoji_bob');
    expect((await api(alice.cookie, '/api/emojis')).body).toEqual({ success: true, emojis: [] });
    expect((await fetch(`${baseUrl}/api/emojis`, { headers: headers() })).status).toBe(401);
    const upload = await api(alice.cookie, '/api/media', 'POST',
      { data: PNG.toString('base64'), purpose: 'emoji' });
    const mediaId = upload.body.id as string;

    const created = await api(alice.cookie, '/api/emojis', 'POST',
      { items: [{ name: 'wave', mediaId }, { name: 'cat', mediaId }] });
    expect(created.status).toBe(201);
    const [wave, cat] = created.body.emojis as EmojiRecord[];
    expect(wave).toMatchObject({ name: 'wave', mediaId, accountId: alice.account.id });

    const missing = `${'d'.repeat(64)}.png`;
    for (const items of [
      [{ name: 'nope', mediaId: missing }],
      [{ name: 'Bad!', mediaId }],
      [{ name: 'twin', mediaId }, { name: 'twin', mediaId }],
      [],
      Array.from({ length: 51 }, (_, index) => ({ name: `e${index}`, mediaId })),
    ]) {
      expect((await api(alice.cookie, '/api/emojis', 'POST', { items })).status).toBe(400);
    }
    expect((await api(alice.cookie, '/api/emojis', 'POST', { items: [{ name: 'wave', mediaId }] })).status)
      .toBe(409);

    expect((await api(alice.cookie, `/api/emojis/${cat.id}`, 'PATCH', { name: 'wave' })).status).toBe(409);
    expect((await api(alice.cookie, `/api/emojis/${cat.id}`, 'PATCH', { name: 'X' })).status).toBe(400);
    expect((await api(bob.cookie, `/api/emojis/${cat.id}`, 'PATCH', { name: 'kitty' })).status).toBe(404);
    expect((await api(alice.cookie, `/api/emojis/${cat.id}`, 'PATCH', { name: 'kitty' })).body)
      .toMatchObject({ success: true, emoji: { id: cat.id, name: 'kitty' } });
    expect((await api(bob.cookie, `/api/emojis/${wave.id}`, 'DELETE')).status).toBe(404);
    expect((await api(alice.cookie, `/api/emojis/${wave.id}`, 'DELETE')).status).toBe(200);
    expect(((await api(alice.cookie, '/api/emojis')).body.emojis as EmojiRecord[]).map((emoji) => emoji.name))
      .toEqual(['kitty']);
    expect((await api(bob.cookie, '/api/emojis')).body.emojis).toEqual([]);
  }, 15_000);

  it('should attach only used emoji from the sender library to chat messages', async () => {
    const alice = await register('chat_alice');
    const bob = await register('chat_bob');
    const aliceMedia = `${'a'.repeat(64)}.png`;
    const bobMedia = `${'b'.repeat(64)}.gif`;
    await repository.createEmojis(alice.account.id,
      [{ name: 'wave', mediaId: aliceMedia }, { name: 'unused', mediaId: aliceMedia }], 1);
    await repository.createEmojis(bob.account.id, [{ name: 'party', mediaId: bobMedia }], 1);
    const aliceClient = await connect(alice.cookie);
    const created = await aliceClient.timeout(5_000).emitWithAck('room:create', { gameType: 'bridge' });
    expect(created.success).toBe(true);
    const bobClient = await connect(bob.cookie);
    expect((await bobClient.timeout(5_000).emitWithAck('room:join', { roomCode: created.roomCode! })).success)
      .toBe(true);

    expect(await aliceClient.timeout(5_000).emitWithAck('chat:send',
      { message: 'hi :wave: :party: :missing: :wave:' })).toEqual({ success: true });
    expect(await bobClient.timeout(5_000).emitWithAck('chat:send', { message: 'plain text' }))
      .toEqual({ success: true });
    const { chatHistory } = await bobClient.timeout(5_000).emitWithAck('player:resume');
    expect(chatHistory?.[0].emojis).toEqual({ wave: aliceMedia });
    expect(chatHistory?.[1]).not.toHaveProperty('emojis');
    expect((await repository.loadRuntime())?.chat[0].messages[0].emojis).toEqual({ wave: aliceMedia });
  }, 15_000);
});
