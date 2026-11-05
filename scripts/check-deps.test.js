import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import { join } from 'path';
import { findBrokenPackages } from './check-deps.js';

function install(dir, path, version) {
  fs.mkdirSync(join(dir, path), { recursive: true });
  fs.writeFileSync(join(dir, path, 'package.json'), JSON.stringify({ version }));
}

describe('findBrokenPackages', () => {
  let dir;

  beforeEach(() => {
    dir = fs.mkdtempSync(join(os.tmpdir(), 'box-deps-'));
    fs.writeFileSync(join(dir, 'package-lock.json'), JSON.stringify({
      packages: {
        '': { name: 'app' },
        'node_modules/a': { version: '1.0.0' },
        'node_modules/a/node_modules/b': { version: '2.0.0' },
        'node_modules/only-on-linux': { version: '1.0.0', optional: true },
      },
    }));
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('полная установка в порядке', () => {
    install(dir, 'node_modules/a', '1.0.0');
    install(dir, 'node_modules/a/node_modules/b', '2.0.0');
    assert.deepEqual(findBrokenPackages(dir), []);
  });

  it('находит пропавший вложенный пакет при существующей папке', () => {
    install(dir, 'node_modules/a', '1.0.0');
    assert.deepEqual(findBrokenPackages(dir), ['node_modules/a/node_modules/b']);
  });

  it('находит пакет другой версии', () => {
    install(dir, 'node_modules/a', '0.9.0');
    install(dir, 'node_modules/a/node_modules/b', '2.0.0');
    assert.deepEqual(findBrokenPackages(dir), ['node_modules/a']);
  });

  it('находит папку без package.json: обрывок старой установки', () => {
    fs.mkdirSync(join(dir, 'node_modules/a'), { recursive: true });
    install(dir, 'node_modules/a/node_modules/b', '2.0.0');
    assert.deepEqual(findBrokenPackages(dir), ['node_modules/a']);
  });
});
