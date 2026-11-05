import { Plus, Trash2 } from 'lucide-react';

export const MAX_ROUNDS = 10;
export const MAX_QUESTIONS_PER_ROUND = 10;
const MAX_OPTIONS = 10;
const LETTERS = 'ABCDEFGHIJ';
const MEDIA_TYPES = [
  { key: 'image', label: 'Фото', accept: 'image/*' },
  { key: 'video', label: 'Видео', accept: 'video/*' },
  { key: 'audio', label: 'Звук', accept: 'audio/*' },
];

export const emptyQuestion = (type = 'choice') => ({
  type,
  question: '',
  options: ['', '', '', ''],
  correctIndex: 0,
  correctAnswer: '',
  image: '',
  video: '',
  audio: '',
});

export const emptyRound = () => ({ timerStart: 'auto', roundTitle: '', questions: [emptyQuestion()] });

function QuestionCard({ question, number, onChange, onRemove, onUploadMedia, radioName }) {
  const options = question.options ?? ['', '', '', ''];
  const setOption = (i, value) => onChange({ options: options.map((option, j) => (j === i ? value : option)) });
  const removeOption = (i) => {
    const correctIndex = question.correctIndex === i ? 0 : question.correctIndex > i ? question.correctIndex - 1 : question.correctIndex;
    onChange({ options: options.filter((_, j) => j !== i), correctIndex });
  };
  const hasMedia = question.image || question.video || question.audio;

  return (
    <article className="flex flex-col gap-3 p-4" style={{ background: 'var(--t-surface)', borderRadius: '0.5rem' }}>
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-bold">Вопрос {number}</h4>
        <div className="flex items-center gap-2">
          <select
            value={question.type}
            onChange={(e) => onChange({ type: e.target.value })}
            aria-label={`Тип вопроса ${number}`}
            className="field w-auto py-1 text-sm"
          >
            <option value="choice">Выбор варианта</option>
            <option value="open">Свой ответ</option>
          </select>
          <button type="button" onClick={onRemove} aria-label={`Удалить вопрос ${number}`} className="p-1"><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>

      <textarea
        value={question.question}
        onChange={(e) => onChange({ question: e.target.value })}
        placeholder="Текст вопроса"
        aria-label={`Текст вопроса ${number}`}
        rows={2}
        className="field"
      />

      {question.type === 'open' ? (
        <label className="text-sm font-bold">
          Правильный ответ
          <input
            type="text"
            value={question.correctAnswer ?? ''}
            onChange={(e) => onChange({ correctAnswer: e.target.value })}
            className="field mt-1 font-normal"
          />
          <span className="mt-1 block font-normal" style={{ color: 'var(--t-muted)' }}>Регистр, ё и е, знаки препинания и лишние пробелы не важны.</span>
        </label>
      ) : (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1 text-sm font-bold">Варианты: отметьте правильный</legend>
          {options.map((option, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="radio"
                name={radioName}
                checked={(question.correctIndex ?? 0) === i}
                onChange={() => onChange({ correctIndex: i })}
                aria-label={`Вариант ${LETTERS[i]} правильный`}
                className="h-4 w-4 shrink-0"
              />
              <span className="w-4 text-sm font-bold">{LETTERS[i]}</span>
              <input
                type="text"
                value={option}
                onChange={(e) => setOption(i, e.target.value)}
                aria-label={`Вариант ${LETTERS[i]}`}
                className="field py-1.5"
              />
              {options.length > 2 && (
                <button type="button" onClick={() => removeOption(i)} aria-label={`Удалить вариант ${LETTERS[i]}`} className="p-1"><Trash2 className="h-4 w-4" /></button>
              )}
            </div>
          ))}
          {options.length < MAX_OPTIONS && (
            <button type="button" onClick={() => onChange({ options: [...options, ''] })} className="mt-1 inline-flex items-center gap-1 self-start text-sm font-bold">
              <Plus className="h-4 w-4" />Добавить вариант
            </button>
          )}
        </fieldset>
      )}

      <details open={Boolean(hasMedia)}>
        <summary className="cursor-pointer text-sm font-bold">Фото, видео или звук к вопросу</summary>
        <div className="mt-2 flex flex-col gap-2">
          {MEDIA_TYPES.map(({ key, label, accept }) => (
            <div key={key} className="flex items-center gap-2 text-sm">
              <span className="w-12 shrink-0">{label}</span>
              <input
                type="text"
                value={question[key] ?? ''}
                onChange={(e) => onChange({ [key]: e.target.value })}
                placeholder="Ссылка или загруженный файл"
                aria-label={`${label} к вопросу ${number}`}
                className="field py-1.5"
              />
              <label className="shrink-0 cursor-pointer font-bold underline underline-offset-2">
                Загрузить
                <input type="file" accept={accept} className="sr-only" onChange={(e) => onUploadMedia(key, e)} />
              </label>
            </div>
          ))}
        </div>
      </details>
    </article>
  );
}

export default function QuestionsEditor({ form, setForm, onUpload, answerTimes }) {
  const updateRound = (ri, patch) => setForm((f) => ({
    ...f,
    rounds: f.rounds.map((round, i) => (i === ri ? { ...round, ...patch } : round)),
  }));
  const updateQuestion = (ri, qi, patch) => setForm((f) => ({
    ...f,
    rounds: f.rounds.map((round, i) => (i !== ri ? round : {
      ...round,
      questions: round.questions.map((q, j) => (j === qi ? { ...q, ...patch } : q)),
    })),
  }));
  const uploadMedia = (ri, qi, field, event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) onUpload(file, (path) => updateQuestion(ri, qi, { [field]: path }));
  };

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <label className="block w-fit text-sm font-bold">
        Время на ответ
        <select
          className="field mt-1 font-normal"
          value={form.answerTimeSec}
          onChange={(e) => setForm((f) => ({ ...f, answerTimeSec: Number(e.target.value) }))}
        >
          {answerTimes.map((n) => <option key={n} value={n}>{n} секунд</option>)}
        </select>
      </label>

      {form.rounds.map((round, ri) => (
        <section key={ri} aria-label={`Раунд ${ri + 1}`} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="min-w-[14rem] flex-1 text-sm font-bold">
              Раунд {ri + 1}
              <input
                type="text"
                value={round.roundTitle ?? ''}
                onChange={(e) => updateRound(ri, { roundTitle: e.target.value })}
                placeholder="Название, например: Животный мир"
                className="field mt-1 font-normal"
              />
            </label>
            <label className="text-sm font-bold">
              Таймер
              <select
                className="field mt-1 font-normal"
                value={round.timerStart ?? 'auto'}
                onChange={(e) => updateRound(ri, { timerStart: e.target.value })}
              >
                <option value="auto">Сразу с вопросом</option>
                <option value="manual">По кнопке ведущего</option>
              </select>
            </label>
            {form.rounds.length > 1 && (
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, rounds: f.rounds.filter((_, i) => i !== ri) }))}
                className="pb-3 text-sm underline underline-offset-2"
              >
                Удалить раунд
              </button>
            )}
          </div>
          {round.questions.map((question, qi) => (
            <QuestionCard
              key={qi}
              question={question}
              number={qi + 1}
              radioName={`correct-${ri}-${qi}`}
              onChange={(patch) => updateQuestion(ri, qi, patch)}
              onRemove={() => updateRound(ri, { questions: round.questions.filter((_, j) => j !== qi) })}
              onUploadMedia={(field, event) => uploadMedia(ri, qi, field, event)}
            />
          ))}
          {round.questions.length < MAX_QUESTIONS_PER_ROUND && (
            <button
              type="button"
              onClick={() => updateRound(ri, { questions: [...round.questions, emptyQuestion()] })}
              className="btn btn-quiet self-start text-sm"
            >
              <Plus className="h-4 w-4" />Добавить вопрос
            </button>
          )}
        </section>
      ))}

      {form.rounds.length < MAX_ROUNDS && (
        <button
          type="button"
          onClick={() => setForm((f) => ({ ...f, rounds: [...f.rounds, emptyRound()] }))}
          className="btn btn-quiet self-start"
        >
          <Plus className="h-4 w-4" />Добавить раунд
        </button>
      )}
    </div>
  );
}
