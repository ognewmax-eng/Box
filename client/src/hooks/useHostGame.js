import { useCallback, useEffect, useRef, useState } from 'react';
import { useSocket } from './useSocket';
import { GAME_STATES, SOCKET_EVENTS } from '../constants';
import { playTimeUpSound } from '../utils/playTimeUpSound';
import { clearHostSession, loadHostSession, saveHostSession } from '../utils/session';

const PHASE_BY_STATE = {
  [GAME_STATES.LOBBY]: 'lobby',
  [GAME_STATES.QUESTION]: 'question',
  [GAME_STATES.RESULTS]: 'results',
  [GAME_STATES.GAME_OVER]: 'gameover',
};

export function useHostGame() {
  const connection = useSocket();
  const { socket } = connection;
  const [phase, setPhase] = useState(() => (loadHostSession() ? 'resuming' : 'create'));
  const [roomCode, setRoomCode] = useState('');
  const [joinUrl, setJoinUrl] = useState('');
  const [players, setPlayers] = useState([]);
  const [question, setQuestion] = useState(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [answered, setAnswered] = useState([]);
  const [results, setResults] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [packs, setPacks] = useState([]);
  const [selectedPackId, setSelectedPackId] = useState('');
  const [theme, setTheme] = useState(null);
  const [title, setTitle] = useState(null);
  const [timeLeft, setTimeLeft] = useState(15);
  const [totalTime, setTotalTime] = useState(15);
  const [manualTimer, setManualTimer] = useState(false);
  const [timerStarted, setTimerStarted] = useState(true);
  const [showRoundLeaderboard, setShowRoundLeaderboard] = useState(false);
  const [notice, setNotice] = useState('');
  const soundRef = useRef(-1);

  useEffect(() => {
    if (phase !== 'question' || timeLeft !== 0 || soundRef.current === questionIndex) return;
    soundRef.current = questionIndex;
    playTimeUpSound();
  }, [phase, timeLeft, questionIndex]);

  useEffect(() => {
    fetch('/api/packs')
      .then((r) => r.json())
      .then(setPacks)
      .catch(() => setPacks([]));
  }, []);

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
        roundTitle: data.roundTitle,
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
        const saved = loadHostSession();
        if (saved) socket.emit(SOCKET_EVENTS.RESUME_SESSION, saved);
      },
      [SOCKET_EVENTS.ROOM_CREATED]: ({ code, joinUrl: url, token }) => {
        saveHostSession({ code, token });
        setRoomCode(code);
        setJoinUrl(url);
        setPhase('lobby');
        setPlayers([]);
        setNotice('');
        setSelectedPackId('');
        setTheme(null);
        setTitle(null);
      },
      [SOCKET_EVENTS.ROOM_ERROR]: ({ message }) => setNotice(message || 'Не удалось создать комнату'),
      [SOCKET_EVENTS.ROOM_THEME]: ({ theme: nextTheme, title: nextTitle }) => {
        setTheme(nextTheme);
        setTitle(nextTitle);
      },
      [SOCKET_EVENTS.SESSION_RESUMED]: (snapshot) => {
        setRoomCode(snapshot.code);
        setJoinUrl(snapshot.joinUrl);
        setPlayers(snapshot.players);
        setAnswered(snapshot.answered);
        setResults(snapshot.results);
        setLeaderboard(snapshot.leaderboard ?? []);
        setShowRoundLeaderboard(snapshot.showRoundLeaderboard);
        setTheme(snapshot.theme);
        setTitle(snapshot.title);
        setSelectedPackId(snapshot.packId ?? '');
        if (snapshot.question) applyQuestion(snapshot.question);
        setPhase(PHASE_BY_STATE[snapshot.state]);
      },
      [SOCKET_EVENTS.SESSION_INVALID]: () => {
        clearHostSession();
        setPhase('create');
      },
      [SOCKET_EVENTS.SESSION_REPLACED]: () => setPhase('replaced'),
      [SOCKET_EVENTS.PLAYER_JOINED]: ({ players: list }) => setPlayers(list),
      [SOCKET_EVENTS.PLAYER_LEFT]: ({ players: list }) => setPlayers(list),
      [SOCKET_EVENTS.GAME_STARTED]: () => setPhase('question'),
      [SOCKET_EVENTS.PACK_LOAD_ERROR]: ({ message }) => setNotice(message || 'Пак не загружен'),
      [SOCKET_EVENTS.QUESTION_START]: (data) => {
        setShowRoundLeaderboard(false);
        setAnswered([]);
        setResults(null);
        setNotice('');
        applyQuestion(data);
        setPhase('question');
      },
      [SOCKET_EVENTS.QUESTION_TIMER_STARTED]: ({ timeSec }) => {
        setTimerStarted(true);
        setTimeLeft(timeSec ?? 15);
        setTotalTime(timeSec ?? 15);
      },
      [SOCKET_EVENTS.PLAYER_ANSWERED]: ({ nickname }) => {
        // Текст открытых ответов на большой экран не выводим до показа правильного
        setAnswered((prev) => [...prev, { nickname }]);
      },
      [SOCKET_EVENTS.RESULTS]: (data) => {
        setResults(data);
        setPhase('results');
        setShowRoundLeaderboard(false);
      },
      [SOCKET_EVENTS.ROUND_LEADERBOARD_SHOWN]: () => setShowRoundLeaderboard(true),
      [SOCKET_EVENTS.GAME_OVER]: ({ leaderboard: list }) => {
        setLeaderboard(list);
        setPhase('gameover');
      },
      [SOCKET_EVENTS.HOST_DISCONNECT]: () => {
        clearHostSession();
        setPhase('create');
      },
    };

    for (const [event, handler] of Object.entries(handlers)) socket.on(event, handler);
    if (socket.connected) handlers.connect();
    return () => {
      for (const [event, handler] of Object.entries(handlers)) socket.off(event, handler);
    };
  }, [socket]);

  useEffect(() => {
    if (phase !== 'question' || !timerStarted || timeLeft <= 0) return undefined;
    const timer = setInterval(() => setTimeLeft((left) => left - 1), 1000);
    return () => clearInterval(timer);
  }, [phase, timerStarted, timeLeft]);

  const emit = useCallback((event, payload) => socket?.emit(event, payload), [socket]);

  const resetRoom = useCallback(() => {
    clearHostSession();
    setRoomCode('');
    setJoinUrl('');
    setPlayers([]);
    setTheme(null);
    setTitle(null);
    setSelectedPackId('');
    setPhase('create');
  }, []);

  return {
    ...connection,
    phase, roomCode, joinUrl, players, question, questionIndex, totalQuestions, answered, results,
    leaderboard, packs, selectedPackId, theme, title, timeLeft, totalTime, manualTimer, timerStarted,
    showRoundLeaderboard, notice,
    createRoom: () => emit(SOCKET_EVENTS.CREATE_ROOM, { joinBaseUrl: window.location.origin }),
    selectPack: (packId) => {
      setSelectedPackId(packId);
      emit(SOCKET_EVENTS.SELECT_PACK, { packId: packId || null });
    },
    startGame: () => emit(SOCKET_EVENTS.START_GAME, { packId: selectedPackId || undefined }),
    showResults: () => emit(SOCKET_EVENTS.SHOW_RESULTS),
    nextQuestion: () => emit(SOCKET_EVENTS.NEXT_QUESTION),
    startTimer: () => emit(SOCKET_EVENTS.HOST_START_TIMER),
    showLeaderboard: () => {
      setShowRoundLeaderboard(true);
      emit(SOCKET_EVENTS.HOST_SHOW_ROUND_LEADERBOARD);
    },
    endRoom: () => {
      if (!window.confirm('Завершить игру для всех участников?')) return;
      emit(SOCKET_EVENTS.END_ROOM);
      resetRoom();
    },
    newRoom: () => {
      emit(SOCKET_EVENTS.END_ROOM);
      resetRoom();
    },
  };
}
