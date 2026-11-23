// The itch.io page (tools/itch-pack.mjs) the way itch.io shows it: an outer page on one site holds our page in a frame
// (itch.io → html-classic.itch.zone), and our page holds the game from a third (the website). Checks that the game
// comes up, signs on to the server, makes a fighter that reaches the ranking, goes full screen from two frames deep,
// and throws no error.
// usage: node tools/itch-pack.mjs --url http://127.0.0.1:8788/ && node tools/e2e/itch.mjs   (server/server.mjs on 8788, a throw-away database)
import { createRequire } from 'node:module';
import http from 'node:http';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const ROOT = new URL('../../', import.meta.url).pathname, API = 'http://127.0.0.1:8788/api';
let bad = 0, n = 0;
const ok = (c, what, got) => { n++; if (!c) bad++; console.log((c ? 'ok   ' : 'FAIL ') + what + (got !== undefined && got !== '' ? ' → ' + got : '')); return c; };
// itch.io's side: the page with the game in a 540×960 frame, as the project's embed options set it
const OUTER = '<!doctype html><meta charset="utf-8"><body style="margin:0;background:#222"><iframe id="g" src="http://127.0.0.1:8790/index.html" width="540" height="960" allow="autoplay; fullscreen *; geolocation; microphone; camera; midi; monetization; xr-spatial-tracking; gamepad; gyroscope; accelerometer; xr; cross-origin-isolated; web-share" allowfullscreen frameborder="0" scrolling="no"></iframe>';
const srv = http.createServer((q, r) => { if (q.url.startsWith('/outer')) { r.writeHead(200, {'Content-Type': 'text/html'}); r.end(OUTER); } else { r.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'}); r.end(readFileSync(ROOT + 'dist/itch/index.html')); } });
await new Promise(res => srv.listen(8790, res));
const browser = await chromium.launch({args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']});
const page = await (await browser.newContext({viewport: {width: 600, height: 1000}})).newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|favicon/.test(m.text())) errs.push('console: ' + m.text().slice(0, 160)); });
await page.goto('http://localhost:8790/outer.html');
let game = null;
for (let i = 0; i < 120 && !game; i++) { game = page.frames().find(f => f.url().startsWith('http://127.0.0.1:8788/')); if (!game) await page.waitForTimeout(500); }
ok(!!game, 'the game loads two frames deep (itch.io → our page → the website)', game && game.url());
if (game) {
  await game.waitForFunction("!!window.MUAY && !!document.getElementById('gName')", null, {timeout: 120000});
  ok(true, 'the game comes up inside the frames');
  ok(await game.evaluate("new URLSearchParams(location.search).get('from')") === 'itch', 'it knows it came from itch.io (?from=itch)');
  await game.evaluate("document.getElementById('gName').value = 'ไอทช์ทดสอบ'; document.querySelector('[data-act=create]').click()");
  await game.waitForFunction('!!(window.GAME && GAME.save() && GAME.uid())', null, {timeout: 60000}).catch(() => {});
  const uid = await game.evaluate('GAME.uid && GAME.uid()');
  ok(!!uid, 'it signs on to the server from inside the frames', uid);
  let line = null; for (let i = 0; i < 40 && !(line && line.data); i++) { line = await (await fetch(API + '/db/board/' + uid)).json().catch(() => null); if (!(line && line.data)) await page.waitForTimeout(500); }
  ok(!!(line && line.data && line.data.name === 'ไอทช์ทดสอบ'), 'the new fighter reaches the ranking on the server', line && line.data && line.data.name);
  const wide = await game.evaluate('document.documentElement.scrollWidth - innerWidth');
  ok(wide <= 1, 'nothing runs off the side in a 540-wide frame', wide);
  await game.evaluate("document.getElementById('btnFull').click()"); await page.waitForTimeout(1500);
  const full = await game.evaluate("({cls: document.getElementById('arena').classList.contains('full'), fs: !!document.fullscreenElement})");
  ok(full.cls && full.fs, 'full screen works from two frames deep', JSON.stringify(full));
  await game.evaluate("document.getElementById('btnFull').click()").catch(() => {});
}
ok(errs.length === 0, 'no script errors', errs.slice(0, 3).join(' | '));
await browser.close(); srv.close();
console.log(bad ? `${bad} of ${n} checks FAILED` : `all ${n} checks passed`);
process.exit(bad ? 1 : 0);
