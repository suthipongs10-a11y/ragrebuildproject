// A player's account on the game's own website, with two browsers:
//   1. the fighter moves to another device with a code (a wrong code is refused; the right one brings name and progress)
//   2. the old device says he has moved, writes nothing more, and can start a fighter of its own
//   3. "delete account" removes the player and everything stored for him
//   4. "start over" removes the stored fighter too (a reload does not bring him back)
// usage: node tools/e2e/account.mjs     (needs the site: SITE=http://127.0.0.1:8788/ by default — wrangler pages dev, or server/server.mjs)
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const ROOT = new URL('../../', import.meta.url).pathname, S = ROOT + 'dist/e2e/', THREE = ROOT + 'node_modules/three/build/three.min.js'; mkdirSync(S, {recursive: true});
const URL0 = process.env.SITE || 'http://127.0.0.1:8788/', NAME = process.env.NAMES || 'ทดสอบย้ายเครื่อง';
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const browsers = [], errs = [];
async function device(tag) {
  const browser = await chromium.launch({args: ARGS}); browsers.push(browser);
  const page = await (await browser.newContext({viewport: {width: 390, height: 780}})).newPage();
  // 403 answers are part of this test: the old device finds out that its key is dead
  page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|fonts|403|Failed to load resource/.test(m.text())) errs.push(tag + ': ' + m.text()); });
  page.on('pageerror', e => errs.push(tag + ' PAGEERROR: ' + e.message));
  await page.route('**/three.min.js', r => r.fulfill({path: THREE, contentType: 'application/javascript'}));
  await page.route('**/fonts.googleapis.com/**', r => r.abort());
  await page.goto(URL0 + (process.env.UI_LANG ? '?lang=' + process.env.UI_LANG : ''), {timeout: 120000}).catch(() => {}); await page.waitForFunction("!!window.MUAY && !!document.getElementById('gName')", null, {timeout: 60000});
  return page;
}
const ev = (p, js) => p.evaluate(js);
const until = (p, js, ms) => p.waitForFunction(js, null, {timeout: ms || 30000, polling: 200}).then(() => true, () => false);
const click = async (p, sel, pause) => { const done = await ev(p, `(() => { const b = document.querySelector(${JSON.stringify(sel)}); if (!b || b.disabled) return false; b.click(); return true; })()`); await p.waitForTimeout(pause == null ? 500 : pause); return done; };
// a picture for the record; the 3D canvas can be slow to capture on a busy machine, and that is not a failure of the game
const shot = (p, name, sel) => (sel ? p.locator(sel) : p).screenshot({path: S + name + '.png', timeout: 20000}).catch(() => console.log('  (no screenshot: ' + name + ')'));
const t0 = Date.now(), T = () => ((Date.now() - t0) / 1000).toFixed(0).padStart(3) + 's';
let bad = 0, steps = 0;
const ok = (c, what, got) => { steps++; if (!c) bad++; console.log(T(), (c ? 'ok   ' : 'FAIL ') + what + (got !== undefined && got !== '' ? ' → ' + got : '')); return c; };
const me = p => ev(p, "JSON.parse(localStorage.getItem('muaySitePlayer') || 'null')");
const api = async (path, key, method) => { const r = await fetch(new URL('api/' + path, URL0), {method: method || 'GET', headers: key ? {Authorization: 'Bearer ' + key.id + '.' + key.secret} : {}}); return {status: r.status, body: await r.json().catch(() => null)}; };
const board = async () => ((await api('db/board?limit=1000')).body.docs || []).filter(d => d.data && d.data.name === NAME);
const made = []; // every key this test was given, to clean up after itself

try {
  // ---- 1. the old device: a fighter with some progress, then a code
  const A = await device('A');
  await until(A, "!!document.getElementById('gCode')", 20000); ok(await ev(A, "!!document.getElementById('gCode')"), 'the creation screen offers "I already have a fighter on another device"');
  await ev(A, `document.getElementById('gName').value = ${JSON.stringify(NAME)}`); await click(A, '[data-act=create]', 2500);
  await until(A, "!!GAME.save() && !!document.querySelector('[data-act=tab][data-v=fight]')", 30000);
  const keyA = await me(A); made.push(keyA);
  await click(A, '[data-act=tab][data-v=train]', 600); await click(A, '[data-act=train][data-v=run]', 800); // a day's work, so there is progress to carry over
  await ev(A, "(() => { const b = document.querySelector('#gBody [data-act=scenego], #gBody [data-act=sceneskip], #gBody [data-act=drillskip]'); if (b) b.click(); })()"); await A.waitForTimeout(1500);
  await click(A, '[data-act=tab][data-v=home]', 600); await click(A, '[data-act=sleep]', 1200);
  const before = await ev(A, "(S => ({name: S.name, day: S.day, money: S.money, total: Object.values(S.stats).reduce((a, b) => a + b, 0).toFixed(2), look: JSON.stringify(S.look)}))(GAME.save())");
  ok(before.day >= 2, 'the fighter has a day behind him', JSON.stringify(before).slice(0, 120));
  ok(await until(A, "true", 100) && await (async () => { for (let i = 0; i < 40; i++) { const r = await api('db/data/users/' + keyA.id + '/save', keyA); if (r.body && r.body.data && r.body.data.day === before.day) return true; await A.waitForTimeout(500); } return false; })(), 'his progress is on the server');
  ok((await board()).length === 1, 'he is on the leaderboard once');
  await click(A, '[data-act=tab][data-v=home]', 400); await click(A, '[data-act=settings]', 700);
  ok(await ev(A, "!!document.querySelector('[data-act=xfer]') && !!document.querySelector('[data-act=delacct]') && document.querySelectorAll('#gBody a.link').length === 2"), 'settings: move to another device, delete account, the two policy links');
  // a note to the developer from the settings screen
  await click(A, '[data-act=feedback]', 300); ok(await ev(A, "/เขียนสักหน่อย/.test(document.getElementById('gFbNote').textContent)"), 'an empty note is not sent');
  await ev(A, "document.getElementById('gFb').value = 'ทดสอบระบบแจ้งปัญหา e2e'"); await click(A, '[data-act=feedback]', 0);
  ok(await until(A, "/ส่งแล้ว/.test(document.getElementById('gFbNote').textContent) && document.getElementById('gFb').value === ''", 15000), 'a note to the developer is sent and the box cleared');
  await shot(A, 'account-settings', '#gBody');
  await click(A, '[data-act=xfer]', 0); ok(await until(A, "!!document.querySelector('.xcode')", 15000), 'the old device shows a code');
  const code = await ev(A, "document.querySelector('.xcode').textContent.trim()"); ok(/^[A-Z2-9]{8}$/.test(code), 'eight letters and digits', code);
  await shot(A, 'account-code');

  // ---- 2. the new device: a wrong code, then the right one
  const B = await device('B'); await until(B, "!!document.getElementById('gCode')", 20000);
  const keyB0 = await me(B); made.push(keyB0);
  await ev(B, "document.getElementById('gCode').value = 'ZZZZ9999'"); await click(B, '[data-act=claim]', 0);
  ok(await until(B, "/ไม่ถูกต้อง/.test((document.getElementById('gClaimMsg') || {}).textContent || '')", 15000), 'a wrong code is refused with a clear note', await ev(B, "document.getElementById('gClaimMsg').textContent"));
  await shot(B, 'account-claim');
  await ev(B, `document.getElementById('gCode').value = ${JSON.stringify(code.toLowerCase())}`); await click(B, '[data-act=claim]', 0); // typed in small letters: still good
  ok(await until(B, "!!window.GAME && !!GAME.save() && !!document.querySelector('[data-act=tab][data-v=fight]')", 60000), 'the right code brings the fighter to the new device');
  const after = await ev(B, "(S => ({name: S.name, day: S.day, money: S.money, total: Object.values(S.stats).reduce((a, b) => a + b, 0).toFixed(2), look: JSON.stringify(S.look)}))(GAME.save())");
  ok(JSON.stringify(after) === JSON.stringify(before), 'same name, day, money, stats and looks', JSON.stringify(after).slice(0, 120));
  const keyB = await me(B); made.push(keyB);
  ok(keyB.id === keyA.id && keyB.secret !== keyA.secret, 'the same player, with a new key');
  ok((await api('db/data/users/' + keyA.id + '/save', keyA)).status === 403, 'the old device\'s key no longer opens his save');
  ok((await api('transfer/claim', null, 'POST')).status === 404, 'a claim with no code is refused');

  // ---- 3. the old device finds out, stops writing, starts a fighter of its own
  await click(A, '[data-act=setback]', 400); await click(A, '[data-act=tab][data-v=home]', 400); await click(A, '[data-act=sleep]', 600); // an action that saves
  ok(await until(A, "/ย้ายไปเล่นเครื่องอื่นแล้ว/.test(document.getElementById('gBody').innerText)", 20000), 'the old device says the fighter has moved');
  await shot(A, 'account-moved');
  ok(await ev(A, "!!document.getElementById('gCode') && !!document.querySelector('[data-act=fresh]') && !document.querySelector('[data-act=tab]')"), 'it offers: bring him back with a code, or start a new fighter');
  await A.reload({timeout: 120000}).catch(() => {}); await until(A, "!!window.MUAY && !!document.getElementById('gBody').innerText", 60000);
  ok(await until(A, "/ย้ายไปเล่นเครื่องอื่นแล้ว/.test(document.getElementById('gBody').innerText)", 20000), 'and still says so after a reload');
  const dayOnServer = (await api('db/data/users/' + keyB.id + '/save', keyB)).body.data.day;
  ok(dayOnServer === before.day && (await board()).length === 1, 'nothing the old device did afterwards reached the server', 'day ' + dayOnServer);
  await click(A, '[data-act=fresh]', 0); ok(await until(A, "!!document.getElementById('gName')", 60000), 'a fresh start on the old device opens the creation screen');
  await until(A, "!!localStorage.getItem('muaySitePlayer')", 15000); const keyA2 = await me(A); made.push(keyA2); ok(keyA2 && keyA2.id !== keyA.id, 'as a new player');

  // ---- 4. delete account on the new device
  ok(await (async () => { for (let i = 0; i < 20; i++) { if (((await api('news')).body.items || []).some(x => x.pid === keyB.id)) return true; await B.waitForTimeout(500); } return false; })(), 'the news list has a line about his fighter');
  { const r = await fetch(new URL('api/chat', URL0), {method: 'POST', headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + keyB.id + '.' + keyB.secret}, body: JSON.stringify({text: 'ข้อความก่อนลบบัญชี'})});
    ok(r.status === 200 && (((await api('chat?after=0')).body.chat || {}).items || []).some(x => x.pid === keyB.id), 'and the world chat has a line of his'); }
  await click(B, '[data-act=tab][data-v=home]', 400); await click(B, '[data-act=settings]', 700);
  await click(B, '[data-act=delacct]', 600); ok(await ev(B, "/ยืนยัน/.test(document.querySelector('[data-act=delacct]').textContent) && !!GAME.save()"), 'delete account asks a second time');
  await shot(B, 'account-delete');
  await click(B, '[data-act=delacct]', 0); ok(await until(B, "!!document.getElementById('gName') && !GAME.save()", 60000), 'after the second press: back at the creation screen');
  ok((await board()).length === 0, 'he is off the leaderboard');
  ok(!((await api('news')).body.items || []).some(x => x.pid === keyB.id), 'and off the news list');
  ok(!(((await api('chat?after=0')).body.chat || {}).items || []).some(x => x.pid === keyB.id), 'and his chat lines are gone');
  ok((await api('db/data/users/' + keyB.id + '/save', keyB)).status === 403 && (await api('db/board/' + keyB.id)).body.data === null && (await api('db/challenges/' + keyB.id)).body.data === null, 'his key, save and records are gone from the server');
  await until(B, "!!localStorage.getItem('muaySitePlayer')", 15000); const keyB2 = await me(B); made.push(keyB2); ok(keyB2 && keyB2.id !== keyB.id, 'the device is a new player now');

  // ---- 5. start over: the stored fighter goes too
  await ev(B, `document.getElementById('gName').value = ${JSON.stringify(NAME)}`); await click(B, '[data-act=create]', 2500);
  await until(B, "!!GAME.save() && !!document.querySelector('[data-act=tab][data-v=fight]')", 30000);
  ok(await (async () => { for (let i = 0; i < 40; i++) { if ((await board()).length === 1) return true; await B.waitForTimeout(500); } return false; })(), 'a new fighter is made and listed');
  await click(B, '[data-act=tab][data-v=home]', 400); await click(B, '[data-act=reset]', 400); await click(B, '[data-act=reset]', 1500);
  ok(await ev(B, "!!document.getElementById('gName') && !GAME.save()"), 'start over: the creation screen');
  ok(await (async () => { for (let i = 0; i < 30; i++) { if ((await board()).length === 0 && (await api('db/data/users/' + keyB2.id + '/save', keyB2)).body.data === null) return true; await B.waitForTimeout(500); } return false; })(), 'his line and his stored save are removed');
  await B.reload({timeout: 120000}).catch(() => {}); await until(B, "!!window.MUAY && !!document.getElementById('gName')", 60000); await B.waitForTimeout(3000);
  ok(await ev(B, "!!document.getElementById('gName') && !GAME.save()"), 'a reload does not bring the old fighter back');
  ok(!errs.length, 'no script errors', [...new Set(errs)].slice(0, 5).join(' | '));
} catch (e) { bad++; console.log('FAILED: ' + String(e && e.stack || e).split('\n').slice(0, 3).join(' ')); }
if (process.env.UI_LANG) { // the run in another language: the Thai each screen still showed (tools/e2e/lang.mjs explains)
  const all = new Map(); for (const b of browsers) for (const c of b.contexts()) for (const pg of c.pages()) { const m = await pg.evaluate('JSON.stringify(window.__i18n ? [...window.__i18n.miss.entries()] : [])').catch(() => '[]'); for (const [t, n] of JSON.parse(m)) all.set(t, (all.get(t) || 0) + n); }
  (await import('node:fs')).writeFileSync(new URL('../../dist/e2e/lang-miss-account-' + process.env.UI_LANG + '.json', import.meta.url), JSON.stringify([...all.keys()], null, 1)); console.log(process.env.UI_LANG + ': ' + all.size + ' texts on screen without a line');
}
for (const b of browsers) await b.close();
// leave nothing behind (matters on the real site): every player this test made is removed with his own key
for (const k of made) if (k && k.id) await api('me', k, 'DELETE');
console.log('left on the leaderboard under the test name: ' + (await board()).length);
console.log(bad ? bad + ' of ' + steps + ' checks FAILED' : 'all ' + steps + ' checks passed');
process.exit(bad ? 1 : 0);
