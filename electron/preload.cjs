// Приложение само открывает настройку игр на этом компьютере: вводить пароль не нужно.
// Пароль передаётся только странице игры, которую открыло приложение.
const arg = process.argv.find((value) => value.startsWith('--box-admin='));
if (arg && window.location.hostname === 'localhost') {
  try {
    window.sessionStorage.setItem('box.adminPassword', arg.slice('--box-admin='.length));
  } catch {
    // Страница без хранилища: админка просто попросит пароль
  }
}
