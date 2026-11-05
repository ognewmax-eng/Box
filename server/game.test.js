import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { join } from 'path';
import { SOCKET_EVENTS as EV } from '../constants.js';
import { buildJoinUrl } from './network.js';
import { normalizeAnswer } from './packs.js';
import { once, sleep, startTestServer } from './test-helpers.js';

async function createRoom(server) {
  const host = await server.connect();
  host.emit(EV.CREATE_ROOM, { joinBaseUrl: 'http://localhost:3000' });
  const room = await once(host, EV.ROOM_CREATED);
  return { host, ...room };
}

async function joinPlayer(server, code, nickname) {
  const socket = await server.connect();
  socket.emit(EV.JOIN_ROOM, { code, nickname });
  const joined = await once(socket, EV.JOIN_SUCCESS);
  return { socket, token: joined.token };
}

describe('игровой цикл', () => {
  let server;
  before(async () => { server = await startTestServer(); });
  after(() => server.stop());

  it('проходит от лобби до итоговой таблицы', async () => {
    const { host, code, joinUrl } = await createRoom(server);
    assert.equal(joinUrl, `http://192.168.1.50:3000/client?room=${code}`);

    const anya = await joinPlayer(server, code, 'Аня');
    const borya = await joinPlayer(server, code, 'Боря');

    // Вопрос 1: открытый, ответы сравниваются без учёта ё и знаков
    const firstQuestion = once(host, EV.QUESTION_START);
    const firstKey = once(host, EV.QUESTION_HOST);
    host.emit(EV.START_GAME, { packId: 'test' });
    const q1 = await firstQuestion;
    assert.equal(q1.roundTitle, 'Первый');
    assert.equal(q1.correctAnswer, undefined);
    assert.deepEqual(await firstKey, { correctAnswer: 'Ёж' });

    const hostSeesAnswer = once(host, EV.PLAYER_ANSWERED);
    let rivalSawAnswer = false;
    borya.socket.on(EV.PLAYER_ANSWERED, () => { rivalSawAnswer = true; });
    anya.socket.emit(EV.SUBMIT_ANSWER, { answerText: 'еж!' });
    assert.equal((await hostSeesAnswer).answerText, 'еж!');
    borya.socket.emit(EV.SUBMIT_ANSWER, { answerText: 'уж' });
    await sleep(50);
    assert.equal(rivalSawAnswer, false, 'чужой ответ не должен приходить игрокам');

    let results = once(host, EV.RESULTS);
    host.emit(EV.SHOW_RESULTS);
    let r = await results;
    assert.deepEqual(r.playerScores, [{ nickname: 'Аня', score: 1 }, { nickname: 'Боря', score: 0 }]);
    assert.equal(r.scores, undefined);

    // Вопрос 2: шестой вариант, конец раунда
    const q2 = once(borya.socket, EV.QUESTION_START);
    host.emit(EV.NEXT_QUESTION);
    assert.equal((await q2).options.length, 6);
    const timerStarted = once(borya.socket, EV.QUESTION_TIMER_STARTED);
    host.emit(EV.HOST_START_TIMER);
    await timerStarted;
    borya.socket.emit(EV.SUBMIT_ANSWER, { answerIndex: 5 });
    anya.socket.emit(EV.SUBMIT_ANSWER, { answerIndex: 99 }); // вне диапазона: не засчитывается
    await sleep(50);
    results = once(host, EV.RESULTS);
    host.emit(EV.SHOW_RESULTS);
    r = await results;
    assert.equal(r.roundOver, true);
    assert.equal(r.roundTitle, 'Первый');
    const leaderboardShown = once(anya.socket, EV.ROUND_LEADERBOARD_SHOWN);
    host.emit(EV.HOST_SHOW_ROUND_LEADERBOARD);
    await leaderboardShown;

    // Вопрос 3 и финал
    const q3 = once(host, EV.QUESTION_START);
    host.emit(EV.NEXT_QUESTION);
    assert.equal((await q3).timerMode, 'auto');
    results = once(host, EV.RESULTS);
    host.emit(EV.SHOW_RESULTS);
    await results;
    const over = once(anya.socket, EV.GAME_OVER);
    host.emit(EV.NEXT_QUESTION);
    assert.deepEqual((await over).leaderboard, [{ nickname: 'Аня', score: 1 }, { nickname: 'Боря', score: 1 }]);
  });

  it('завершает вопрос по таймеру только один раз', async () => {
    const fast = await startTestServer({ secondMs: 5 });
    try {
      const { host } = await createRoom(fast);
      let resultCount = 0;
      host.on(EV.RESULTS, () => { resultCount += 1; });
      const started = once(host, EV.QUESTION_START);
      host.emit(EV.START_GAME, {}); // пример вопроса с авто-таймером
      await started;
      host.emit(EV.START_GAME, {}); // повторный старт игнорируется
      await sleep(150);
      assert.equal(resultCount, 1);
    } finally {
      await fast.stop();
    }
  });
});

describe('оформление игры', () => {
  let server;
  before(async () => {
    server = await startTestServer();
    fs.writeFileSync(join(server.appRoot, 'games', 'north.json'), JSON.stringify({
      title: 'Север',
      theme: { preset: 'tundra', texts: { pointsLabel: 'Олени' }, evil: 'x' },
      rounds: [{ questions: [{ type: 'choice', question: 'Q', options: ['a', 'b'], correctIndex: 1 }] }],
    }));
  });
  after(() => server.stop());

  it('выбор пака перекрашивает телефоны в лобби, тема есть при входе и возврате', async () => {
    const { host, code } = await createRoom(server);
    const early = await joinPlayer(server, code, 'Первый');
    const themed = once(early.socket, EV.ROOM_THEME);
    host.emit(EV.SELECT_PACK, { packId: 'north' });
    const update = await themed;
    assert.equal(update.title, 'Север');
    assert.deepEqual(update.theme, { preset: 'tundra', texts: { pointsLabel: 'Олени' } });

    // Форма входа: тема по коду, ещё без входа в комнату
    const visitor = await server.connect();
    visitor.emit(EV.PEEK_ROOM, { code });
    assert.equal((await once(visitor, EV.ROOM_THEME)).theme.preset, 'tundra');

    const late = await server.connect();
    late.emit(EV.JOIN_ROOM, { code, nickname: 'Второй' });
    assert.equal((await once(late, EV.JOIN_SUCCESS)).theme.preset, 'tundra');

    // Старт без packId использует выбранный пак
    const question = once(host, EV.QUESTION_START);
    host.emit(EV.START_GAME, {});
    assert.equal((await question).question, 'Q');

    // Подписка до отправки: второй ответ может прийти сразу за первым
    const bothAnswered = new Promise((resolve) => {
      let count = 0;
      host.on(EV.PLAYER_ANSWERED, () => {
        count += 1;
        if (count === 2) resolve();
      });
    });
    late.emit(EV.SUBMIT_ANSWER, { answerIndex: 1 });
    early.socket.emit(EV.SUBMIT_ANSWER, { answerIndex: 0 });
    await bothAnswered;
    const results = once(host, EV.RESULTS);
    host.emit(EV.SHOW_RESULTS);
    const r = await results;
    assert.deepEqual(r.answerCounts, [1, 1]);
    assert.deepEqual(r.correctNicknames, ['Второй']);

    const back = await server.connect();
    back.emit(EV.RESUME_SESSION, { code, token: early.token });
    const snapshot = await once(back, EV.SESSION_RESUMED);
    assert.equal(snapshot.theme.preset, 'tundra');
    assert.equal(snapshot.title, 'Север');
    assert.equal(snapshot.results.correctNicknames[0], 'Второй');
  });

  it('снятие пака возвращает базовое оформление, игрок не может менять пак', async () => {
    const { host, code } = await createRoom(server);
    const player = await joinPlayer(server, code, 'Игрок');
    let selected = once(player.socket, EV.ROOM_THEME);
    host.emit(EV.SELECT_PACK, { packId: 'north' });
    await selected;

    player.socket.emit(EV.SELECT_PACK, { packId: null });
    await sleep(40);
    assert.equal(server.rooms.get(code).theme.preset, 'tundra');

    selected = once(player.socket, EV.ROOM_THEME);
    host.emit(EV.SELECT_PACK, { packId: null });
    assert.deepEqual(await selected, { theme: null, title: null });
  });

  it('выбор несуществующего пака и путь за пределы папки дают ошибку', async () => {
    const { host } = await createRoom(server);
    const error = once(host, EV.PACK_LOAD_ERROR);
    host.emit(EV.SELECT_PACK, { packId: '../secret' });
    await error;
  });
});

describe('игра без показа ответов', () => {
  let server;
  before(async () => {
    server = await startTestServer();
    fs.writeFileSync(join(server.appRoot, 'games', 'hidden.json'), JSON.stringify({
      title: 'Без ответов',
      theme: { options: { showAnswers: false } },
      rounds: [{
        questions: [
          { type: 'choice', question: 'Q1', options: ['a', 'b'], correctIndex: 1 },
          { type: 'open', question: 'Q2', correctAnswer: 'Ёж' },
        ],
      }],
    }));
  });
  after(() => server.stop());

  it('до финала ответы и счёт не уходят ни на один экран, очки считаются', async () => {
    const { host, code } = await createRoom(server);
    const player = await joinPlayer(server, code, 'Игрок');
    host.emit(EV.SELECT_PACK, { packId: 'hidden' });
    await once(host, EV.ROOM_THEME);
    const q1 = once(player.socket, EV.QUESTION_START);
    host.emit(EV.START_GAME, {});
    await q1;

    let answered = once(host, EV.PLAYER_ANSWERED);
    player.socket.emit(EV.SUBMIT_ANSWER, { answerIndex: 1 });
    await answered;
    let results = once(player.socket, EV.RESULTS);
    host.emit(EV.SHOW_RESULTS);
    const first = await results;
    assert.equal(first.answersHidden, true);
    assert.equal(first.answeredCount, 1);
    assert.deepEqual(first.playerScores, []);
    for (const key of ['correctIndex', 'correctAnswer', 'correctNicknames', 'answerCounts', 'openAnswers', 'roundLeaderboard']) {
      assert.equal(first[key], undefined, key);
    }

    // После обрыва связи ответ тоже не утекает
    const back = await server.connect();
    back.emit(EV.RESUME_SESSION, { code, token: player.token });
    const snapshot = await once(back, EV.SESSION_RESUMED);
    assert.equal(JSON.stringify(snapshot.results).includes('correct'), false);
    assert.equal(snapshot.answerReview, undefined);

    const q2 = once(back, EV.QUESTION_START);
    host.emit(EV.NEXT_QUESTION);
    await q2;
    answered = once(host, EV.PLAYER_ANSWERED);
    back.emit(EV.SUBMIT_ANSWER, { answerText: 'еж' });
    await answered;
    results = once(back, EV.RESULTS);
    host.emit(EV.SHOW_RESULTS);
    const last = await results;
    assert.equal(last.roundOver, true);
    assert.deepEqual(last.roundLeaderboard, [{ nickname: 'Игрок', score: 2 }]);
    assert.equal(last.correctAnswer, undefined);

    const over = once(back, EV.GAME_OVER);
    host.emit(EV.NEXT_QUESTION);
    assert.deepEqual((await over).answerReview, [
      { question: 'Q1', answer: 'b' },
      { question: 'Q2', answer: 'Ёж' },
    ]);
  });

  it('в обычной игре разбора нет', async () => {
    const { host } = await createRoom(server);
    const started = once(host, EV.QUESTION_START);
    host.emit(EV.START_GAME, { packId: 'test' });
    await started;
    assert.equal(server.rooms.size > 0, true);
    const results = once(host, EV.RESULTS);
    host.emit(EV.SHOW_RESULTS);
    assert.equal((await results).answersHidden, undefined);
  });
});

describe('возврат в игру', () => {
  let server;
  before(async () => { server = await startTestServer({ lobbyGraceMs: 30, hostGraceMs: 80 }); });
  after(() => server.stop());

  it('игрок возвращается с очками и своим ответом', async () => {
    const { host, code } = await createRoom(server);
    const leader = await joinPlayer(server, code, 'Лидер');
    const started = once(host, EV.QUESTION_START);
    host.emit(EV.START_GAME, { packId: 'test' });
    await started;
    leader.socket.emit(EV.SUBMIT_ANSWER, { answerText: 'ёж' });
    await once(host, EV.PLAYER_ANSWERED);
    const results = once(host, EV.RESULTS);
    host.emit(EV.SHOW_RESULTS);
    await results;

    const left = once(host, EV.PLAYER_LEFT);
    leader.socket.close();
    assert.equal((await left).players[0].connected, false);

    const q2 = once(host, EV.QUESTION_START);
    host.emit(EV.NEXT_QUESTION);
    await q2;

    const back = await server.connect();
    const backInList = once(host, EV.PLAYER_JOINED);
    back.emit(EV.RESUME_SESSION, { code, token: leader.token });
    const snapshot = await once(back, EV.SESSION_RESUMED);
    assert.equal(snapshot.state, 'QUESTION');
    assert.equal(snapshot.nickname, 'Лидер');
    assert.equal(snapshot.question.questionIndex, 1);
    assert.equal(snapshot.myAnswer, null);
    assert.equal(snapshot.joinUrl, undefined, 'игроку не нужны данные ведущего');
    assert.equal((await backInList).players[0].connected, true);

    back.emit(EV.SUBMIT_ANSWER, { answerIndex: 5 });
    await once(host, EV.PLAYER_ANSWERED);
    const final = once(host, EV.RESULTS);
    host.emit(EV.SHOW_RESULTS);
    assert.deepEqual((await final).playerScores, [{ nickname: 'Лидер', score: 2 }]);
  });

  it('ведущий возвращается, пока идёт грейс-период', async () => {
    const { host, code, token } = await createRoom(server);
    const player = await joinPlayer(server, code, 'Игрок');
    const started = once(player.socket, EV.QUESTION_START);
    host.emit(EV.START_GAME, { packId: 'test' });
    await started;

    const lost = once(player.socket, EV.HOST_STATUS);
    host.close();
    assert.deepEqual(await lost, { connected: false });

    const hostBack = await server.connect();
    const restored = once(player.socket, EV.HOST_STATUS);
    hostBack.emit(EV.RESUME_SESSION, { code, token });
    const snapshot = await once(hostBack, EV.SESSION_RESUMED);
    assert.equal(snapshot.role, 'host');
    assert.equal(snapshot.state, 'QUESTION');
    assert.deepEqual(snapshot.answerKey, { correctAnswer: 'Ёж' });
    assert.equal(snapshot.players[0].nickname, 'Игрок');
    assert.deepEqual(await restored, { connected: true });

    await sleep(120); // старый таймер удаления комнаты отменён
    assert.ok(server.rooms.has(code));
  });

  it('удаляет комнату, если ведущий не вернулся', async () => {
    const { host, code } = await createRoom(server);
    const player = await joinPlayer(server, code, 'Игрок');
    const gone = once(player.socket, EV.HOST_DISCONNECT);
    host.close();
    await gone;
    assert.equal(server.rooms.has(code), false);
    player.socket.emit(EV.RESUME_SESSION, { code, token: player.token });
    await once(player.socket, EV.SESSION_INVALID);
  });

  it('отклоняет чужой токен и не отдаёт токены в списке игроков', async () => {
    const { host, code } = await createRoom(server);
    const joined = once(host, EV.PLAYER_JOINED);
    const player = await joinPlayer(server, code, 'Игрок');
    const { players } = await joined;
    assert.equal(JSON.stringify(players).includes(player.token), false);

    const stranger = await server.connect();
    stranger.emit(EV.RESUME_SESSION, { code, token: 'not-a-token' });
    await once(stranger, EV.SESSION_INVALID);
  });

  it('вторая вкладка забирает сессию, первая получает уведомление', async () => {
    const { code } = await createRoom(server);
    const first = await joinPlayer(server, code, 'Игрок');
    const replaced = once(first.socket, EV.SESSION_REPLACED);
    const second = await server.connect();
    second.emit(EV.RESUME_SESSION, { code, token: first.token });
    await once(second, EV.SESSION_RESUMED);
    await replaced;
    await sleep(30);
    const room = server.rooms.get(code);
    assert.equal([...room.players.values()][0].connected, true, 'отключение старой вкладки не снимает игрока');
  });

  it('из лобби отключившийся игрок убирается через грейс-период', async () => {
    const { host, code } = await createRoom(server);
    const player = await joinPlayer(server, code, 'Игрок');
    player.socket.close();
    await once(host, EV.PLAYER_LEFT);
    const removed = await once(host, EV.PLAYER_LEFT);
    assert.deepEqual(removed.players, []);
  });
});

describe('защита', () => {
  let server;
  before(async () => { server = await startTestServer({ maxPlayers: 1, maxFailedJoins: 3 }); });
  after(() => server.stop());

  it('сообщения без данных и с мусором не роняют сервер', async () => {
    const socket = await server.connect();
    for (const event of Object.values(EV)) {
      for (const payload of [undefined, null, 42, 'x', [], { code: 1, nickname: 1, token: {}, packId: {}, answerIndex: 'x', answerText: {} }]) {
        socket.emit(event, payload);
      }
    }
    await sleep(100);
    const res = await fetch(`${server.url}/api/health`);
    assert.equal(res.status, 200);
  });

  it('не читает пак за пределами папки games', async () => {
    const { host } = await createRoom(server);
    const error = once(host, EV.PACK_LOAD_ERROR);
    const question = once(host, EV.QUESTION_START);
    host.emit(EV.START_GAME, { packId: '../secret' });
    await error;
    assert.equal((await question).question, 'Пример вопроса?');
  });

  it('только ведущий управляет игрой', async () => {
    const { host, code } = await createRoom(server);
    const player = await joinPlayer(server, code, 'Игрок');
    let started = false;
    host.on(EV.GAME_STARTED, () => { started = true; });
    player.socket.emit(EV.START_GAME, {});
    await sleep(50);
    assert.equal(started, false);
  });

  it('ограничивает число игроков', async () => {
    const { code } = await createRoom(server);
    await joinPlayer(server, code, 'Первый');
    const second = await server.connect();
    second.emit(EV.JOIN_ROOM, { code, nickname: 'Второй' });
    assert.equal((await once(second, EV.JOIN_ERROR)).message, 'В комнате нет свободных мест');
  });

  it('ограничивает число комнат', async () => {
    const limited = await startTestServer({ maxRooms: 2 });
    try {
      await createRoom(limited);
      await createRoom(limited);
      const extra = await limited.connect();
      extra.emit(EV.CREATE_ROOM, {});
      assert.match((await once(extra, EV.ROOM_ERROR)).message, /слишком много комнат/);
    } finally {
      await limited.stop();
    }
  });

  it('отключает при подборе кода комнаты', async () => {
    const socket = await server.connect();
    const closed = once(socket, 'disconnect');
    for (let i = 0; i < 3; i++) socket.emit(EV.JOIN_ROOM, { code: 'ZZZZ', nickname: 'x' });
    await closed;
  });

  it('не пускает WebSocket с чужого сайта', async () => {
    await assert.rejects(server.connect({ extraHeaders: { Origin: 'https://evil.example' } }));
    const sameOrigin = await server.connect({ extraHeaders: { Origin: server.url } });
    assert.equal(sameOrigin.connected, true);
  });
});

describe('вспомогательные функции', () => {
  it('QR не ведёт на localhost', () => {
    const lan = '192.168.1.50';
    assert.equal(buildJoinUrl('http://localhost:3000', 'ABCD', lan, 3000), 'http://192.168.1.50:3000/client?room=ABCD');
    assert.equal(buildJoinUrl('http://127.0.0.1:5173', 'ABCD', lan, 3000), 'http://192.168.1.50:5173/client?room=ABCD');
    assert.equal(buildJoinUrl('https://x.loca.lt', 'ABCD', lan, 3000), 'https://x.loca.lt/client?room=ABCD');
    assert.equal(buildJoinUrl('javascript:alert(1)', 'ABCD', lan, 3000), 'http://192.168.1.50:3000/client?room=ABCD');
    assert.equal(buildJoinUrl(undefined, 'ABCD', lan, 3000), 'http://192.168.1.50:3000/client?room=ABCD');
  });

  it('сравнение открытых ответов', () => {
    assert.equal(normalizeAnswer('  Ёж! '), normalizeAnswer('еж'));
    assert.equal(normalizeAnswer('Санкт-Петербург'), normalizeAnswer('санкт петербург'));
    assert.notEqual(normalizeAnswer('ёж'), normalizeAnswer('уж'));
    assert.equal(normalizeAnswer(null), '');
  });
});
