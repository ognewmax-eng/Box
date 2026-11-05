import { app, BrowserWindow, Menu, dialog, shell } from 'electron';
import { randomBytes } from 'crypto';
import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createGameServer } from '../server/app.js';
import { getLANIP } from '../server/network.js';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, '..');
const PREFERRED_PORT = 3000;

let mainWindow = null;
let serverPort = null;
let adminPassword = null;
let gameServer = null;

// В установленном приложении клиент и готовые игры лежат в ресурсах, при запуске из исходников в проекте
const resourcesRoot = () => (app.isPackaged ? process.resourcesPath : projectRoot);
const bundledClient = () => (app.isPackaged ? join(process.resourcesPath, 'client-dist') : join(projectRoot, 'client', 'dist'));

/** Копирует готовые игры в папку пользователя, не трогая то, что он уже изменил или загрузил. */
function copyMissingFiles(source, target) {
  if (!fs.existsSync(source)) return;
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = join(source, entry.name);
    const to = join(target, entry.name);
    if (entry.isDirectory()) copyMissingFiles(from, to);
    else if (!fs.existsSync(to) && !entry.name.startsWith('.')) fs.copyFileSync(from, to);
  }
}

function loadAdminPassword(dataDir) {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  const file = join(dataDir, '.admin-password');
  if (fs.existsSync(file)) {
    const saved = fs.readFileSync(file, 'utf-8').trim();
    if (saved) return saved;
  }
  const generated = randomBytes(6).toString('base64url');
  fs.writeFileSync(file, generated, { mode: 0o600 });
  return generated;
}

// Если порт занят другой программой, берём любой свободный: адрес для телефонов игра покажет сама
function listen(httpServer, port) {
  return new Promise((resolve, reject) => {
    const onError = (err) => {
      if (err.code === 'EADDRINUSE' && port !== 0) resolve(listen(httpServer, 0));
      else reject(err);
    };
    httpServer.once('error', onError);
    httpServer.listen(port, '0.0.0.0', () => {
      httpServer.off('error', onError);
      resolve(httpServer.address().port);
    });
  });
}

async function startServer() {
  const dataDir = process.env.BOX_DATA_DIR || app.getPath('userData');
  fs.mkdirSync(dataDir, { recursive: true });
  copyMissingFiles(join(resourcesRoot(), 'games'), join(dataDir, 'games'));
  adminPassword = loadAdminPassword(dataDir);
  gameServer = createGameServer({
    appRoot: dataDir,
    clientBuild: bundledClient(),
    adminPassword,
    lanIp: getLANIP,
    port: () => serverPort,
  });
  serverPort = await listen(gameServer.httpServer, Number(process.env.PORT) || PREFERRED_PORT);
}

const pageUrl = (path) => `http://localhost:${serverPort}${path}`;

function openPage(path) {
  mainWindow?.loadURL(pageUrl(path));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 560,
    title: 'Box Party',
    backgroundColor: '#2330D9',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: join(here, 'preload.cjs'),
      additionalArguments: [`--box-admin=${adminPassword}`],
    },
  });

  // Внутри окна только сама игра, остальные ссылки открываются в обычном браузере
  const isGamePage = (url) => url.startsWith(`http://localhost:${serverPort}/`);
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isGamePage(url)) {
      event.preventDefault();
      if (/^https?:\/\//.test(url)) shell.openExternal(url);
    }
  });
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.loadURL(pageUrl('/host'));
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'Игра',
      submenu: [
        { label: 'Экран ведущего', accelerator: 'CmdOrCtrl+1', click: () => openPage('/host') },
        { label: 'Настройка игр', accelerator: 'CmdOrCtrl+2', click: () => openPage('/admin') },
        { type: 'separator' },
        { label: 'Открыть в браузере', click: () => shell.openExternal(pageUrl('/host')) },
        { label: 'Показать папку с играми', click: () => shell.openPath(join(gameServer ? (process.env.BOX_DATA_DIR || app.getPath('userData')) : '', 'games')) },
        ...(isMac ? [] : [{ type: 'separator' }, { role: 'quit', label: 'Выйти' }]),
      ],
    },
    {
      label: 'Вид',
      submenu: [
        { role: 'togglefullscreen', label: 'Во весь экран' },
        { role: 'resetZoom', label: 'Обычный размер' },
        { role: 'zoomIn', label: 'Крупнее' },
        { role: 'zoomOut', label: 'Мельче' },
        { type: 'separator' },
        { role: 'reload', label: 'Обновить' },
      ],
    },
    { role: 'editMenu', label: 'Правка' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// Второй запуск не поднимает второй сервер, а показывает уже открытое окно
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) {
      createWindow();
      return;
    }
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    try {
      await startServer();
    } catch (err) {
      dialog.showErrorBox('Не удалось запустить игру', err.message);
      app.quit();
      return;
    }
    buildMenu();
    createWindow();
    app.on('activate', () => {
      if (!mainWindow) createWindow();
    });
  });

  app.on('window-all-closed', () => app.quit());
}
