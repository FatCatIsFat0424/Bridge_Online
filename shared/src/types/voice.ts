export interface VoiceSettings {
  readonly muted: boolean;
  readonly deafened: boolean;
}

export interface VoiceParticipant extends VoiceSettings {
  readonly peerId: string;
  readonly accountId: string;
}

export interface VoiceRoomState {
  readonly roomCode: string;
  readonly participants: VoiceParticipant[];
}

export interface VoiceJoinResult {
  readonly success: boolean;
  readonly error?: string;
  readonly peerId?: string;
  readonly state?: VoiceRoomState;
}

export interface VoiceDescription {
  readonly type: 'offer' | 'answer';
  readonly sdp: string;
}

export interface VoiceCandidate {
  readonly candidate: string;
  readonly sdpMid: string | null;
  readonly sdpMLineIndex: number | null;
  readonly usernameFragment?: string | null;
}

export interface VoiceSignal {
  readonly targetPeerId: string;
  readonly description?: VoiceDescription;
  readonly candidate?: VoiceCandidate;
}

export interface VoiceIncomingSignal {
  readonly fromPeerId: string;
  readonly description?: VoiceDescription;
  readonly candidate?: VoiceCandidate;
}
