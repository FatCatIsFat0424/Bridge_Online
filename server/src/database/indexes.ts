import type { AccountRecord, FriendshipRecord, MatchRecord, SessionRecord } from './repository';

interface AccountIndexes {
  byId: Map<string, AccountRecord>;
  byUsername: Map<string, AccountRecord>;
  positions: Map<string, number>;
}

interface FriendshipIndexes {
  byId: Map<string, FriendshipRecord>;
  byAccount: Map<string, FriendshipRecord[]>;
  positions: Map<string, number>;
  pairs: Set<string>;
}

interface MatchIndexes {
  byAccount: Map<string, MatchRecord[]>;
  positions: Map<string, number>;
}

interface DatabaseIndexes {
  accounts(records: readonly AccountRecord[]): AccountIndexes;
  sessions(records: readonly SessionRecord[]): Map<string, SessionRecord>;
  friendships(records: readonly FriendshipRecord[]): FriendshipIndexes;
  matches(records: readonly MatchRecord[]): MatchIndexes;
}

/** Tables are immutable after publication, so unrelated writes preserve their indexes. */
function cacheTable<T, TIndex>(
  build: (records: readonly T[]) => TIndex,
): (records: readonly T[]) => TIndex {
  let source: readonly T[] | undefined;
  let index: TIndex;
  return (records) => {
    if (source !== records) {
      index = build(records);
      source = records;
    }
    return index;
  };
}

function append<T>(groups: Map<string, T[]>, key: string, value: T): void {
  const group = groups.get(key);
  if (group) group.push(value);
  else groups.set(key, [value]);
}

export function friendshipPair(first: string, second: string): string {
  return JSON.stringify([first, second].sort());
}

/** Indexes only hold server-private references; repository reads still return deep copies. */
export function createDatabaseIndexes(): DatabaseIndexes {
  return {
    accounts: cacheTable((records: readonly AccountRecord[]): AccountIndexes => {
      const byId = new Map<string, AccountRecord>();
      const byUsername = new Map<string, AccountRecord>();
      const positions = new Map<string, number>();
      records.forEach((record, position) => {
        byId.set(record.id, record);
        byUsername.set(record.usernameNormalized, record);
        positions.set(record.id, position);
      });
      return { byId, byUsername, positions };
    }),
    sessions: cacheTable(
      (records: readonly SessionRecord[]) =>
        new Map(records.map((record) => [record.tokenHash, record])),
    ),
    friendships: cacheTable((records: readonly FriendshipRecord[]): FriendshipIndexes => {
      const byId = new Map<string, FriendshipRecord>();
      const byAccount = new Map<string, FriendshipRecord[]>();
      const positions = new Map<string, number>();
      const pairs = new Set<string>();
      records.forEach((record, position) => {
        byId.set(record.id, record);
        positions.set(record.id, position);
        pairs.add(friendshipPair(record.requesterId, record.recipientId));
        append(byAccount, record.requesterId, record);
        append(byAccount, record.recipientId, record);
      });
      return { byId, byAccount, positions, pairs };
    }),
    matches: cacheTable((records: readonly MatchRecord[]): MatchIndexes => {
      const byAccount = new Map<string, MatchRecord[]>();
      const positions = new Map<string, number>();
      records.forEach((record, position) => {
        positions.set(record.id, position);
        for (const accountId of record.accountIds) append(byAccount, accountId, record);
      });
      for (const matches of byAccount.values())
        matches.sort((first, second) => second.finishedAt - first.finishedAt);
      return { byAccount, positions };
    }),
  };
}
