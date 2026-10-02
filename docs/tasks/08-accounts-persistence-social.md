# 08 — Accounts, persistence, profiles, and friends

Status: complete. TypeScript, ESLint, 122 tests, production build, and browser verification passed.
Date: 2026-10-03

## Delivered

- [x] Versioned JSON database behind an asynchronous Repository contract.
- [x] Atomic serialized writes, schema/reference validation, corrupt-file preservation.
- [x] Username/password registration, login, persistent sessions, logout and logout-all.
- [x] Password change with current-password verification and session revocation.
- [x] Public nickname, color, and six preset avatars.
- [x] Friend requests, incoming/outgoing lists, accept/decline/cancel and unfriend.
- [x] Authenticated sockets; identity comes from the session cookie.
- [x] Durable room membership, readiness, game state, chat, and completed match history.
- [x] Authoritative private snapshots on reconnect and after committed actions.
- [x] Login/register/account/friends/history UI with Chinese and English text.
- [x] Persistence/auth/friend/restart/full-game regression tests.
- [x] Storage configuration, backup/restore, and later SQL migration documentation.

This replaces the initial guest identity and memory-only persistence design.
SQL implementation is a later stage; the current adapter is JSON and supports one server
process per database file. Avatars are presets. Username/password accounts do not require
an email service.

See [accounts and storage](../wiki/accounts-and-storage.md) for acceptance details.
