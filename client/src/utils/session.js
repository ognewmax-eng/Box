/** Сохранённая сессия нужна, чтобы вернуться в игру после обрыва связи или обновления страницы. */
function read(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key));
    return parsed?.code && parsed?.token ? parsed : null;
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Приватный режим браузера: игра работает, но без возврата
  }
}

function remove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // См. write
  }
}

const HOST_KEY = 'box.hostSession';
const PLAYER_KEY = 'box.playerSession';

export const loadHostSession = () => read(HOST_KEY);
export const saveHostSession = (session) => write(HOST_KEY, session);
export const clearHostSession = () => remove(HOST_KEY);

export const loadPlayerSession = () => read(PLAYER_KEY);
export const savePlayerSession = (session) => write(PLAYER_KEY, session);
export const clearPlayerSession = () => remove(PLAYER_KEY);
