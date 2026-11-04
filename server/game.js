import { randomInt, randomUUID } from 'crypto';
import { GAME_STATES, QUESTION_TIME_SEC, ROOM_CODE_LENGTH, SOCKET_EVENTS as EV } from '../constants.js';
import { loadPackForGame, normalizeAnswer, normalizeQuestion, readPack, resolveMediaUrl } from './packs.js';
import { buildJoinUrl } from './network.js';

const DEFAULTS = {
  hostGraceMs: 5 * 60 * 1000, // сколько комната ждёт вернувшегося ведущего
  lobbyGraceMs: 60 * 1000, // сколько игрок числится в лобби после обрыва связи
  roomTtlMs: 2 * 60 * 60 * 1000, // удаление комнат без активности
  sweepIntervalMs: 5 * 60 * 1000,
  maxRooms: 100,
  maxPlayers: 100,
  maxFailedJoins: 20,
  secondMs: 1000, // длина «секунды» таймера вопроса; в тестах меньше
};
const NICKNAME_MAX = 30;
const OPEN_ANSWER_MAX = 200;

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) code += chars[randomInt(chars.length)];
  return code;
}

function publicPlayers(room) {
  return [...room.players.values()].map((p) => ({ id: p.id, nickname: p.nickname, connected: p.connected }));
}

function leaderboardOf(room) {
  return [...room.players.values()]
    .map((p) => ({ nickname: p.nickname, score: room.scores.get(p.id) ?? 0 }))
    .sort((a, b) => b.score - a.score);
}

function questionPayload(room, opts) {
  const q = room.questions[room.currentQuestionIndex];
  if (!q) return null;
  const timeSec = room.answerTimeSec;
  const remainingSec = room.state === GAME_STATES.QUESTION && room.timerStarted
    ? Math.max(0, Math.ceil((room.deadline - Date.now()) / opts.secondMs))
    : timeSec;
  const roundIndex = room.questionRounds?.[room.currentQuestionIndex] ?? 0;
  return {
    questionIndex: room.currentQuestionIndex,
    total: room.questions.length,
    type: q.type,
    question: q.question,
    options: q.type === 'choice' ? q.options : undefined,
    timeSec,
    remainingSec,
    timerMode: room.timerModes[room.currentQuestionIndex] || 'auto',
    timerStarted: room.timerStarted,
    roundNumber: roundIndex + 1,
    roundTitle: room.roundTitles?.[roundIndex] || undefined,
    image: resolveMediaUrl(q.image),
    video: resolveMediaUrl(q.video),
    audio: resolveMediaUrl(q.audio),
  };
}

function hostAnswerKey(room) {
  const q = room.questions[room.currentQuestionIndex];
  if (!q) return null;
  return q.type === 'open' ? { correctAnswer: q.correctAnswer } : { correctIndex: q.correctIndex };
}

function buildSnapshot(room, role, player, opts) {
  const base = {
    role,
    code: room.code,
    state: room.state,
    hostConnected: room.hostConnected,
    question: room.state === GAME_STATES.LOBBY ? null : questionPayload(room, opts),
    results: room.state === GAME_STATES.RESULTS ? room.lastResults : null,
    showRoundLeaderboard: room.roundLeaderboardShown,
    leaderboard: room.state === GAME_STATES.GAME_OVER ? leaderboardOf(room) : null,
  };
  if (role === 'host') {
    return {
      ...base,
      joinUrl: room.joinUrl,
      players: publicPlayers(room),
      answerKey: room.state === GAME_STATES.LOBBY ? null : hostAnswerKey(room),
      answered: [...room.answers.entries()].map(([id, value]) => ({
        nickname: room.players.get(id)?.nickname ?? '',
        answerText: typeof value === 'string' ? value : undefined,
      })),
    };
  }
  return { ...base, nickname: player.nickname, myAnswer: room.answers.get(player.id) ?? null };
}

export function registerGame(io, { gamesDir, lanIp, port, ...overrides }) {
  const opts = { ...DEFAULTS, ...overrides };
  const rooms = new Map();

  const getRoom = (code) => (typeof code === 'string' ? rooms.get(code.trim().toUpperCase()) : undefined);

  function unbindSocket(socketId, code) {
    const socket = io.sockets.sockets.get(socketId);
    if (!socket) return;
    socket.leave(code);
    socket.data.roomCode = null;
    socket.data.role = null;
    socket.data.playerId = null;
  }

  function clearRoomTimers(room) {
    clearTimeout(room.currentTimer);
    clearTimeout(room.hostTimer);
    room.currentTimer = null;
    room.hostTimer = null;
    for (const player of room.players.values()) clearTimeout(player.removeTimer);
  }

  function destroyRoom(room, { notify = true } = {}) {
    clearRoomTimers(room);
    if (notify) io.to(room.code).emit(EV.HOST_DISCONNECT);
    if (room.hostSocketId) unbindSocket(room.hostSocketId, room.code);
    for (const player of room.players.values()) {
      if (player.socketId) unbindSocket(player.socketId, room.code);
    }
    rooms.delete(room.code);
  }

  const sweep = setInterval(() => {
    const threshold = Date.now() - opts.roomTtlMs;
    for (const room of rooms.values()) {
      if (room.lastActivity < threshold) destroyRoom(room);
    }
  }, opts.sweepIntervalMs);
  sweep.unref();

  function finishQuestion(room) {
    if (room.state !== GAME_STATES.QUESTION) return;
    const question = room.questions[room.currentQuestionIndex];
    clearTimeout(room.currentTimer);
    room.currentTimer = null;
    room.state = GAME_STATES.RESULTS;
    room.roundLeaderboardShown = false;

    const isOpen = question.type === 'open';
    const correctNorm = isOpen ? normalizeAnswer(question.correctAnswer) : null;
    for (const id of room.players.keys()) {
      const answer = room.answers.get(id);
      const isCorrect = isOpen
        ? Boolean(correctNorm) && normalizeAnswer(answer) === correctNorm
        : answer === question.correctIndex;
      if (isCorrect) room.scores.set(id, (room.scores.get(id) ?? 0) + 1);
    }

    const sorted = leaderboardOf(room);
    const roundPosition = room.roundEndIndices.indexOf(room.currentQuestionIndex);
    const roundOver = roundPosition !== -1;
    room.lastResults = {
      questionIndex: room.currentQuestionIndex,
      type: question.type,
      correctIndex: isOpen ? undefined : question.correctIndex,
      correctAnswer: isOpen ? question.correctAnswer : undefined,
      playerScores: sorted,
      roundOver,
      roundNumber: roundOver ? roundPosition + 1 : 0,
      roundTitle: roundOver ? room.roundTitles?.[roundPosition] || undefined : undefined,
      roundLeaderboard: roundOver ? sorted : undefined,
    };
    io.to(room.code).emit(EV.RESULTS, room.lastResults);
  }

  function armQuestionTimer(room) {
    const index = room.currentQuestionIndex;
    room.timerStarted = true;
    room.deadline = Date.now() + room.answerTimeSec * opts.secondMs;
    clearTimeout(room.currentTimer);
    room.currentTimer = setTimeout(() => {
      if (rooms.get(room.code) === room && room.currentQuestionIndex === index) finishQuestion(room);
    }, room.answerTimeSec * opts.secondMs);
  }

  function startQuestion(room, index) {
    clearTimeout(room.currentTimer);
    room.currentTimer = null;
    room.currentQuestionIndex = index;
    room.state = GAME_STATES.QUESTION;
    room.answers = new Map();
    room.lastResults = null;
    room.timerStarted = false;
    if (room.timerModes[index] !== 'manual') armQuestionTimer(room);

    io.to(room.code).emit(EV.QUESTION_START, questionPayload(room, opts));
    if (room.hostSocketId) io.to(room.hostSocketId).emit(EV.QUESTION_HOST, hostAnswerKey(room));
  }

  function loadQuestions(socket, packId) {
    if (packId != null && packId !== '') {
      try {
        const data = readPack(gamesDir, packId);
        if (!data) throw new Error(`Пак не найден: ${String(packId).slice(0, 64)}`);
        const pack = loadPackForGame(data);
        if (pack.questions.length > 0) return pack;
        throw new Error('В паке нет вопросов');
      } catch (err) {
        console.error(err.message);
        socket.emit(EV.PACK_LOAD_ERROR, { message: 'Пак не загружен, используется пример вопроса' });
      }
    }
    return {
      questions: [normalizeQuestion({
        type: 'choice',
        question: 'Пример вопроса?',
        options: ['Вариант A', 'Вариант B', 'Вариант C', 'Вариант D'],
        correctIndex: 0,
      })],
      timerModes: ['auto'],
      roundEndIndices: [0],
      questionRounds: [0],
      roundTitles: [''],
      answerTimeSec: QUESTION_TIME_SEC,
    };
  }

  function removePlayer(room, player) {
    clearTimeout(player.removeTimer);
    room.players.delete(player.id);
    io.to(room.code).emit(EV.PLAYER_LEFT, { players: publicPlayers(room) });
  }

  function findRoomOfHost(socket) {
    if (socket.data.role !== 'host') return null;
    const room = getRoom(socket.data.roomCode);
    return room && room.hostSocketId === socket.id ? room : null;
  }

  function touchRoom(socket) {
    const room = getRoom(socket.data.roomCode);
    if (room) room.lastActivity = Date.now();
  }

  // Игрок сменил комнату с этого же соединения: старая запись больше не его
  function leaveCurrentRoom(socket) {
    const room = getRoom(socket.data.roomCode);
    if (room && socket.data.role === 'player') {
      const player = room.players.get(socket.data.playerId);
      if (player && room.state === GAME_STATES.LOBBY) removePlayer(room, player);
      else if (player) {
        player.socketId = null;
        player.connected = false;
        io.to(room.code).emit(EV.PLAYER_LEFT, { players: publicPlayers(room) });
      }
      unbindSocket(socket.id, room.code);
    }
  }

  function countFailedJoin(socket) {
    socket.data.failedJoins = (socket.data.failedJoins || 0) + 1;
    if (socket.data.failedJoins >= opts.maxFailedJoins) socket.disconnect(true);
  }

  io.on('connection', (socket) => {
    // Любое сообщение может прийти без данных или с мусором: ошибка в обработчике не должна ронять сервер
    const on = (event, handler) => {
      socket.on(event, (...args) => {
        const payload = args[0] && typeof args[0] === 'object' ? args[0] : {};
        try {
          touchRoom(socket);
          handler(payload);
        } catch (err) {
          console.error(`Ошибка обработки ${event}:`, err);
        }
      });
    };

    on(EV.CREATE_ROOM, ({ joinBaseUrl }) => {
      if (socket.data.role === 'player') return;
      const previous = findRoomOfHost(socket);
      if (previous) destroyRoom(previous);
      if (rooms.size >= opts.maxRooms) {
        socket.emit(EV.ROOM_ERROR, { message: 'Сервер занят: слишком много комнат' });
        return;
      }

      let code;
      do {
        code = generateRoomCode();
      } while (rooms.has(code));

      const room = {
        code,
        hostToken: randomUUID(),
        hostSocketId: socket.id,
        hostConnected: true,
        hostTimer: null,
        joinUrl: buildJoinUrl(joinBaseUrl, code, lanIp, port),
        players: new Map(),
        scores: new Map(),
        answers: new Map(),
        state: GAME_STATES.LOBBY,
        questions: [],
        timerModes: [],
        roundEndIndices: [],
        questionRounds: [],
        roundTitles: [],
        answerTimeSec: QUESTION_TIME_SEC,
        currentQuestionIndex: 0,
        timerStarted: false,
        deadline: null,
        currentTimer: null,
        lastResults: null,
        roundLeaderboardShown: false,
        lastActivity: Date.now(),
      };
      rooms.set(code, room);
      socket.join(code);
      socket.data.roomCode = code;
      socket.data.role = 'host';
      socket.emit(EV.ROOM_CREATED, { code, joinUrl: room.joinUrl, token: room.hostToken });
    });

    on(EV.JOIN_ROOM, ({ code, nickname }) => {
      const fail = (message) => socket.emit(EV.JOIN_ERROR, { message });
      if (socket.data.role === 'host') return fail('Ведущий не может войти как игрок');
      if (typeof code !== 'string' || !code.trim()) return fail('Укажите код комнаты');
      const room = getRoom(code);
      if (!room) {
        countFailedJoin(socket);
        return fail('Комната не найдена');
      }
      if (room.state !== GAME_STATES.LOBBY) return fail('Игра уже началась');
      if (room.players.size >= opts.maxPlayers) return fail('В комнате нет свободных мест');
      if (nickname != null && typeof nickname !== 'string') return fail('Введите имя');
      const name = (nickname || 'Игрок').replace(/\p{Cc}/gu, '').trim().slice(0, NICKNAME_MAX);
      if (!name) return fail('Введите имя');
      const taken = [...room.players.values()].some((p) => p.nickname.toLowerCase() === name.toLowerCase());
      if (taken) return fail('Такое имя уже занято');

      leaveCurrentRoom(socket);
      const player = {
        id: randomUUID(),
        token: randomUUID(),
        nickname: name,
        socketId: socket.id,
        connected: true,
        removeTimer: null,
      };
      room.players.set(player.id, player);
      socket.join(room.code);
      socket.data.roomCode = room.code;
      socket.data.role = 'player';
      socket.data.playerId = player.id;
      socket.emit(EV.JOIN_SUCCESS, { code: room.code, nickname: name, token: player.token });
      io.to(room.code).emit(EV.PLAYER_JOINED, { players: publicPlayers(room) });
    });

    on(EV.RESUME_SESSION, ({ code, token }) => {
      const room = getRoom(code);
      if (!room || typeof token !== 'string' || !token) {
        countFailedJoin(socket);
        return socket.emit(EV.SESSION_INVALID);
      }
      const replaceSocket = (oldId) => {
        if (!oldId || oldId === socket.id) return;
        const old = io.sockets.sockets.get(oldId);
        unbindSocket(oldId, room.code);
        old?.emit(EV.SESSION_REPLACED);
        old?.disconnect(true);
      };

      if (token === room.hostToken) {
        replaceSocket(room.hostSocketId);
        clearTimeout(room.hostTimer);
        room.hostTimer = null;
        room.hostSocketId = socket.id;
        room.hostConnected = true;
        socket.join(room.code);
        socket.data.roomCode = room.code;
        socket.data.role = 'host';
        socket.emit(EV.SESSION_RESUMED, buildSnapshot(room, 'host', null, opts));
        io.to(room.code).emit(EV.HOST_STATUS, { connected: true });
        return;
      }

      const player = [...room.players.values()].find((p) => p.token === token);
      if (!player) {
        countFailedJoin(socket);
        return socket.emit(EV.SESSION_INVALID);
      }
      replaceSocket(player.socketId);
      clearTimeout(player.removeTimer);
      player.removeTimer = null;
      player.socketId = socket.id;
      player.connected = true;
      socket.join(room.code);
      socket.data.roomCode = room.code;
      socket.data.role = 'player';
      socket.data.playerId = player.id;
      socket.emit(EV.SESSION_RESUMED, buildSnapshot(room, 'player', player, opts));
      io.to(room.code).emit(EV.PLAYER_JOINED, { players: publicPlayers(room) });
    });

    on(EV.END_ROOM, () => {
      const room = findRoomOfHost(socket);
      // После финала игроки остаются на экране с результатами
      if (room) destroyRoom(room, { notify: room.state !== GAME_STATES.GAME_OVER });
    });

    on(EV.START_GAME, ({ packId }) => {
      const room = findRoomOfHost(socket);
      if (!room || room.state !== GAME_STATES.LOBBY) return;
      Object.assign(room, loadQuestions(socket, packId));
      room.scores = new Map();
      io.to(room.code).emit(EV.GAME_STARTED);
      startQuestion(room, 0);
    });

    on(EV.SUBMIT_ANSWER, ({ answerIndex, answerText }) => {
      const room = getRoom(socket.data.roomCode);
      if (!room || socket.data.role !== 'player' || room.state !== GAME_STATES.QUESTION) return;
      const player = room.players.get(socket.data.playerId);
      const q = room.questions[room.currentQuestionIndex];
      if (!player || !q || room.answers.has(player.id)) return;

      let hostUpdate;
      if (q.type === 'open') {
        const text = typeof answerText === 'string' ? answerText.trim().slice(0, OPEN_ANSWER_MAX) : '';
        if (!text) return;
        room.answers.set(player.id, text);
        hostUpdate = { nickname: player.nickname, answerText: text };
      } else {
        if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex >= q.options.length) return;
        room.answers.set(player.id, answerIndex);
        hostUpdate = { nickname: player.nickname };
      }
      // Только ведущему: игроки не должны видеть чужие ответы до показа правильного
      if (room.hostSocketId) io.to(room.hostSocketId).emit(EV.PLAYER_ANSWERED, hostUpdate);
    });

    on(EV.HOST_START_TIMER, () => {
      const room = findRoomOfHost(socket);
      if (!room || room.state !== GAME_STATES.QUESTION || room.timerStarted) return;
      armQuestionTimer(room);
      io.to(room.code).emit(EV.QUESTION_TIMER_STARTED, { timeSec: room.answerTimeSec });
    });

    on(EV.SHOW_RESULTS, () => {
      const room = findRoomOfHost(socket);
      if (room) finishQuestion(room);
    });

    on(EV.NEXT_QUESTION, () => {
      const room = findRoomOfHost(socket);
      if (!room || room.state !== GAME_STATES.RESULTS) return;
      const nextIndex = room.currentQuestionIndex + 1;
      if (nextIndex < room.questions.length) {
        startQuestion(room, nextIndex);
        return;
      }
      room.state = GAME_STATES.GAME_OVER;
      io.to(room.code).emit(EV.GAME_OVER, { leaderboard: leaderboardOf(room) });
    });

    on(EV.HOST_SHOW_ROUND_LEADERBOARD, () => {
      const room = findRoomOfHost(socket);
      if (!room || room.state !== GAME_STATES.RESULTS || !room.lastResults?.roundOver) return;
      room.roundLeaderboardShown = true;
      io.to(room.code).emit(EV.ROUND_LEADERBOARD_SHOWN);
    });

    socket.on('disconnect', () => {
      const room = getRoom(socket.data.roomCode);
      if (!room) return;

      if (socket.data.role === 'host') {
        if (room.hostSocketId !== socket.id) return;
        room.hostSocketId = null;
        room.hostConnected = false;
        io.to(room.code).emit(EV.HOST_STATUS, { connected: false });
        room.hostTimer = setTimeout(
          () => destroyRoom(room, { notify: room.state !== GAME_STATES.GAME_OVER }),
          opts.hostGraceMs,
        );
        return;
      }

      const player = room.players.get(socket.data.playerId);
      if (!player || player.socketId !== socket.id) return;
      player.socketId = null;
      player.connected = false;
      io.to(room.code).emit(EV.PLAYER_LEFT, { players: publicPlayers(room) });
      if (room.state === GAME_STATES.LOBBY) {
        player.removeTimer = setTimeout(() => {
          if (!player.connected && room.state === GAME_STATES.LOBBY) removePlayer(room, player);
        }, opts.lobbyGraceMs);
      }
    });
  });

  return {
    rooms,
    close() {
      clearInterval(sweep);
      for (const room of rooms.values()) clearRoomTimers(room);
      rooms.clear();
    },
  };
}
