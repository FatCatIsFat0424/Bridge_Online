export const MUSIC_GENRES = {
  chill: { 'zh-TW': '輕鬆小品', en: 'Easy listening' },
  jazz: { 'zh-TW': '爵士', en: 'Jazz' },
  piano: { 'zh-TW': '鋼琴', en: 'Piano' },
  electronic: { 'zh-TW': '電子流行', en: 'Electronic pop' },
  chiptune: { 'zh-TW': '8-bit 電玩', en: '8-bit / Chiptune' },
  cinematic: { 'zh-TW': '電影氛圍', en: 'Cinematic' },
  lofi: { 'zh-TW': 'Lo-fi', en: 'Lo-fi' },
  punk: { 'zh-TW': 'Punk 龐克', en: 'Punk' },
  'kawaii-edm': { 'zh-TW': 'Kawaii EDM', en: 'Kawaii EDM' },
  ambient: { 'zh-TW': 'Ambient 氛圍', en: 'Ambient' },
  celtic: { 'zh-TW': 'Celtic 凱爾特', en: 'Celtic' },
  japanese: { 'zh-TW': '和風', en: 'Japanese-inspired' },
  house: { 'zh-TW': 'House 浩室', en: 'House' },
} as const;

export const MUSIC_ENERGIES = {
  calm: { 'zh-TW': '舒緩', en: 'Calm' },
  steady: { 'zh-TW': '輕快', en: 'Steady' },
  energetic: { 'zh-TW': '活力', en: 'Energetic' },
} as const;

export type MusicGenre = keyof typeof MUSIC_GENRES;
export type MusicEnergy = keyof typeof MUSIC_ENERGIES;
