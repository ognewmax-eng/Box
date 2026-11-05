/** Готовые оформления. Любое поле можно переопределить в настройках пака. */
export const PRESETS = [
  {
    id: 'studio',
    name: 'Студия',
    hint: 'Яркая телевикторина на каждый день',
    colors: { bg: '#2330D9', surface: '#1A24AE', text: '#FFF8E7', accent: '#FFC928', ink: '#0C1150' },
    answers: ['#FF5A47', '#FFC928', '#2ED9A3', '#FF8AD1'],
    fonts: { display: 'unbounded', body: 'onest' },
    radius: 'soft', tile: 'raised', marks: 'letters', pattern: 'none', ambient: 'none',
  },
  {
    id: 'tundra',
    name: 'Тундра',
    hint: 'Север, снег и орнамент',
    colors: { bg: '#0F3446', surface: '#174A5E', text: '#EEF7F4', accent: '#7BE8C0', ink: '#06202C' },
    answers: ['#7BE8C0', '#8FD3F4', '#E4573D', '#F2C14E'],
    fonts: { display: 'yeseva-one', body: 'golos-text' },
    radius: 'sharp', tile: 'flat', marks: 'shapes', pattern: 'ornament', ambient: 'snow',
  },
  {
    id: 'chalk',
    name: 'Школьная доска',
    hint: 'Для уроков и школьных праздников',
    colors: { bg: '#23423A', surface: '#2D5348', text: '#F3F1E6', accent: '#F7D56E', ink: '#12261F' },
    answers: ['#F7D56E', '#F29BA5', '#9AD7E8', '#B9E58C'],
    fonts: { display: 'neucha', body: 'neucha' },
    radius: 'soft', tile: 'outline', marks: 'numbers', pattern: 'grid', ambient: 'none',
  },
  {
    id: 'retro',
    name: 'Телевикторина 70-х',
    hint: 'Тёплое ретро с лучами из студии',
    colors: { bg: '#F3B61F', surface: '#E5A50F', text: '#2A1608', accent: '#C8321F', ink: '#2A1608' },
    answers: ['#C8321F', '#1F6F78', '#F7EBD3', '#2A1608'],
    fonts: { display: 'oswald', body: 'pt-serif' },
    radius: 'round', tile: 'raised', marks: 'letters', pattern: 'rays', ambient: 'none',
  },
  {
    id: 'clean',
    name: 'Чистый лист',
    hint: 'Спокойный вид для логотипа и цветов компании',
    colors: { bg: '#FFFFFF', surface: '#F1F3F6', text: '#15171C', accent: '#2F5BEA', ink: '#15171C' },
    answers: ['#2F5BEA', '#E8503A', '#14A37F', '#F0B429'],
    fonts: { display: 'golos-text', body: 'golos-text' },
    radius: 'soft', tile: 'flat', marks: 'letters', pattern: 'none', ambient: 'none',
  },
  {
    id: 'newyear',
    name: 'Новый год',
    hint: 'Золото и снег на красном',
    colors: { bg: '#8E1422', surface: '#74101C', text: '#FFF4E0', accent: '#F4C542', ink: '#3D0710' },
    answers: ['#F4C542', '#2A9D66', '#CFE8F3', '#FF8C69'],
    fonts: { display: 'playfair-display', body: 'golos-text' },
    radius: 'round', tile: 'flat', marks: 'letters', pattern: 'stars', ambient: 'snow',
  },
  {
    id: 'arcade',
    name: 'Аркада',
    hint: 'Пиксели и неон игрового автомата',
    colors: { bg: '#1A0B3D', surface: '#2A1560', text: '#F5F1FF', accent: '#39F2E0', ink: '#0A0420' },
    answers: ['#39F2E0', '#FF4FA3', '#FFE14D', '#7C7CFF'],
    fonts: { display: 'pixelify-sans', body: 'onest' },
    radius: 'sharp', tile: 'raised', marks: 'letters', pattern: 'pixels', ambient: 'stars',
  },
];

export const DEFAULT_PRESET = PRESETS[0];

export const DEFAULT_TEXTS = {
  lobbyHint: 'Наведите камеру на QR-код или откройте ссылку и введите код',
  waitMessage: 'Смотрите на большой экран: игра скоро начнётся',
  finalTitle: 'Игра окончена',
  pointsLabel: 'Очки',
  correctText: 'Верно',
  wrongText: 'Мимо',
};

export const DEFAULT_OPTIONS = {
  showAnswers: true,
  showAnswerCounts: true,
  showAnswererNames: true,
  showLeaderboardOnPhones: true,
};
