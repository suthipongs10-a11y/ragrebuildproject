// Muay Manager on a computer (Windows; Linux and the Steam Deck): an Electron shell around the same game as the website.
// The game's files come with the app (resources/app/site, a copy of dist/site) and are served from muay://game/, so the
// game runs as it does on muay.eggpact.com. Its save stays in this computer's app data; the online parts (ranking,
// challenges, chat, news) talk to the game's server, as the mobile app shell does (docs/APP_BUILD_GUIDE.md).
// Built by tools/desktop-build.mjs, tested by tools/e2e/desktop.mjs.
'use strict';
const { app, BrowserWindow, Menu, ipcMain, net, protocol, screen, shell } = require('electron');
const fs = require('node:fs'), path = require('node:path'), { pathToFileURL } = require('node:url');

const SCHEME = 'muay', HOST = 'game', HOME = SCHEME + '://' + HOST + '/'; // the page's address: its save is kept under it, never change it
const SITE = path.join(__dirname, 'site');
const arg = name => { const a = process.argv.find(x => x.startsWith('--' + name + '=')); return a ? a.slice(name.length + 3) : null; };
// The game's server. --server= (or MUAY_SERVER) points a test build at a server on this machine, so tests never add
// players to the real one.
const SERVER = (arg('server') || process.env.MUAY_SERVER || 'https://muay.eggpact.com').replace(/\/+$/, '');
const DEBUG = process.argv.includes('--debug') || process.env.MUAY_DEBUG === '1';
const dataDir = arg('user-data') || process.env.MUAY_USER_DATA; // tests keep their saves apart
if (dataDir) app.setPath('userData', path.resolve(dataDir));

// A computer whose graphics card Chromium will not use for WebGL still gets the 3D ring, drawn in software (slower). The
// page is the game's own files only, so the software renderer's risk with unknown web pages does not apply.
app.commandLine.appendSwitch('enable-unsafe-swiftshader');
protocol.registerSchemesAsPrivileged([{scheme: SCHEME, privileges: {standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true, codeCache: true}}]);

// a file of the game, or 404 (nothing outside the game's folder is served)
async function serve(req) {
  const u = new URL(req.url);
  if (u.host !== HOST) return new Response('not found', {status: 404});
  let rel = decodeURIComponent(u.pathname); if (rel.endsWith('/')) rel += 'index.html';
  const file = path.normalize(path.join(SITE, rel));
  if (!file.startsWith(SITE + path.sep)) return new Response('not found', {status: 404});
  try { if (!(await fs.promises.stat(file)).isFile()) throw new Error('not a file'); } catch (e) { return new Response('not found', {status: 404}); }
  return net.fetch(pathToFileURL(file).toString(), {headers: req.headers});
}

// where the window was and how big, kept between runs
const STATE = () => path.join(app.getPath('userData'), 'window.json');
function readState() {
  try {
    const s = JSON.parse(fs.readFileSync(STATE(), 'utf8'));
    if (s.x != null && s.y != null) { // a window on a screen that is no longer there opens in the middle of the main one
      const d = screen.getDisplayMatching({x: s.x, y: s.y, width: s.w, height: s.h}).workArea;
      if (s.x + 80 > d.x + d.width || s.y + 40 > d.y + d.height || s.x + s.w < d.x + 80 || s.y < d.y - 10) { delete s.x; delete s.y; }
    }
    return s;
  } catch (e) { return {}; }
}
function keepState(win) {
  try {
    const b = win.getNormalBounds();
    fs.mkdirSync(app.getPath('userData'), {recursive: true});
    fs.writeFileSync(STATE(), JSON.stringify({x: b.x, y: b.y, w: b.width, h: b.height, max: win.isMaximized(), full: win.isFullScreen()}));
  } catch (e) { /* the next run opens at the default size */ }
}

function openWindow() {
  const st = readState();
  const win = new BrowserWindow({
    width: st.w || 1280, height: st.h || 800, x: st.x, y: st.y, minWidth: 800, minHeight: 600, show: false,
    title: 'Muay Manager', backgroundColor: '#0e0f14', autoHideMenuBar: true, icon: path.join(__dirname, 'icon.png'),
    webPreferences: {preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: false, devTools: DEBUG},
  });
  win.once('ready-to-show', () => { if (st.max) win.maximize(); win.show(); if (st.full) win.setFullScreen(true); });
  win.on('close', () => keepState(win));
  win.on('page-title-updated', e => e.preventDefault()); // the window keeps the game's name
  const wc = win.webContents;
  wc.setVisualZoomLevelLimits(1, 1).catch(() => {});
  // a thin dark scroll bar in the game's colours instead of the system's grey one
  wc.on('dom-ready', () => wc.insertCSS('html{scrollbar-color:#3a3d4a #0e0f14;scrollbar-width:thin}').catch(() => {}));
  // F11 or Alt+Enter: full screen. F12 opens the developer tools in a --debug run.
  wc.on('before-input-event', (e, k) => {
    if (k.type !== 'keyDown' || k.isAutoRepeat) return; // a held key toggles once
    if (k.key === 'F11' || (k.alt && k.key === 'Enter')) { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
    else if (DEBUG && k.key === 'F12') { wc.toggleDevTools(); e.preventDefault(); }
  });
  // links out of the game (the privacy page, a match to share) open in the computer's browser, never inside the app
  const out = url => { if (/^https?:\/\//i.test(url)) shell.openExternal(url).catch(() => {}); };
  wc.setWindowOpenHandler(({url}) => { out(url); return {action: 'deny'}; });
  wc.on('will-navigate', (e, url) => { if (!url.startsWith(HOME)) { e.preventDefault(); out(url); } });
  // the page only gets what the game uses: full screen (the stage's button) and copying a link
  wc.session.setPermissionRequestHandler((w, perm, ok) => ok(perm === 'fullscreen' || perm === 'clipboard-sanitized-write'));
  // a crashed page starts again (the save is in local storage, written as the game goes)
  let crashes = 0;
  wc.on('render-process-gone', (e, d) => { if (d.reason !== 'clean-exit' && ++crashes <= 3) wc.loadURL(HOME); });
  wc.loadURL(HOME + (arg('page') || ''));
  return win;
}

if (!app.requestSingleInstanceLock()) app.quit(); // a second start brings the open window forward instead
else {
  app.on('second-instance', () => { const w = BrowserWindow.getAllWindows()[0]; if (w) { if (w.isMinimized()) w.restore(); w.focus(); } });
  ipcMain.on('muay:config', e => { e.returnValue = {api: SERVER + '/api', web: SERVER, version: app.getVersion(), platform: process.platform}; });
  app.whenReady().then(() => {
    Menu.setApplicationMenu(null); // no menu bar, and none of a browser's keys (reload, zoom)
    protocol.handle(SCHEME, serve);
    openWindow();
  });
  app.on('window-all-closed', () => app.quit());
}
