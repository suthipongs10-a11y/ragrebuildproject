// Runs before the game's page: tells the game where its server is, as the mobile app shell does
// (docs/APP_BUILD_GUIDE.md: MUAY_API, MUAY_WEB), and that it runs in the computer app (MuayDesktop).
'use strict';
const { contextBridge, ipcRenderer } = require('electron');
const cfg = ipcRenderer.sendSync('muay:config');
contextBridge.exposeInMainWorld('MUAY_API', cfg.api);
contextBridge.exposeInMainWorld('MUAY_WEB', cfg.web);
contextBridge.exposeInMainWorld('MuayDesktop', {version: cfg.version, platform: cfg.platform});
