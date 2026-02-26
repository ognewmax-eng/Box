#!/usr/bin/env node
/**
 * Сборка проекта в один исполняемый файл (pkg) для macOS.
 * 1) Сборка клиента
 * 2) Бандл сервера в CJS (esbuild) — pkg не поддерживает ESM
 * 3) Упаковка в бинарник (pkg)
 * 4) Копирование client/dist и games в Builds/
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const builds = path.join(root, 'Builds');

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', cwd: opts.cwd || root, shell: false });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

console.log('1/4 Сборка клиента...');
run('npm', ['run', 'build']);

console.log('2/4 Бандл сервера в CJS (esbuild)...');
fs.mkdirSync(builds, { recursive: true });
run('npx', ['esbuild', 'server.js', '--bundle', '--platform=node', '--format=cjs', '--outfile=Builds/server-cjs.cjs']);

console.log('3/4 Упаковка в бинарник (pkg)...');
run('npx', ['pkg', 'Builds/server-cjs.cjs', '--targets', 'node18-macos-arm64', '--output', 'Builds/BoxParty']);

console.log('4/4 Копирование client/dist и games в Builds/...');
run('node', ['scripts/copy-build-assets.js']);

// Удаляем промежуточный CJS (опционально)
try { fs.unlinkSync(path.join(builds, 'server-cjs.cjs')); } catch (_) {}

console.log('\nГотово. Запуск: Builds/BoxParty');
