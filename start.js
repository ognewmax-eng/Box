#!/usr/bin/env node
/**
 * Скрипт запуска игры: установка зависимостей (при необходимости), сборка клиента, старт сервера, открытие браузера.
 * Работает на Windows и macOS.
 * Запуск: node start.js  (или через start.bat / start.command)
 */
import { spawn, exec } from 'child_process';
import http from 'http';
import os from 'os';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

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

async function main() {
  console.log('🎮 Box Party Game — запуск\n');

  const root = __dirname;
  const clientDir = join(root, 'client');
  const clientDist = join(clientDir, 'dist');

  if (!fs.existsSync(join(root, 'node_modules'))) {
    console.log('Установка зависимостей (корень)...');
    await run('npm', ['install']);
  }
  if (!fs.existsSync(join(clientDir, 'node_modules'))) {
    console.log('Установка зависимостей (клиент)...');
    await run('npm', ['install'], { cwd: clientDir });
  }

  if (!fs.existsSync(clientDist)) {
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
