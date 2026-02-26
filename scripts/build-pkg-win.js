#!/usr/bin/env node
/**
 * Сборка проекта в один исполняемый .exe для Windows (pkg).
 * Результат в папке Builds-Windows: BoxParty.exe, client/, games/.
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const buildsWin = path.join(root, 'Builds-Windows');

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    stdio: 'inherit',
    cwd: opts.cwd || root,
    shell: false,
    ...(opts.env && { env: opts.env }),
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

console.log('1/4 Сборка клиента...');
run('npm', ['run', 'build']);

console.log('2/4 Бандл сервера в CJS (esbuild)...');
fs.mkdirSync(buildsWin, { recursive: true });
run('npx', ['esbuild', 'server.js', '--bundle', '--platform=node', '--format=cjs', '--outfile=Builds-Windows/server-cjs.cjs']);

console.log('3/4 Упаковка в .exe (pkg, Windows x64)...');
run('npx', ['pkg', 'Builds-Windows/server-cjs.cjs', '--targets', 'node18-win-x64', '--output', 'Builds-Windows/BoxParty']);

console.log('4/4 Копирование client/dist и games в Builds-Windows/...');
run('node', ['scripts/copy-build-assets.js'], { env: { ...process.env, BUILD_DIR: 'Builds-Windows' } });

try { fs.unlinkSync(path.join(buildsWin, 'server-cjs.cjs')); } catch (_) {}

console.log('\nГотово. Файл для Windows: Builds-Windows/BoxParty.exe');
