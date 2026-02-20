import express from 'express';
import multer from 'multer';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import os from 'os';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { GAME_STATES, SOCKET_EVENTS, QUESTION_TIME_SEC, ROOM_CODE_LENGTH } from './constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' },
  pingTimeout: 60000,
});

app.use(cors());
app.use(express.json());

// Папка с игровыми паками и медиа (создаём при отсутствии)
const GAMES_DIR = join(__dirname, 'games');
const MEDIA_DIR = join(GAMES_DIR, 'media');
if (!fs.existsSync(GAMES_DIR)) fs.mkdirSync(GAMES_DIR, { recursive: true });
if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });

// Проверка доступности с телефона (откройте http://IP:3000/api/health в браузере телефона)
app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'Сервер доступен', ts: Date.now() });
});

app.get('/api/packs', (req, res) => {
  try {
    const files = fs.readdirSync(GAMES_DIR).filter((f) => f.endsWith('.json'));
    const packs = [];
    for (const f of files) {
      try {
        const path = join(GAMES_DIR, f);
        const data = JSON.parse(fs.readFileSync(path, 'utf-8'));
        const questions = loadPackQuestions(data);
        packs.push({ id: f.replace(/\.json$/i, ''), ...data, questionsCount: questions.length });
      } catch (err) {
        console.error('Пак не загружен:', f, err.message);
      }
    }
    res.json(packs);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Безопасный id пака: только латиница, цифры, дефис, подчёркивание (защита от path traversal)
function sanitizePackId(id) {
  if (id == null || typeof id !== 'string') return '';
  return id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || '';
}

// API: один пак по id
app.get('/api/packs/:id', (req, res) => {
  try {
    const id = sanitizePackId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Некорректный id пака' });
    const path = join(GAMES_DIR, `${id}.json`);
    if (!fs.existsSync(path)) return res.status(404).json({ error: 'Пак не найден' });
    const data = JSON.parse(fs.readFileSync(path, 'utf-8'));
    res.json({ id, ...data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// API: сохранить пак (admin) — формат: { title, rounds } или { title, questions } (legacy)
app.post('/api/packs', (req, res) => {
  try {
    const { id, title, rounds, questions, answerTimeSec } = req.body;
    if (!id || !title) return res.status(400).json({ error: 'Нужны id и title' });
    const safeId = sanitizePackId(id);
    if (!safeId) return res.status(400).json({ error: 'ID пака: только латиница, цифры, дефис и подчёркивание' });
    const path = join(GAMES_DIR, `${safeId}.json`);
    let payload;
    if (Array.isArray(rounds) && rounds.length > 0) {
      const timeSec = Math.min(60, Math.max(10, Number(answerTimeSec) || 15));
      payload = {
        title,
        answerTimeSec: timeSec,
        rounds: rounds.slice(0, 10).map((r) => ({
          questions: (r.questions || []).slice(0, 10).map((q) => {
            const type = q.type === 'open' ? 'open' : 'choice';
            const media = {};
            if (q.image && String(q.image).trim()) media.image = String(q.image).trim();
            if (q.video && String(q.video).trim()) media.video = String(q.video).trim();
            if (q.audio && String(q.audio).trim()) media.audio = String(q.audio).trim();
            if (type === 'open') {
              return { type: 'open', question: String(q.question || '').trim(), correctAnswer: String(q.correctAnswer ?? '').trim(), ...media };
            }
            const options = Array.isArray(q.options) ? q.options.map((o) => String(o ?? '').trim()) : [];
            const opts = options.length ? options : ['', '', '', ''];
            return {
              type: 'choice',
              question: String(q.question || '').trim(),
              options: opts.slice(0, 10),
              correctIndex: Math.max(0, Math.min(Number(q.correctIndex) || 0, opts.length - 1)),
              ...media,
            };
          }),
        })),
      };
    } else {
      payload = { title, questions: Array.isArray(questions) ? questions : [] };
    }
    fs.writeFileSync(path, JSON.stringify(payload, null, 2), 'utf-8');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json({ ok: true, id: safeId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Медиа-файлы вопросов (фото, видео, аудио): раздаём статику до SPA
app.use('/media', express.static(MEDIA_DIR));

// Загрузка медиа для пака (админка)
function sanitizeMediaFilename(name) {
  if (name == null || typeof name !== 'string') return 'file';
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 128) || 'file';
}

const mediaUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const id = sanitizePackId(req.params.id);
      if (!id) return cb(new Error('Некорректный id пака'));
      const dir = join(MEDIA_DIR, id);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const base = sanitizeMediaFilename(file.originalname) || 'file';
      const ext = base.includes('.') ? base.slice(base.lastIndexOf('.')) : '';
      const name = base.slice(0, base.lastIndexOf('.') || base.length) || 'file';
      cb(null, `${name}-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

app.post('/api/packs/:id/media', (req, res) => {
  const id = sanitizePackId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Некорректный id пака' });
  mediaUpload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Файл слишком большой (макс. 50 МБ)' });
      return res.status(500).json({ error: err.message || 'Ошибка загрузки' });
    }
    if (!req.file) return res.status(400).json({ error: 'Файл не выбран' });
    const path = `${id}/${req.file.filename}`;
    res.json({ path });
  });
});

// Раздача статики React и SPA (после всех API-маршрутов)
const clientBuild = join(__dirname, 'client', 'dist');
if (fs.existsSync(clientBuild)) {
  app.use(express.static(clientBuild));
  app.get('*', (req, res) => res.sendFile(join(clientBuild, 'index.html')));
}

// Нормализация открытого ответа: символы, без учёта регистра
function normalizeAnswer(s) {
  if (s == null) return '';
  return String(s).trim().toLowerCase();
}

// Загрузка списка вопросов из пака (для API списка паков)
function loadPackQuestions(data) {
  const result = loadPackForGame(data);
  return result.questions;
}

// Загрузка пака для игры: вопросы, индексы концов раундов, время на ответ
function loadPackForGame(data) {
  const DEFAULT_TIME = 15;
  const answerTimeSec = Math.min(60, Math.max(10, Number(data.answerTimeSec) || DEFAULT_TIME));
  if (Array.isArray(data.rounds) && data.rounds.length > 0) {
    const questions = [];
    const roundEndIndices = [];
    let idx = 0;
    for (const round of data.rounds.slice(0, 10)) {
      const qs = (round.questions || []).slice(0, 10);
      for (const q of qs) {
        questions.push(normalizeQuestion(q));
        idx++;
      }
      if (qs.length > 0) roundEndIndices.push(idx - 1);
    }
    return { questions, roundEndIndices, answerTimeSec };
  }
  if (Array.isArray(data.questions) && data.questions.length > 0) {
    const questions = data.questions.map(normalizeQuestion);
    return { questions, roundEndIndices: [questions.length - 1], answerTimeSec };
  }
  return { questions: [], roundEndIndices: [], answerTimeSec: DEFAULT_TIME };
}

function resolveMediaUrl(value) {
  if (!value || typeof value !== 'string') return undefined;
  const s = value.trim();
  if (!s) return undefined;
  if (s.startsWith('http://') || s.startsWith('https://')) return s;
  return '/media/' + (s.startsWith('/') ? s.slice(1) : s);
}

function normalizeQuestion(q) {
  const type = q.type === 'open' ? 'open' : 'choice';
  const media = {};
  if (q.image && String(q.image).trim()) media.image = String(q.image).trim();
  if (q.video && String(q.video).trim()) media.video = String(q.video).trim();
  if (q.audio && String(q.audio).trim()) media.audio = String(q.audio).trim();
  if (type === 'open') {
    return {
      type: 'open',
      question: q.question || '',
      correctAnswer: q.correctAnswer != null ? String(q.correctAnswer).trim() : '',
      ...media,
    };
  }
  const options = Array.isArray(q.options) ? q.options.slice(0, 10) : [];
  return {
    type: 'choice',
    question: q.question || '',
    options: options.length ? options : ['A', 'B', 'C', 'D'],
    correctIndex: Math.max(0, Math.min(Number(q.correctIndex) || 0, options.length - 1)),
    ...media,
  };
}

// Генерация 4-буквенного кода комнаты
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

const rooms = new Map(); // code -> room state

function getRoom(code) {
  if (code == null || typeof code !== 'string') return undefined;
  return rooms.get(code.toUpperCase());
}

function setRoom(code, state) {
  rooms.set(code.toUpperCase(), state);
}

io.on('connection', (socket) => {
  socket.on(SOCKET_EVENTS.CREATE_ROOM, ({ packId, joinBaseUrl }) => {
    // Если ведущий уже создал комнату — удаляем старую (избегаем «призрачных» комнат)
    const oldCode = socket.roomCode;
    if (oldCode && socket.role === 'host') {
      const oldRoom = getRoom(oldCode);
      if (oldRoom?.currentTimer) {
        clearTimeout(oldRoom.currentTimer);
        oldRoom.currentTimer = null;
      }
      rooms.delete(oldCode);
    }

    let code;
    do {
      code = generateRoomCode();
    } while (rooms.has(code));

    const roomState = {
      code,
      packId: packId || null,
      hostId: socket.id,
      players: new Map(),
      state: GAME_STATES.LOBBY,
      currentQuestionIndex: 0,
      questions: [],
      answers: new Map(),
      questionStartTime: null,
    };
    setRoom(code, roomState);
    socket.join(code);
    socket.roomCode = code;
    socket.role = 'host';

    const base = (joinBaseUrl && typeof joinBaseUrl === 'string') ? joinBaseUrl.replace(/\/$/, '') : `http://${getLANIP()}:${PORT}`;
    const joinUrl = `${base}/client?room=${code}`;
    socket.emit(SOCKET_EVENTS.ROOM_CREATED, {
      code,
      joinUrl,
    });
  });

  socket.on(SOCKET_EVENTS.JOIN_ROOM, ({ code, nickname }) => {
    const room = getRoom(code);
    const c = (code || '').toUpperCase();
    if (!room) {
      socket.emit(SOCKET_EVENTS.JOIN_ERROR, { message: 'Комната не найдена' });
      return;
    }
    if (room.state !== GAME_STATES.LOBBY) {
      socket.emit(SOCKET_EVENTS.JOIN_ERROR, { message: 'Игра уже началась' });
      return;
    }
    const names = [...room.players.values()].map((p) => p.nickname.toLowerCase());
    const rawName = (nickname || 'Игрок').trim().slice(0, 30);
    if (!rawName) {
      socket.emit(SOCKET_EVENTS.JOIN_ERROR, { message: 'Введите имя' });
      return;
    }
    if (names.includes(rawName.toLowerCase())) {
      socket.emit(SOCKET_EVENTS.JOIN_ERROR, { message: 'Такое имя уже занято' });
      return;
    }
    const player = { id: socket.id, nickname: rawName };
    room.players.set(socket.id, player);
    socket.join(c);
    socket.roomCode = c;
    socket.role = 'player';

    socket.emit(SOCKET_EVENTS.JOIN_SUCCESS, { code: c, nickname: player.nickname });
    io.to(c).emit(SOCKET_EVENTS.PLAYER_JOINED, {
      players: [...room.players.values()],
    });
  });

  socket.on('disconnect', () => {
    const code = socket.roomCode;
    if (!code) return;
    const room = getRoom(code);
    if (!room) return;

    if (socket.role === 'host') {
      if (room.currentTimer) {
        clearTimeout(room.currentTimer);
        room.currentTimer = null;
      }
      io.to(code).emit(SOCKET_EVENTS.HOST_DISCONNECT);
      rooms.delete(code);
      return;
    }

    room.players.delete(socket.id);
    io.to(code).emit(SOCKET_EVENTS.PLAYER_LEFT, {
      players: [...room.players.values()],
    });
  });

  socket.on(SOCKET_EVENTS.START_GAME, async ({ packId }) => {
    const code = socket.roomCode;
    const room = getRoom(code);
    if (!room || room.hostId !== socket.id) return;

    let pack = { questions: [], roundEndIndices: [], answerTimeSec: 15 };
    if (packId) {
      try {
        const path = join(GAMES_DIR, `${packId}.json`);
        const data = JSON.parse(fs.readFileSync(path, 'utf-8'));
        pack = loadPackForGame(data);
      } catch (e) {
        console.error(e);
      }
    }
    if (pack.questions.length === 0) {
      pack = { ...pack, questions: [normalizeQuestion({ type: 'choice', question: 'Пример вопроса?', options: ['Вариант A', 'Вариант B', 'Вариант C', 'Вариант D'], correctIndex: 0 })], roundEndIndices: [0] };
    }

    room.questions = pack.questions;
    room.roundEndIndices = pack.roundEndIndices || [];
    room.answerTimeSec = pack.answerTimeSec;
    room.currentQuestionIndex = 0;
    room.state = GAME_STATES.QUESTION;
    room.answers = new Map();

    const q = room.questions[0];
    const timeSec = room.answerTimeSec;
    room.questionStartTime = Date.now();
    io.to(code).emit(SOCKET_EVENTS.GAME_STARTED);
    io.to(code).emit(SOCKET_EVENTS.QUESTION_START, {
      questionIndex: 0,
      total: pack.questions.length,
      type: q.type,
      question: q.question,
      options: q.type === 'choice' ? q.options : undefined,
      timeSec,
      image: resolveMediaUrl(q.image),
      video: resolveMediaUrl(q.video),
      audio: resolveMediaUrl(q.audio),
    });
    socket.emit('question_host', q.type === 'open' ? { correctAnswer: q.correctAnswer } : { correctIndex: q.correctIndex });

    const timer = setTimeout(() => {
      const r = getRoom(code);
      if (r?.state === GAME_STATES.QUESTION && r.currentQuestionIndex === 0) {
        finishQuestion(r, code, 0, q);
      }
    }, timeSec * 1000);
    room.currentTimer = timer;
  });

  function finishQuestion(room, code, questionIndex, question) {
    if (room.currentTimer) clearTimeout(room.currentTimer);
    room.currentTimer = null;
    room.state = GAME_STATES.RESULTS;
    if (!room.scores) room.scores = new Map();
    const isOpen = question.type === 'open';
    room.players.forEach((_, id) => {
      const prev = room.scores.get(id) || 0;
      let got = 0;
      if (isOpen) {
        const raw = room.answers.get(id);
        const userNorm = normalizeAnswer(typeof raw === 'string' ? raw : raw?.text);
        const correctNorm = normalizeAnswer(question.correctAnswer);
        if (userNorm && correctNorm && userNorm === correctNorm) got = 1;
      } else {
        if (room.answers.get(id) === question.correctIndex) got = 1;
      }
      room.scores.set(id, prev + got);
    });
    const playerScores = [...room.players.entries()].map(([id, p]) => ({
      nickname: p.nickname,
      score: room.scores.get(id) || 0,
    }));
    const sorted = playerScores.sort((a, b) => b.score - a.score);
    const roundEndIndices = room.roundEndIndices || [];
    const isRoundEnd = roundEndIndices.includes(questionIndex);
    let roundNumber = 0;
    if (isRoundEnd) {
      roundNumber = roundEndIndices.indexOf(questionIndex) + 1;
    }
    io.to(code).emit(SOCKET_EVENTS.RESULTS, {
      questionIndex,
      type: question.type,
      correctIndex: isOpen ? undefined : question.correctIndex,
      correctAnswer: isOpen ? question.correctAnswer : undefined,
      answers: Object.fromEntries(room.answers),
      scores: Object.fromEntries(room.scores),
      playerScores: sorted,
      roundOver: isRoundEnd,
      roundNumber,
      roundLeaderboard: isRoundEnd ? sorted : undefined,
    });
  }

  socket.on(SOCKET_EVENTS.SUBMIT_ANSWER, ({ answerIndex, answerText }) => {
    const code = socket.roomCode;
    const room = getRoom(code);
    if (!room || room.state !== GAME_STATES.QUESTION) return;
    const player = room.players.get(socket.id);
    if (!player || room.answers.has(socket.id)) return;
    const q = room.questions[room.currentQuestionIndex];
    if (!q) return;
    if (q.type === 'open') {
      const text = typeof answerText === 'string' ? answerText.trim() : '';
      room.answers.set(socket.id, text);
      io.to(code).emit(SOCKET_EVENTS.PLAYER_ANSWERED, { playerId: socket.id, nickname: player.nickname, answerText: text });
    } else {
      const opts = q.options || [];
      const idx = Number(answerIndex);
      if (!Number.isInteger(idx) || idx < 0 || idx >= opts.length) return;
      room.answers.set(socket.id, idx);
      io.to(code).emit(SOCKET_EVENTS.PLAYER_ANSWERED, { playerId: socket.id, nickname: player.nickname });
    }
  });

  socket.on(SOCKET_EVENTS.NEXT_QUESTION, () => {
    const code = socket.roomCode;
    const room = getRoom(code);
    if (!room || room.hostId !== socket.id) return;

    if (room.currentTimer) clearTimeout(room.currentTimer);
    const nextIndex = room.currentQuestionIndex + 1;

    if (nextIndex >= room.questions.length) {
      room.state = GAME_STATES.RESULTS;
      const leaderboard = [...room.players.entries()]
        .map(([id, p]) => ({ nickname: p.nickname, score: room.scores?.get(id) ?? 0 }))
        .sort((a, b) => b.score - a.score);
      io.to(code).emit(SOCKET_EVENTS.GAME_OVER, { leaderboard });
      return;
    }

    room.currentQuestionIndex = nextIndex;
    room.state = GAME_STATES.QUESTION;
    room.answers = new Map();
    const q = room.questions[nextIndex];
    const timeSec = room.answerTimeSec ?? 15;
    room.questionStartTime = Date.now();
    io.to(code).emit(SOCKET_EVENTS.QUESTION_START, {
      questionIndex: nextIndex,
      total: room.questions.length,
      type: q.type,
      question: q.question,
      options: q.type === 'choice' ? q.options : undefined,
      timeSec,
      image: resolveMediaUrl(q.image),
      video: resolveMediaUrl(q.video),
      audio: resolveMediaUrl(q.audio),
    });
    socket.emit('question_host', q.type === 'open' ? { correctAnswer: q.correctAnswer } : { correctIndex: q.correctIndex });

    const timer = setTimeout(() => {
      const r = getRoom(code);
      if (r?.state === GAME_STATES.QUESTION && r.currentQuestionIndex === nextIndex) {
        finishQuestion(r, code, nextIndex, q);
      }
    }, timeSec * 1000);
    room.currentTimer = timer;
  });

  socket.on(SOCKET_EVENTS.SHOW_RESULTS, ({ questionIndex, correctIndex, correctAnswer }) => {
    const code = socket.roomCode;
    const room = getRoom(code);
    if (!room || room.hostId !== socket.id) return;
    const q = room.questions[questionIndex];
    if (!q) return;
    // Останавливаем таймер, чтобы не отправить RESULTS дважды (по кнопке и по таймауту)
    if (room.currentTimer) {
      clearTimeout(room.currentTimer);
      room.currentTimer = null;
    }
    const payload = q.type === 'open'
      ? { ...q, correctAnswer: typeof correctAnswer === 'string' ? correctAnswer : q.correctAnswer }
      : q;
    finishQuestion(room, code, questionIndex, payload);
  });
});

function getLocalIPs() {
  const nets = os.networkInterfaces();
  const list = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) list.push(net.address);
    }
  }
  return list;
}

function getLANIP() {
  const list = getLocalIPs();
  const lan = list.filter((ip) => ip.startsWith('192.168.') || ip.startsWith('10.'));
  return lan[0] || list[0] || 'localhost';
}

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
httpServer.listen(PORT, HOST, () => {
  const lan = getLANIP();
  const all = [...new Set(getLocalIPs())].filter(Boolean);
  const urls = all.length ? all.map((ip) => `http://${ip}:${PORT}`).join(', ') : `http://localhost:${PORT}`;
  console.log(`
  🎮 Party Game Server (слушает на 0.0.0.0:${PORT})
  Локальный:  http://localhost:${PORT}
  С телефона: http://${lan}:${PORT}
  Все IP:     ${urls}
  Хост:       http://${lan}:${PORT}/host
  Клиент:     http://${lan}:${PORT}/client
  Проверка:   http://${lan}:${PORT}/api/health

  Если с телефона таймаут: откройте на ПК в браузере http://${lan}:${PORT}/api/health
  — если на ПК открывается, блокирует брандмауэр/антивирус входящие с сети.
  — туннель (обход): npx localtunnel --port ${PORT}
  `);
});
