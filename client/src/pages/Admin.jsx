import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import ThemeStage from '../theme/ThemeStage';
import QuestionsEditor, { emptyQuestion, emptyRound } from '../admin/QuestionsEditor';
import ThemeEditor from '../admin/ThemeEditor';

const PASSWORD_KEY = 'box.adminPassword';
const ANSWER_TIMES = [10, 15, 20, 25, 30, 40, 50, 60];
// Админка всегда в спокойном оформлении: цвета игры видны только в превью
const TOOL_THEME = { preset: 'clean' };

const normalizePackId = (id) => id.trim().toLowerCase().replace(/\s+/g, '-');

const newForm = () => ({
  id: `game-${Date.now().toString(36)}`,
  title: '',
  answerTimeSec: 15,
  theme: null,
  rounds: [emptyRound()],
});

function toFormQuestion(q) {
  return {
    ...emptyQuestion(q.type === 'open' ? 'open' : 'choice'),
    question: q.question ?? '',
    options: q.options?.length ? q.options.slice(0, 10) : ['', '', '', ''],
    correctIndex: q.correctIndex ?? 0,
    correctAnswer: q.correctAnswer ?? '',
    image: q.image ?? '',
    video: q.video ?? '',
    audio: q.audio ?? '',
  };
}

function packToForm(data) {
  const source = data.rounds?.length ? data.rounds : [{ timerStart: 'auto', questions: data.questions ?? [] }];
  const rounds = source.map((round) => ({
    timerStart: round.timerStart === 'manual' || round.timerStart === 'on_host' ? 'manual' : 'auto',
    roundTitle: round.roundTitle ?? '',
    questions: (round.questions ?? []).map(toFormQuestion),
  }));
  return {
    id: data.id,
    title: data.title ?? '',
    answerTimeSec: Math.min(60, Math.max(10, Number(data.answerTimeSec) || 15)),
    theme: data.theme ?? null,
    rounds: rounds.length ? rounds : [emptyRound()],
  };
}

function LoginForm({ message, onSubmit }) {
  const [value, setValue] = useState('');
  return (
    <form
      className="mx-auto flex h-full max-w-sm flex-col justify-center gap-4 p-6"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(value);
      }}
    >
      <h1 className="font-display-t text-2xl">Настройка игр</h1>
      <label className="font-bold">
        Пароль
        <input type="password" autoFocus value={value} onChange={(e) => setValue(e.target.value)} className="field mt-1 font-normal" />
      </label>
      <p className="text-sm" style={{ color: 'var(--t-muted)' }}>Он показан в окне сервера при запуске и хранится в файле .admin-password.</p>
      {message && <p role="alert" className="font-bold" style={{ color: 'var(--t-bad)' }}>{message}</p>}
      <button type="submit" disabled={!value} className="btn w-full">Войти</button>
    </form>
  );
}

export default function Admin() {
  const [password, setPassword] = useState(() => sessionStorage.getItem(PASSWORD_KEY) || '');
  const [authorized, setAuthorized] = useState(false);
  const [packs, setPacks] = useState([]);
  const [form, setForm] = useState(newForm);
  const [isExisting, setIsExisting] = useState(false);
  const [tab, setTab] = useState('questions');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const logout = useCallback((reason) => {
    sessionStorage.removeItem(PASSWORD_KEY);
    setPassword('');
    setAuthorized(false);
    setMessage(reason);
  }, []);

  const adminFetch = useCallback(async (url, options = {}) => {
    const res = await fetch(url, { ...options, headers: { ...options.headers, 'X-Admin-Password': password } });
    if (res.status === 401) {
      logout('Неверный пароль');
      throw new Error('Неверный пароль');
    }
    return res;
  }, [password, logout]);

  useEffect(() => {
    if (!password) return;
    adminFetch('/api/admin/check')
      .then((res) => {
        if (res.status === 429) return logout('Слишком много попыток, подождите минуту');
        if (!res.ok) throw new Error();
        sessionStorage.setItem(PASSWORD_KEY, password);
        setAuthorized(true);
        setMessage('');
        return undefined;
      })
      .catch(() => {});
  }, [password, adminFetch, logout]);

  const loadPacks = useCallback(() => {
    fetch('/api/packs')
      .then((r) => r.json())
      .then(setPacks)
      .catch(() => setPacks([]));
  }, []);

  useEffect(() => {
    if (authorized) loadPacks();
  }, [authorized, loadPacks]);

  const openPack = async (pack) => {
    setMessage('');
    try {
      const res = await adminFetch(`/api/packs/${encodeURIComponent(pack.id)}`);
      if (!res.ok) throw new Error(res.status === 404 ? 'Игра не найдена' : 'Не удалось открыть игру');
      setForm(packToForm(await res.json()));
      setIsExisting(true);
    } catch (err) {
      setMessage(err.message);
    }
  };

  const startNew = () => {
    setForm(newForm());
    setIsExisting(false);
    setTab('questions');
    setMessage('');
  };

  const uploadFile = async (file, onDone) => {
    setMessage('');
    if (!form.id.trim()) {
      setMessage('Сначала укажите адрес игры');
      return;
    }
    const body = new FormData();
    body.append('file', file);
    try {
      const res = await adminFetch(`/api/packs/${encodeURIComponent(normalizePackId(form.id))}/media`, { method: 'POST', body });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      onDone(data.path);
    } catch (err) {
      setMessage(err.message || 'Файл не загрузился');
    }
  };

  const save = async () => {
    if (!form.title.trim()) {
      setMessage('Укажите название игры');
      return;
    }
    const rounds = form.rounds
      .map((round) => ({ ...round, questions: round.questions.filter((q) => q.question.trim()) }))
      .filter((round) => round.questions.length > 0);
    if (rounds.length === 0) {
      setMessage('Добавьте хотя бы один вопрос');
      setTab('questions');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const id = normalizePackId(form.id);
      const res = await adminFetch('/api/packs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, id, rounds }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setForm((f) => ({ ...f, id: data.id }));
      setIsExisting(true);
      setMessage('Игра сохранена');
      loadPacks();
    } catch (err) {
      setMessage(err.message || 'Игра не сохранилась');
    } finally {
      setSaving(false);
    }
  };

  if (!authorized) {
    return (
      <ThemeStage config={TOOL_THEME} page>
        <LoginForm
          message={message}
          onSubmit={(value) => {
            setMessage('');
            setPassword(value);
          }}
        />
      </ThemeStage>
    );
  }

  const firstQuestion = form.rounds[0]?.questions[0];

  return (
    <ThemeStage config={TOOL_THEME} page>
      <div className="grid h-full grid-rows-[auto_minmax(0,1fr)] lg:grid-cols-[15rem_minmax(0,1fr)] lg:grid-rows-1">
        <nav aria-label="Игры" className="flex flex-col gap-3 overflow-y-auto p-4 max-lg:max-h-44" style={{ background: 'var(--t-surface)' }}>
          <Link to="/" className="font-display-t text-lg">Box Party</Link>
          <button type="button" onClick={startNew} className="btn justify-start py-2 text-sm"><Plus className="h-4 w-4" />Новая игра</button>
          <ul className="flex flex-col gap-1">
            {packs.map((pack) => (
              <li key={pack.id}>
                <button
                  type="button"
                  onClick={() => openPack(pack)}
                  aria-current={pack.id === form.id ? 'true' : undefined}
                  className="w-full px-2 py-2 text-left text-sm"
                  style={{
                    borderRadius: '0.4rem',
                    background: pack.id === form.id ? 'var(--t-bg)' : 'transparent',
                    fontWeight: pack.id === form.id ? 700 : 400,
                  }}
                >
                  {pack.title}
                  <span className="block text-xs" style={{ color: 'var(--t-muted)' }}>Вопросов: {pack.questionsCount}</span>
                </button>
              </li>
            ))}
          </ul>
          {packs.length === 0 && <p className="text-sm" style={{ color: 'var(--t-muted)' }}>Игр пока нет. Создайте первую.</p>}
        </nav>

        <main className="flex min-h-0 flex-col">
          <header className="flex flex-wrap items-end gap-4 border-b p-4" style={{ borderColor: 'var(--t-line)' }}>
            <label className="min-w-[14rem] flex-1 text-sm font-bold">
              Название игры
              <input
                type="text"
                value={form.title}
                maxLength={200}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Например: Сокровища Ямала"
                className="field mt-1 text-base font-normal"
              />
            </label>
            <label className="w-44 text-sm font-bold">
              Адрес игры (латиница)
              <input
                type="text"
                value={form.id}
                disabled={isExisting}
                onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
                className="field mt-1 font-normal disabled:opacity-60"
              />
            </label>
            <button type="button" onClick={save} disabled={saving} className="btn">{saving ? 'Сохраняем…' : 'Сохранить игру'}</button>
          </header>

          <div role="tablist" aria-label="Разделы" className="flex gap-1 px-4 pt-3">
            {[['questions', 'Вопросы'], ['theme', 'Оформление']].map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className="px-4 py-2 font-bold"
                style={{
                  borderRadius: '0.4rem',
                  background: tab === id ? 'var(--t-text)' : 'transparent',
                  color: tab === id ? 'var(--t-bg)' : 'var(--t-text)',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {message && <p role="status" className="mx-4 mt-3 px-3 py-2 font-bold" style={{ background: 'var(--t-surface)', borderRadius: '0.4rem' }}>{message}</p>}

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {tab === 'questions' ? (
              <QuestionsEditor form={form} setForm={setForm} onUpload={uploadFile} answerTimes={ANSWER_TIMES} />
            ) : (
              <ThemeEditor
                theme={form.theme}
                onChange={(theme) => setForm((f) => ({ ...f, theme }))}
                onUpload={uploadFile}
                title={form.title}
                firstQuestion={firstQuestion}
              />
            )}
          </div>
        </main>
      </div>
    </ThemeStage>
  );
}
