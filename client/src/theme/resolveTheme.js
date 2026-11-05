import { fontById } from './fonts';
import { DEFAULT_OPTIONS, DEFAULT_PRESET, DEFAULT_TEXTS, PRESETS } from './presets';

const RADIUS = { sharp: '0px', soft: '0.6em', round: '1.5em' };
const GOOD = '#17A862';
const BAD = '#D93D42';

function toRgb(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

function luminance(hex) {
  const [r, g, b] = toRgb(hex).map((value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export function mix(a, b, weightOfA) {
  const [ra, rb] = [toRgb(a), toRgb(b)];
  const channels = ra.map((value, i) => Math.round(value * weightOfA + rb[i] * (1 - weightOfA)));
  return `#${channels.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

/** Цвет текста поверх заливки: тема может быть любой, а читаться должно всегда. */
export function readableOn(color, dark = '#10121A', light = '#FFFFFF') {
  return contrastRatio(color, dark) >= contrastRatio(color, light) ? dark : light;
}

export function mediaUrl(value) {
  if (!value) return undefined;
  if (/^https?:\/\//.test(value) || value.startsWith('/media/')) return value;
  return `/media/${value.replace(/^\/+/, '')}`;
}

export function presetById(id) {
  return PRESETS.find((preset) => preset.id === id) ?? DEFAULT_PRESET;
}

export function resolveTheme(config) {
  const preset = presetById(config?.preset);
  const colors = { ...preset.colors, ...config?.colors };
  const answers = config?.answers ?? preset.answers;
  const fonts = { ...preset.fonts, ...config?.fonts };
  const display = fontById(fonts.display);
  const body = fontById(fonts.body);
  const radius = config?.radius ?? preset.radius;
  const tile = config?.tile ?? preset.tile;

  const vars = {
    '--t-bg': colors.bg,
    '--t-surface': colors.surface,
    '--t-text': colors.text,
    '--t-muted': mix(colors.text, colors.bg, 0.72),
    '--t-accent': colors.accent,
    '--t-on-accent': readableOn(colors.accent),
    '--t-ink': colors.ink,
    '--t-drain': mix(colors.text, colors.bg, 0.13),
    '--t-line': mix(colors.text, colors.bg, 0.25),
    '--t-good': GOOD,
    '--t-on-good': readableOn(GOOD),
    '--t-bad': BAD,
    '--t-on-bad': readableOn(BAD),
    '--t-radius': RADIUS[radius] ?? RADIUS.soft,
    '--t-font-display': `${display.family}, system-ui, sans-serif`,
    '--t-font-body': `${body.family}, system-ui, sans-serif`,
    '--t-display-weight': display.weight,
    '--t-shadow': tile === 'raised' ? `0.28em 0.28em 0 ${colors.ink}` : 'none',
  };

  return {
    preset,
    colors,
    answers,
    fonts,
    vars,
    radius,
    tile,
    marks: config?.marks ?? preset.marks,
    pattern: config?.pattern ?? preset.pattern,
    ambient: config?.ambient ?? preset.ambient,
    backgroundImage: mediaUrl(config?.backgroundImage),
    backgroundDim: config?.backgroundDim ?? 55,
    logo: mediaUrl(config?.logo),
    texts: { ...DEFAULT_TEXTS, ...config?.texts },
    options: { ...DEFAULT_OPTIONS, ...config?.options },
  };
}

export function tileColors(theme, index) {
  const fill = theme.answers[index % theme.answers.length];
  // Метка не должна сливаться с плашкой, даже если цвет плашки совпал с тёмным цветом темы
  const markBg = readableOn(fill, theme.colors.ink, '#FFFFFF');
  return { '--tile': fill, '--on-tile': readableOn(fill), '--mark-bg': markBg, '--mark-fg': readableOn(markBg) === '#FFFFFF' && contrastRatio(fill, markBg) >= 3 ? fill : readableOn(markBg) };
}

const SHAPES = ['▲', '◆', '●', '■', '★', '⬟', '✚', '⬢', '▼', '◐'];
const LETTERS = 'ABCDEFGHIJ';

export function answerMark(marks, index) {
  if (marks === 'none') return null;
  if (marks === 'numbers') return String(index + 1);
  if (marks === 'shapes') return SHAPES[index % SHAPES.length];
  return LETTERS[index] ?? String(index + 1);
}
