import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createJsonRepository } from '../../src/database/json-repository';
import { CURRENT_SCHEMA_VERSION, migrateDocument } from '../../src/database/migrations';
import { emptyDocument, validateDocument } from '../../src/database/schema';

const PASSWORD_HASH = `scrypt$131072$8$1$${'ab'.repeat(16)}$${'cd'.repeat(64)}`;
const V1_PLAYER = {
  id: 'account-1', username: 'alice', nickname: 'Alice', color: '#123456', avatar: 'cat',
};

/** The shape emptyDocument() produced at schema v1, plus one account. */
function version1(runtime: unknown = null): Record<string, unknown> {
  return {
    schemaVersion: 1,
    accounts: [{
      id: 'account-1', username: 'alice', usernameNormalized: 'alice', nickname: 'Alice',
      color: '#123456', avatar: 'cat', passwordHash: PASSWORD_HASH, createdAt: 100, updatedAt: 100,
    }],
    sessions: [],
    friendships: [],
    matches: [],
    runtime,
  };
}

function version1Runtime(): unknown {
  return {
    players: [{ info: V1_PLAYER, currentRoomCode: 'ABC123', disconnectedAt: null }],
    rooms: [{
      info: {
        code: 'ABC123', gameType: 'bridge', status: 'waiting', createdAt: 100,
        seats: {
          N: { player: V1_PLAYER, isReady: false },
          E: { player: null, isReady: false },
          S: { player: null, isReady: false },
          W: { player: null, isReady: false },
        },
      },
      memberIds: ['account-1'],
    }],
    games: [],
    chat: [{
      roomCode: 'ABC123',
      messages: [{ id: 'message-1', sender: V1_PLAYER, content: 'hi', timestamp: 100 }],
    }],
  };
}

describe('database migrations', () => {
  it('should upgrade a v1 document to v2 defaults without mutating the input', () => {
    const input = version1();
    const before = structuredClone(input);
    const migrated = migrateDocument(input);
    expect(input).toEqual(before);
    expect(() => validateDocument(migrated)).not.toThrow();
    expect(migrated).toMatchObject({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      emojis: [],
      accounts: [{ avatarImage: null, tableBackground: null, matchesPublic: false }],
    });
  });

  it('should add avatarImage to every persisted runtime player', () => {
    const migrated = migrateDocument(version1(version1Runtime()));
    expect(() => validateDocument(migrated)).not.toThrow();
    const runtime = (migrated as { runtime: ReturnType<typeof emptyDocument>['runtime'] }).runtime!;
    expect(runtime.players[0].info.avatarImage).toBeNull();
    expect(runtime.rooms[0].info.seats.N.player?.avatarImage).toBeNull();
    expect(runtime.rooms[0].info.seats.E.player).toBeNull();
    expect(runtime.chat[0].messages[0].sender.avatarImage).toBeNull();
  });

  it('should return a current document untouched and reject unknown versions', () => {
    const current = emptyDocument();
    expect(migrateDocument(current)).toBe(current);
    expect(() => migrateDocument({ ...current, schemaVersion: 99 })).toThrow();
    expect(() => migrateDocument({ ...current, schemaVersion: 0 })).toThrow();
    expect(() => migrateDocument([])).toThrow();
  });

  it('should keep a v1 backup and persist the migrated document on open', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'bridge-migration-'));
    const path = join(directory, 'database.json');
    try {
      const original = JSON.stringify(version1(version1Runtime()));
      await writeFile(path, original);
      const repository = await createJsonRepository(path);
      expect(await repository.getAccountById('account-1')).toMatchObject({ matchesPublic: false });
      await repository.close();
      expect(await readFile(`${path}.v1.bak`, 'utf8')).toBe(original);
      expect(JSON.parse(await readFile(path, 'utf8')).schemaVersion).toBe(2);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
