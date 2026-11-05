import fs from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { sanitizeTheme } from './theme.js';

export const MAX_ROUNDS = 10;
export const MAX_QUESTIONS_PER_ROUND = 10;
export const MAX_OPTIONS = 10;
const DEFAULT_ANSWER_TIME = 15;

/** Ошибка содержимого пака: её текст показывается автору пака в админке. */
export class PackValidationError extends Error {}

// Только латиница, цифры, дефис и подчёркивание (защита от path traversal)
export function sanitizePackId(id) {
  if (typeof id !== 'string') return '';
  return id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
}

function text(value, maxLength) {
  return value == null ? '' : String(value).trim().slice(0, maxLength);
}

function clampAnswerTime(value) {
  return Math.min(60, Math.max(10, Number(value) || DEFAULT_ANSWER_TIME));
}

function getTimerStart(round) {
  return round?.timerStart === 'manual' || round?.timerStart === 'on_host' ? 'manual' : 'auto';
}

function pickMedia(q) {
  const media = {};
  for (const key of ['image', 'video', 'audio']) {
    const value = text(q?.[key], 2000);
    if (value) media[key] = value;
  }
  return media;
}

/**
 * Проверяет вопрос перед сохранением. Пустые варианты удаляются, а индекс
 * правильного ответа сдвигается вместе с ними.
 */
function sanitizeQuestionForSave(q, where) {
  const question = text(q?.question, 1000);
  if (!question) throw new PackValidationError(`${where}: нет текста вопроса`);
  const media = pickMedia(q);

  if (q.type === 'open') {
    const correctAnswer = text(q.correctAnswer, 300);
    if (!correctAnswer) throw new PackValidationError(`${where}: укажите правильный ответ`);
    return { type: 'open', question, correctAnswer, ...media };
  }

  const raw = Array.isArray(q.options) ? q.options.map((o) => text(o, 300)) : [];
  const correctIndex = Number(q.correctIndex) || 0;
  if (!raw[correctIndex]) throw new PackValidationError(`${where}: правильный вариант пуст`);
  const options = raw.filter(Boolean);
  if (options.length < 2) throw new PackValidationError(`${where}: нужно минимум 2 варианта`);
  if (options.length > MAX_OPTIONS) throw new PackValidationError(`${where}: максимум ${MAX_OPTIONS} вариантов`);
  return {
    type: 'choice',
    question,
    options,
    correctIndex: raw.slice(0, correctIndex).filter(Boolean).length,
    ...media,
  };
}

/** Собирает файл пака из тела запроса или бросает PackValidationError. */
export function buildPackFile(body) {
  const title = text(body?.title, 200);
  if (!title) throw new PackValidationError('Нужно название пака');

  const sourceRounds = Array.isArray(body.rounds) && body.rounds.length > 0
    ? body.rounds
    : [{ timerStart: 'auto', questions: body.questions }];
  if (sourceRounds.length > MAX_ROUNDS) throw new PackValidationError(`Максимум ${MAX_ROUNDS} раундов`);

  const rounds = sourceRounds.map((round, ri) => {
    const questions = Array.isArray(round?.questions) ? round.questions : [];
    if (questions.length === 0) throw new PackValidationError(`Раунд ${ri + 1}: нет вопросов`);
    if (questions.length > MAX_QUESTIONS_PER_ROUND) {
      throw new PackValidationError(`Раунд ${ri + 1}: максимум ${MAX_QUESTIONS_PER_ROUND} вопросов`);
    }
    const roundTitle = text(round.roundTitle, 200);
    return {
      timerStart: getTimerStart(round),
      ...(roundTitle ? { roundTitle } : {}),
      questions: questions.map((q, qi) => sanitizeQuestionForSave(q, `Раунд ${ri + 1}, вопрос ${qi + 1}`)),
    };
  });

  const theme = sanitizeTheme(body.theme);
  return { title, answerTimeSec: clampAnswerTime(body.answerTimeSec), ...(theme ? { theme } : {}), rounds };
}

export function normalizeQuestion(q) {
  const media = pickMedia(q);
  if (q?.type === 'open') {
    return { type: 'open', question: q.question || '', correctAnswer: text(q.correctAnswer, 300), ...media };
  }
  const options = Array.isArray(q?.options) && q.options.length ? q.options.slice(0, MAX_OPTIONS) : ['A', 'B', 'C', 'D'];
  return {
    type: 'choice',
    question: q?.question || '',
    options,
    correctIndex: Math.max(0, Math.min(Number(q?.correctIndex) || 0, options.length - 1)),
    ...media,
  };
}

/** Разворачивает пак в плоский список вопросов для игры. */
export function loadPackForGame(data) {
  const answerTimeSec = clampAnswerTime(data?.answerTimeSec);
  const sourceRounds = Array.isArray(data?.rounds) && data.rounds.length > 0
    ? data.rounds.slice(0, MAX_ROUNDS)
    : [{ timerStart: 'auto', questions: Array.isArray(data?.questions) ? data.questions : [] }];

  const questions = [];
  const timerModes = [];
  const roundEndIndices = [];
  const questionRounds = [];
  const roundTitles = [];
  for (const round of sourceRounds) {
    const roundQuestions = Array.isArray(round?.questions) ? round.questions : [];
    if (roundQuestions.length === 0) continue;
    roundTitles.push(typeof round.roundTitle === 'string' ? round.roundTitle : '');
    for (const q of roundQuestions) {
      questions.push(normalizeQuestion(q));
      timerModes.push(getTimerStart(round));
      questionRounds.push(roundTitles.length - 1);
    }
    roundEndIndices.push(questions.length - 1);
  }
  return { questions, timerModes, roundEndIndices, questionRounds, roundTitles, answerTimeSec };
}

export function resolveMediaUrl(value) {
  if (!value || typeof value !== 'string') return undefined;
  const s = value.trim();
  if (!s) return undefined;
  if (s.startsWith('http://') || s.startsWith('https://')) return s;
  return '/media/' + s.replace(/^\/+/, '');
}

/** Для сравнения открытых ответов: регистр, ё/е, знаки и лишние пробелы не важны. */
export function normalizeAnswer(value) {
  if (value == null) return '';
  return String(value)
    .normalize('NFC')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function readPack(gamesDir, id) {
  const safeId = sanitizePackId(id);
  if (!safeId) return null;
  const path = join(gamesDir, `${safeId}.json`);
  if (!fs.existsSync(path)) return null;
  return JSON.parse(fs.readFileSync(path, 'utf-8'));
}

export function listPacks(gamesDir) {
  const packs = [];
  for (const file of fs.readdirSync(gamesDir).filter((f) => f.endsWith('.json'))) {
    try {
      const data = JSON.parse(fs.readFileSync(join(gamesDir, file), 'utf-8'));
      const theme = sanitizeTheme(data.theme);
      packs.push({
        id: file.replace(/\.json$/i, ''),
        title: data.title,
        questionsCount: loadPackForGame(data).questions.length,
        ...(theme ? { theme } : {}),
      });
    } catch (err) {
      console.error('Пак не загружен:', file, err.message);
    }
  }
  return packs;
}

// Запись через временный файл: сбой посреди записи не испортит существующий пак
export function writePack(gamesDir, id, pack) {
  const path = join(gamesDir, `${id}.json`);
  const tmp = `${path}.${randomUUID()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(pack, null, 2), 'utf-8');
  fs.renameSync(tmp, path);
}
