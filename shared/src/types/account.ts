export type AvatarPreset = 'cat' | 'fox' | 'owl' | 'bear' | 'rabbit' | 'panda';
export type AvatarId = AvatarPreset;
/** Uploaded image: 64 lowercase hex sha256 + `.png|.jpg|.gif|.webp`. */
export type MediaId = string;

/** Public account data. Passwords and session tokens never cross this boundary. */
export interface AccountProfile {
  readonly id: string;
  readonly username: string;
  readonly nickname: string;
  readonly color: string;
  readonly avatar: AvatarPreset;
  readonly avatarImage: MediaId | null;
  readonly tableBackground: MediaId | null;
  readonly matchesPublic: boolean;
  readonly createdAt: number;
  readonly updatedAt: number;
}
