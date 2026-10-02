const english = {
  'theme.label': 'Theme',
  'theme.dashboard': 'Modern',
  'theme.felt': 'Classic',
  'theme.paper': 'Paper',
  'topbar.menu': 'Menu',
  'topbar.music': 'Background music',
  'topbar.voice': 'Table voice',
  'topbar.signOut': 'Sign out',
  'topbar.room': 'Room code',
  'topbar.contract': 'Contract',
  'topbar.tricks': 'Tricks won',
} as const;

export type UiTranslationKey = keyof typeof english;

export const uiTranslations: Record<'en' | 'zh-TW', Record<UiTranslationKey, string>> = {
  en: english,
  'zh-TW': {
    'theme.label': '主題',
    'theme.dashboard': '現代',
    'theme.felt': '經典',
    'theme.paper': '紙感',
    'topbar.menu': '選單',
    'topbar.music': '背景音樂',
    'topbar.voice': '牌桌語音',
    'topbar.signOut': '登出',
    'topbar.room': '房間代碼',
    'topbar.contract': '合約',
    'topbar.tricks': '贏得墩數',
  },
};
