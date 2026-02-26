import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Gamepad2 } from 'lucide-react';
import { useSocket } from '../hooks/useSocket';
import { SOCKET_EVENTS, ROOM_CODE_LENGTH } from '../constants';
import { playTimeUpSound } from '../utils/playTimeUpSound';

const LETTERS = ['A', 'B', 'C', 'D'];
const ANSWER_COLORS = ['#ef4444', '#3b82f6', '#10b981', '#fbbf24'];

export default function Client() {
  const [searchParams] = useSearchParams();
  const roomFromUrl = searchParams.get('room') || '';
  const { socket, connected, retry, connectionError } = useSocket();
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
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center text-[#22d3ee] p-4">
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
    <div className="min-h-screen bg-[#0a0a0f] text-white p-4 pb-10 safe-area-pb relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-72 h-72 bg-[#a855f7] rounded-full blur-[120px] opacity-20" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-[#22d3ee] rounded-full blur-[120px] opacity-20" />
      </div>
      <AnimatePresence mode="wait">
        {screen === 'join' && (
          <motion.div
            key="join"
            className="relative z-10 max-w-md mx-auto pt-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="text-center mb-8">
              <div className="flex items-center justify-center mb-3">
                <Gamepad2 className="w-10 h-10 text-[#a855f7]" />
              </div>
              <h1 className="text-3xl font-black text-white mb-2">
                BOX <span className="text-[#a855f7]">PARTY</span>
              </h1>
              <p className="text-gray-400">Введите код комнаты и имя</p>
            </div>
            <form onSubmit={joinRoom} className="space-y-6">
              <div>
                <label htmlFor="client-room-code" className="block text-gray-400 text-sm mb-2">Код комнаты</label>
                <input
                  id="client-room-code"
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase().slice(0, ROOM_CODE_LENGTH))}
                  placeholder="XXXX"
                  maxLength={ROOM_CODE_LENGTH}
                  className="w-full rounded-2xl bg-white/5 border-2 border-white/10 px-4 py-5 text-2xl font-black tracking-[0.3em] text-center text-white placeholder-gray-600 focus:border-[#a855f7] focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label htmlFor="client-nickname" className="block text-gray-400 text-sm mb-2">Ваше имя</label>
                <input
                  id="client-nickname"
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value.slice(0, 20))}
                  placeholder="Никнейм"
                  className="w-full rounded-2xl bg-white/5 border-2 border-white/10 px-4 py-4 text-lg font-bold text-white placeholder-gray-600 focus:border-[#22d3ee] focus:outline-none transition-colors"
                />
              </div>
              <motion.button
                type="submit"
                disabled={!connected || !roomCode.trim()}
                className="w-full py-6 rounded-2xl bg-gradient-to-r from-[#a855f7] to-[#7c3aed] text-white text-xl font-black disabled:opacity-50 transition-all hover:shadow-nexus-purple active:scale-[0.98]"
                whileTap={{ scale: 0.98 }}
              >
                Войти в игру
              </motion.button>
            </form>
          </motion.div>
        )}

        {screen === 'error' && (
          <motion.div
            key="error"
            className="relative z-10 max-w-md mx-auto pt-8 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <p className="text-[#ef4444] text-xl mb-6">{error}</p>
            <motion.button
              onClick={() => { setScreen('join'); setError(''); }}
              className="px-8 py-4 rounded-2xl bg-white/10 border border-white/10 hover:bg-white/20 font-bold"
              whileTap={{ scale: 0.98 }}
            >
              Назад
            </motion.button>
          </motion.div>
        )}

        {screen === 'lobby' && (
          <motion.div
            key="lobby"
            className="relative z-10 max-w-md mx-auto pt-8 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <h2 className="text-2xl font-black text-white mb-2">Вы в игре!</h2>
            <p className="text-gray-400 mb-8">Ожидайте начала раунда на экране ведущего.</p>
            <motion.div
              className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 backdrop-blur-xl p-8"
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              <span className="text-[#22d3ee] font-bold">Ожидание...</span>
            </motion.div>
          </motion.div>
        )}

        {screen === 'question' && question && (
          <motion.div
            key="question"
            className="relative z-10 max-w-md mx-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex justify-between items-center mb-4">
              <span className="text-gray-400 font-bold">
                {questionIndex + 1} / {totalQuestions}
              </span>
              {timerMode === 'manual' && !timerStarted ? (
                <span className="text-gray-400 text-sm">Ожидайте старта таймера</span>
              ) : (
                <span className={`font-mono font-black ${timeLeft <= 5 ? 'text-[#fbbf24]' : 'text-[#22d3ee]'}`}>
                  {timeLeft}
                </span>
              )}
            </div>
            <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl p-6 mb-6">
              <h2 className="text-xl font-bold text-white mb-4 leading-snug">{question.question}</h2>
              {(question.image || question.video || question.audio) && (
                <div className="flex flex-col gap-3 mb-4">
                  {question.image && (
                    <img src={question.image} alt="" className="max-h-48 w-full rounded-xl border border-white/10 object-contain bg-black/30" />
                  )}
                  {question.video && (
                    <video src={question.video} controls className="max-h-48 w-full rounded-xl border border-white/10 bg-black" />
                  )}
                  {question.audio && (
                    <audio src={question.audio} controls className="w-full" />
                  )}
                </div>
              )}
            </div>
            {question.type === 'open' ? (
              <form onSubmit={submitOpenAnswer} className="space-y-4">
                <input
                  type="text"
                  value={openAnswerText}
                  onChange={(e) => setOpenAnswerText(e.target.value)}
                  placeholder="Введите ответ..."
                  disabled={selectedAnswer !== null}
                  className="w-full rounded-2xl bg-white/5 border-2 border-white/10 px-5 py-4 text-lg text-white placeholder-gray-500 focus:border-[#a855f7] outline-none disabled:opacity-50"
                  autoComplete="off"
                />
                <motion.button
                  type="submit"
                  disabled={selectedAnswer !== null || !openAnswerText.trim()}
                  className="w-full py-5 rounded-2xl bg-gradient-to-r from-[#a855f7] to-[#7c3aed] text-white text-lg font-black disabled:opacity-50 hover:shadow-nexus-purple"
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
                    className={`w-full rounded-2xl px-5 py-4 text-left text-lg font-bold transition-all active:scale-[0.98] flex items-center border-2 ${
                      selectedAnswer === i
                        ? 'bg-white/10 border-white/30 text-white shadow-lg'
                        : selectedAnswer !== null
                          ? 'bg-white/5 text-gray-500 border-white/10'
                          : 'bg-white/5 border-white/10 text-white hover:border-white/20'
                    }`}
                    whileTap={selectedAnswer === null ? { scale: 0.98 } : {}}
                  >
                    <span
                      className="w-10 h-10 rounded-xl flex items-center justify-center mr-4 font-black text-white shrink-0"
                      style={{ backgroundColor: ANSWER_COLORS[i % 4] }}
                    >
                      {LETTERS[i]}
                    </span>
                    {opt}
                  </motion.button>
                ))}
              </div>
            )}
            {selectedAnswer !== null && (
              <motion.p
                className="mt-6 text-center text-[#22d3ee] font-bold"
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
            className="relative z-10 max-w-md mx-auto pt-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {results?.roundOver ? (
              showRoundLeaderboard ? (
                <>
                  <h2 className="text-2xl font-black text-white mb-2">Итоги раунда {results.roundNumber ?? 1}</h2>
                  <h3 className="text-xl font-bold text-[#a855f7] mb-4">Таблица лидеров</h3>
                  <ul className="space-y-3 mb-8">
                    {(results?.roundLeaderboard || results?.playerScores || []).map((entry, i) => (
                      <motion.li
                        key={entry.nickname ? `${entry.nickname}-${i}` : i}
                        className="flex justify-between items-center rounded-2xl bg-white/5 border border-white/10 px-4 py-4"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                      >
                        <span className="text-[#a855f7] font-bold">#{i + 1}</span>
                        <span className="text-white">{entry.nickname}</span>
                        <span className="text-[#fbbf24] font-bold">{entry.score}</span>
                      </motion.li>
                    ))}
                  </ul>
                  <p className="text-gray-400 text-center">
                    Следующий раунд скоро…
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-2xl font-bold text-[#a855f7] mb-4">Правильный ответ</h2>
                  <p className="text-gray-400 text-center mb-6">Показан на экране ведущего</p>
                  <p className="text-gray-500 text-center">
                    Ожидайте таблицу лидеров…
                  </p>
                </>
              )
            ) : (
              <>
                <h2 className="text-2xl font-bold text-[#a855f7] mb-6">Результаты</h2>
                <ul className="space-y-3 mb-6">
                  {(results?.playerScores || []).map((entry, i) => (
                    <li
                      key={entry.nickname ? `${entry.nickname}-${i}` : i}
                      className="flex justify-between items-center rounded-2xl bg-white/5 border border-white/10 px-4 py-3"
                    >
                      <span className="text-[#a855f7] font-bold">#{i + 1}</span>
                      <span className="text-white">{entry.nickname}</span>
                      <span className="text-[#fbbf24] font-bold">{entry.score}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-gray-400 text-center">
                  Следующий вопрос скоро…
                </p>
              </>
            )}
          </motion.div>
        )}

        {screen === 'gameover' && (
          <motion.div
            key="gameover"
            className="relative z-10 max-w-md mx-auto pt-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#a855f7] via-[#22d3ee] to-[#fbbf24] mb-8 text-center">
              Игра окончена!
            </h1>
            <ul className="space-y-3 mb-10">
              {leaderboard.map((entry, i) => (
                <motion.li
                  key={entry.nickname ? `${entry.nickname}-${i}` : i}
                  className="flex justify-between items-center rounded-2xl bg-white/5 border border-white/10 px-4 py-4 text-lg"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                >
                  <span className="text-[#a855f7] font-bold">#{i + 1}</span>
                  <span className="text-white">{entry.nickname}</span>
                  <span className="text-[#fbbf24] font-bold">{entry.score}</span>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
