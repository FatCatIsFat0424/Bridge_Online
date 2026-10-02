const english = {
  'theme.label': 'Theme',
  'theme.dashboard': 'Modern',
  'theme.felt': 'Classic',
  'theme.paper': 'Paper',
} as const;

export type UiTranslationKey = keyof typeof english;

export const uiTranslations: Record<'en' | 'zh-TW', Record<UiTranslationKey, string>> = {
  en: english,
  'zh-TW': {
    'theme.label': '主題',
    'theme.dashboard': '現代',
    'theme.felt': '經典',
    'theme.paper': '紙感',
  },
};
