// ─── Types 統一匯出 ───

export type {
  PlayerId,
  Seat,
  PlayerColor,
  PlayerInfo,
  ConnectionStatus,
} from './player';

export type {
  RoomCode,
  GameType,
  RoomStatus,
  SeatInfo,
  SeatMap,
  RoomInfo,
} from './room';

export type {
  Suit,
  BidSuit,
  Rank,
  Card,
  BidLevel,
  BidAction,
  Contract,
  GamePhase,
  TrickRecord,
  GameLogEntry,
  GameResult,
  Team,
  PlayingState,
  BiddingState,
  GameState,
  PlayerVisibleGameState,
} from './game';

export type { ChatMessage } from './chat';
export type { EmojiRecord } from './emoji';
export type { AccountProfile, AvatarPreset, AvatarId, MediaId } from './account';

export type {
  ClientToServerEvents,
  ServerToClientEvents,
  PlayerSnapshot,
} from './socket-events';

export type { MatchSummary } from './game';
export type {
  PublicAccount, FriendRequest, FriendsData, FriendsResponse, CreateFriendRequestResponse,
  MatchHistory,
} from './social';

export type {
  VoiceSettings, VoiceParticipant, VoiceRoomState, VoiceJoinResult,
  VoiceDescription, VoiceCandidate, VoiceSignal, VoiceIncomingSignal,
} from './voice';
