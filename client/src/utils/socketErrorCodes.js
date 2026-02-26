/**
 * Коды и сообщения ошибок соединения Socket.IO для отображения пользователю.
 * Помогает понять причину "Нет связи с сервером" на разных устройствах.
 */

/**
 * По данным из connect_error или disconnect возвращает { code, message }.
 * @param {Error & { code?: string; description?: number }} err - объект из connect_error
 * @param {string} [disconnectReason] - причина из disconnect (transport close, ping timeout и т.д.)
 */
export function getSocketErrorInfo(err, disconnectReason) {
  if (disconnectReason) {
    const d = DISCONNECT_REASONS[disconnectReason] || {
      code: 'DISCONNECT',
      message: `Соединение разорвано (${disconnectReason}). Убедитесь, что вы в той же Wi‑Fi что и ведущий, и сервер запущен.`,
    };
    return d;
  }
  if (!err) return { code: 'UNKNOWN', message: 'Неизвестная ошибка соединения.' };

  const code = err.code || parseCodeFromMessage(err.message);
  const known = ERROR_MAP[code];
  if (known) return known;

  // Описание от Socket.IO (HTTP статус и т.д.)
  const desc = err.description != null ? ` (код ${err.description})` : '';
  return {
    code: code || 'CONNECT_ERROR',
    message: (err.message || 'Ошибка подключения') + desc + '. Проверьте, что сервер запущен и устройство в той же сети.',
  };
}

function parseCodeFromMessage(msg) {
  if (!msg || typeof msg !== 'string') return null;
  if (msg.includes('ECONNREFUSED')) return 'ECONNREFUSED';
  if (msg.includes('ETIMEDOUT') || msg.includes('timeout')) return 'ETIMEDOUT';
  if (msg.includes('ENOTFOUND') || msg.includes('getaddrinfo')) return 'ENOTFOUND';
  if (msg.includes('Network Error') || msg.includes('ERR_NETWORK')) return 'ERR_NETWORK';
  if (msg.includes('xhr poll error') || msg.includes('poll error')) return 'XHR_POLL_ERROR';
  if (msg.includes('websocket error')) return 'WEBSOCKET_ERROR';
  if (msg.includes('CORS') || msg.includes('Cross-Origin')) return 'CORS';
  return null;
}

const ERROR_MAP = {
  ECONNREFUSED: {
    code: 'ECONNREFUSED',
    message: 'Сервер недоступен. Запустите игру на ПК ведущего и убедитесь, что телефон в той же Wi‑Fi. В браузере ПК откройте тот же адрес, что и на телефоне.',
  },
  ETIMEDOUT: {
    code: 'ETIMEDOUT',
    message: 'Таймаут подключения. Сервер не ответил вовремя. Проверьте Wi‑Fi и что сервер запущен на ПК.',
  },
  ENOTFOUND: {
    code: 'ENOTFOUND',
    message: 'Адрес сервера не найден. Вводите адрес с экрана ведущего (например http://192.168.1.5:3000).',
  },
  ERR_NETWORK: {
    code: 'ERR_NETWORK',
    message: 'Сетевая ошибка. Проверьте интернет/Wi‑Fi и что вы в той же сети, что и ПК с игрой.',
  },
  XHR_POLL_ERROR: {
    code: 'XHR_POLL_ERROR',
    message: 'Не удалось связаться с сервером (опрос соединения). Та же Wi‑Fi сеть, что и ПК? Сервер запущен?',
  },
  WEBSOCKET_ERROR: {
    code: 'WEBSOCKET_ERROR',
    message: 'Ошибка WebSocket. Попробуйте обновить страницу или проверить, не блокирует ли сеть/прокси соединение.',
  },
  CORS: {
    code: 'CORS',
    message: 'Доступ заблокирован (CORS). Запускайте игру с того же адреса, что показывает ведущий (например http://IP:3000).',
  },
  CONNECT_ERROR: {
    code: 'CONNECT_ERROR',
    message: 'Ошибка подключения. Проверьте адрес, Wi‑Fi и что сервер на ПК запущен.',
  },
  UNKNOWN: {
    code: 'UNKNOWN',
    message: 'Неизвестная ошибка. Убедитесь, что открываете ссылку с экрана ведущего и вы в одной сети.',
  },
};

const DISCONNECT_REASONS = {
  'io server disconnect': {
    code: 'SERVER_DISCONNECT',
    message: 'Сервер отключил соединение. Ведущий мог закрыть игру или перезапустить сервер.',
  },
  'io client disconnect': {
    code: 'CLIENT_DISCONNECT',
    message: 'Соединение закрыто с вашей стороны.',
  },
  'ping timeout': {
    code: 'PING_TIMEOUT',
    message: 'Соединение разорвано по таймауту. Слабый Wi‑Fi или сервер перестал отвечать. Проверьте сеть и переподключитесь.',
  },
  'transport close': {
    code: 'TRANSPORT_CLOSE',
    message: 'Соединение разорвано (сеть или сервер). Убедитесь, что в той же Wi‑Fi и сервер запущен.',
  },
  'transport error': {
    code: 'TRANSPORT_ERROR',
    message: 'Ошибка передачи данных. Обновите страницу и зайдите снова по ссылке с экрана ведущего.',
  },
};
