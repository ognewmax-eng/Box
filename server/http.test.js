import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { join } from 'path';
import { ADMIN_PASSWORD, TEST_PACK, startTestServer } from './test-helpers.js';

describe('HTTP API', () => {
  let server;
  const admin = { 'X-Admin-Password': ADMIN_PASSWORD };
  const json = { 'Content-Type': 'application/json' };
  const savePack = (body) => fetch(`${server.url}/api/packs`, {
    method: 'POST',
    headers: { ...json, ...admin },
    body: JSON.stringify(body),
  });

  before(async () => { server = await startTestServer(); });
  after(() => server.stop());

  it('публичный список не содержит вопросов и ответов', async () => {
    const res = await fetch(`${server.url}/api/packs`);
    const packs = await res.json();
    assert.deepEqual(packs, [{ id: 'test', title: 'Тестовый пак', questionsCount: 3 }]);
  });

  it('пак с ответами только по паролю', async () => {
    assert.equal((await fetch(`${server.url}/api/packs/test`)).status, 401);
    assert.equal((await fetch(`${server.url}/api/packs/test`, { headers: { 'X-Admin-Password': 'wrong' } })).status, 401);
    const res = await fetch(`${server.url}/api/packs/test`, { headers: admin });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).rounds[0].questions[0].correctAnswer, 'Ёж');
  });

  it('без пароля пак не перезаписать, CORS-заголовков нет', async () => {
    const res = await fetch(`${server.url}/api/packs`, {
      method: 'POST',
      headers: { ...json, Origin: 'https://evil.example' },
      body: JSON.stringify({ id: 'test', title: 'HACKED', questions: [] }),
    });
    assert.equal(res.status, 401);
    assert.equal(res.headers.get('access-control-allow-origin'), null);
    const saved = JSON.parse(fs.readFileSync(join(server.appRoot, 'games', 'test.json'), 'utf-8'));
    assert.equal(saved.title, TEST_PACK.title);
  });

  it('сдвигает правильный ответ при удалении пустых вариантов', async () => {
    const res = await savePack({
      id: 'shift',
      title: 'Сдвиг',
      rounds: [{ questions: [{ type: 'choice', question: 'Q', options: ['', 'B', '', 'D'], correctIndex: 3 }] }],
    });
    assert.equal(res.status, 200);
    const saved = JSON.parse(fs.readFileSync(join(server.appRoot, 'games', 'shift.json'), 'utf-8'));
    assert.deepEqual(saved.rounds[0].questions[0].options, ['B', 'D']);
    assert.equal(saved.rounds[0].questions[0].correctIndex, 1);
  });

  it('сохраняет название раунда', async () => {
    await savePack({ id: 'titled', title: 'T', rounds: [{ roundTitle: 'Быт', questions: [{ type: 'open', question: 'Q', correctAnswer: 'A' }] }] });
    const saved = JSON.parse(fs.readFileSync(join(server.appRoot, 'games', 'titled.json'), 'utf-8'));
    assert.equal(saved.rounds[0].roundTitle, 'Быт');
  });

  it('объясняет ошибки в паке', async () => {
    const cases = [
      [{ type: 'choice', question: 'Q', options: ['', 'B', 'C'], correctIndex: 0 }, /правильный вариант пуст/],
      [{ type: 'choice', question: 'Q', options: ['A'], correctIndex: 0 }, /минимум 2/],
      [{ type: 'open', question: 'Q', correctAnswer: ' ' }, /правильный ответ/],
      [{ type: 'open', question: ' ', correctAnswer: 'A' }, /нет текста/],
    ];
    for (const [question, message] of cases) {
      const res = await savePack({ id: 'bad', title: 'T', rounds: [{ questions: [question] }] });
      assert.equal(res.status, 400);
      assert.match((await res.json()).error, message);
    }
    assert.equal(fs.existsSync(join(server.appRoot, 'games', 'bad.json')), false);
  });

  it('слишком большой пак получает понятную JSON-ошибку', async () => {
    const res = await savePack({ id: 'big', title: 'x'.repeat(2 * 1024 * 1024) });
    assert.equal(res.status, 413);
    assert.match((await res.json()).error, /слишком большой/);
  });

  const upload = (name, type, headers = admin) => {
    const form = new FormData();
    form.append('file', new Blob(['data'], { type }), name);
    return fetch(`${server.url}/api/packs/test/media`, { method: 'POST', body: form, headers });
  };

  it('принимает медиа и отдаёт его с защитными заголовками', async () => {
    const res = await upload('pic.png', 'image/png');
    assert.equal(res.status, 200);
    const { path } = await res.json();
    assert.match(path, /^test\/pic-\d+\.png$/);
    const media = await fetch(`${server.url}/media/${path}`);
    assert.equal(media.headers.get('content-security-policy'), 'sandbox');
    assert.equal(media.headers.get('x-content-type-options'), 'nosniff');
  });

  it('не принимает HTML, SVG и загрузку без пароля', async () => {
    assert.equal((await upload('x.html', 'text/html')).status, 400);
    assert.equal((await upload('x.svg', 'image/svg+xml')).status, 400);
    assert.equal((await upload('x.html', 'image/png')).status, 400);
    assert.equal((await upload('x.png', 'image/png', {})).status, 401);
  });

  it('несуществующий API отвечает JSON, а не страницей', async () => {
    const res = await fetch(`${server.url}/api/unknown`);
    assert.equal(res.status, 404);
    assert.equal((await res.json()).error, 'Не найдено');
  });

  it('блокирует подбор пароля', async () => {
    const wrong = { 'X-Admin-Password': 'wrong' };
    let status;
    for (let i = 0; i < 12; i++) {
      status = (await fetch(`${server.url}/api/admin/check`, { headers: wrong })).status;
    }
    assert.equal(status, 429);
  });
});
