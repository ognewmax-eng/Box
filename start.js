#!/usr/bin/env node
/**
 * Скрипт запуска игры: установка зависимостей (при необходимости), сборка клиента, старт сервера, открытие браузера.
 * Работает на Windows и macOS.
 * Запуск: node start.js  (или через start.bat / start.command)
 */
import { spawn, exec } from 'child_process';
import http from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { getLANIP } from './server/network.js';
import { findBrokenPackages } from './scripts/check-deps.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

const LAN_IP = getLANIP();
const BASE_URL = LAN_IP === 'localhost' ? `http://localhost:${PORT}` : `http://${LAN_IP}:${PORT}`;

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, {
      stdio: 'inherit',
      shell: true,
      cwd: opts.cwd || __dirname,
      ...opts,
    });
    p.on('error', reject);
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`Exit ${code}`))));
  });
}

function waitForServer(maxAttempts = 40, intervalMs = 500) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    function check() {
      const req = http.request(
        { hostname: 'localhost', port: PORT, path: '/api/health', method: 'GET' },
        (res) => {
          res.resume();
          if (res.statusCode === 200) return resolve();
          if (++attempts >= maxAttempts) return reject(new Error('Сервер не ответил'));
          setTimeout(check, intervalMs);
        }
      );
      req.on('error', () => {
        if (++attempts >= maxAttempts) return reject(new Error('Сервер не запустился'));
        setTimeout(check, intervalMs);
      });
      req.setTimeout(2000, () => req.destroy());
      req.end();
    }
    check();
  });
}

function openBrowser(url) {
  if (process.platform === 'win32') {
    exec(`start "" "${url}"`, (err) => {
      if (err) console.warn('\nОткройте в браузере:', url);
    });
  } else {
    exec(`open "${url}"`, (err) => {
      if (err) console.warn('\nОткройте в браузере:', url);
    });
  }
}

// npm ci удаляет node_modules и ставит ровно то, что записано в package-lock.json
async function ensureDependencies(dir, label) {
  if (findBrokenPackages(dir).length === 0) return;
  console.log(`Установка зависимостей (${label})...`);
  await run('npm', ['ci'], { cwd: dir });
}

function newestMtime(path) {
  const stat = fs.statSync(path);
  if (!stat.isDirectory()) return stat.mtimeMs;
  return Math.max(0, ...fs.readdirSync(path).map((name) => newestMtime(join(path, name))));
}

// Собираем клиент, если сборки нет или исходники новее неё
function needsClientBuild(clientDir, clientDist) {
  const builtIndex = join(clientDist, 'index.html');
  if (!fs.existsSync(builtIndex)) return true;
  const sources = [join(clientDir, 'src'), join(clientDir, 'index.html'), join(__dirname, 'constants.js')];
  return Math.max(...sources.map(newestMtime)) > fs.statSync(builtIndex).mtimeMs;
}

async function main() {
  console.log('🎮 Box Party Game — запуск\n');

  const root = __dirname;
  const clientDir = join(root, 'client');
  const clientDist = join(clientDir, 'dist');

  await ensureDependencies(root, 'корень');
  await ensureDependencies(clientDir, 'клиент');

  if (needsClientBuild(clientDir, clientDist)) {
    console.log('Сборка клиента...');
    await run('npm', ['run', 'build']);
  }

  console.log('Запуск сервера...\n');
  const serverProcess = spawn('node', ['server.js'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, PORT: String(PORT) },
  });

  waitForServer(40, 500)
    .then(() => {
      console.log('\n✅ Сервер запущен.');
      if (LAN_IP !== 'localhost') {
        console.log(`   Открываю по адресу для сети: ${BASE_URL}`);
        console.log(`   (по этой ссылке можно зайти с телефона в той же Wi‑Fi)`);
      } else {
        console.log('   Открываю: ' + BASE_URL);
      }
      openBrowser(BASE_URL);
    })
    .catch(() => {
      console.warn('\nОткройте в браузере:', BASE_URL);
    });

  serverProcess.on('exit', (code) => {
    process.exit(code ?? 0);
  });

  process.on('SIGINT', () => {
    serverProcess.kill('SIGINT');
  });
  process.on('SIGTERM', () => {
    serverProcess.kill('SIGTERM');
  });
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
