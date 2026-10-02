# Accounts, friends, and persistent storage

> [Wiki index](./index.md) · [HTTP and Socket API](./api-events.md)

## Account lifecycle

Register with a unique username (3–24 letters, numbers, or underscores) and a password
(10–128 characters). Username matching is case-insensitive. Registration signs the user in.
The account UUID is also the player ID; nicknames can change without changing identity.
Profiles have a nickname (1–20 characters), six-digit color, and one of six avatar presets:
`cat`, `fox`, `owl`, `bear`, `rabbit`, `panda`. Avatars render as emoji with a profile-color ring.

Login creates a seven-day opaque session. Only a SHA-256 token digest is stored in the
database; the browser receives an HttpOnly, SameSite=Lax cookie. Production cookies also
use Secure. Passwords use salted asynchronous scrypt (N=131072, r=8, p=1). Hash concurrency
and HTTP request rates are bounded. Mutating HTTP requests require a permitted Origin and
JSON Content-Type. Credentials never appear in public account or socket payloads.

Logout revokes the current session. Logout-all revokes all sessions. Changing a password
requires the current password, revokes all sessions, and asks the user to sign in again.
Live sockets belonging to revoked sessions are disconnected. Expired sessions cannot
perform socket actions. Username/password is the configured authentication method;
there is no email delivery or forgotten-password workflow in this version.

The password parameters follow the [OWASP password storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).

## Friendships

An account can find another account by exact username and send a friend request.
The recipient can accept or decline; the sender can cancel. Either participant can remove
an accepted friendship. Self requests, duplicate pairs (including reversed requests), and
actions by unrelated accounts are rejected. Friend lists resolve current nicknames and
avatars from account records. Accepted and pending relationships survive restart.

## Database layout and ownership

`server/src/database/repository.ts` is the asynchronous storage contract. Auth, social,
and game persistence depend on that contract. `json-repository.ts` is the current adapter.
The default file is `server/data/database.json`, independent of the process working directory.
Override it with `DATABASE_PATH`; relative overrides resolve from the process working directory.
The data directory is ignored by Git and is never served as a static directory.

The document has `schemaVersion: 1` and these collections:

| Collection | Data |
| --- | --- |
| `accounts` | Stable ID, unique normalized username, password hash, nickname/color/avatar, timestamps |
| `sessions` | Unique token hash, account ID, creation and expiry timestamps |
| `friendships` | Stable ID, requester/recipient IDs, pending/accepted state, timestamps |
| `matches` | Stable game ID, room code, four account IDs, result, completion timestamp |
| `runtime.players` | Public player identity, current room, disconnection timestamp |
| `runtime.rooms` | Room metadata, member IDs, seats, ready flags |
| `runtime.games` | Game ID, participant snapshots, hands, bidding, tricks, result, log |
| `runtime.chat` | Last 200 messages per existing room |

Only one server process may own a JSON database file. An in-process guard rejects duplicate
adapters for the same path; it is not a cross-process lock. Use SQL and appropriate shared
game coordination before scaling to multiple server processes.

Writes run through a serialized queue. Each mutation copies affected collection arrays and
replacement records, validates the complete document's schema and references, writes a temporary
file in the same directory, flushes that file,
and atomically renames it over the database. The in-memory document changes only after a
successful rename. Invalid JSON, unsupported versions, duplicate records, and invalid
references stop startup without replacing the original file. Atomic replacement protects
against partial writes; hardware power-loss durability also depends on the filesystem.

Lazy in-memory indexes cover account IDs/usernames, session hashes, friendship IDs/pairs/account
membership, and sorted match history. Indexes follow collection identity and refresh after a
collection changes; unrelated runtime writes retain them. This uses additional memory. Reads and
external inputs remain isolated, and actual writes still validate and serialize the whole JSON
document, flush it with fsync, and atomically replace the file. The schema and Repository API are
unchanged. See [performance measurements](./performance.md) for the workload and tradeoffs.

Game actions use a separate serialized runtime coordinator. It snapshots manager state,
applies the action, saves the complete runtime and any completed match in one repository
write, then acknowledges and broadcasts to the actor and affected old/new room members.
A failed write restores the previous runtime. A resume with exactly unchanged persisted state
can skip the write while still authenticating, acknowledging and synchronizing its room.
First attachment, final-tab disconnect and reconnection still persist their actual state changes.
Socket IDs stay in memory and are never persisted. Each account receives only its own hand.

On restart, room seats and games are restored and disconnected players get a fresh 60-second
reconnect window. Normal disconnects use the same window. After expiry, the player leaves;
an unfinished game is aborted, and remaining players can prepare another game. Multiple
tabs share one account seat; closing one tab does not disconnect its other tabs. Empty rooms
and their active game/chat records are removed, while completed match history is retained.

## Configuration and backup

Set `CLIENT_ORIGIN` to a comma-separated list of exact frontend origins. Development defaults
are localhost and 127.0.0.1 on port 5173. `NODE_ENV=production` requires an explicit origin
and enables Secure cookies, so production must use HTTPS. The Vite proxy forwards `/api`
and `/socket.io` to port 3001. `server/.env.example` documents variables; it is not auto-loaded.

For a consistent backup, stop the server, copy `database.json` to protected storage, and
restart. Keep the backup private because it contains password hashes and private hands.
To restore, stop the server, preserve the current file separately, copy the selected backup
to `DATABASE_PATH`, then start the server. Startup validates the restored document. Do not
edit a live database file or run concurrent servers against it.

## Later SQL migration

The SQL adapter is a future stage. Implement `Repository` with the same asynchronous methods,
public DTOs, atomic uniqueness checks, compare-and-swap password updates, and revocation rules.
Suggested relational mapping:

| SQL table | Constraints / mapping |
| --- | --- |
| `accounts` | Primary key `id`; unique `username_normalized`; preserve hash format and IDs |
| `sessions` | Primary key `token_hash`; FK `account_id`; expiry index |
| `friendships` | Primary key `id`; two account FKs; unique unordered account pair; status check |
| `matches` | Primary key `id`; result columns or JSON; completion index |
| `match_players` | Composite key `(match_id, account_id)`; account/match FKs |
| `runtime` | Single versioned JSON/JSONB snapshot initially, with atomic match insertion |

Keeping the runtime as JSON/JSONB initially permits SQL migration without changing game
logic. Normalize room/game tables separately when multi-process coordination is designed.

Migration procedure:

1. Implement the SQL adapter and run the repository/auth/social/runtime tests against it.
2. Stop writes and take a JSON backup. Validate version 1 before importing.
3. Import accounts first, then sessions, friendships, matches/participants, and runtime in
   one transaction. Preserve IDs and hashes verbatim. Use primary keys to make retries
   idempotent; reject conflicting existing records instead of overwriting them.
4. Compare row counts, account IDs, unique usernames/pairs, foreign keys, expiry times,
   and serialized runtime contents. Verify login, friend lists, history, and game resume.
5. Change only the repository construction at startup and resume traffic. Keep the original
   JSON backup. Roll back before accepting new SQL writes by switching back to that backup;
   after SQL writes begin, export and verify newer SQL data before any rollback.

Do not dual-write JSON and SQL without a separately designed transaction/outbox strategy.

The account introduction also replaces the guest Socket protocol. Deploy the frontend and
backend together; existing guest tabs must reload and create an account. There was no prior
durable application database to import. Keep this release's JSON file when upgrading later.
