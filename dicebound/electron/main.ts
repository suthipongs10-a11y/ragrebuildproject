import { app, BrowserWindow } from 'electron';
import path from 'node:path';

const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 720;
const BACKGROUND = '#000000';

const devServerUrl = process.env['VITE_DEV_SERVER_URL'];

function createWindow(): void {
  const window = new BrowserWindow({
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    useContentSize: true,
    backgroundColor: BACKGROUND,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: !app.isPackaged,
    },
  });

  window.once('ready-to-show', () => window.show());
  if (app.isPackaged) window.removeMenu();

  if (devServerUrl && !app.isPackaged) {
    void window.loadURL(devServerUrl);
  } else {
    void window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

void app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => app.quit());
