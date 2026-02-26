import { describe, it, expect } from 'vitest';
import {
  GAME_STATES,
  ROOM_CODE_LENGTH,
  SOCKET_EVENTS,
} from './constants';

describe('constants', () => {
  it('ROOM_CODE_LENGTH is 4', () => {
    expect(ROOM_CODE_LENGTH).toBe(4);
  });

  it('GAME_STATES has LOBBY, QUESTION, RESULTS', () => {
    expect(GAME_STATES.LOBBY).toBe('LOBBY');
    expect(GAME_STATES.QUESTION).toBe('QUESTION');
    expect(GAME_STATES.RESULTS).toBe('RESULTS');
  });

  it('SOCKET_EVENTS.QUESTION_HOST is question_host', () => {
    expect(SOCKET_EVENTS.QUESTION_HOST).toBe('question_host');
  });

  it('SOCKET_EVENTS.PACK_LOAD_ERROR is pack_load_error', () => {
    expect(SOCKET_EVENTS.PACK_LOAD_ERROR).toBe('pack_load_error');
  });

  it('SOCKET_EVENTS has JOIN_ROOM, SHOW_RESULTS, NEXT_QUESTION', () => {
    expect(SOCKET_EVENTS.JOIN_ROOM).toBe('join_room');
    expect(SOCKET_EVENTS.SHOW_RESULTS).toBe('show_results');
    expect(SOCKET_EVENTS.NEXT_QUESTION).toBe('next_question');
  });
});
