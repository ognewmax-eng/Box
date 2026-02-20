import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const LETTERS = ['A', 'B', 'C', 'D'];
const MAX_ROUNDS = 10;
const MAX_QUESTIONS_PER_ROUND = 10;

const emptyQuestion = (type = 'choice') => ({
  type,
  question: '',
  options: type === 'choice' ? ['', '', '', ''] : undefined,
  correctIndex: type === 'choice' ? 0 : undefined,
  correctAnswer: type === 'open' ? '' : undefined,
  image: '',
  video: '',
  audio: '',
});

export default function Admin() {
  const [packs, setPacks] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ id: '', title: '', answerTimeSec: 15, rounds: [{ questions: [emptyQuestion()] }] });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const loadPacks = () => {
    fetch('/api/packs')
      .then((r) => r.json())
      .then(setPacks)
      .catch(() => setPacks([]));
  };

  useEffect(() => loadPacks(), []);

  const addRound = () => {
    if (form.rounds.length >= MAX_ROUNDS) return;
    setForm((f) => ({ ...f, rounds: [...f.rounds, { questions: [emptyQuestion()] }] }));
  };

  const addQuestion = (roundIndex) => {
    setForm((f) => {
      const round = f.rounds[roundIndex];
      if (round.questions.length >= MAX_QUESTIONS_PER_ROUND) return f;
      return {
        ...f,
        rounds: f.rounds.map((r, i) =>
          i === roundIndex ? { ...r, questions: [...r.questions, emptyQuestion()] } : r
        ),
      };
    });
  };

  const updateQuestion = (roundIndex, questionIndex, field, value) => {
    setForm((f) => ({
      ...f,
      rounds: f.rounds.map((r, ri) =>
        ri !== roundIndex
          ? r
          : {
              ...r,
              questions: r.questions.map((q, qi) => {
                if (qi !== questionIndex) return q;
                if (field === 'options' && Array.isArray(value)) return { ...q, options: value };
                return { ...q, [field]: value };
              }),
            }
      ),
    }));
  };

  const setQuestionType = (roundIndex, questionIndex, type) => {
    setForm((f) => ({
      ...f,
      rounds: f.rounds.map((r, ri) =>
        ri !== roundIndex
          ? r
          : {
              ...r,
              questions: r.questions.map((q, qi) => {
                if (qi !== questionIndex) return q;
                const text = q.question || '';
                const media = { image: q.image ?? '', video: q.video ?? '', audio: q.audio ?? '' };
                if (type === 'open') return { type: 'open', question: text, correctAnswer: '', ...media };
                return { type: 'choice', question: text, options: ['', '', '', ''], correctIndex: 0, ...media };
              }),
            }
      ),
    }));
  };

  const removeQuestion = (roundIndex, questionIndex) => {
    setForm((f) => ({
      ...f,
      rounds: f.rounds.map((r, i) =>
        i === roundIndex
          ? { ...r, questions: r.questions.filter((_, qi) => qi !== questionIndex) }
          : r
      ),
    }));
  };

  const removeRound = (roundIndex) => {
    if (form.rounds.length <= 1) return;
    setForm((f) => ({ ...f, rounds: f.rounds.filter((_, i) => i !== roundIndex) }));
  };

  const uploadMedia = (roundIndex, questionIndex, field, e) => {
    const file = e.target?.files?.[0];
    if (!file || !form.id?.trim()) return;
    const fd = new FormData();
    fd.append('file', file);
    fetch(`/api/packs/${encodeURIComponent(form.id.trim())}/media`, { method: 'POST', body: fd })
      .then((r) => r.json())
      .then((data) => {
        if (data.path) updateQuestion(roundIndex, questionIndex, field, data.path);
        if (data.error) setMessage(data.error);
      })
      .catch(() => setMessage('Ошибка загрузки'));
    e.target.value = '';
  };

  const savePack = async (e) => {
    e?.preventDefault();
    if (!form.id.trim() || !form.title.trim()) {
      setMessage('Заполните ID и название');
      return;
    }
    const id = form.id.trim().toLowerCase().replace(/\s+/g, '-');
    const rounds = form.rounds
      .map((r) => ({
        questions: r.questions
          .filter((q) => q.question.trim())
          .map((q) => {
            const media = {};
            if (q.image?.trim()) media.image = q.image.trim();
            if (q.video?.trim()) media.video = q.video.trim();
            if (q.audio?.trim()) media.audio = q.audio.trim();
            if (q.type === 'open') {
              return { type: 'open', question: q.question.trim(), correctAnswer: (q.correctAnswer || '').trim(), ...media };
            }
            const options = (q.options || []).map((o) => o.trim()).filter(Boolean);
            return {
              type: 'choice',
              question: q.question.trim(),
              options: options.length ? options : ['A', 'B', 'C', 'D'],
              correctIndex: Math.max(0, Math.min(Number(q.correctIndex) || 0, options.length - 1)),
              ...media,
            };
          }),
      }))
      .filter((r) => r.questions.length > 0);
    if (rounds.length === 0) {
      setMessage('Добавьте хотя бы один вопрос в раунды');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/packs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, title: form.title.trim(), answerTimeSec: form.answerTimeSec, rounds }),
      });
      const text = await res.text();
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch (_) {
        throw new Error('Сервер вернул не JSON. Убедитесь, что запущен сервер (npm run dev:server или npm run tunnel).');
      }
      if (data.error) throw new Error(data.error);
      setMessage('Пак сохранён!');
      setForm({ id: '', title: '', answerTimeSec: 15, rounds: [{ questions: [emptyQuestion()] }] });
      setEditing(null);
      loadPacks();
    } catch (err) {
      setMessage(err.message || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (pack) => {
    const id = encodeURIComponent(pack.id);
    fetch(`/api/packs/${id}`)
      .then((r) => {
        if (!r.ok) {
          setMessage(r.status === 404 ? 'Пак не найден' : 'Не удалось загрузить пак');
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        let rounds = [];
        if (Array.isArray(data.rounds) && data.rounds.length > 0) {
          rounds = data.rounds.map((r) => ({
            questions: (r.questions || []).map((q) => ({
              type: q.type === 'open' ? 'open' : 'choice',
              question: q.question || '',
              options: (q.options && [...q.options, '', '', ''].slice(0, 4)) || ['', '', '', ''],
              correctIndex: q.correctIndex ?? 0,
              correctAnswer: q.correctAnswer ?? '',
              image: q.image ?? '',
              video: q.video ?? '',
              audio: q.audio ?? '',
            })),
          }));
        } else if (Array.isArray(data.questions) && data.questions.length > 0) {
          rounds = [{
            questions: data.questions.map((q) => ({
              type: q.type === 'open' ? 'open' : 'choice',
              question: q.question || '',
              options: (q.options && [...q.options, '', '', ''].slice(0, 4)) || ['', '', '', ''],
              correctIndex: q.correctIndex ?? 0,
              correctAnswer: q.correctAnswer ?? '',
              image: q.image ?? '',
              video: q.video ?? '',
              audio: q.audio ?? '',
            })),
          }];
        }
        if (rounds.length === 0) rounds = [{ questions: [emptyQuestion()] }];
        const answerTimeSec = Math.min(60, Math.max(10, Number(data.answerTimeSec) || 15));
        setForm({ id: data.id, title: data.title || '', answerTimeSec, rounds });
        setEditing(pack.id);
        setMessage('');
      })
      .catch(() => setMessage('Не удалось загрузить пак'));
  };

  const totalQuestions = form.rounds.reduce((acc, r) => acc + r.questions.length, 0);

  return (
    <div className="min-h-screen bg-party-dark text-white p-6 md:p-10">
      <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-party-neon to-party-pink mb-2">
        Админка
      </h1>
      <p className="text-slate-400 mb-8">Пак: до {MAX_ROUNDS} раундов, до {MAX_QUESTIONS_PER_ROUND} вопросов в раунде. Тип: выбор ответа или открытый (сравнение без учёта регистра).</p>

      {message && (
        <motion.p className="mb-6 p-4 rounded-xl bg-slate-800 border border-slate-600" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {message}
        </motion.p>
      )}

      <div className="grid lg:grid-cols-2 gap-10">
        <div>
          <h2 className="text-xl font-bold text-party-neon mb-4">Паки</h2>
          <ul className="space-y-3">
            {packs.map((pack) => (
              <li key={pack.id} className="flex justify-between items-center rounded-2xl bg-slate-800/60 px-4 py-3 border border-slate-700">
                <div>
                  <span className="font-medium">{pack.title}</span>
                  <span className="text-slate-500 text-sm ml-2">({pack.questionsCount ?? pack.questions?.length ?? 0} вопр.)</span>
                </div>
                <motion.button onClick={() => startEdit(pack)} className="px-4 py-2 rounded-xl bg-party-purple hover:bg-party-neon text-sm font-medium" whileTap={{ scale: 0.98 }}>
                  Редактировать
                </motion.button>
              </li>
            ))}
          </ul>
          {packs.length === 0 && <p className="text-slate-500">Нет паков.</p>}
        </div>

        <div className="bg-slate-800/30 rounded-3xl p-8 border border-slate-700/50">
          <h2 className="text-xl font-bold text-party-neon mb-6">{editing ? 'Редактировать пак' : 'Новый пак'}</h2>
          <form onSubmit={savePack} className="space-y-6">
            <div>
              <label className="block text-slate-400 text-sm mb-2">ID (латиница)</label>
              <input type="text" value={form.id} onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))} placeholder="my-pack" className="w-full rounded-xl bg-slate-800 border border-slate-600 px-4 py-3 text-white placeholder-slate-500 focus:border-party-purple outline-none" disabled={!!editing} />
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-2">Название пака</label>
              <input type="text" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Название" className="w-full rounded-xl bg-slate-800 border border-slate-600 px-4 py-3 text-white placeholder-slate-500 focus:border-party-purple outline-none" />
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-2">Время на ответ (сек)</label>
              <select value={form.answerTimeSec} onChange={(e) => setForm((f) => ({ ...f, answerTimeSec: Number(e.target.value) }))} className="w-full rounded-xl bg-slate-800 border border-slate-600 px-4 py-3 text-white focus:border-party-purple outline-none">
                {[10, 15, 20, 25, 30, 40, 50, 60].map((n) => (
                  <option key={n} value={n}>{n} сек</option>
                ))}
              </select>
            </div>
            <div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-slate-400 text-sm">Раунды и вопросы</span>
                <motion.button type="button" onClick={addRound} disabled={form.rounds.length >= MAX_ROUNDS} className="text-party-cyan hover:text-party-neon text-sm font-medium disabled:opacity-50" whileTap={{ scale: 0.98 }}>+ Раунд</motion.button>
              </div>
              <div className="space-y-8 max-h-[55vh] overflow-y-auto pr-2">
                {form.rounds.map((round, ri) => (
                  <div key={ri} className="rounded-2xl bg-slate-800/50 p-4 border border-slate-600">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-party-neon font-medium">Раунд {ri + 1}</span>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => addQuestion(ri)} disabled={round.questions.length >= MAX_QUESTIONS_PER_ROUND} className="text-slate-400 hover:text-party-cyan text-sm disabled:opacity-50">+ Вопрос</button>
                        {form.rounds.length > 1 && <button type="button" onClick={() => removeRound(ri)} className="text-slate-500 hover:text-party-pink text-sm">Удалить раунд</button>}
                      </div>
                    </div>
                    {round.questions.map((q, qi) => (
                      <div key={qi} className="rounded-xl bg-slate-800/60 p-3 border border-slate-700 mb-3">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-slate-400 text-sm">Вопрос {qi + 1}</span>
                          <div className="flex gap-2 items-center">
                            <select value={q.type} onChange={(e) => setQuestionType(ri, qi, e.target.value)} className="rounded-lg bg-slate-800 border border-slate-600 px-2 py-1 text-white text-sm">
                              <option value="choice">Выбор</option>
                              <option value="open">Открытый</option>
                            </select>
                            <button type="button" onClick={() => removeQuestion(ri, qi)} className="text-slate-500 hover:text-party-pink text-sm">Удалить</button>
                          </div>
                        </div>
                        <input type="text" value={q.question} onChange={(e) => updateQuestion(ri, qi, 'question', e.target.value)} placeholder="Текст вопроса?" className="w-full rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-white text-sm mb-2 focus:border-party-purple outline-none" />
                        <div className="mb-3 rounded-lg bg-slate-800/70 p-3 border border-party-purple/30">
                          <p className="text-party-cyan font-medium text-sm mb-2">Медиа (фото, видео, аудио)</p>
                          <p className="text-slate-400 text-xs mb-2">URL или загрузите файл после сохранения пака</p>
                          {['image', 'video', 'audio'].map((mediaType) => (
                            <div key={mediaType} className="flex flex-wrap items-center gap-2 mb-2">
                              <span className="text-party-cyan text-xs w-12 shrink-0">{mediaType === 'image' ? 'Фото' : mediaType === 'video' ? 'Видео' : 'Аудио'}:</span>
                              <input type="text" value={q[mediaType] ?? ''} onChange={(e) => updateQuestion(ri, qi, mediaType, e.target.value)} placeholder="URL или нажмите «Добавить»" className="flex-1 min-w-0 rounded bg-slate-800 border border-slate-600 px-2 py-1.5 text-white text-xs" />
                              {form.id?.trim() ? (
                                <>
                                  <input type="file" id={`${ri}-${qi}-${mediaType}`} accept={mediaType === 'image' ? 'image/*' : mediaType === 'video' ? 'video/*' : 'audio/*'} className="hidden" onChange={(e) => uploadMedia(ri, qi, mediaType, e)} />
                                  <label htmlFor={`${ri}-${qi}-${mediaType}`} className="cursor-pointer px-3 py-1.5 rounded-lg bg-party-purple hover:bg-party-neon text-white text-xs font-medium whitespace-nowrap">
                                    Добавить
                                  </label>
                                </>
                              ) : (
                                <span className="text-slate-500 text-xs">Сохраните пак, чтобы загружать файлы</span>
                              )}
                            </div>
                          ))}
                        </div>
                        {q.type === 'open' ? (
                          <input type="text" value={q.correctAnswer ?? ''} onChange={(e) => updateQuestion(ri, qi, 'correctAnswer', e.target.value)} placeholder="Правильный ответ (сравнение без учёта регистра)" className="w-full rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-white text-sm focus:border-party-purple outline-none" />
                        ) : (
                          <>
                            {(q.options || ['', '', '', '']).slice(0, 4).map((opt, oi) => (
                              <div key={oi} className="flex items-center gap-2 mb-1">
                                <span className="text-party-cyan w-5">{LETTERS[oi]}.</span>
                                <input type="text" value={opt} onChange={(e) => { const opts = [...(q.options || ['', '', '', '']), '', '', ''].slice(0, 4); opts[oi] = e.target.value; updateQuestion(ri, qi, 'options', opts); }} placeholder={`Вариант ${oi + 1}`} className="flex-1 rounded-lg bg-slate-800 border border-slate-600 px-2 py-1 text-white text-sm" />
                              </div>
                            ))}
                            <select value={q.correctIndex ?? 0} onChange={(e) => updateQuestion(ri, qi, 'correctIndex', parseInt(e.target.value, 10))} className="mt-2 rounded-lg bg-slate-800 border border-slate-600 px-2 py-1 text-white text-sm">
                              {[0, 1, 2, 3].map((i) => <option key={i} value={i}>Правильный: {LETTERS[i]}</option>)}
                            </select>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <p className="text-slate-500 text-sm mt-2">Всего вопросов: {totalQuestions}</p>
            </div>
            <div className="flex gap-4">
              <motion.button type="submit" disabled={saving} className="px-8 py-4 rounded-2xl bg-party-purple hover:bg-party-neon disabled:opacity-50 font-bold" whileTap={{ scale: 0.98 }}>{saving ? 'Сохранение…' : 'Сохранить пак'}</motion.button>
              {editing && (
                <motion.button type="button" onClick={() => { setEditing(null); setForm({ id: '', title: '', answerTimeSec: 15, rounds: [{ questions: [emptyQuestion()] }] }); setMessage(''); }} className="px-8 py-4 rounded-2xl bg-slate-600 hover:bg-slate-500 font-bold" whileTap={{ scale: 0.98 }}>Отмена</motion.button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
