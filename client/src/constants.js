export const GAME_STATES = {
  LOBBY: 'LOBBY',
  QUESTION: 'QUESTION',
  RESULTS: 'RESULTS',
};

export const SOCKET_EVENTS = {
  CREATE_ROOM: 'create_room',
  ROOM_CREATED: 'room_created',
  JOIN_ROOM: 'join_room',
  JOIN_SUCCESS: 'join_success',
  JOIN_ERROR: 'join_error',
  PLAYER_JOINED: 'player_joined',
  PLAYER_LEFT: 'player_left',
  START_GAME: 'start_game',
  GAME_STARTED: 'game_started',
  NEXT_QUESTION: 'next_question',
  QUESTION_START: 'question_start',
  SUBMIT_ANSWER: 'submit_answer',
  PLAYER_ANSWERED: 'player_answered',
  SHOW_RESULTS: 'show_results',
  RESULTS: 'results',
  GAME_OVER: 'game_over',
  ROOM_STATE: 'room_state',
  HOST_DISCONNECT: 'host_disconnect',
};

export const API_BASE = import.meta.env.DEV ? '' : '';
