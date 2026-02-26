import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { useSocket } from '../hooks/useSocket';
import { SOCKET_EVENTS, GAME_STATES } from '../constants';
import { playTimeUpSound } from '../utils/playTimeUpSound';

const LETTERS = 'ABCDEFGHIJ'.split('');

export default function Host() {
  const { socket, connected, retry, connectionError } = useSocket();
  const [roomCode, setRoomCode] = useState('');
  const [joinUrl, setJoinUrl] = useState('');
  const [players, setPlayers] = useState([]);
  const [phase, setPhase] = useState('create'); // create | lobby | question | results | gameover
  const [question, setQuestion] = useState(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [answered, setAnswered] = useState([]);
  const [results, setResults] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [packs, setPacks] = useState([]);
  const [selectedPackId, setSelectedPackId] = useState('');
  const [timeLeft, setTimeLeft] = useState(15);
  const [initialQuestionTime, setInitialQuestionTime] = useState(15);
  const [timerMode, setTimerMode] = useState('auto'); // 'auto' | 'manual'
  const [timerStarted, setTimerStarted] = useState(true);
  const [showRoundLeaderboard, setShowRoundLeaderboard] = useState(false);
  const [packLoadError, setPackLoadError] = useState('');
  const timeUpSoundRef = useRef({ questionIndex: -1, played: false });

  useEffect(() => {
    if (phase !== 'question' || timeLeft !== 0) return;
    if (timeUpSoundRef.current.questionIndex !== questionIndex) {
      timeUpSoundRef.current = { questionIndex, played: false };
    }
    if (!timeUpSoundRef.current.played) {
      timeUpSoundRef.current.played = true;
      playTimeUpSound();
    }
  }, [phase, timeLeft, questionIndex]);

  useEffect(() => {
    fetch('/api/packs')
      .then((r) => r.json())
      .then(setPacks)
      .catch(() => setPacks([]));
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on(SOCKET_EVENTS.ROOM_CREATED, ({ code, joinUrl: url }) => {
      setRoomCode(code);
      setJoinUrl(url);
      setPhase('lobby');
      setPlayers([]);
      setPackLoadError('');
    });
    socket.on(SOCKET_EVENTS.PLAYER_JOINED, ({ players: p }) => setPlayers(p));
    socket.on(SOCKET_EVENTS.PLAYER_LEFT, ({ players: p }) => setPlayers(p));
    socket.on(SOCKET_EVENTS.GAME_STARTED, () => setPhase('question'));
    socket.on(SOCKET_EVENTS.PACK_LOAD_ERROR, ({ message }) => setPackLoadError(message || 'Пак не загружен'));
    socket.on(SOCKET_EVENTS.QUESTION_START, (data) => {
      setShowRoundLeaderboard(false);
      const mode = data.timerMode === 'manual' ? 'manual' : 'auto';
      setTimerMode(mode);
      setTimerStarted(mode === 'auto');
      setQuestion((prev) => ({
        type: data.type || 'choice',
        question: data.question,
        options: data.options || [],
        correctIndex: prev?.correctIndex ?? 0,
        correctAnswer: prev?.correctAnswer ?? '',
        image: data.image ?? undefined,
        video: data.video ?? undefined,
        audio: data.audio ?? undefined,
      }));
      setQuestionIndex(data.questionIndex);
      setTotalQuestions(data.total);
      setAnswered([]);
      const sec = data.timeSec ?? 15;
      setTimeLeft(sec);
      setInitialQuestionTime(sec);
      setPhase('question');
    });
    socket.on(SOCKET_EVENTS.QUESTION_TIMER_STARTED, ({ timeSec }) => {
      const sec = timeSec ?? 15;
      setTimerStarted(true);
      setTimeLeft(sec);
      setInitialQuestionTime(sec);
    });
    socket.on(SOCKET_EVENTS.QUESTION_HOST, ({ correctIndex, correctAnswer }) => {
      setQuestion((prev) => (prev ? { ...prev, correctIndex: correctIndex ?? prev.correctIndex, correctAnswer: correctAnswer ?? prev.correctAnswer } : null));
    });
    socket.on(SOCKET_EVENTS.PLAYER_ANSWERED, ({ nickname, answerText }) => {
      setAnswered((prev) => [...prev, { nickname, answerText }]);
    });
    socket.on(SOCKET_EVENTS.RESULTS, (data) => {
      setResults(data);
      setPhase('results');
      if (data.roundOver) setShowRoundLeaderboard(false);
    });
    socket.on(SOCKET_EVENTS.ROUND_LEADERBOARD_SHOWN, () => setShowRoundLeaderboard(true));
    socket.on(SOCKET_EVENTS.GAME_OVER, ({ leaderboard: lb }) => {
      setLeaderboard(lb);
      setPhase('gameover');
    });
    socket.on(SOCKET_EVENTS.HOST_DISCONNECT, () => setPhase('create'));
    socket.on('disconnect', () => {
      setPhase((p) => (p !== 'create' ? 'create' : p));
      setRoomCode('');
      setJoinUrl('');
      setPlayers([]);
      setQuestion(null);
      setResults(null);
      setLeaderboard([]);
    });
    return () => {
      socket.off(SOCKET_EVENTS.ROOM_CREATED);
      socket.off(SOCKET_EVENTS.PLAYER_JOINED);
      socket.off(SOCKET_EVENTS.PLAYER_LEFT);
      socket.off(SOCKET_EVENTS.GAME_STARTED);
      socket.off(SOCKET_EVENTS.QUESTION_START);
      socket.off(SOCKET_EVENTS.QUESTION_TIMER_STARTED);
      socket.off(SOCKET_EVENTS.QUESTION_HOST);
      socket.off(SOCKET_EVENTS.PLAYER_ANSWERED);
      socket.off(SOCKET_EVENTS.RESULTS);
      socket.off(SOCKET_EVENTS.ROUND_LEADERBOARD_SHOWN);
      socket.off(SOCKET_EVENTS.GAME_OVER);
      socket.off('disconnect');
    };
  }, [socket]);

  useEffect(() => {
    if (phase !== 'question' || !timerStarted || timeLeft <= 0) return;
    const t = setInterval(() => setTimeLeft((l) => l - 1), 1000);
    return () => clearInterval(t);
  }, [phase, timerStarted, timeLeft]);

  const createRoom = useCallback(() => {
    if (socket) socket.emit(SOCKET_EVENTS.CREATE_ROOM, { joinBaseUrl: window.location.origin });
  }, [socket]);

  const startGame = useCallback(() => {
    if (socket) socket.emit(SOCKET_EVENTS.START_GAME, { packId: selectedPackId || undefined });
  }, [socket, selectedPackId]);

  const showResults = useCallback(() => {
    if (socket && question) {
      socket.emit(SOCKET_EVENTS.SHOW_RESULTS, {
        questionIndex,
        correctIndex: question.correctIndex,
        correctAnswer: question.correctAnswer,
      });
    }
  }, [socket, question, questionIndex]);

  const nextQuestion = useCallback(() => {
    if (socket) socket.emit(SOCKET_EVENTS.NEXT_QUESTION);
  }, [socket]);

  const startTimer = useCallback(() => {
    if (socket) socket.emit(SOCKET_EVENTS.HOST_START_TIMER);
  }, [socket]);

  const showRoundLeaderboardClick = useCallback(() => {
    setShowRoundLeaderboard(true);
    if (socket) socket.emit(SOCKET_EVENTS.HOST_SHOW_ROUND_LEADERBOARD);
  }, [socket]);

  if (!socket) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center text-[#22d3ee]">
        Подключение…
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center gap-4 p-4 text-center max-w-md">
        <p className="text-gray-400 font-bold">Нет связи с сервером</p>
        {connectionError && (
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 text-left w-full">
            <p className="text-[#22d3ee] font-mono text-sm mb-2">Код: {connectionError.code}</p>
            <p className="text-gray-300 text-sm">{connectionError.message}</p>
          </div>
        )}
        <button
          type="button"
          onClick={retry}
          className="px-6 py-3 rounded-2xl bg-white/10 border border-white/20 hover:bg-white/20 font-bold text-white"
        >
          Повторить
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-6 md:p-10 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#a855f7] rounded-full blur-[150px] opacity-10" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#22d3ee] rounded-full blur-[150px] opacity-10" />
      </div>

      {phase === 'create' && (
        <motion.div
          className="relative z-10 max-w-2xl mx-auto text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <h1 className="text-4xl md:text-6xl font-black text-white mb-4">
            BOX <span className="text-[#a855f7]">PARTY</span>
          </h1>
          <p className="text-gray-400 mb-8">Создайте комнату и покажите игрокам QR-код или код</p>
          <motion.button
            onClick={createRoom}
            disabled={!connected}
            className="px-12 py-6 rounded-2xl bg-gradient-to-r from-[#a855f7] to-[#7c3aed] text-white text-xl font-black disabled:opacity-50 transition-all hover:shadow-nexus-purple hover:scale-105"
            whileTap={{ scale: 0.98 }}
          >
            Создать комнату
          </motion.button>
        </motion.div>
      )}

      {packLoadError && (phase === 'lobby' || phase === 'question') && (
        <div className="relative z-20 mb-4 rounded-2xl bg-amber-500/20 border border-amber-500/50 px-4 py-3 text-amber-200 text-center">
          {packLoadError}
        </div>
      )}
      <AnimatePresence mode="wait">
        {phase === 'lobby' && (
          <motion.div
            key="lobby"
            className="relative z-10 max-w-4xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <div className="text-center mb-10">
              <p className="text-gray-400 mb-4 text-lg">Подключитесь по ссылке или коду</p>
              <div className="inline-block relative">
                <div className="absolute inset-0 bg-gradient-to-r from-[#a855f7] via-[#22d3ee] to-[#fbbf24] rounded-3xl blur-xl opacity-50" />
                <div className="relative bg-gradient-to-br from-[#1a1a2e] to-[#0a0a0f] rounded-3xl border-2 border-white/20 px-12 py-6">
                  <p className="text-gray-400 mb-2 text-sm">Код комнаты</p>
                  <h2 className="text-6xl md:text-7xl font-black tracking-[0.2em] bg-gradient-to-r from-[#a855f7] via-[#22d3ee] to-[#fbbf24] bg-clip-text text-transparent">
                    {roomCode}
                  </h2>
                </div>
              </div>
              <div className="mt-6 inline-block p-4 bg-white rounded-2xl">
                <QRCodeSVG value={joinUrl} size={180} level="M" />
              </div>
              <p className="text-gray-500 mt-4 text-sm break-all max-w-md mx-auto">{joinUrl}</p>
            </div>

            <div className="rounded-3xl bg-gradient-to-br from-[#1a1a2e]/80 to-[#1a1a2e]/40 backdrop-blur-xl border border-white/10 p-8">
              <p className="text-gray-400 mb-4">Игровой пак (опционально)</p>
              <select
                value={selectedPackId}
                onChange={(e) => setSelectedPackId(e.target.value)}
                className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-white w-full max-w-xs mb-6 focus:border-[#a855f7] focus:outline-none"
              >
                <option value="">— Без пака / тест —</option>
                {packs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
              <p className="text-xl text-gray-300 mb-4">
                Игроков в лобби: <span className="text-[#a855f7] font-bold">{players.length}</span>
              </p>
              <ul className="space-y-2 mb-8">
                {players.map((pl) => (
                  <li key={pl.id} className="text-lg text-gray-300 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#22d3ee]" />
                    {pl.nickname}
                  </li>
                ))}
              </ul>
              <motion.button
                onClick={startGame}
                className="px-12 py-6 rounded-2xl bg-gradient-to-r from-[#a855f7] to-[#7c3aed] text-white text-xl font-black hover:shadow-nexus-purple transition-all hover:scale-105"
                whileTap={{ scale: 0.98 }}
              >
                Начать игру
              </motion.button>
            </div>
          </motion.div>
        )}

        {phase === 'question' && question && (
          <motion.div
            key="question"
            className="relative z-10 max-w-4xl mx-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400">
                  Вопрос {questionIndex + 1} из {totalQuestions}
                </span>
                {timerMode === 'manual' && !timerStarted ? (
                  <motion.button
                    onClick={startTimer}
                    className="px-6 py-3 rounded-2xl bg-[#22d3ee] hover:bg-[#06b6d4] text-[#0a0a0f] font-bold text-lg"
                    whileTap={{ scale: 0.98 }}
                  >
                    Старт таймера
                  </motion.button>
                ) : (
                  <span className={`text-xl font-black ${timeLeft <= 5 ? 'text-[#fbbf24] animate-pulse' : 'text-[#fbbf24]'}`}>
                    {timeLeft} сек
                  </span>
                )}
              </div>
              {timerStarted && (
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-[#fbbf24] to-[#f59e0b]"
                    initial={{ width: '100%' }}
                    animate={{ width: `${(timeLeft / initialQuestionTime) * 100}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              )}
            </div>

            <div className="rounded-3xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 backdrop-blur-xl p-8 md:p-12 mb-8">
              <h2 className="text-3xl md:text-5xl font-black text-white mb-8 leading-tight">
                {question.question}
              </h2>
              {(question.image || question.video || question.audio) && (
                <div className="flex flex-col gap-4 mb-8">
                  {question.image && (
                    <img src={question.image} alt="" className="max-h-72 w-auto rounded-2xl border border-white/10 object-contain" />
                  )}
                  {question.video && (
                    <video src={question.video} controls className="max-h-72 w-full rounded-2xl border border-white/10 bg-black" />
                  )}
                  {question.audio && (
                    <audio src={question.audio} controls className="w-full" />
                  )}
                </div>
              )}
              {question.type === 'open' ? (
                <p className="text-[#22d3ee] text-xl">Открытый ответ — игроки вводят текст на телефоне</p>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {(question.options || []).map((opt, i) => (
                    <div
                      key={i}
                      className="rounded-2xl bg-white/5 border-2 border-white/20 p-6 flex items-center gap-4"
                    >
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-black text-white shrink-0"
                        style={{ backgroundColor: ['#ef4444', '#3b82f6', '#10b981', '#fbbf24', '#a855f7', '#ec4899', '#14b8a6', '#f59e0b', '#6366f1', '#84cc16'][i % 10] }}
                      >
                        {LETTERS[i] ?? i + 1}
                      </div>
                      <p className="text-lg font-bold text-white">{opt ?? ''}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl p-6 mb-8">
              <p className="text-[#a855f7] font-bold mb-2">Ответили:</p>
              {answered.length === 0 ? (
                <p className="text-xl text-gray-400">Пока никто</p>
              ) : question.type === 'open' ? (
                <ul className="space-y-2 text-white">
                  {answered.map((a, i) => (
                    <li key={i}><strong>{a.nickname}</strong>: {a.answerText != null ? a.answerText : '—'}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xl text-white">{answered.map((a) => a.nickname).join(', ')}</p>
              )}
            </div>
            <motion.button
              onClick={showResults}
              className="px-10 py-4 rounded-2xl bg-gradient-to-r from-[#a855f7] to-[#7c3aed] text-white text-lg font-black hover:shadow-nexus-purple"
              whileTap={{ scale: 0.98 }}
            >
              Показать ответ
            </motion.button>
          </motion.div>
        )}

        {phase === 'results' && results && (
          <motion.div
            key="results"
            className="relative z-10 max-w-4xl mx-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {results.roundOver ? (
              showRoundLeaderboard ? (
                <>
                  <h2 className="text-3xl font-black text-[#a855f7] mb-2">Итоги раунда {results.roundNumber ?? 1}</h2>
                  <h3 className="text-2xl font-black text-white mb-6">Таблица лидеров</h3>
                  <ul className="space-y-3 mb-10">
                    {(results.roundLeaderboard ?? results.playerScores ?? []).map((item, i) => (
                      <motion.li
                        key={item.nickname}
                        className="flex justify-between items-center rounded-2xl bg-white/5 border border-white/10 px-6 py-4 text-xl backdrop-blur-sm"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                      >
                        <span className="text-[#a855f7] font-black">#{i + 1}</span>
                        <span className="text-white">{item.nickname}</span>
                        <span className="text-[#fbbf24] font-black">{item.score}</span>
                      </motion.li>
                    ))}
                  </ul>
                  <motion.button
                    onClick={nextQuestion}
                    className="px-10 py-4 rounded-2xl bg-gradient-to-r from-[#a855f7] to-[#7c3aed] text-white text-xl font-black hover:shadow-nexus-purple"
                    whileTap={{ scale: 0.98 }}
                  >
                    Следующий раунд
                  </motion.button>
                </>
              ) : (
                <>
                  <h2 className="text-3xl font-black text-white mb-6">Правильный ответ</h2>
                  {results.type === 'open' ? (
                    <p className="text-2xl text-white mb-8">{results.correctAnswer ?? ''}</p>
                  ) : question && question.options && results.correctIndex != null && (
                    <p className="text-2xl text-white mb-8">
                      {LETTERS[results.correctIndex]}. {question.options[results.correctIndex]}
                    </p>
                  )}
                  <motion.button
                    onClick={showRoundLeaderboardClick}
                    className="px-10 py-4 rounded-2xl bg-gradient-to-r from-[#a855f7] to-[#7c3aed] text-white text-xl font-black hover:shadow-nexus-purple"
                    whileTap={{ scale: 0.98 }}
                  >
                    Показать таблицу лидеров
                  </motion.button>
                </>
              )
            ) : (
              <>
                <h2 className="text-3xl font-black text-white mb-6">Правильный ответ</h2>
                {results.type === 'open' ? (
                  <p className="text-2xl text-white mb-6">{results.correctAnswer ?? ''}</p>
                ) : question && question.options && results.correctIndex != null && (
                  <p className="text-2xl text-white mb-6">
                    {LETTERS[results.correctIndex]}. {question.options[results.correctIndex]}
                  </p>
                )}
                <div className="rounded-2xl bg-white/5 border border-white/10 p-6 mb-8">
                  <p className="text-gray-400 mb-4">Очки после этого вопроса</p>
                  <ul className="space-y-2">
                    {(results.playerScores ?? []).map((item) => (
                      <li key={item.nickname} className="flex justify-between text-lg">
                        <span className="text-gray-300">{item.nickname}</span>
                        <span className="text-[#fbbf24] font-bold">{item.score}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <motion.button
                  onClick={nextQuestion}
                  className="px-10 py-4 rounded-2xl bg-gradient-to-r from-[#a855f7] to-[#7c3aed] text-white text-xl font-black hover:shadow-nexus-purple"
                  whileTap={{ scale: 0.98 }}
                >
                  Следующий вопрос
                </motion.button>
              </>
            )}
          </motion.div>
        )}

        {phase === 'gameover' && (
          <motion.div
            key="gameover"
            className="relative z-10 max-w-2xl mx-auto text-center"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
          >
            <h1 className="text-4xl md:text-6xl font-black mb-8 bg-gradient-to-r from-[#a855f7] via-[#22d3ee] to-[#fbbf24] bg-clip-text text-transparent">
              Игра окончена!
            </h1>
            <p className="text-gray-400 text-xl mb-10">Итоговая таблица</p>
            <ul className="space-y-4 mb-10">
              {leaderboard.map((entry, i) => (
                <motion.li
                  key={entry.nickname ? `${entry.nickname}-${i}` : i}
                  className="flex justify-between items-center rounded-2xl bg-white/5 border border-white/10 px-6 py-4 text-xl backdrop-blur-sm"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <span className="text-[#a855f7] font-black">#{i + 1}</span>
                  <span className="text-white">{entry.nickname}</span>
                  <span className="text-[#fbbf24] font-black">{entry.score}</span>
                </motion.li>
              ))}
            </ul>
            <motion.button
              onClick={() => {
                setPhase('create');
                setRoomCode('');
                setJoinUrl('');
              }}
              className="px-10 py-4 rounded-2xl bg-white/10 border border-white/10 hover:bg-white/20 text-lg font-bold transition-colors"
              whileTap={{ scale: 0.98 }}
            >
              Новая комната
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
