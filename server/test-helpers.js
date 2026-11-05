import fs from 'fs';
import os from 'os';
import { join } from 'path';
import { io as connectClient } from 'socket.io-client';
import { createGameServer } from './app.js';

export const ADMIN_PASSWORD = 'test-password';

export const TEST_PACK = {
  title: 'Тестовый пак',
  answerTimeSec: 10,
  rounds: [
    {
      timerStart: 'manual',
      roundTitle: 'Первый',
      questions: [
        { type: 'open', question: 'Кто колючий?', correctAnswer: 'Ёж' },
        { type: 'choice', question: 'Шестой вариант?', options: ['a', 'b', 'c', 'd', 'e', 'f'], correctIndex: 5 },
      ],
    },
    {
      timerStart: 'auto',
      questions: [{ type: 'choice', question: 'Авто-таймер?', options: ['да', 'нет'], correctIndex: 0 }],
    },
  ],
};

export async function startTestServer(game = {}) {
  const appRoot = fs.mkdtempSync(join(os.tmpdir(), 'box-test-'));
  fs.mkdirSync(join(appRoot, 'games'), { recursive: true });
  fs.writeFileSync(join(appRoot, 'games', 'test.json'), JSON.stringify(TEST_PACK));
  fs.writeFileSync(join(appRoot, 'secret.json'), JSON.stringify({ title: 's', questions: [{ question: 'SECRET', options: ['a', 'b'] }] }));

  const server = createGameServer({
    appRoot,
    adminPassword: ADMIN_PASSWORD,
    lanIp: '192.168.1.50',
    port: 3000,
    game,
  });
  await new Promise((resolve) => server.httpServer.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.httpServer.address().port}`;
  const sockets = [];

  return {
    ...server,
    url,
    appRoot,
    connect(options = {}) {
      const socket = connectClient(url, { transports: ['websocket'], reconnection: false, forceNew: true, ...options });
      sockets.push(socket);
      return new Promise((resolve, reject) => {
        socket.once('connect', () => resolve(socket));
        socket.once('connect_error', reject);
      });
    },
    async stop() {
      for (const socket of sockets) socket.close();
      await server.close();
      fs.rmSync(appRoot, { recursive: true, force: true });
    },
  };
}

export function once(socket, event, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Нет события ${event}`)), timeoutMs);
    socket.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
