import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { randomBytes } from 'crypto';
import { createGameServer } from './server/app.js';
import { getLANIP, getLocalIPs } from './server/network.js';

// В CJS-бандле (pkg) import.meta.url отсутствует: файлы лежат рядом с исполняемым файлом
const moduleUrl = typeof import.meta !== 'undefined' ? import.meta.url : undefined;
const defaultRoot = moduleUrl ? dirname(fileURLToPath(moduleUrl)) : dirname(process.execPath);
const appRoot = process.env.APP_ROOT || defaultRoot;

// Пароль админки: из ADMIN_PASSWORD, иначе создаётся один раз и хранится рядом с игрой
function resolveAdminPassword() {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  const file = join(appRoot, '.admin-password');
  if (fs.existsSync(file)) {
    const saved = fs.readFileSync(file, 'utf-8').trim();
    if (saved) return saved;
  }
  const generated = randomBytes(6).toString('base64url');
  fs.writeFileSync(file, generated, { mode: 0o600 });
  return generated;
}

const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';
const lanIp = getLANIP();
const adminPassword = resolveAdminPassword();

const { httpServer } = createGameServer({ appRoot, adminPassword, lanIp, port: PORT });

httpServer.listen(PORT, HOST, () => {
  const all = [...new Set(getLocalIPs())];
  const urls = all.length ? all.map((ip) => `http://${ip}:${PORT}`).join(', ') : `http://localhost:${PORT}`;
  console.log(`
  🎮 Party Game Server (слушает на ${HOST}:${PORT})
  Локальный:  http://localhost:${PORT}
  С телефона: http://${lanIp}:${PORT}
  Все IP:     ${urls}
  Хост:       http://${lanIp}:${PORT}/host
  Клиент:     http://${lanIp}:${PORT}/client
  Админка:    http://${lanIp}:${PORT}/admin (пароль: ${adminPassword})
  Проверка:   http://${lanIp}:${PORT}/api/health

  Если с телефона таймаут: откройте на ПК в браузере http://${lanIp}:${PORT}/api/health
  — если на ПК открывается, блокирует брандмауэр/антивирус входящие с сети.
  — туннель (обход): npx localtunnel --port ${PORT}
  `);
});
