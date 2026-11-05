import express from 'express';
import multer from 'multer';
import fs from 'fs';
import { createHash, timingSafeEqual } from 'crypto';
import { extname, join } from 'path';
import { PackValidationError, buildPackFile, listPacks, readPack, sanitizePackId, writePack } from './packs.js';

const MEDIA_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp',
  '.mp4', '.webm', '.mov', '.m4v',
  '.mp3', '.wav', '.ogg', '.m4a', '.aac',
]);
const MAX_MEDIA_BYTES = 50 * 1024 * 1024;
const LOGIN_MAX_FAILURES = 10;
const LOGIN_WINDOW_MS = 60 * 1000;

class BadUpload extends Error {}

function sha256(value) {
  return createHash('sha256').update(String(value)).digest();
}

function requireAdminFactory(adminPassword) {
  const expected = sha256(adminPassword);
  const failures = new Map(); // ip -> { count, resetAt }

  return function requireAdmin(req, res, next) {
    const now = Date.now();
    const entry = failures.get(req.ip);
    if (entry && entry.resetAt <= now) failures.delete(req.ip);
    else if (entry && entry.count >= LOGIN_MAX_FAILURES) {
      return res.status(429).json({ error: 'Слишком много попыток, подождите минуту' });
    }

    const given = req.get('x-admin-password');
    if (given && timingSafeEqual(sha256(given), expected)) return next();

    if (given) {
      const current = failures.get(req.ip) || { count: 0, resetAt: now + LOGIN_WINDOW_MS };
      current.count += 1;
      failures.set(req.ip, current);
    }
    return res.status(401).json({ error: 'Неверный пароль админки' });
  };
}

function sanitizeMediaName(originalName) {
  const safe = String(originalName || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 128);
  const ext = extname(safe).toLowerCase();
  const name = (ext ? safe.slice(0, -ext.length) : safe) || 'file';
  return `${name}-${Date.now()}${ext}`;
}

export function createHttpApp({ gamesDir, mediaDir, clientBuild, adminPassword }) {
  const app = express();
  const requireAdmin = requireAdminFactory(adminPassword);

  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  });
  app.use('/api', express.json({ limit: '1mb' }));

  app.get('/api/health', (req, res) => {
    res.json({ ok: true, message: 'Сервер доступен', ts: Date.now() });
  });

  // Публично отдаём только название и число вопросов: ответы видит лишь админка
  app.get('/api/packs', (req, res) => {
    res.json(listPacks(gamesDir));
  });

  app.get('/api/admin/check', requireAdmin, (req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/packs/:id', requireAdmin, (req, res) => {
    const id = sanitizePackId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Некорректный id пака' });
    const data = readPack(gamesDir, id);
    if (!data) return res.status(404).json({ error: 'Пак не найден' });
    res.json({ id, ...data });
  });

  app.post('/api/packs', requireAdmin, (req, res) => {
    const safeId = sanitizePackId(req.body?.id);
    if (!safeId) return res.status(400).json({ error: 'ID пака: только латиница, цифры, дефис и подчёркивание' });
    writePack(gamesDir, safeId, buildPackFile(req.body));
    res.json({ ok: true, id: safeId });
  });

  const mediaUpload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        const dir = join(mediaDir, sanitizePackId(req.params.id));
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (req, file, cb) => cb(null, sanitizeMediaName(file.originalname)),
    }),
    limits: { fileSize: MAX_MEDIA_BYTES, files: 1 },
    fileFilter: (req, file, cb) => {
      const ext = extname(String(file.originalname || '')).toLowerCase();
      if (MEDIA_EXTENSIONS.has(ext) && /^(image|video|audio)\//.test(file.mimetype)) return cb(null, true);
      cb(new BadUpload('Разрешены только фото, видео и аудио'));
    },
  });

  app.post('/api/packs/:id/media', requireAdmin, (req, res) => {
    const id = sanitizePackId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Некорректный id пака' });
    mediaUpload.single('file')(req, res, (err) => {
      if (err?.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Файл слишком большой (макс. 50 МБ)' });
      if (err instanceof BadUpload) return res.status(400).json({ error: err.message });
      if (err) {
        console.error('Ошибка загрузки:', err);
        return res.status(500).json({ error: 'Ошибка загрузки' });
      }
      if (!req.file) return res.status(400).json({ error: 'Файл не выбран' });
      res.json({ path: `${id}/${req.file.filename}` });
    });
  });

  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Не найдено' });
  });

  // sandbox не даст выполнить скрипты из файла, даже если он попал в папку не через загрузку
  app.use('/media', express.static(mediaDir, {
    setHeaders: (res) => res.setHeader('Content-Security-Policy', 'sandbox'),
  }));

  if (fs.existsSync(clientBuild)) {
    app.use(express.static(clientBuild));
    app.get('*', (req, res) => res.sendFile(join(clientBuild, 'index.html')));
  }

  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    if (err instanceof PackValidationError) return res.status(400).json({ error: err.message });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Пак слишком большой (макс. 1 МБ)' });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Некорректный JSON' });
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  });

  return app;
}
