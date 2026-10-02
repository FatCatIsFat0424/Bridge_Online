import type { GameState, Seat } from '@shared/types';
import type { RuntimeSnapshot } from './types';

type ObjectValue = Record<string, unknown>;
const seats: Seat[] = ['N', 'E', 'S', 'W'];
const suits = ['clubs', 'diamonds', 'hearts', 'spades'];

function object(value: unknown): value is ObjectValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function number(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function text(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function oneOf(value: unknown, choices: string[]): boolean {
  return typeof value === 'string' && choices.includes(value);
}

function player(value: unknown): boolean {
  return (
    object(value) &&
    text(value.id) &&
    text(value.username) &&
    text(value.nickname) &&
    typeof value.color === 'string' &&
    /^#[a-fA-F0-9]{6}$/.test(value.color) &&
    oneOf(value.avatar, ['cat', 'fox', 'owl', 'bear', 'rabbit', 'panda'])
  );
}

function card(value: unknown): boolean {
  return (
    object(value) &&
    oneOf(value.suit, suits) &&
    number(value.rank) &&
    Number.isInteger(value.rank) &&
    value.rank >= 2 &&
    value.rank <= 14
  );
}

function bid(value: unknown): boolean {
  return (
    object(value) &&
    (value.type === 'pass' ||
      (value.type === 'bid' &&
        number(value.level) &&
        Number.isInteger(value.level) &&
        value.level >= 1 &&
        value.level <= 7 &&
        oneOf(value.suit, [...suits, 'nt'])))
  );
}

function contract(value: unknown): boolean {
  return object(value) && bid({ ...value, type: 'bid' }) && oneOf(value.declarer, seats);
}

function result(value: unknown): boolean {
  return (
    object(value) &&
    contract(value.contract) &&
    number(value.declarerTeamTricks) &&
    number(value.defenderTeamTricks) &&
    number(value.requiredTricks) &&
    value.declarerTeamTricks + value.defenderTeamTricks === 13 &&
    value.requiredTricks === Number((value.contract as ObjectValue).level) + 6 &&
    value.declarerTeamWins === value.declarerTeamTricks >= value.requiredTricks
  );
}

function trick(value: unknown, complete = false): boolean {
  return (
    object(value) &&
    Object.keys(value).every((seat) => seats.includes(seat as Seat)) &&
    Object.values(value).every(card) &&
    (!complete || Object.keys(value).length === 4)
  );
}

function playing(value: unknown): boolean {
  return (
    object(value) &&
    trick(value.currentTrick) &&
    oneOf(value.trickLeadSeat, seats) &&
    oneOf(value.currentTurnSeat, seats) &&
    number(value.trickCountEW) &&
    number(value.trickCountNS) &&
    Array.isArray(value.completedTricks) &&
    value.completedTricks.length <= 13 &&
    value.trickCountEW + value.trickCountNS === value.completedTricks.length &&
    value.completedTricks.every(
      (entry: unknown) =>
        object(entry) &&
        trick(entry.cards, true) &&
        oneOf(entry.leadSeat, seats) &&
        oneOf(entry.winnerSeat, seats),
    )
  );
}

function bidding(value: unknown): boolean {
  return (
    object(value) &&
    oneOf(value.currentBidderSeat, seats) &&
    number(value.consecutivePassCount) &&
    value.consecutivePassCount <= 4 &&
    typeof value.isFirstRound === 'boolean' &&
    (value.highestBid === null ||
      (object(value.highestBid) &&
        bid({ ...value.highestBid, type: 'bid' }) &&
        oneOf(value.highestBid.seat, seats))) &&
    Array.isArray(value.bids) &&
    value.bids.every(
      (entry: unknown) => object(entry) && oneOf(entry.seat, seats) && bid(entry.action),
    )
  );
}

function log(value: unknown): boolean {
  if (!object(value) || !number(value.timestamp)) return false;
  if (value.type === 'system') return typeof value.message === 'string';
  if (value.type === 'bid') return oneOf(value.seat, seats) && bid(value.action);
  if (value.type === 'play') return oneOf(value.seat, seats) && card(value.card);
  if (value.type === 'redeal')
    return oneOf(value.seat, seats) && typeof value.accepted === 'boolean';
  return value.type === 'trick_end' && oneOf(value.winnerSeat, seats) && number(value.trickIndex);
}

function game(value: unknown): boolean {
  return (
    object(value) &&
    text(value.id) &&
    text(value.roomCode) &&
    number(value.startedAt) &&
    object(value.players) &&
    Object.keys(value.players).length === 4 &&
    seats.every((seat) => player((value.players as ObjectValue)[seat])) &&
    oneOf(value.phase, ['dealing', 'redeal_pending', 'bidding', 'playing', 'scoring']) &&
    object(value.hands) &&
    Object.keys(value.hands).length === 4 &&
    seats.every((seat) => {
      const hand = (value.hands as ObjectValue)[seat];
      return Array.isArray(hand) && hand.length <= 13 && hand.every(card);
    }) &&
    oneOf(value.dealerSeat, seats) &&
    (value.bidding === null || bidding(value.bidding)) &&
    (value.contract === null || contract(value.contract)) &&
    (value.playing === null || playing(value.playing)) &&
    (value.result === null || result(value.result)) &&
    Array.isArray(value.log) &&
    value.log.every(log) &&
    Array.isArray(value.redealDeclinedSeats) &&
    value.redealDeclinedSeats.every((seat: unknown) => oneOf(seat, seats)) &&
    new Set(value.redealDeclinedSeats).size === value.redealDeclinedSeats.length &&
    (value.redealPendingSeat === null || oneOf(value.redealPendingSeat, seats))
  );
}

function room(value: unknown): boolean {
  if (
    !object(value) ||
    !object(value.info) ||
    !Array.isArray(value.memberIds) ||
    !value.memberIds.every(text) ||
    value.memberIds.length < 1 ||
    value.memberIds.length > 4 ||
    new Set(value.memberIds).size !== value.memberIds.length
  )
    return false;
  const info = value.info;
  return (
    text(info.code) &&
    info.gameType === 'bridge' &&
    oneOf(info.status, ['waiting', 'playing']) &&
    number(info.createdAt) &&
    object(info.seats) &&
    Object.keys(info.seats).length === 4 &&
    seats.every((seat) => {
      const entry = (info.seats as ObjectValue)[seat];
      return (
        object(entry) &&
        typeof entry.isReady === 'boolean' &&
        ((entry.player === null && !entry.isReady) ||
          (player(entry.player) &&
            (value.memberIds as unknown[]).includes((entry.player as ObjectValue).id)))
      );
    })
  );
}

/** A persisted phase must contain the state needed to resume its next legal action. */
function coherentGame(state: GameState): boolean {
  if (new Set(seats.map((seat) => state.players[seat].id)).size !== 4) return false;
  if (state.phase === 'dealing' || state.phase === 'redeal_pending' || state.phase === 'bidding') {
    if (
      state.contract !== null ||
      state.playing !== null ||
      state.result !== null ||
      !seats.every((seat) => state.hands[seat].length === 13)
    )
      return false;
    if (state.phase === 'bidding') {
      return (
        state.bidding !== null &&
        state.redealPendingSeat === null &&
        state.bidding.consecutivePassCount < (state.bidding.highestBid ? 3 : 4)
      );
    }
    return (
      state.bidding === null &&
      (state.phase === 'dealing'
        ? state.redealPendingSeat === null
        : state.redealPendingSeat !== null &&
          !state.redealDeclinedSeats.includes(state.redealPendingSeat))
    );
  }
  if (
    state.bidding === null ||
    state.contract === null ||
    state.playing === null ||
    state.redealPendingSeat !== null
  )
    return false;
  const highest = state.bidding.highestBid;
  if (
    !highest ||
    highest.level !== state.contract.level ||
    highest.suit !== state.contract.suit ||
    highest.seat !== state.contract.declarer ||
    state.bidding.consecutivePassCount !== 3
  )
    return false;
  const playingState = state.playing;
  const ewTricks = playingState.completedTricks.filter(
    (entry) => entry.winnerSeat === 'E' || entry.winnerSeat === 'W',
  ).length;
  if (ewTricks !== playingState.trickCountEW) return false;
  const playedSeats = Object.keys(playingState.currentTrick);
  if (
    playedSeats.length >= 4 ||
    !seats.every(
      (seat) =>
        state.hands[seat].length ===
        13 - playingState.completedTricks.length - (playedSeats.includes(seat) ? 1 : 0),
    )
  )
    return false;
  if (state.phase === 'playing')
    return state.result === null && playingState.completedTricks.length < 13;
  const finished = state.result;
  const declarerTricks = ['N', 'S'].includes(state.contract.declarer)
    ? playingState.trickCountNS
    : playingState.trickCountEW;
  return (
    finished !== null &&
    playingState.completedTricks.length === 13 &&
    playedSeats.length === 0 &&
    finished.contract.level === state.contract.level &&
    finished.contract.suit === state.contract.suit &&
    finished.contract.declarer === state.contract.declarer &&
    finished.declarerTeamTricks === declarerTricks
  );
}

export function isRuntimeSnapshot(value: unknown): value is RuntimeSnapshot {
  if (
    !object(value) ||
    !Array.isArray(value.players) ||
    !Array.isArray(value.rooms) ||
    !Array.isArray(value.games) ||
    !Array.isArray(value.chat)
  )
    return false;
  if (
    !value.players.every(
      (entry: unknown) =>
        object(entry) &&
        player(entry.info) &&
        (entry.currentRoomCode === null || text(entry.currentRoomCode)) &&
        (entry.disconnectedAt === null || number(entry.disconnectedAt)),
    ) ||
    !value.rooms.every(room) ||
    !value.games.every(game) ||
    !value.chat.every(
      (entry: unknown) =>
        object(entry) &&
        text(entry.roomCode) &&
        Array.isArray(entry.messages) &&
        entry.messages.every(
          (message: unknown) =>
            object(message) &&
            text(message.id) &&
            player(message.sender) &&
            typeof message.content === 'string' &&
            number(message.timestamp),
        ),
    )
  )
    return false;
  const snapshot = value as unknown as RuntimeSnapshot;
  const players = new Map(snapshot.players.map((entry) => [entry.info.id, entry]));
  const rooms = new Map(snapshot.rooms.map((entry) => [entry.info.code, entry]));
  const games = new Map(snapshot.games.map((entry) => [entry.roomCode, entry]));
  if (
    players.size !== snapshot.players.length ||
    rooms.size !== snapshot.rooms.length ||
    games.size !== snapshot.games.length ||
    new Set(snapshot.games.map((entry) => entry.id)).size !== snapshot.games.length ||
    new Set(snapshot.chat.map((entry) => entry.roomCode)).size !== snapshot.chat.length
  )
    return false;
  const memberships = new Map<string, string>();
  for (const entry of snapshot.rooms) {
    const occupants = seats.flatMap((seat) => entry.info.seats[seat].player?.id ?? []);
    if (new Set(occupants).size !== occupants.length) return false;
    for (const id of entry.memberIds) {
      if (
        !players.has(id) ||
        memberships.has(id) ||
        players.get(id)?.currentRoomCode !== entry.info.code
      )
        return false;
      memberships.set(id, entry.info.code);
    }
    if (
      entry.info.status === 'playing' &&
      (!games.has(entry.info.code) || games.get(entry.info.code)?.phase === 'scoring')
    )
      return false;
  }
  if (
    !snapshot.players.every(
      (entry) => (memberships.get(entry.info.id) ?? null) === entry.currentRoomCode,
    )
  )
    return false;
  for (const entry of snapshot.games) {
    const currentRoom = rooms.get(entry.roomCode);
    if (!currentRoom || !coherentGame(entry)) return false;
    if (entry.phase === 'scoring') {
      // The completed board is historical: seats and members may have changed already.
      if (currentRoom.info.status !== 'waiting') return false;
    } else if (
      currentRoom.info.status !== 'playing' ||
      !seats.every((seat) => currentRoom.info.seats[seat].player?.id === entry.players[seat].id)
    )
      return false;
  }
  return snapshot.chat.every((entry) => rooms.has(entry.roomCode));
}
