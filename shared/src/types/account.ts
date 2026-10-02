export type AvatarPreset = 'cat' | 'fox' | 'owl' | 'bear' | 'rabbit' | 'panda';
export type AvatarId = AvatarPreset;

/** Public account data. Passwords and session tokens never cross this boundary. */
export interface AccountProfile {
  readonly id: string;
  readonly username: string;
  readonly nickname: string;
  readonly color: string;
  readonly avatar: AvatarPreset;
  readonly createdAt: number;
  readonly updatedAt: number;
}
