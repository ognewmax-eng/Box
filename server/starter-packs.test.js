import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { buildPackFile } from './packs.js';

const gamesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'games');
const packFiles = fs.readdirSync(gamesDir).filter((file) => file.endsWith('.json'));

describe('паки в поставке', () => {
  for (const file of packFiles) {
    const pack = JSON.parse(fs.readFileSync(join(gamesDir, file), 'utf-8'));
    const questions = (pack.rounds ?? []).flatMap((round) => round.questions);

    it(`${file}: проходит проверку сервера без потерь`, () => {
      const built = buildPackFile(pack);
      assert.deepEqual(
        built.rounds.flatMap((round) => round.questions).map((q) => q.question),
        questions.map((q) => q.question),
      );
      if (pack.theme) assert.deepEqual(built.theme, pack.theme);
    });

    it(`${file}: у вопросов с выбором нет повторов, а картинки на месте`, () => {
      for (const q of questions) {
        if (q.type === 'choice') {
          assert.equal(new Set(q.options).size, q.options.length, q.question);
          assert.ok(q.options[q.correctIndex], q.question);
        }
        if (q.image) assert.ok(fs.existsSync(join(gamesDir, 'media', q.image)), q.image);
      }
    });
  }
});
