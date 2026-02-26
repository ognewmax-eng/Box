/**
 * Общие константы игры (используются сервером и клиентом)
 */

export const GAME_STATES = {
  LOBBY: 'LOBBY',
  QUESTION: 'QUESTION',
  RESULTS: 'RESULTS',
};

export const ROOM_CODE_LENGTH = 4;

export const QUESTION_TIME_SEC = 15;

export const SOCKET_EVENTS = {
  // Комната
  CREATE_ROOM: 'create_room',
  ROOM_CREATED: 'room_created',
  JOIN_ROOM: 'join_room',
  JOIN_SUCCESS: 'join_success',
  JOIN_ERROR: 'join_error',
  PLAYER_JOINED: 'player_joined',
  PLAYER_LEFT: 'player_left',

  // Игра
  START_GAME: 'start_game',
  GAME_STARTED: 'game_started',
  NEXT_QUESTION: 'next_question',
  QUESTION_START: 'question_start',
  HOST_START_TIMER: 'host_start_timer',
  QUESTION_TIMER_STARTED: 'question_timer_started',
  SUBMIT_ANSWER: 'submit_answer',
  PLAYER_ANSWERED: 'player_answered',
  SHOW_RESULTS: 'show_results',
  RESULTS: 'results',
  GAME_OVER: 'game_over',
  HOST_SHOW_ROUND_LEADERBOARD: 'host_show_round_leaderboard',
  ROUND_LEADERBOARD_SHOWN: 'round_leaderboard_shown',

  // Синхронизация
  ROOM_STATE: 'room_state',
  HOST_DISCONNECT: 'host_disconnect',
  QUESTION_HOST: 'question_host',
  PACK_LOAD_ERROR: 'pack_load_error',
};
