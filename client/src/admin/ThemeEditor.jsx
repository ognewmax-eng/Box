import { FONTS } from '../theme/fonts';
import { DEFAULT_TEXTS, PRESETS } from '../theme/presets';
import { contrastRatio, mediaUrl, readableOn, resolveTheme } from '../theme/resolveTheme';
import ThemePreview from './ThemePreview';

const COLOR_FIELDS = [
  { key: 'bg', label: 'Фон' },
  { key: 'text', label: 'Текст' },
  { key: 'accent', label: 'Кнопки' },
  { key: 'surface', label: 'Панели' },
  { key: 'ink', label: 'Тени и метки' },
];
const CHOICES = {
  radius: { label: 'Углы', items: [['sharp', 'Острые'], ['soft', 'Мягкие'], ['round', 'Круглые']] },
  tile: { label: 'Плашки ответов', items: [['raised', 'С тенью'], ['flat', 'Плоские'], ['outline', 'Контур']] },
  marks: { label: 'Метки ответов', items: [['letters', 'A B C'], ['numbers', '1 2 3'], ['shapes', '▲ ◆ ●'], ['none', 'Без меток']] },
  pattern: { label: 'Узор фона', items: [['none', 'Нет'], ['dots', 'Точки'], ['grid', 'Клетка'], ['ornament', 'Орнамент'], ['rays', 'Лучи'], ['stars', 'Звёзды'], ['pixels', 'Пиксели']] },
  ambient: { label: 'Движение в лобби и на финале', items: [['none', 'Нет'], ['snow', 'Снег'], ['stars', 'Мерцание']] },
};
const TEXT_FIELDS = [
  { key: 'lobbyHint', label: 'Подсказка в лобби' },
  { key: 'waitMessage', label: 'Сообщение игроку перед стартом' },
  { key: 'correctText', label: 'Верный ответ на телефоне' },
  { key: 'wrongText', label: 'Неверный ответ на телефоне' },
  { key: 'pointsLabel', label: 'Как называть очки' },
  { key: 'finalTitle', label: 'Заголовок финала' },
];
const OPTION_FIELDS = [
  { key: 'showAnswerCounts', label: 'Показывать, сколько игроков выбрали каждый вариант' },
  { key: 'showAnswererNames', label: 'Показывать имена ответивших' },
  { key: 'showLeaderboardOnPhones', label: 'Показывать очки и таблицу на телефонах' },
];

function Group({ title, children }) {
  return (
    <fieldset className="flex flex-col gap-3 border-t pt-4" style={{ borderColor: 'var(--t-line)' }}>
      <legend className="pr-2 text-lg font-bold">{title}</legend>
      {children}
    </fieldset>
  );
}

function ColorField({ label, value, onChange }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-11 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0" aria-label={label} />
      <span>{label}</span>
    </label>
  );
}

function Segmented({ label, items, value, onChange }) {
  return (
    <div>
      <p className="mb-1 text-sm font-bold">{label}</p>
      <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={label}>
        {items.map(([id, name]) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={value === id}
            onClick={() => onChange(id)}
            className="px-3 py-1.5 text-sm"
            style={{
              borderRadius: '0.4rem',
              background: value === id ? 'var(--t-text)' : 'var(--t-surface)',
              color: value === id ? 'var(--t-bg)' : 'var(--t-text)',
            }}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}

function ImageField({ label, value, onUpload, onClear }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-14 w-20 shrink-0 place-items-center overflow-hidden" style={{ background: 'var(--t-surface)', borderRadius: '0.4rem' }}>
        {value ? <img src={mediaUrl(value)} alt="" className="h-full w-full object-contain" /> : <span className="text-xs" style={{ color: 'var(--t-muted)' }}>Нет</span>}
      </div>
      <div className="flex flex-col items-start gap-1 text-sm">
        <span className="font-bold">{label}</span>
        <span className="flex gap-3">
          <label className="cursor-pointer underline underline-offset-2">
            Загрузить
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={onUpload} />
          </label>
          {value && <button type="button" onClick={onClear} className="underline underline-offset-2">Убрать</button>}
        </span>
      </div>
    </div>
  );
}

function PresetButton({ preset, active, onSelect }) {
  const { colors, answers } = preset;
  const font = FONTS.find((item) => item.id === preset.fonts.display);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className="flex flex-col gap-2 p-3 text-left"
      style={{
        background: colors.bg,
        color: colors.text,
        borderRadius: '0.5rem',
        outline: active ? '3px solid var(--t-accent)' : '1px solid var(--t-line)',
        outlineOffset: active ? 2 : 0,
      }}
    >
      <span className="text-base leading-tight" style={{ fontFamily: font?.family, fontWeight: font?.weight }}>{preset.name}</span>
      <span className="flex gap-1" aria-hidden="true">
        {answers.map((color) => <span key={color} className="h-4 w-4" style={{ background: color, borderRadius: 3 }} />)}
      </span>
      <span className="text-xs leading-snug opacity-85">{preset.hint}</span>
    </button>
  );
}

/** Предупреждает, если выбранные цвета будет трудно читать на проекторе и телефонах. */
function contrastProblems(colors) {
  const problems = [];
  if (contrastRatio(colors.text, colors.bg) < 4.5) problems.push('Текст плохо читается на фоне. Сделайте один из цветов светлее или темнее.');
  if (contrastRatio(colors.text, colors.surface) < 4.5) problems.push('Текст плохо читается на панелях.');
  if (contrastRatio(colors.accent, colors.bg) < 1.6) problems.push('Кнопки сливаются с фоном.');
  return problems;
}

export default function ThemeEditor({ theme, onChange, onUpload, title, firstQuestion }) {
  const config = theme ?? {};
  const resolved = resolveTheme(config);
  const set = (patch) => onChange({ ...config, ...patch });
  const setIn = (group, key, value) => set({ [group]: { ...config[group], [key]: value } });
  const problems = contrastProblems(resolved.colors);

  const selectPreset = (id) => {
    const { logo, backgroundImage, backgroundDim, texts, options } = config;
    onChange({
      preset: id,
      ...(logo ? { logo } : {}),
      ...(backgroundImage ? { backgroundImage } : {}),
      ...(backgroundDim != null ? { backgroundDim } : {}),
      ...(texts ? { texts } : {}),
      ...(options ? { options } : {}),
    });
  };

  const upload = (field) => (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) onUpload(file, (path) => set({ [field]: path }));
  };

  return (
    <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <div className="flex min-w-0 flex-col gap-6">
        <section aria-label="Готовые оформления">
          <h2 className="mb-1 text-lg font-bold">Готовое оформление</h2>
          <p className="mb-3 text-sm" style={{ color: 'var(--t-muted)' }}>Выберите основу и измените то, что нужно под вашу игру.</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PRESETS.map((preset) => (
              <PresetButton key={preset.id} preset={preset} active={resolved.preset.id === preset.id} onSelect={() => selectPreset(preset.id)} />
            ))}
          </div>
        </section>

        <Group title="Цвета">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {COLOR_FIELDS.map(({ key, label }) => (
              <ColorField key={key} label={label} value={resolved.colors[key]} onChange={(value) => setIn('colors', key, value)} />
            ))}
          </div>
          <p className="text-sm font-bold">Плашки ответов</p>
          <div className="flex flex-wrap gap-3">
            {resolved.answers.map((color, i) => (
              <ColorField
                key={i}
                label={`Вариант ${i + 1}`}
                value={color}
                onChange={(value) => set({ answers: resolved.answers.map((c, j) => (j === i ? value : c)) })}
              />
            ))}
          </div>
          {problems.map((problem) => (
            <p key={problem} role="alert" className="px-3 py-2 text-sm font-bold" style={{ background: 'var(--t-bad)', color: readableOn('#D93D42'), borderRadius: '0.4rem' }}>{problem}</p>
          ))}
        </Group>

        <Group title="Шрифты">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-bold">
              Заголовки и вопросы
              <select className="field mt-1 font-normal" value={resolved.fonts.display} onChange={(e) => setIn('fonts', 'display', e.target.value)}>
                {FONTS.map((font) => <option key={font.id} value={font.id}>{font.name}</option>)}
              </select>
            </label>
            <label className="text-sm font-bold">
              Обычный текст
              <select className="field mt-1 font-normal" value={resolved.fonts.body} onChange={(e) => setIn('fonts', 'body', e.target.value)}>
                {FONTS.map((font) => <option key={font.id} value={font.id}>{font.name}</option>)}
              </select>
            </label>
          </div>
        </Group>

        <Group title="Форма и узор">
          {Object.entries(CHOICES).map(([key, { label, items }]) => (
            <Segmented key={key} label={label} items={items} value={resolved[key]} onChange={(value) => set({ [key]: value })} />
          ))}
        </Group>

        <Group title="Логотип и фон">
          <ImageField label="Логотип вместо названия" value={config.logo} onUpload={upload('logo')} onClear={() => set({ logo: undefined })} />
          <ImageField label="Фоновая картинка" value={config.backgroundImage} onUpload={upload('backgroundImage')} onClear={() => set({ backgroundImage: undefined })} />
          {config.backgroundImage && (
            <label className="text-sm font-bold">
              Затемнение картинки цветом фона: {resolved.backgroundDim}%
              <input type="range" min="0" max="90" step="5" value={resolved.backgroundDim} onChange={(e) => set({ backgroundDim: Number(e.target.value) })} className="mt-1 block w-full" />
            </label>
          )}
        </Group>

        <Group title="Тексты">
          <div className="grid gap-3 sm:grid-cols-2">
            {TEXT_FIELDS.map(({ key, label }) => (
              <label key={key} className="text-sm font-bold">
                {label}
                <input
                  type="text"
                  maxLength={120}
                  value={config.texts?.[key] ?? ''}
                  placeholder={DEFAULT_TEXTS[key]}
                  onChange={(e) => setIn('texts', key, e.target.value)}
                  className="field mt-1 font-normal"
                />
              </label>
            ))}
          </div>
        </Group>

        <Group title="Что показывать в игре">
          {OPTION_FIELDS.map(({ key, label }) => (
            <label key={key} className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-0.5 h-4 w-4" checked={resolved.options[key]} onChange={(e) => setIn('options', key, e.target.checked)} />
              {label}
            </label>
          ))}
        </Group>
      </div>

      <aside className="min-w-0 xl:sticky xl:top-0" aria-label="Как это будет выглядеть">
        <ThemePreview theme={config} title={title} firstQuestion={firstQuestion} />
      </aside>
    </div>
  );
}
