import { useCallback, useEffect, useRef, useState } from 'react';
import { useSocket } from './useSocket';
import { GAME_STATES, ROOM_CODE_LENGTH, SOCKET_EVENTS } from '../constants';
import { playTimeUpSound } from '../utils/playTimeUpSound';
import { clearPlayerSession, loadPlayerSession, savePlayerSession } from '../utils/session';

const SCREEN_BY_STATE = {
  [GAME_STATES.LOBBY]: 'lobby',
  [GAME_STATES.QUESTION]: 'question',
  [GAME_STATES.RESULTS]: 'results',
  [GAME_STATES.GAME_OVER]: 'gameover',
};

function initialSession(roomFromUrl) {
  const saved = loadPlayerSession();
  if (!saved) return null;
  // Ссылка ведёт в другую комнату: прошлая сессия больше не нужна
  if (roomFromUrl && saved.code !== roomFromUrl.toUpperCase()) {
    clearPlayerSession();
    return null;
  }
  return saved;
}

export function usePlayerGame(roomFromUrl) {
  const connection = useSocket();
  const { socket } = connection;
  const [screen, setScreen] = useState(() => (initialSession(roomFromUrl) ? 'resuming' : 'join'));
  const [hostConnected, setHostConnected] = useState(true);
  const [roomCode, setRoomCode] = useState(roomFromUrl.toUpperCase().slice(0, ROOM_CODE_LENGTH));
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [theme, setTheme] = useState(null);
  const [title, setTitle] = useState(null);
  const [question, setQuestion] = useState(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [openAnswerText, setOpenAnswerText] = useState('');
  const [results, setResults] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [timeLeft, setTimeLeft] = useState(15);
  const [totalTime, setTotalTime] = useState(15);
  const [manualTimer, setManualTimer] = useState(false);
  const [timerStarted, setTimerStarted] = useState(true);
  const [showRoundLeaderboard, setShowRoundLeaderboard] = useState(false);
  const soundRef = useRef(-1);

  useEffect(() => {
    if (screen !== 'question' || timeLeft !== 0 || soundRef.current === questionIndex) return;
    soundRef.current = questionIndex;
    playTimeUpSound();
  }, [screen, timeLeft, questionIndex]);

  useEffect(() => {
    if (!socket) return undefined;

    const applyQuestion = (data) => {
      const manual = data.timerMode === 'manual';
      setManualTimer(manual);
      setTimerStarted(data.timerStarted ?? !manual);
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
      setTimeLeft(data.remainingSec ?? data.timeSec ?? 15);
      setTotalTime(data.timeSec ?? 15);
    };

    const handlers = {
      connect: () => {
        const saved = loadPlayerSession();
        if (saved) socket.emit(SOCKET_EVENTS.RESUME_SESSION, saved);
      },
      [SOCKET_EVENTS.ROOM_THEME]: ({ theme: nextTheme, title: nextTitle }) => {
        setTheme(nextTheme);
        setTitle(nextTitle);
      },
      [SOCKET_EVENTS.JOIN_SUCCESS]: ({ code, token, nickname: name, theme: nextTheme, title: nextTitle }) => {
        savePlayerSession({ code, token });
        if (name) setNickname(name);
        if (nextTheme !== undefined) setTheme(nextTheme);
        if (nextTitle !== undefined) setTitle(nextTitle);
        setScreen('lobby');
      },
      [SOCKET_EVENTS.JOIN_ERROR]: ({ message }) => {
        setError(message);
        setScreen('error');
      },
      [SOCKET_EVENTS.SESSION_RESUMED]: (snapshot) => {
        setRoomCode(snapshot.code);
        setNickname(snapshot.nickname);
        setHostConnected(snapshot.hostConnected);
        setTheme(snapshot.theme);
        setTitle(snapshot.title);
        setResults(snapshot.results);
        setLeaderboard(snapshot.leaderboard ?? []);
        setShowRoundLeaderboard(snapshot.showRoundLeaderboard);
        if (snapshot.question) applyQuestion(snapshot.question);
        const { myAnswer } = snapshot;
        setSelectedAnswer(typeof myAnswer === 'string' ? 'sent' : myAnswer);
        setOpenAnswerText(typeof myAnswer === 'string' ? myAnswer : '');
        setScreen(SCREEN_BY_STATE[snapshot.state]);
      },
      [SOCKET_EVENTS.SESSION_INVALID]: () => {
        clearPlayerSession();
        setScreen('join');
      },
      [SOCKET_EVENTS.SESSION_REPLACED]: () => {
        setError('Игра открыта в другой вкладке или на другом устройстве');
        setScreen('error');
      },
      [SOCKET_EVENTS.HOST_STATUS]: ({ connected }) => setHostConnected(connected),
      [SOCKET_EVENTS.GAME_STARTED]: () => {
        setScreen('question');
        setSelectedAnswer(null);
      },
      [SOCKET_EVENTS.QUESTION_START]: (data) => {
        setShowRoundLeaderboard(false);
        applyQuestion(data);
        setSelectedAnswer(null);
        setOpenAnswerText('');
        setScreen('question');
      },
      [SOCKET_EVENTS.QUESTION_TIMER_STARTED]: ({ timeSec }) => {
        setTimerStarted(true);
        setTimeLeft(timeSec ?? 15);
        setTotalTime(timeSec ?? 15);
      },
      [SOCKET_EVENTS.RESULTS]: (data) => {
        setResults(data);
        setScreen('results');
        setShowRoundLeaderboard(false);
      },
      [SOCKET_EVENTS.ROUND_LEADERBOARD_SHOWN]: () => setShowRoundLeaderboard(true),
      [SOCKET_EVENTS.GAME_OVER]: ({ leaderboard: list }) => {
        setLeaderboard(list);
        setScreen('gameover');
      },
      [SOCKET_EVENTS.HOST_DISCONNECT]: () => {
        clearPlayerSession();
        setError('Ведущий завершил игру');
        setScreen('error');
      },
    };

    for (const [event, handler] of Object.entries(handlers)) socket.on(event, handler);
    if (socket.connected) handlers.connect();
    return () => {
      for (const [event, handler] of Object.entries(handlers)) socket.off(event, handler);
    };
  }, [socket]);

  useEffect(() => {
    if (screen !== 'question' || !timerStarted || timeLeft <= 0) return undefined;
    const timer = setInterval(() => setTimeLeft((left) => left - 1), 1000);
    return () => clearInterval(timer);
  }, [screen, timerStarted, timeLeft]);

  // Как только код набран, показываем оформление этой игры на форме входа
  useEffect(() => {
    if (!socket || screen !== 'join') return;
    if (roomCode.length === ROOM_CODE_LENGTH) {
      if (socket.connected) socket.emit(SOCKET_EVENTS.PEEK_ROOM, { code: roomCode });
      else socket.once?.('connect', () => socket.emit(SOCKET_EVENTS.PEEK_ROOM, { code: roomCode }));
    } else {
      setTheme(null);
      setTitle(null);
    }
  }, [socket, screen, roomCode]);

  const joinRoom = useCallback((event) => {
    event?.preventDefault();
    setError('');
    if (!socket || !roomCode.trim()) return;
    socket.emit(SOCKET_EVENTS.JOIN_ROOM, { code: roomCode.trim(), nickname: nickname.trim() || 'Игрок' });
  }, [socket, roomCode, nickname]);

  const submitAnswer = useCallback((answerIndex) => {
    if (!socket || selectedAnswer !== null) return;
    setSelectedAnswer(answerIndex);
    socket.emit(SOCKET_EVENTS.SUBMIT_ANSWER, { answerIndex });
  }, [socket, selectedAnswer]);

  const submitOpenAnswer = useCallback((event) => {
    event?.preventDefault();
    const text = openAnswerText.trim();
    if (!socket || selectedAnswer !== null || !text) return;
    setSelectedAnswer('sent');
    socket.emit(SOCKET_EVENTS.SUBMIT_ANSWER, { answerText: text });
  }, [socket, selectedAnswer, openAnswerText]);

  const newGame = useCallback(() => {
    clearPlayerSession();
    setRoomCode('');
    setScreen('join');
  }, []);

  return {
    ...connection,
    screen, setScreen, hostConnected, roomCode, setRoomCode, nickname, setNickname, error, setError,
    theme, title, question, questionIndex, totalQuestions, selectedAnswer, openAnswerText, setOpenAnswerText,
    results, leaderboard, timeLeft, totalTime, manualTimer, timerStarted, showRoundLeaderboard,
    joinRoom, submitAnswer, submitOpenAnswer, newGame,
  };
}
