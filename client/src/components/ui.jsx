import { Check, X } from 'lucide-react';
import { useMemo } from 'react';
import { useTheme } from '../theme/ThemeStage';
import { answerMark, readableOn, tileColors } from '../theme/resolveTheme';

/** Название игры: логотип пака, его заголовок или фирменные кубики. */
export function Wordmark({ title, className = '', size = 'text-xl' }) {
  const theme = useTheme();
  if (theme.logo) {
    return <img src={theme.logo} alt={title || 'Логотип игры'} className={`h-[2.4em] w-auto object-contain ${size} ${className}`} />;
  }
  if (title) return <span className={`font-display-t ${size} ${className}`}>{title}</span>;
  return <BoxLetters text="BOX PARTY" className={`${size} ${className}`} />;
}

export function BoxLetters({ text, className = '' }) {
  const theme = useTheme();
  let letterIndex = -1;
  return (
    <span className={`inline-flex flex-wrap items-center gap-x-[0.5em] gap-y-[0.2em] font-display-t ${className}`} aria-label={text} role="img">
      {text.split(' ').map((word) => (
        <span key={word} className="inline-flex gap-[0.14em]" aria-hidden="true">
          {[...word].map((char, i) => {
            letterIndex += 1;
            const fill = theme.answers[letterIndex % 4];
            return (
              <span
                key={i}
                className="grid h-[1.65em] w-[1.5em] place-items-center leading-none"
                style={{ background: fill, color: readableOn(fill), borderRadius: 'calc(var(--t-radius) * 0.45)' }}
              >
                {char}
              </span>
            );
          })}
        </span>
      ))}
    </span>
  );
}

/** Код комнаты кубиками: главный опознавательный знак лобби. */
export function CodeBoxes({ code, length = 4, className = '', boxClass = '', decorative = false }) {
  const theme = useTheme();
  const chars = Array.from({ length }, (_, i) => code?.[i] ?? '');
  return (
    <div className={`flex gap-[0.2em] ${className}`} {...(decorative ? { 'aria-hidden': true } : { 'aria-label': `Код комнаты ${code}`, role: 'img' })}>
      {chars.map((char, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`font-display-t grid aspect-square w-[1.45em] place-items-center leading-none ${boxClass}`}
          style={char ? {
            background: theme.answers[i % 4],
            color: readableOn(theme.answers[i % 4]),
            borderRadius: 'calc(var(--t-radius) * 0.5)',
            boxShadow: 'var(--t-shadow)',
          } : {
            boxShadow: 'inset 0 0 0 0.05em var(--t-line)',
            borderRadius: 'calc(var(--t-radius) * 0.5)',
          }}
        >
          {char}
        </span>
      ))}
    </div>
  );
}

function tileState({ index, reveal, correctIndex, selected }) {
  if (reveal) return index === correctIndex ? 'correct' : 'wrong';
  if (selected == null) return undefined;
  return selected === index ? 'picked' : 'dim';
}

/** Плашка ответа: одна и та же на большом экране и на телефоне. */
export function AnswerTile({ index, text, reveal, correctIndex, selected, count, onClick, disabled, className = '' }) {
  const theme = useTheme();
  const mark = answerMark(theme.marks, index);
  const Tag = onClick ? 'button' : 'div';
  const isCorrect = reveal && index === correctIndex;
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      disabled={onClick ? disabled : undefined}
      data-state={tileState({ index, reveal, correctIndex, selected })}
      style={tileColors(theme, index)}
      className={`tile flex min-h-0 w-full items-center gap-[0.6em] p-[0.55em] text-left ${className}`}
    >
      {mark && (
        <span className="tile-mark font-display-t grid aspect-square h-[1.9em] shrink-0 place-items-center leading-none">{mark}</span>
      )}
      <span lang="ru" className="min-w-0 flex-1 font-bold leading-[1.15] [hyphens:auto] [overflow-wrap:break-word]">{text}</span>
      {reveal && count != null && <span className="font-display-t shrink-0 tabular-nums">{count}</span>}
      {isCorrect && <Check className="h-[1.4em] w-[1.4em] shrink-0" strokeWidth={3.5} aria-label="Правильный ответ" />}
    </Tag>
  );
}

export function QuestionMedia({ question, className = '' }) {
  if (!question?.image && !question?.video && !question?.audio) return null;
  return (
    <div className={`flex min-h-0 flex-col gap-2 ${className}`}>
      {question.image && <img src={question.image} alt="" className="min-h-0 w-full flex-1 object-contain" style={{ borderRadius: 'var(--t-radius)' }} />}
      {question.video && <video src={question.video} controls className="min-h-0 w-full flex-1 bg-black" style={{ borderRadius: 'var(--t-radius)' }} />}
      {question.audio && <audio src={question.audio} controls className="w-full" />}
    </div>
  );
}

/** Таблица лидеров; строка `highlight` выделена, чтобы игрок сразу видел себя. */
export function ScoreList({ entries, highlight, className = '', rowClass = '' }) {
  const max = Math.max(1, ...entries.map((entry) => entry.score));
  return (
    <ol className={`flex min-h-0 flex-col gap-[0.35em] ${className}`}>
      {entries.map((entry, i) => (
        <li
          key={entry.nickname}
          className={`relative flex items-center gap-[0.7em] overflow-hidden px-[0.8em] py-[0.42em] ${rowClass}`}
          style={{
            background: 'var(--t-surface)',
            borderRadius: 'calc(var(--t-radius) * 0.7)',
            outline: entry.nickname === highlight ? '0.14em solid var(--t-accent)' : undefined,
          }}
        >
          <span aria-hidden="true" className="absolute inset-y-0 left-0" style={{ width: `${(entry.score / max) * 100}%`, background: 'var(--t-line)', opacity: 0.55 }} />
          <span className="relative w-[1.5em] shrink-0 tabular-nums opacity-70">{i + 1}</span>
          <span className="relative min-w-0 flex-1 truncate font-bold">{entry.nickname}</span>
          <span className="font-display-t relative tabular-nums">{entry.score}</span>
        </li>
      ))}
    </ol>
  );
}

export function Confetti() {
  const theme = useTheme();
  const pieces = useMemo(() => Array.from({ length: 56 }, (_, i) => ({
    left: `${(i * 29) % 100}%`,
    delay: `${(i % 14) * 0.09}s`,
    dx: `${((i * 17) % 18) - 9}cqw`,
    spin: `${360 + (i * 47) % 720}deg`,
    color: theme.answers[i % 4],
  })), [theme.answers]);
  return (
    <div className="ambient" aria-hidden="true">
      {pieces.map((piece, i) => (
        <span
          key={i}
          className="confetti"
          style={{ left: piece.left, background: piece.color, animationDelay: piece.delay, '--dx': piece.dx, '--spin': piece.spin }}
        />
      ))}
    </div>
  );
}

export function Banner({ children, className = '' }) {
  return (
    <div
      className={`px-4 py-2 text-center font-bold ${className}`}
      style={{ background: 'var(--t-accent)', color: 'var(--t-on-accent)', borderRadius: 'calc(var(--t-radius) * 0.6)' }}
      role="status"
    >
      {children}
    </div>
  );
}

export function ConnectionLost({ detail, hint, onRetry }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <X className="h-10 w-10" strokeWidth={3} aria-hidden="true" />
      <h1 className="font-display-t text-2xl">Нет связи с сервером</h1>
      <p className="max-w-md" style={{ color: 'var(--t-muted)' }}>Переподключаемся автоматически. {hint}</p>
      {detail && <p className="max-w-md text-sm" style={{ color: 'var(--t-muted)' }}>{detail.message}</p>}
      <button type="button" onClick={onRetry} className="btn btn-quiet">Повторить</button>
    </div>
  );
}

/** Сетка плашек: колонки зависят от числа вариантов, чтобы плашки оставались крупными. */
export function answerGridClass(count) {
  if (count <= 4) return 'grid-cols-2';
  if (count <= 6) return 'grid-cols-3';
  return 'grid-cols-5';
}

export function questionSizeClass(text = '') {
  if (text.length > 140) return 'tv-md';
  if (text.length > 70) return 'tv-lg';
  return 'tv-xl';
}
