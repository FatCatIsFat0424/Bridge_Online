import type { AccountProfile } from './account';

/** Account details visible to other signed-in players. */
export type PublicAccount = Pick<
  AccountProfile,
  'id' | 'username' | 'nickname' | 'color' | 'avatar' | 'avatarImage'
>;

export interface FriendRequest {
  readonly id: string;
  readonly requester: PublicAccount;
  readonly recipient: PublicAccount;
  readonly createdAt: number;
}

/** A friend plus live presence, computed per request and never persisted. */
export type FriendEntry = PublicAccount & {
  readonly online: boolean;
  readonly inRoom: boolean;
};

export interface FriendsData {
  readonly friends: FriendEntry[];
  readonly incoming: FriendRequest[];
  readonly outgoing: FriendRequest[];
}

export type FriendsResponse =
  | ({ readonly success: true } & FriendsData)
  | { readonly success: false; readonly error: string };

export type CreateFriendRequestResponse =
  | { readonly success: true; readonly request: FriendRequest }
  | { readonly success: false; readonly error: string };
