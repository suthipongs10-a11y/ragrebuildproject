// The computer app, run for real: the Linux build from tools/desktop-build.mjs, opened by Playwright on a screen of its
// own (Xvfb when there is no display), talking to a game server this test starts on this machine (so no test player
// ever reaches the real server). Checks that the game loads from inside the app, goes online, opens links outside,
// takes F11, and keeps the save and the window's size from one run to the next.
// usage: node tools/desktop-build.mjs --only=linux && node tools/e2e/desktop.mjs
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
const require = createRequire(import.meta.url); const { _electron } = require('playwright');
const ROOT = new URL('../../', import.meta.url).pathname, S = ROOT + 'dist/e2e/desktop/';
const dir = readdirSync(ROOT + 'dist/desktop').filter(f => /-linux-x64$/.test(f)).sort().pop();
if (!dir) throw new Error('no Linux build: run node tools/desktop-build.mjs --only=linux');
const EXE = ROOT + 'dist/desktop/' + dir + '/muay-manager', PORT = 8791, SERVER = 'http://127.0.0.1:' + PORT, NAME = 'ทดสอบเครื่องคอม';
rmSync(S, {recursive: true, force: true}); mkdirSync(S, {recursive: true});

const kids = [];
const run = (cmd, args, env) => { const k = spawn(cmd, args, {env: {...process.env, ...env}, stdio: 'ignore'}); kids.push(k); return k; };
let display = process.env.DISPLAY;
if (!display) { display = ':97'; run('Xvfb', [display, '-screen', '0', '1600x1000x24', '-nolisten', 'tcp']); }
run(process.execPath, ['--disable-warning=ExperimentalWarning', ROOT + 'server/server.mjs'], {PORT: String(PORT), MUAY_DB: S + 'muay.db'});
for (let i = 0; i < 50; i++) { try { if ((await fetch(SERVER + '/api/db/board?limit=1')).ok) break; } catch (e) { /* still starting */ } await new Promise(r => setTimeout(r, 200)); }

const t0 = Date.now(), T = () => ((Date.now() - t0) / 1000).toFixed(0).padStart(3) + 's';
let bad = 0, steps = 0;
const ok = (c, what, got) => { steps++; if (!c) bad++; console.log(T(), (c ? 'ok   ' : 'FAIL ') + what + (got !== undefined && got !== '' ? ' → ' + got : '')); return c; };
const errs = [];
// a Linux container runs as root and has no graphics card: Chromium's sandbox off, WebGL in software
const ARGS = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--server=' + SERVER, '--user-data=' + S + 'profile'];
async function open(tag) {
  const app = await _electron.launch({executablePath: EXE, args: ARGS, env: {...process.env, DISPLAY: display}, timeout: 60000});
  const page = await app.firstWindow();
  page.on('pageerror', e => errs.push(tag + ': ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|Failed to load resource/.test(m.text())) errs.push(tag + ' console: ' + m.text()); });
  await page.waitForFunction("!!window.MUAY && !!document.querySelector('#gBody h2')", null, {timeout: 90000});
  return {app, page};
}
const win = (app, js) => app.evaluate(new Function('{BrowserWindow}', 'const w = BrowserWindow.getAllWindows()[0]; return ' + js));

try {
  // ---- 1. first start
  let {app, page} = await open('first run');
  ok(page.url().startsWith('muay://game/'), 'the game is the app\'s own files, not the website', page.url());
  ok(await win(app, 'w.getTitle()') === 'Muay Manager', 'the window is called Muay Manager');
  ok(JSON.stringify(await win(app, '[w.getSize()[0], w.getSize()[1]]')) === '[1280,800]', 'it opens at 1280 × 800', await win(app, 'w.getSize().join(" × ")'));
  ok(await page.evaluate('window.MUAY_API') === SERVER + '/api' && await page.evaluate('!!window.MuayDesktop'), 'the shell tells the game where its server is', await page.evaluate('window.MUAY_API'));
  ok(await page.evaluate("!!(window.LAB && LAB.renderer) || !!document.querySelector('canvas')"), 'the 3D stage is drawn');
  const files = await page.evaluate("Promise.all(['/version.json', '/icon-192.png', '/nothing-here.txt', '/..%2Fmain.cjs'].map(u => fetch(u).then(r => r.status, () => 'error')))");
  ok(JSON.stringify(files) === '[200,200,404,404]', 'the game\'s files are served, and nothing outside them', files.join(' '));
  const music = await page.evaluate("(() => { const u = [...document.scripts].map(s => s.textContent).join(' ').match(/\\/a\\/[0-9a-f]{16}\\.mp3/); return u ? fetch(u[0]).then(r => r.status + ' ' + r.headers.get('content-type')) : 'no music in this build'; })()");
  ok(/^200 audio\//.test(music) || music === 'no music in this build', 'the music files play from inside the app', music);
  // a fighter, then online
  await page.evaluate(`document.getElementById('gName').value = ${JSON.stringify(NAME)}; document.querySelector('[data-act=create]').click()`);
  ok(await page.waitForFunction("!!document.querySelector('[data-act=tab]')", null, {timeout: 30000}).then(() => true, () => false), 'a fighter is made and the camp opens');
  let online = false;
  for (let i = 0; i < 60 && !online; i++) { const b = await (await fetch(SERVER + '/api/db/board?limit=100')).json(); online = (b.docs || []).some(d => d.data && d.data.name === NAME); if (!online) await page.waitForTimeout(1000); }
  ok(online, 'the fighter reaches the game server (ranking table)');
  // a link out opens in the computer's browser; the app keeps one window
  await app.evaluate(({shell}) => { globalThis.opened = []; shell.openExternal = url => { globalThis.opened.push(url); return Promise.resolve(); }; });
  await page.evaluate("(() => { const a = document.createElement('a'); a.href = 'https://muay.eggpact.com/privacy-en.html'; a.target = '_blank'; document.body.appendChild(a); a.click(); a.remove(); })()");
  await page.waitForTimeout(800);
  const opened = await app.evaluate(() => globalThis.opened);
  ok(opened.length === 1 && /privacy/.test(opened[0]) && (await app.windows()).length === 1, 'a link out goes to the browser, not a second window', opened.join(' '));
  await page.evaluate("location.href = 'https://example.com/'").catch(() => {}); await page.waitForTimeout(800);
  ok(page.url().startsWith('muay://game/'), 'the game page cannot be swapped for a website', page.url());
  // F11 and Alt+Enter, as keys from the keyboard (Playwright's own key presses skip the window's key handling)
  const key = async (code, mods) => { await app.evaluate(({BrowserWindow}, [c, m]) => { const wc = BrowserWindow.getAllWindows()[0].webContents; wc.sendInputEvent({type: 'keyDown', keyCode: c, modifiers: m}); wc.sendInputEvent({type: 'keyUp', keyCode: c, modifiers: m}); }, [code, mods || []]); await page.waitForTimeout(1200); return win(app, 'w.isFullScreen()'); };
  const f11 = [await key('F11'), await key('F11')], altEnter = [await key('Enter', ['alt']), await key('Enter', ['alt'])];
  ok(f11.join() === 'true,false' && altEnter.join() === 'true,false', 'F11 and Alt+Enter go full screen and back', 'F11 ' + f11 + ' · Alt+Enter ' + altEnter);
  await win(app, 'w.setSize(1100, 700)'); await page.waitForTimeout(500);
  ok(errs.length === 0, 'no script errors', errs.slice(0, 3).join(' | '));
  await app.close();

  // ---- 2. the second start: same save, same window
  ({app, page} = await open('second run'));
  ok(await page.evaluate("!!document.querySelector('[data-act=tab]') && (GAME.save() || {}).name") === NAME, 'the save is still there after closing the app', await page.evaluate('(GAME.save() || {}).name'));
  ok(await win(app, 'w.getSize().join("x")') === '1100x700', 'the window comes back at the size it was left', await win(app, 'w.getSize().join("x")'));
  // ---- 3. a second copy started while one is open only brings the first forward
  const second = spawn(EXE, ARGS, {env: {...process.env, DISPLAY: display}, stdio: 'ignore'});
  const quit = await new Promise(r => { const t = setTimeout(() => { second.kill(); r(false); }, 15000); second.on('exit', () => { clearTimeout(t); r(true); }); });
  ok(quit && (await app.windows()).length === 1, 'starting it again does not open a second game');
  ok(errs.length === 0, 'no script errors on the second run', errs.slice(0, 3).join(' | '));
  await page.screenshot({path: S + 'desktop.png'}).catch(() => {});
  await app.close();
} catch (e) { ok(false, 'the run stopped: ' + e.message.split('\n')[0]); }
finally { for (const k of kids) k.kill(); }
console.log(bad ? `${bad} of ${steps} checks FAILED` : `all ${steps} checks passed`);
process.exit(bad ? 1 : 0);
