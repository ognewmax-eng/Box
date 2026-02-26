#!/usr/bin/env node
/**
 * Копирует client/dist и games в Builds/ для работы pkg-сборки.
 * Запускается после pkg. Работает на Windows и Unix.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const builds = path.join(root, 'Builds');

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const s = path.join(src, name);
    const d = path.join(dest, name);
    if (fs.statSync(s).isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

// client/dist -> Builds/client/dist
const clientDist = path.join(root, 'client', 'dist');
const buildsClient = path.join(builds, 'client', 'dist');
if (fs.existsSync(clientDist)) {
  fs.mkdirSync(path.join(builds, 'client'), { recursive: true });
  copyDir(clientDist, buildsClient);
  console.log('Скопировано: client/dist -> Builds/client/dist');
}

// games -> Builds/games (пакеты и media)
const gamesSrc = path.join(root, 'games');
const gamesDest = path.join(builds, 'games');
if (fs.existsSync(gamesSrc)) {
  copyDir(gamesSrc, gamesDest);
  console.log('Скопировано: games -> Builds/games');
} else {
  fs.mkdirSync(path.join(gamesDest, 'media'), { recursive: true });
  console.log('Создана папка: Builds/games');
}
