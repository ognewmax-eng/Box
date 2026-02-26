import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const LETTERS = 'ABCDEFGHIJ'.split('');
const MAX_ROUNDS = 10;
const MAX_QUESTIONS_PER_ROUND = 10;
const MAX_CHOICE_OPTIONS = 10;

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
  const [form, setForm] = useState({ id: '', title: '', answerTimeSec: 15, rounds: [{ questions: [emptyQuestion()], timerStart: 'auto' }] });
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
    setForm((f) => ({ ...f, rounds: [...f.rounds, { questions: [emptyQuestion()], timerStart: 'auto' }] }));
  };

  const updateRound = (roundIndex, field, value) => {
    setForm((f) => ({
      ...f,
      rounds: f.rounds.map((r, i) => (i !== roundIndex ? r : { ...r, [field]: value })),
    }));
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
        timerStart: (r.timerStart === 'manual' || r.timerStart === 'on_host') ? 'manual' : 'auto',
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
      setForm({ id: '', title: '', answerTimeSec: 15, rounds: [{ questions: [emptyQuestion()], timerStart: 'auto' }] });
      setEditing(null);
      loadPacks();
    } catch (err) {
      setMessage(err.message || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (pack) => {
    if (!pack?.id) return;
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
            timerStart: (r.timerStart === 'manual' || r.timerStart === 'on_host') ? 'manual' : 'auto',
            questions: (r.questions || []).map((q) => ({
              type: q.type === 'open' ? 'open' : 'choice',
              question: q.question || '',
              options: (q.options && q.options.length) ? [...q.options].slice(0, MAX_CHOICE_OPTIONS) : ['', '', '', ''],
              correctIndex: q.correctIndex ?? 0,
              correctAnswer: q.correctAnswer ?? '',
              image: q.image ?? '',
              video: q.video ?? '',
              audio: q.audio ?? '',
            })),
          }));
        } else if (Array.isArray(data.questions) && data.questions.length > 0) {
          rounds = [{
            timerStart: 'auto',
            questions: data.questions.map((q) => ({
              type: q.type === 'open' ? 'open' : 'choice',
              question: q.question || '',
              options: (q.options && q.options.length) ? [...q.options].slice(0, MAX_CHOICE_OPTIONS) : ['', '', '', ''],
              correctIndex: q.correctIndex ?? 0,
              correctAnswer: q.correctAnswer ?? '',
              image: q.image ?? '',
              video: q.video ?? '',
              audio: q.audio ?? '',
            })),
          }];
        }
        if (rounds.length === 0) rounds = [{ questions: [emptyQuestion()], timerStart: 'auto' }];
        const answerTimeSec = Math.min(60, Math.max(10, Number(data.answerTimeSec) || 15));
        setForm({ id: data.id, title: data.title || '', answerTimeSec, rounds });
        setEditing(pack.id);
        setMessage('');
      })
      .catch(() => setMessage('Не удалось загрузить пак'));
  };

  const totalQuestions = form.rounds.reduce((acc, r) => acc + r.questions.length, 0);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-6 md:p-10 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#a855f7] rounded-full blur-[140px] opacity-10" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#22d3ee] rounded-full blur-[140px] opacity-10" />
      </div>
      <div className="relative z-10">
        <h1 className="text-4xl font-black text-white mb-2">
          BOX <span className="text-[#a855f7]">PARTY</span> — Админка
        </h1>
        <p className="text-gray-400 mb-8">Пак: до {MAX_ROUNDS} раундов, до {MAX_QUESTIONS_PER_ROUND} вопросов в раунде. Тип: выбор ответа или открытый (сравнение без учёта регистра).</p>

        {message && (
          <motion.p className="mb-6 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {message}
          </motion.p>
        )}

        <div className="grid lg:grid-cols-2 gap-10">
          <div>
            <h2 className="text-xl font-bold text-[#a855f7] mb-4">Паки</h2>
            <ul className="space-y-3">
              {packs.map((pack) => (
                <li key={pack.id} className="flex justify-between items-center rounded-2xl bg-white/5 border border-white/10 px-4 py-3">
                  <div>
                    <span className="font-bold text-white">{pack.title}</span>
                    <span className="text-gray-500 text-sm ml-2">({pack.questionsCount ?? pack.questions?.length ?? 0} вопр.)</span>
                  </div>
                  <motion.button onClick={() => startEdit(pack)} className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#a855f7] to-[#7c3aed] text-white text-sm font-bold hover:shadow-nexus-purple" whileTap={{ scale: 0.98 }}>
                    Редактировать
                  </motion.button>
                </li>
              ))}
            </ul>
            {packs.length === 0 && <p className="text-gray-500">Нет паков.</p>}
          </div>

          <div className="rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl p-8">
            <h2 className="text-xl font-bold text-[#a855f7] mb-6">{editing ? 'Редактировать пак' : 'Новый пак'}</h2>
            <form onSubmit={savePack} className="space-y-6">
              <div>
                <label className="block text-gray-400 text-sm mb-2">ID (латиница)</label>
                <input type="text" value={form.id} onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))} placeholder="my-pack" className="w-full rounded-xl bg-white/5 border-2 border-white/10 px-4 py-3 text-white placeholder-gray-500 focus:border-[#a855f7] outline-none transition-colors" disabled={!!editing} />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-2">Название пака</label>
                <input type="text" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Название" className="w-full rounded-xl bg-white/5 border-2 border-white/10 px-4 py-3 text-white placeholder-gray-500 focus:border-[#a855f7] outline-none transition-colors" />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-2">Время на ответ (сек)</label>
                <select value={form.answerTimeSec} onChange={(e) => setForm((f) => ({ ...f, answerTimeSec: Number(e.target.value) }))} className="w-full rounded-xl bg-white/5 border-2 border-white/10 px-4 py-3 text-white focus:border-[#a855f7] outline-none">
                  {[10, 15, 20, 25, 30, 40, 50, 60].map((n) => (
                    <option key={n} value={n} className="bg-[#1a1a2e]">{n} сек</option>
                  ))}
                </select>
              </div>
              <div>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-gray-400 text-sm">Раунды и вопросы</span>
                  <motion.button type="button" onClick={addRound} disabled={form.rounds.length >= MAX_ROUNDS} className="text-[#22d3ee] hover:text-[#a855f7] text-sm font-bold disabled:opacity-50" whileTap={{ scale: 0.98 }}>+ Раунд</motion.button>
                </div>
                <div className="space-y-8 max-h-[55vh] overflow-y-auto pr-2">
                  {form.rounds.map((round, ri) => (
                    <div key={ri} className="rounded-2xl bg-white/5 p-4 border border-white/10">
                      <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
                        <span className="text-[#a855f7] font-bold">Раунд {ri + 1}</span>
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="text-gray-400 text-sm flex items-center gap-1">
                            Таймер:
                            <select value={round.timerStart ?? 'auto'} onChange={(e) => updateRound(ri, 'timerStart', e.target.value)} className="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-white text-sm">
                              <option value="auto" className="bg-[#1a1a2e]">сразу</option>
                              <option value="manual" className="bg-[#1a1a2e]">по нажатию ведущего</option>
                            </select>
                          </label>
                          <button type="button" onClick={() => addQuestion(ri)} disabled={round.questions.length >= MAX_QUESTIONS_PER_ROUND} className="text-gray-400 hover:text-[#22d3ee] text-sm disabled:opacity-50">+ Вопрос</button>
                          {form.rounds.length > 1 && <button type="button" onClick={() => removeRound(ri)} className="text-gray-500 hover:text-[#ef4444] text-sm">Удалить раунд</button>}
                        </div>
                      </div>
                      {round.questions.map((q, qi) => (
                        <div key={qi} className="rounded-xl bg-white/5 p-3 border border-white/10 mb-3">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-gray-400 text-sm">Вопрос {qi + 1}</span>
                            <div className="flex gap-2 items-center">
                              <select value={q.type} onChange={(e) => setQuestionType(ri, qi, e.target.value)} className="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-white text-sm">
                                <option value="choice" className="bg-[#1a1a2e]">Выбор</option>
                                <option value="open" className="bg-[#1a1a2e]">Открытый</option>
                              </select>
                              <button type="button" onClick={() => removeQuestion(ri, qi)} className="text-gray-500 hover:text-[#ef4444] text-sm">Удалить</button>
                            </div>
                          </div>
                          <input type="text" value={q.question} onChange={(e) => updateQuestion(ri, qi, 'question', e.target.value)} placeholder="Текст вопроса?" className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white text-sm mb-2 focus:border-[#a855f7] outline-none" />
                          <div className="mb-3 rounded-lg bg-white/5 p-3 border border-[#a855f7]/30">
                            <p className="text-[#22d3ee] font-bold text-sm mb-2">Медиа (фото, видео, аудио)</p>
                            <p className="text-gray-400 text-xs mb-2">URL или загрузите файл после сохранения пака</p>
                            {['image', 'video', 'audio'].map((mediaType) => (
                              <div key={mediaType} className="flex flex-wrap items-center gap-2 mb-2">
                                <span className="text-[#22d3ee] text-xs w-12 shrink-0">{mediaType === 'image' ? 'Фото' : mediaType === 'video' ? 'Видео' : 'Аудио'}:</span>
                                <input type="text" value={q[mediaType] ?? ''} onChange={(e) => updateQuestion(ri, qi, mediaType, e.target.value)} placeholder="URL или нажмите «Добавить»" className="flex-1 min-w-0 rounded bg-white/5 border border-white/10 px-2 py-1.5 text-white text-xs" />
                                {form.id?.trim() ? (
                                  <>
                                    <input type="file" id={`${ri}-${qi}-${mediaType}`} accept={mediaType === 'image' ? 'image/*' : mediaType === 'video' ? 'video/*' : 'audio/*'} className="hidden" onChange={(e) => uploadMedia(ri, qi, mediaType, e)} />
                                    <label htmlFor={`${ri}-${qi}-${mediaType}`} className="cursor-pointer px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#a855f7] to-[#7c3aed] text-white text-xs font-bold whitespace-nowrap">
                                      Добавить
                                    </label>
                                  </>
                                ) : (
                                  <span className="text-gray-500 text-xs">Сохраните пак, чтобы загружать файлы</span>
                                )}
                              </div>
                            ))}
                          </div>
                          {q.type === 'open' ? (
                            <input type="text" value={q.correctAnswer ?? ''} onChange={(e) => updateQuestion(ri, qi, 'correctAnswer', e.target.value)} placeholder="Правильный ответ (сравнение без учёта регистра)" className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white text-sm focus:border-[#a855f7] outline-none" />
                          ) : (
                            <>
                              {(() => { const base = q.options || ['', '', '', '']; const opts = [...base.slice(0, MAX_CHOICE_OPTIONS)]; while (opts.length < MAX_CHOICE_OPTIONS) opts.push(''); return opts; })().map((opt, oi) => (
                                <div key={oi} className="flex items-center gap-2 mb-1">
                                  <span className="text-[#22d3ee] w-5 font-bold">{LETTERS[oi] ?? oi + 1}.</span>
                                  <input type="text" value={opt} onChange={(e) => { const base = q.options || ['', '', '', '']; const opts = [...base.slice(0, MAX_CHOICE_OPTIONS)]; while (opts.length <= oi) opts.push(''); opts[oi] = e.target.value; updateQuestion(ri, qi, 'options', opts.slice(0, MAX_CHOICE_OPTIONS)); }} placeholder={`Вариант ${oi + 1}`} className="flex-1 rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-white text-sm" />
                                </div>
                              ))}
                              <select value={Math.min(Math.max(0, q.correctIndex ?? 0), Math.max(0, (q.options || []).length - 1))} onChange={(e) => updateQuestion(ri, qi, 'correctIndex', parseInt(e.target.value, 10))} className="mt-2 rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-white text-sm">
                                {((q.options || ['', '', '', '']).slice(0, MAX_CHOICE_OPTIONS).map((_, i) => i)).map((i) => <option key={i} value={i} className="bg-[#1a1a2e]">Правильный: {LETTERS[i] ?? i + 1}</option>)}
                              </select>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                <p className="text-gray-500 text-sm mt-2">Всего вопросов: {totalQuestions}</p>
              </div>
              <div className="flex gap-4">
                <motion.button type="submit" disabled={saving} className="px-8 py-4 rounded-2xl bg-gradient-to-r from-[#a855f7] to-[#7c3aed] text-white font-black disabled:opacity-50 hover:shadow-nexus-purple" whileTap={{ scale: 0.98 }}>{saving ? 'Сохранение…' : 'Сохранить пак'}</motion.button>
                {editing && (
                  <motion.button type="button" onClick={() => { setEditing(null); setForm({ id: '', title: '', answerTimeSec: 15, rounds: [{ questions: [emptyQuestion()], timerStart: 'auto' }] }); setMessage(''); }} className="px-8 py-4 rounded-2xl bg-white/10 border border-white/10 hover:bg-white/20 font-bold" whileTap={{ scale: 0.98 }}>Отмена</motion.button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
