import fs from 'fs';
import { join } from 'path';

/**
 * Возвращает пакеты из package-lock.json, которых нет в node_modules или у которых другая версия.
 * Наличия самой папки мало: после git pull в ней могут остаться только обрывки старой установки.
 * Модуль использует лишь встроенные возможности Node, потому что запускается до установки зависимостей.
 */
export function findBrokenPackages(projectDir) {
  const lock = JSON.parse(fs.readFileSync(join(projectDir, 'package-lock.json'), 'utf-8'));
  const broken = [];
  for (const [path, entry] of Object.entries(lock.packages || {})) {
    // Необязательные пакеты зависят от платформы, а ссылки указывают на другие папки
    if (!path.startsWith('node_modules/') || entry.optional || entry.link) continue;
    try {
      const installed = JSON.parse(fs.readFileSync(join(projectDir, path, 'package.json'), 'utf-8'));
      if (entry.version && installed.version !== entry.version) broken.push(path);
    } catch {
      broken.push(path);
    }
  }
  return broken;
}
