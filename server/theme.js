const HEX = /^#[0-9a-fA-F]{6}$/;
const SLUG = /^[a-z0-9-]{1,40}$/;
const MEDIA_PATH = /^(https?:\/\/[^\s"'()<>]+|[\w-][\w\-./]*)$/;

const ENUMS = {
  radius: ['sharp', 'soft', 'round'],
  tile: ['raised', 'flat', 'outline'],
  marks: ['letters', 'numbers', 'shapes', 'none'],
  pattern: ['none', 'dots', 'grid', 'ornament', 'rays', 'stars', 'pixels'],
  ambient: ['none', 'snow', 'stars'],
};
const COLOR_KEYS = ['bg', 'surface', 'text', 'accent', 'ink'];
const TEXT_KEYS = ['lobbyHint', 'waitMessage', 'finalTitle', 'pointsLabel', 'correctText', 'wrongText'];
const OPTION_KEYS = ['showAnswerCounts', 'showAnswererNames', 'showLeaderboardOnPhones'];

function pickHexColors(source) {
  const colors = {};
  for (const key of COLOR_KEYS) {
    if (HEX.test(source?.[key] ?? '')) colors[key] = source[key];
  }
  return colors;
}

function safeMedia(value) {
  if (typeof value !== 'string') return undefined;
  const s = value.trim();
  return s.length <= 2000 && MEDIA_PATH.test(s) && !s.includes('..') ? s : undefined;
}

/**
 * Оставляет в теме только известные поля с допустимыми значениями: тема попадает
 * в стили на телефонах всех игроков, поэтому посторонним строкам там не место.
 * Возвращает undefined, если настроек нет.
 */
export function sanitizeTheme(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const theme = {};

  if (SLUG.test(raw.preset ?? '')) theme.preset = raw.preset;

  const colors = pickHexColors(raw.colors);
  if (Object.keys(colors).length) theme.colors = colors;

  if (Array.isArray(raw.answers)) {
    const answers = raw.answers.filter((c) => HEX.test(c ?? '')).slice(0, 4);
    if (answers.length === 4) theme.answers = answers;
  }

  const fonts = {};
  if (SLUG.test(raw.fonts?.display ?? '')) fonts.display = raw.fonts.display;
  if (SLUG.test(raw.fonts?.body ?? '')) fonts.body = raw.fonts.body;
  if (Object.keys(fonts).length) theme.fonts = fonts;

  for (const [key, allowed] of Object.entries(ENUMS)) {
    if (allowed.includes(raw[key])) theme[key] = raw[key];
  }

  const backgroundImage = safeMedia(raw.backgroundImage);
  if (backgroundImage) theme.backgroundImage = backgroundImage;
  const logo = safeMedia(raw.logo);
  if (logo) theme.logo = logo;
  if (Number.isFinite(raw.backgroundDim)) {
    theme.backgroundDim = Math.min(90, Math.max(0, Math.round(raw.backgroundDim)));
  }

  const texts = {};
  for (const key of TEXT_KEYS) {
    const value = typeof raw.texts?.[key] === 'string' ? raw.texts[key].trim().slice(0, 120) : '';
    if (value) texts[key] = value;
  }
  if (Object.keys(texts).length) theme.texts = texts;

  const options = {};
  for (const key of OPTION_KEYS) {
    if (typeof raw.options?.[key] === 'boolean') options[key] = raw.options[key];
  }
  if (Object.keys(options).length) theme.options = options;

  return Object.keys(theme).length ? theme : undefined;
}
