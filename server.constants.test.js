/**
 * Проверка констант сервера (запуск: node server.constants.test.js)
 * Соответствие клиенту и корректность значений после исправлений.
 */
import { GAME_STATES, SOCKET_EVENTS, ROOM_CODE_LENGTH, QUESTION_TIME_SEC } from './constants.js';

const assert = (ok, msg) => {
  if (!ok) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
};

assert(ROOM_CODE_LENGTH === 4, 'ROOM_CODE_LENGTH === 4');
assert(GAME_STATES.LOBBY === 'LOBBY' && GAME_STATES.QUESTION === 'QUESTION' && GAME_STATES.RESULTS === 'RESULTS', 'GAME_STATES');
assert(SOCKET_EVENTS.QUESTION_HOST === 'question_host', 'QUESTION_HOST');
assert(SOCKET_EVENTS.PACK_LOAD_ERROR === 'pack_load_error', 'PACK_LOAD_ERROR');
assert(SOCKET_EVENTS.SHOW_RESULTS === 'show_results', 'SHOW_RESULTS');
assert(SOCKET_EVENTS.NEXT_QUESTION === 'next_question', 'NEXT_QUESTION');
assert(SOCKET_EVENTS.JOIN_ROOM === 'join_room', 'JOIN_ROOM');

console.log('OK: server constants');
process.exit(0);
