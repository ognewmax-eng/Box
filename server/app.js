import { createServer } from 'http';
import { Server } from 'socket.io';
import fs from 'fs';
import { join } from 'path';
import { createHttpApp } from './http.js';
import { registerGame } from './game.js';

/**
 * WebSocket не защищён CORS, поэтому чужие сайты, открытые в браузере ведущего,
 * отсекаем сравнением Origin с адресом самого сервера.
 */
function isSameOrigin(req) {
  const { origin } = req.headers;
  if (!origin) return true; // не браузер
  try {
    return new URL(origin).host === (req.headers['x-forwarded-host'] || req.headers.host);
  } catch {
    return false;
  }
}

export function createGameServer({ appRoot, adminPassword, lanIp, port, game = {} }) {
  const gamesDir = join(appRoot, 'games');
  const mediaDir = join(gamesDir, 'media');
  fs.mkdirSync(mediaDir, { recursive: true });

  const app = createHttpApp({
    gamesDir,
    mediaDir,
    clientBuild: join(appRoot, 'client', 'dist'),
    adminPassword,
  });
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    pingTimeout: 60000,
    maxHttpBufferSize: 100 * 1024,
    allowRequest: (req, callback) => callback(null, isSameOrigin(req)),
  });
  const gameHandle = registerGame(io, { gamesDir, lanIp, port, ...game });

  return {
    app,
    httpServer,
    io,
    rooms: gameHandle.rooms,
    close: () => new Promise((resolve) => {
      gameHandle.close();
      io.close(() => resolve());
    }),
  };
}
