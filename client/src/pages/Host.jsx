import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { useSocket } from '../hooks/useSocket';
import { SOCKET_EVENTS, GAME_STATES } from '../constants';
import { playTimeUpSound } from '../utils/playTimeUpSound';

const LETTERS = ['A', 'B', 'C', 'D'];

export default function Host() {
  const { socket, connected } = useSocket();
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
  const [timerMode, setTimerMode] = useState('auto'); // 'auto' | 'manual'
  const [timerStarted, setTimerStarted] = useState(true);
  const [showRoundLeaderboard, setShowRoundLeaderboard] = useState(false);
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
    });
    socket.on(SOCKET_EVENTS.PLAYER_JOINED, ({ players: p }) => setPlayers(p));
    socket.on(SOCKET_EVENTS.PLAYER_LEFT, ({ players: p }) => setPlayers(p));
    socket.on(SOCKET_EVENTS.GAME_STARTED, () => setPhase('question'));
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
      setTimeLeft(data.timeSec ?? 15);
      setPhase('question');
    });
    socket.on(SOCKET_EVENTS.QUESTION_TIMER_STARTED, ({ timeSec }) => {
      setTimerStarted(true);
      setTimeLeft(timeSec ?? 15);
    });
    socket.on('question_host', ({ correctIndex, correctAnswer }) => {
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
    socket.on(SOCKET_EVENTS.HOST_DISCONNECT, () => {});
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
      socket.off('question_host');
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
      <div className="min-h-screen bg-party-dark flex items-center justify-center text-party-neon">
        Подключение…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-party-dark text-white p-6 md:p-10">
      {phase === 'create' && (
        <motion.div
          className="max-w-2xl mx-auto text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <h1 className="text-4xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-party-neon to-party-pink mb-8">
            Ведущий
          </h1>
          <p className="text-slate-400 mb-6">Создайте комнату и покажите игрокам QR-код или код</p>
          <motion.button
            onClick={createRoom}
            disabled={!connected}
            className="px-10 py-5 rounded-2xl bg-party-purple hover:bg-party-neon disabled:opacity-50 text-xl font-bold transition-all hover:scale-105 shadow-lg shadow-purple-500/30"
            whileTap={{ scale: 0.98 }}
          >
            Создать комнату
          </motion.button>
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        {phase === 'lobby' && (
          <motion.div
            key="lobby"
            className="max-w-4xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <h1 className="text-3xl md:text-5xl font-bold text-party-neon mb-2">Комната создана</h1>
            <p className="text-slate-400 mb-8">Игроки подключаются по коду или QR-коду</p>
            <div className="grid md:grid-cols-2 gap-8 items-start">
              <div className="bg-slate-800/50 rounded-3xl p-8 border border-party-purple/30">
                <p className="text-slate-400 text-sm uppercase tracking-wider mb-2">Код комнаты</p>
                <p className="text-5xl md:text-6xl font-mono font-bold text-party-cyan tracking-[0.3em]">
                  {roomCode}
                </p>
                <p className="text-slate-500 mt-4 text-sm break-all">{joinUrl}</p>
              </div>
              <div className="bg-white/5 rounded-3xl p-6 flex flex-col items-center">
                <p className="text-slate-400 text-sm mb-4">Отсканируйте для входа</p>
                <QRCodeSVG value={joinUrl} size={200} level="M" className="rounded-xl" />
              </div>
            </div>
            <div className="mt-10 bg-slate-800/30 rounded-3xl p-8 border border-slate-700/50">
              <p className="text-slate-400 mb-4">Игровой пак (опционально)</p>
              <select
                value={selectedPackId}
                onChange={(e) => setSelectedPackId(e.target.value)}
                className="bg-slate-800 rounded-xl px-4 py-3 text-white border border-slate-600 w-full max-w-xs mb-6"
              >
                <option value="">— Без пакa / тест —</option>
                {packs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
              <p className="text-xl text-slate-300 mb-4">
                Игроков в лобби: <span className="text-party-neon font-bold">{players.length}</span>
              </p>
              <ul className="space-y-2 mb-8">
                {players.map((pl) => (
                  <li key={pl.id} className="text-lg text-slate-300">
                    • {pl.nickname}
                  </li>
                ))}
              </ul>
              <motion.button
                onClick={startGame}
                className="px-10 py-4 rounded-2xl bg-party-pink hover:bg-pink-400 text-xl font-bold transition-all hover:scale-105"
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
            className="max-w-4xl mx-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex justify-between items-center mb-8">
              <span className="text-slate-400">
                Вопрос {questionIndex + 1} из {totalQuestions}
              </span>
              {timerMode === 'manual' && !timerStarted ? (
                <motion.button
                  onClick={startTimer}
                  className="px-6 py-3 rounded-2xl bg-party-cyan hover:bg-party-neon text-party-dark font-bold text-lg"
                  whileTap={{ scale: 0.98 }}
                >
                  Старт таймера
                </motion.button>
              ) : (
                <span
                  className={`text-2xl font-mono font-bold ${timeLeft <= 5 ? 'text-party-pink animate-pulse' : 'text-party-cyan'}`}
                >
                  {timeLeft} сек
                </span>
              )}
            </div>
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-12 leading-tight">
              {question.question}
            </h2>
            {(question.image || question.video || question.audio) && (
              <div className="flex flex-col gap-4 mb-8">
                {question.image && (
                  <img src={question.image} alt="" className="max-h-80 w-auto rounded-2xl border border-slate-600 object-contain" />
                )}
                {question.video && (
                  <video src={question.video} controls className="max-h-80 w-full rounded-2xl border border-slate-600 bg-black" />
                )}
                {question.audio && (
                  <audio src={question.audio} controls className="w-full" />
                )}
              </div>
            )}
            {question.type === 'open' ? (
              <p className="text-party-cyan text-xl mb-8">Открытый ответ — игроки вводят текст на телефоне</p>
            ) : (
              <div className="grid grid-cols-2 gap-4 mb-12">
                {(question.options || []).map((opt, i) => (
                  <div
                    key={i}
                    className="rounded-2xl bg-slate-800/60 border border-slate-600/50 px-6 py-4 text-lg"
                  >
                    <span className="text-party-neon font-bold mr-2">{LETTERS[i]}.</span>
                    {opt}
                  </div>
                ))}
              </div>
            )}
            <div className="bg-party-purple/20 rounded-2xl p-6 border border-party-purple/40">
              <p className="text-party-neon font-semibold mb-2">Ответили:</p>
              {answered.length === 0 ? (
                <p className="text-2xl text-white">Пока никто</p>
              ) : question.type === 'open' ? (
                <ul className="space-y-2 text-white">
                  {answered.map((a, i) => (
                    <li key={i}><strong>{a.nickname}</strong>: {a.answerText != null ? a.answerText : '—'}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-2xl text-white">{answered.map((a) => a.nickname).join(', ')}</p>
              )}
            </div>
            <motion.button
              onClick={showResults}
              className="mt-8 px-8 py-4 rounded-2xl bg-party-pink hover:bg-pink-400 text-lg font-bold"
              whileTap={{ scale: 0.98 }}
            >
              Показать ответ
            </motion.button>
          </motion.div>
        )}

        {phase === 'results' && results && (
          <motion.div
            key="results"
            className="max-w-4xl mx-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {results.roundOver ? (
              showRoundLeaderboard ? (
                <>
                  <h2 className="text-3xl font-bold text-party-pink mb-2">Итоги раунда {results.roundNumber ?? 1}</h2>
                  <h3 className="text-2xl font-bold text-party-neon mb-6">Таблица лидеров</h3>
                  <ul className="space-y-3 mb-10">
                    {(results.roundLeaderboard || results.playerScores || Object.entries(results.scores || {}).map(([id, score]) => ({ nickname: id, score }))).map((item, i) => (
                      <motion.li
                        key={item.nickname}
                        className="flex justify-between items-center rounded-2xl bg-slate-800/60 px-6 py-4 text-xl border border-slate-600/50"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                      >
                        <span className="text-party-neon font-bold">#{i + 1}</span>
                        <span className="text-white">{item.nickname}</span>
                        <span className="text-party-cyan font-bold">{item.score}</span>
                      </motion.li>
                    ))}
                  </ul>
                  <motion.button
                    onClick={nextQuestion}
                    className="px-10 py-4 rounded-2xl bg-party-purple hover:bg-party-neon text-xl font-bold"
                    whileTap={{ scale: 0.98 }}
                  >
                    Следующий раунд
                  </motion.button>
                </>
              ) : (
                <>
                  <h2 className="text-3xl font-bold text-party-neon mb-6">Правильный ответ</h2>
                  {results.type === 'open' ? (
                    <p className="text-2xl text-white mb-8">{results.correctAnswer ?? ''}</p>
                  ) : question && question.options && results.correctIndex != null && (
                    <p className="text-2xl text-white mb-8">
                      {LETTERS[results.correctIndex]}. {question.options[results.correctIndex]}
                    </p>
                  )}
                  <motion.button
                    onClick={showRoundLeaderboardClick}
                    className="px-10 py-4 rounded-2xl bg-party-pink hover:bg-pink-400 text-xl font-bold"
                    whileTap={{ scale: 0.98 }}
                  >
                    Показать таблицу лидеров
                  </motion.button>
                </>
              )
            ) : (
              <>
                <h2 className="text-3xl font-bold text-party-neon mb-6">Правильный ответ</h2>
                {results.type === 'open' ? (
                  <p className="text-2xl text-white mb-6">{results.correctAnswer ?? ''}</p>
                ) : question && question.options && results.correctIndex != null && (
                  <p className="text-2xl text-white mb-6">
                    {LETTERS[results.correctIndex]}. {question.options[results.correctIndex]}
                  </p>
                )}
                <div className="bg-slate-800/50 rounded-2xl p-6 mb-8">
                  <p className="text-slate-400 mb-4">Очки после этого вопроса</p>
                  <ul className="space-y-2">
                    {(results.playerScores || Object.entries(results.scores || {}).map(([id, score]) => ({ nickname: id, score }))).map((item) => (
                      <li key={item.nickname} className="flex justify-between text-lg">
                        <span className="text-slate-300">{item.nickname}</span>
                        <span className="text-party-cyan font-bold">{item.score}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <motion.button
                  onClick={nextQuestion}
                  className="px-10 py-4 rounded-2xl bg-party-purple hover:bg-party-neon text-xl font-bold"
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
            className="max-w-2xl mx-auto text-center"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
          >
            <h1 className="text-4xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-party-neon to-party-pink mb-8">
              Игра окончена!
            </h1>
            <p className="text-slate-400 text-xl mb-10">Итоговая таблица</p>
            <ul className="space-y-4 mb-10">
              {leaderboard.map((entry, i) => (
                <motion.li
                  key={entry.nickname ? `${entry.nickname}-${i}` : i}
                  className="flex justify-between items-center rounded-2xl bg-slate-800/60 px-6 py-4 text-xl"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <span className="text-party-neon font-bold">#{i + 1}</span>
                  <span className="text-white">{entry.nickname}</span>
                  <span className="text-party-cyan font-bold">{entry.score}</span>
                </motion.li>
              ))}
            </ul>
            <motion.button
              onClick={() => {
                setPhase('create');
                setRoomCode('');
                setJoinUrl('');
              }}
              className="px-10 py-4 rounded-2xl bg-slate-600 hover:bg-slate-500 text-lg font-bold"
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
