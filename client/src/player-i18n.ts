const english = {
  'player.myProfile': 'My profile',
  'player.title': 'Player profile',
  'player.view': 'View {nickname}’s profile',
  'player.viewOwn': 'View my public profile',
  'player.edit': 'Edit profile',
  'player.self': 'This is your public player profile.',
  'player.notFound': 'This player could not be found.',
  'player.friends': 'You are friends',
  'player.incoming': 'This player sent you a friend request.',
  'player.outgoing': 'Your friend request is waiting for a reply.',
  'player.connect': 'Add this player to your friends to find them again.',
  'player.updated': 'Friendship updated.',
  'player.manageFriends': 'Manage friends',
} as const;

export type PlayerTranslationKey = keyof typeof english;

export const playerTranslations: Record<'en' | 'zh-TW', Record<PlayerTranslationKey, string>> = {
  en: english,
  'zh-TW': {
    'player.myProfile': '我的個人頁面',
    'player.title': '玩家個人頁面',
    'player.view': '查看 {nickname} 的個人頁面',
    'player.viewOwn': '查看我的公開個人頁面',
    'player.edit': '編輯個人資料',
    'player.self': '這是你的公開玩家個人頁面。',
    'player.notFound': '找不到這位玩家。',
    'player.friends': '你們已經是好友',
    'player.incoming': '這位玩家已傳送好友邀請給你。',
    'player.outgoing': '你的好友邀請正在等待回覆。',
    'player.connect': '將這位玩家加入好友，方便下次一起遊玩。',
    'player.updated': '好友關係已更新。',
    'player.manageFriends': '管理好友',
  },
};
