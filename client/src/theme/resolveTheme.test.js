import { describe, expect, it } from 'vitest';
import { PRESETS } from './presets';
import { answerMark, contrastRatio, mediaUrl, readableOn, resolveTheme, tileColors } from './resolveTheme';
import { FONTS } from './fonts';

describe('resolveTheme', () => {
  it('без настроек даёт базовую тему', () => {
    const theme = resolveTheme(null);
    expect(theme.preset.id).toBe('studio');
    expect(theme.texts.correctText).toBe('Верно');
  });

  it('настройки пака перекрывают основу, остальное берётся из неё', () => {
    const theme = resolveTheme({ preset: 'tundra', colors: { accent: '#112233' }, texts: { pointsLabel: 'Олени' } });
    expect(theme.colors.accent).toBe('#112233');
    expect(theme.colors.bg).toBe('#0F3446');
    expect(theme.pattern).toBe('ornament');
    expect(theme.texts.pointsLabel).toBe('Олени');
    expect(theme.texts.wrongText).toBe('Мимо');
  });

  it('неизвестное оформление заменяется базовым', () => {
    expect(resolveTheme({ preset: 'нет-такого' }).preset.id).toBe('studio');
  });

  it.each(PRESETS.map((preset) => [preset.id, preset]))('тема %s читается и использует известные шрифты', (_, preset) => {
    expect(contrastRatio(preset.colors.text, preset.colors.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(preset.colors.text, preset.colors.surface)).toBeGreaterThanOrEqual(4.5);
    const ids = FONTS.map((font) => font.id);
    expect(ids).toContain(preset.fonts.display);
    expect(ids).toContain(preset.fonts.body);
    for (const fill of preset.answers) {
      expect(contrastRatio(fill, readableOn(fill))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(PRESETS.map((preset) => [preset.id, preset]))('метка на плашке темы %s не сливается', (_, preset) => {
    const theme = resolveTheme({ preset: preset.id });
    preset.answers.forEach((fill, i) => {
      const colors = tileColors(theme, i);
      expect(contrastRatio(colors['--mark-bg'], fill)).toBeGreaterThanOrEqual(2.5);
      expect(contrastRatio(colors['--mark-fg'], colors['--mark-bg'])).toBeGreaterThanOrEqual(3);
    });
  });

  it('метки ответов', () => {
    expect(answerMark('letters', 5)).toBe('F');
    expect(answerMark('numbers', 5)).toBe('6');
    expect(answerMark('shapes', 0)).toBe('▲');
    expect(answerMark('none', 0)).toBeNull();
  });

  it('адрес картинки', () => {
    expect(mediaUrl('pack/logo.png')).toBe('/media/pack/logo.png');
    expect(mediaUrl('https://x.test/a.png')).toBe('https://x.test/a.png');
    expect(mediaUrl('')).toBeUndefined();
  });
});
