import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '../hooks/useSocket';
import { SOCKET_EVENTS } from '../constants';
import { playTimeUpSound } from '../utils/playTimeUpSound';

const LETTERS = ['A', 'B', 'C', 'D'];

export default function Client() {
  const [searchParams] = useSearchParams();
  const roomFromUrl = searchParams.get('room') || '';
  const { socket, connected } = useSocket();
  const [screen, setScreen] = useState('join'); // join | lobby | question | results | gameover | error
  const [roomCode, setRoomCode] = useState(roomFromUrl.toUpperCase());
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [question, setQuestion] = useState(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [openAnswerText, setOpenAnswerText] = useState('');
  const [results, setResults] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [timeLeft, setTimeLeft] = useState(15);
  const [timerMode, setTimerMode] = useState('auto');
  const [timerStarted, setTimerStarted] = useState(true);
  const [showRoundLeaderboard, setShowRoundLeaderboard] = useState(false);
  const timeUpSoundRef = useRef({ questionIndex: -1, played: false });

  useEffect(() => {
    if (screen !== 'question' || timeLeft !== 0) return;
    if (timeUpSoundRef.current.questionIndex !== questionIndex) {
      timeUpSoundRef.current = { questionIndex, played: false };
    }
    if (!timeUpSoundRef.current.played) {
      timeUpSoundRef.current.played = true;
      playTimeUpSound();
    }
  }, [screen, timeLeft, questionIndex]);

  useEffect(() => {
    if (!socket) return;
    socket.on(SOCKET_EVENTS.JOIN_SUCCESS, () => setScreen('lobby'));
    socket.on(SOCKET_EVENTS.JOIN_ERROR, ({ message }) => {
      setError(message);
      setScreen('error');
    });
    socket.on(SOCKET_EVENTS.GAME_STARTED, () => {
      setScreen('question');
      setSelectedAnswer(null);
    });
    socket.on(SOCKET_EVENTS.QUESTION_START, (data) => {
      setShowRoundLeaderboard(false);
      const mode = data.timerMode === 'manual' ? 'manual' : 'auto';
      setTimerMode(mode);
      setTimerStarted(mode === 'auto');
      setQuestion({
        type: data.type || 'choice',
        question: data.question,
        options: data.options || [],
        image: data.image,
        video: data.video,
        audio: data.audio,
      });
      setQuestionIndex(data.questionIndex);
      setTotalQuestions(data.total);
      setSelectedAnswer(null);
      setOpenAnswerText('');
      setTimeLeft(data.timeSec ?? 15);
      setScreen('question');
    });
    socket.on(SOCKET_EVENTS.QUESTION_TIMER_STARTED, ({ timeSec }) => {
      setTimerStarted(true);
      setTimeLeft(timeSec ?? 15);
    });
    socket.on(SOCKET_EVENTS.RESULTS, (data) => {
      setResults(data);
      setScreen('results');
      if (data.roundOver) setShowRoundLeaderboard(false);
    });
    socket.on(SOCKET_EVENTS.ROUND_LEADERBOARD_SHOWN, () => setShowRoundLeaderboard(true));
    socket.on(SOCKET_EVENTS.GAME_OVER, ({ leaderboard: lb }) => {
      setLeaderboard(lb);
      setScreen('gameover');
    });
    socket.on(SOCKET_EVENTS.HOST_DISCONNECT, () => {
      setError('Ведущий отключился');
      setScreen('error');
    });
    return () => {
      socket.off(SOCKET_EVENTS.JOIN_SUCCESS);
      socket.off(SOCKET_EVENTS.JOIN_ERROR);
      socket.off(SOCKET_EVENTS.GAME_STARTED);
      socket.off(SOCKET_EVENTS.QUESTION_START);
      socket.off(SOCKET_EVENTS.QUESTION_TIMER_STARTED);
      socket.off(SOCKET_EVENTS.RESULTS);
      socket.off(SOCKET_EVENTS.ROUND_LEADERBOARD_SHOWN);
      socket.off(SOCKET_EVENTS.GAME_OVER);
      socket.off(SOCKET_EVENTS.HOST_DISCONNECT);
    };
  }, [socket]);

  useEffect(() => {
    if (screen !== 'question' || !timerStarted || timeLeft <= 0) return;
    const t = setInterval(() => setTimeLeft((l) => l - 1), 1000);
    return () => clearInterval(t);
  }, [screen, timerStarted, timeLeft]);

  const joinRoom = useCallback(
    (e) => {
      e?.preventDefault();
      setError('');
      if (!socket || !roomCode.trim()) return;
      socket.emit(SOCKET_EVENTS.JOIN_ROOM, {
        code: roomCode.trim().toUpperCase(),
        nickname: nickname.trim() || 'Игрок',
      });
    },
    [socket, roomCode, nickname]
  );

  const submitAnswer = useCallback(
    (answerIndex) => {
      if (!socket || selectedAnswer !== null) return;
      setSelectedAnswer(answerIndex);
      socket.emit(SOCKET_EVENTS.SUBMIT_ANSWER, { answerIndex });
    },
    [socket, selectedAnswer]
  );

  const submitOpenAnswer = useCallback(
    (e) => {
      e?.preventDefault();
      if (!socket || selectedAnswer !== null) return;
      const text = openAnswerText.trim();
      if (!text) return;
      setSelectedAnswer('sent');
      socket.emit(SOCKET_EVENTS.SUBMIT_ANSWER, { answerText: text });
    },
    [socket, selectedAnswer, openAnswerText]
  );

  if (!socket) {
    return (
      <div className="min-h-screen bg-party-dark flex items-center justify-center text-party-neon p-4">
        Подключение…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-party-dark text-white p-4 pb-10 safe-area-pb">
      <AnimatePresence mode="wait">
        {screen === 'join' && (
          <motion.div
            key="join"
            className="max-w-md mx-auto pt-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-party-neon to-party-pink mb-2">
              Войти в игру
            </h1>
            <p className="text-slate-400 mb-8">Введите код комнаты и имя</p>
            <form onSubmit={joinRoom} className="space-y-4">
              <div>
                <label className="block text-slate-400 text-sm mb-2">Код комнаты</label>
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase().slice(0, 4))}
                  placeholder="XXXX"
                  maxLength={4}
                  className="w-full rounded-2xl bg-slate-800 border border-slate-600 px-4 py-4 text-xl font-mono tracking-[0.4em] text-center text-white placeholder-slate-500 focus:border-party-purple focus:ring-2 focus:ring-party-purple/50 outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-2">Ваше имя</label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value.slice(0, 20))}
                  placeholder="Никнейм"
                  className="w-full rounded-2xl bg-slate-800 border border-slate-600 px-4 py-4 text-lg text-white placeholder-slate-500 focus:border-party-purple focus:ring-2 focus:ring-party-purple/50 outline-none"
                />
              </div>
              <motion.button
                type="submit"
                disabled={!connected || !roomCode.trim()}
                className="w-full py-4 rounded-2xl bg-party-purple hover:bg-party-neon disabled:opacity-50 text-lg font-bold transition-all active:scale-[0.98]"
                whileTap={{ scale: 0.98 }}
              >
                Войти
              </motion.button>
            </form>
          </motion.div>
        )}

        {screen === 'error' && (
          <motion.div
            key="error"
            className="max-w-md mx-auto pt-8 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <p className="text-party-pink text-xl mb-6">{error}</p>
            <motion.button
              onClick={() => { setScreen('join'); setError(''); }}
              className="px-8 py-4 rounded-2xl bg-slate-600 hover:bg-slate-500 font-bold"
              whileTap={{ scale: 0.98 }}
            >
              Назад
            </motion.button>
          </motion.div>
        )}

        {screen === 'lobby' && (
          <motion.div
            key="lobby"
            className="max-w-md mx-auto pt-8 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <h2 className="text-2xl font-bold text-party-neon mb-2">Вы в игре!</h2>
            <p className="text-slate-400">Ожидайте начала раунда на экране ведущего.</p>
            <motion.div
              className="mt-8 p-6 rounded-2xl bg-slate-800/50 border border-party-purple/30"
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              <span className="text-party-cyan">Ожидание...</span>
            </motion.div>
          </motion.div>
        )}

        {screen === 'question' && question && (
          <motion.div
            key="question"
            className="max-w-md mx-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex justify-between items-center mb-4">
              <span className="text-slate-400">
                {questionIndex + 1} / {totalQuestions}
              </span>
              {timerMode === 'manual' && !timerStarted ? (
                <span className="text-slate-400 text-sm">Ожидайте старта таймера</span>
              ) : (
                <span className={`font-mono font-bold ${timeLeft <= 5 ? 'text-party-pink' : 'text-party-cyan'}`}>
                  {timeLeft}
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-white mb-6 leading-snug">{question.question}</h2>
            {(question.image || question.video || question.audio) && (
              <div className="flex flex-col gap-3 mb-6">
                {question.image && (
                  <img src={question.image} alt="" className="max-h-48 w-full rounded-xl border border-slate-600 object-contain bg-slate-800/50" />
                )}
                {question.video && (
                  <video src={question.video} controls className="max-h-48 w-full rounded-xl border border-slate-600 bg-black" />
                )}
                {question.audio && (
                  <audio src={question.audio} controls className="w-full" />
                )}
              </div>
            )}
            {question.type === 'open' ? (
              <form onSubmit={submitOpenAnswer} className="space-y-4">
                <input
                  type="text"
                  value={openAnswerText}
                  onChange={(e) => setOpenAnswerText(e.target.value)}
                  placeholder="Введите ответ..."
                  disabled={selectedAnswer !== null}
                  className="w-full rounded-2xl bg-slate-800 border-2 border-slate-600 px-5 py-4 text-lg text-white placeholder-slate-500 focus:border-party-purple outline-none disabled:opacity-50"
                  autoComplete="off"
                />
                <motion.button
                  type="submit"
                  disabled={selectedAnswer !== null || !openAnswerText.trim()}
                  className="w-full py-4 rounded-2xl bg-party-purple hover:bg-party-neon disabled:opacity-50 text-lg font-bold"
                  whileTap={{ scale: 0.98 }}
                >
                  Отправить ответ
                </motion.button>
              </form>
            ) : (
              <div className="space-y-3">
                {(question.options || []).map((opt, i) => (
                  <motion.button
                    key={i}
                    onClick={() => submitAnswer(i)}
                    disabled={selectedAnswer !== null}
                    className={`w-full rounded-2xl px-5 py-4 text-left text-lg font-medium transition-all active:scale-[0.98] flex items-center ${
                      selectedAnswer === i
                        ? 'bg-party-purple border-2 border-party-neon text-white'
                        : selectedAnswer !== null
                          ? 'bg-slate-800/50 text-slate-500 border-2 border-slate-700'
                          : 'bg-slate-800 border-2 border-slate-600 text-white hover:border-party-purple'
                    }`}
                    whileTap={selectedAnswer === null ? { scale: 0.98 } : {}}
                  >
                    <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center mr-3 font-bold text-party-neon">
                      {LETTERS[i]}
                    </span>
                    {opt}
                  </motion.button>
                ))}
              </div>
            )}
            {selectedAnswer !== null && (
              <motion.p
                className="mt-6 text-center text-party-cyan font-medium"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                Ответ принят!
              </motion.p>
            )}
          </motion.div>
        )}

        {screen === 'results' && (
          <motion.div
            key="results"
            className="max-w-md mx-auto pt-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {results?.roundOver ? (
              showRoundLeaderboard ? (
                <>
                  <h2 className="text-2xl font-bold text-party-pink mb-2">Итоги раунда {results.roundNumber ?? 1}</h2>
                  <h3 className="text-xl font-bold text-party-neon mb-4">Таблица лидеров</h3>
                  <ul className="space-y-3 mb-8">
                    {(results?.roundLeaderboard || results?.playerScores || []).map((entry, i) => (
                      <motion.li
                        key={entry.nickname ? `${entry.nickname}-${i}` : i}
                        className="flex justify-between items-center rounded-2xl bg-slate-800/60 px-4 py-4 border border-slate-600/50"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                      >
                        <span className="text-party-neon font-bold">#{i + 1}</span>
                        <span className="text-white">{entry.nickname}</span>
                        <span className="text-party-cyan font-bold">{entry.score}</span>
                      </motion.li>
                    ))}
                  </ul>
                  <p className="text-slate-400 text-center">
                    Следующий раунд скоро…
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-2xl font-bold text-party-neon mb-4">Правильный ответ</h2>
                  <p className="text-slate-400 text-center mb-6">Показан на экране ведущего</p>
                  <p className="text-slate-500 text-center">
                    Ожидайте таблицу лидеров…
                  </p>
                </>
              )
            ) : (
              <>
                <h2 className="text-2xl font-bold text-party-neon mb-6">Результаты</h2>
                <ul className="space-y-3 mb-6">
                  {(results?.playerScores || []).map((entry, i) => (
                    <li
                      key={entry.nickname ? `${entry.nickname}-${i}` : i}
                      className="flex justify-between items-center rounded-2xl bg-slate-800/60 px-4 py-3"
                    >
                      <span className="text-party-neon font-bold">#{i + 1}</span>
                      <span className="text-white">{entry.nickname}</span>
                      <span className="text-party-cyan font-bold">{entry.score}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-slate-400 text-center">
                  Следующий вопрос скоро…
                </p>
              </>
            )}
          </motion.div>
        )}

        {screen === 'gameover' && (
          <motion.div
            key="gameover"
            className="max-w-md mx-auto pt-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-party-neon to-party-pink mb-8 text-center">
              Игра окончена!
            </h1>
            <ul className="space-y-3 mb-10">
              {leaderboard.map((entry, i) => (
                <motion.li
                  key={entry.nickname ? `${entry.nickname}-${i}` : i}
                  className="flex justify-between items-center rounded-2xl bg-slate-800/60 px-4 py-4 text-lg"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                >
                  <span className="text-party-neon font-bold">#{i + 1}</span>
                  <span className="text-white">{entry.nickname}</span>
                  <span className="text-party-cyan font-bold">{entry.score}</span>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
