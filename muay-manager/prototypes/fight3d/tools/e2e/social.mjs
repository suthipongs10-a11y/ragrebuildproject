// What players do to one another, with two browsers on the site (SITE, default http://127.0.0.1:8788/):
//   1. A fights a ranked fight against B’s fighter (run by the game) -> B is told on his camp screen and at the top of
//      the screen, with a button that challenges A back; the line survives A’s later challenges
// usage: node tools/e2e/social.mjs      (needs the site: PORT=8788 npm run serve, or npm run site)
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const ROOT = new URL('../../', import.meta.url).pathname, S = ROOT + 'dist/e2e/', THREE = ROOT + 'node_modules/three/build/three.min.js'; mkdirSync(S, {recursive: true});
const URL0 = process.env.SITE || 'http://127.0.0.1:8788/', NAMES = (process.env.NAMES || 'ทดสอบสังคมเอ,ทดสอบสังคมบี,ทดสอบสังคมซี').split(',');
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'];
const browsers = [], errs = [];
async function player(tag) {
  const browser = await chromium.launch({args: ARGS}); browsers.push(browser);
  const page = await (await browser.newContext({viewport: {width: 390, height: 780}})).newPage();
  page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|fonts|Failed to load resource/.test(m.text())) errs.push(tag + ': ' + m.text()); });
  page.on('pageerror', e => errs.push(tag + ' PAGEERROR: ' + e.message));
  await page.route('**/three.min.js', r => r.fulfill({path: THREE, contentType: 'application/javascript'}));
  await page.route('**/fonts.googleapis.com/**', r => r.abort());
  await page.goto(URL0, {timeout: 120000}).catch(() => {}); await page.waitForFunction("!!window.MUAY && !!document.getElementById('gName')", null, {timeout: 90000});
  return page;
}
const ev = (p, js) => p.evaluate(js);
const until = (p, js, ms) => p.waitForFunction(js, null, {timeout: ms || 30000, polling: 200}).then(() => true, () => false);
const click = async (p, sel, pause) => { const done = await ev(p, `(() => { const b = document.querySelector(${JSON.stringify(sel)}); if (!b || b.disabled) return false; b.click(); return true; })()`); await p.waitForTimeout(pause == null ? 500 : pause); return done; };
const t0 = Date.now(), T = () => ((Date.now() - t0) / 1000).toFixed(0).padStart(3) + 's';
let bad = 0, steps = 0;
const ok = (c, what, got) => { steps++; if (!c) bad++; console.log(T(), (c ? 'ok   ' : 'FAIL ') + what + (got !== undefined && got !== '' ? ' → ' + got : '')); return c; };
const me = p => ev(p, "JSON.parse(localStorage.getItem('muaySitePlayer') || 'null')");
const api = async (path, key, method) => { const r = await fetch(new URL('api/' + path, URL0), {method: method || 'GET', headers: key ? {Authorization: 'Bearer ' + key.id + '.' + key.secret} : {}}); return {status: r.status, body: await r.json().catch(() => null)}; };
const made = [];
try {
  const A = await player('A'), B = await player('B');
  for (const [p, n] of [[A, NAMES[0]], [B, NAMES[1]]]) { await ev(p, `document.getElementById('gName').value = ${JSON.stringify(n)}`); await click(p, '[data-act=create]', 2500); await until(p, "!!GAME.save() && !!document.querySelector('[data-act=tab][data-v=fight]')", 30000); made.push(await me(p)); }
  await A.waitForTimeout(5000); await A.reload({timeout: 120000}).catch(() => {}); await until(A, "!!window.GAME && !!GAME.save() && !!document.querySelector('[data-act=tab][data-v=fight]')", 90000); await A.waitForTimeout(3000);

  // ---- 1. a ranked fight against another player’s fighter, and the news of it
  let found = false; // the ranked draw moves with the number of ranked fights left: turn it until B’s fighter comes up
  for (let k = 2; k < 80 && !found; k++) { await ev(A, `GAME.save().ranked = ${k}; GAME.save().fatigue = 0`); await click(A, '[data-act=tab][data-v=fight]', 250); found = await ev(A, `(() => { const b = document.querySelector('[data-act=pick][data-v=r]'), c = b && b.closest('.opp'); return !!c && c.innerText.includes(${JSON.stringify(NAMES[1])}); })()`); }
  ok(found, 'the ranked draw can come up with another player’s fighter');
  await click(A, '[data-act=pick][data-v=r]', 800); ok(await ev(A, `document.getElementById('gBody').innerText.includes(${JSON.stringify(NAMES[1])})`), 'A is about to fight B’s fighter');
  await click(A, '[data-act=startfight]', 0); await until(A, "!!(window.LAB && LAB.fight && document.querySelector('.app.g-fight') && LAB.t > .2)", 60000);
  ok(await ev(A, `LAB.cfg.specs[1].name === ${JSON.stringify(NAMES[1])}`), 'the opponent in the ring carries B’s name');
  await click(A, '[data-act=skip]', 0); await until(A, "!!document.querySelector('#gBody [data-act=home]')", 120000);
  const resA = await ev(A, "(r => r.draw ? 'd' : r.win ? 'w' : 'l')(GAME.fight().res)"), want = {w: 'ชนะนักมวยของคุณ', l: 'แพ้นักมวยของคุณ', d: 'เสมอกับนักมวยของคุณ'}[resA];
  await click(A, '#gBody [data-act=home]', 1500);
  const docA = async () => (await api('db/challenges/' + made[0].id)).body.data || {};
  ok(await (async () => { for (let i = 0; i < 30; i++) { const d = await docA(); if (Array.isArray(d.vs) && d.vs.length === 1 && d.vs[0].to === made[1].id && d.vs[0].r === resA) return true; await A.waitForTimeout(400); } return false; })(), 'A’s record says whom he fought and how it went', resA);
  ok(await until(B, `[...document.querySelectorAll('#gMatch .matchbar')].some(b => b.innerText.includes(${JSON.stringify(NAMES[0])}) && b.innerText.includes('ศึกจัดอันดับ'))`, 30000), 'B is told at the top of the screen', await ev(B, "[...document.querySelectorAll('#gMatch .matchbar')].map(b => b.innerText.replace(/\\s+/g, ' ')).join(' | ')"));
  await click(B, '[data-act=tab][data-v=home]', 800);
  await until(B, "!!document.querySelector('.vsrow [data-act=chsend][data-w=now]')", 20000); // the ranking is read again when the news comes: A shows as online
  const card = await ev(B, "(() => { const c = [...document.querySelectorAll('#gBody .gcard')].find(x => x.innerText.includes('ข่าวจากเวที')); return c ? c.innerText.replace(/\\s+/g, ' ') : ''; })()");
  ok(card.includes(NAMES[0]) && card.includes(want), 'B’s camp screen has the news: who came and how it went', card.slice(0, 110));
  await B.screenshot({path: S + 'social-news.png', timeout: 20000}).catch(() => {});
  const b4 = await ev(B, "JSON.stringify(GAME.save().rec) + GAME.save().rp + GAME.save().money");
  ok(await ev(B, "!!document.querySelector('.vsrow [data-act=chsend]')") && /ท้า(แก้มือ|ชก)เดี๋ยวนี้/.test(card), 'with a button to challenge him back now (he is online)');
  await click(B, '.vsrow [data-act=chsend]', 0);
  ok(await until(A, "!!document.querySelector('#gMatch [data-act=chyes]')", 30000), 'A gets B’s challenge', await ev(A, "[...document.querySelectorAll('#gMatch .matchbar')].map(b => b.innerText.replace(/\\s+/g, ' ').slice(0, 80)).join(' | ')"));
  ok(await ev(B, "JSON.stringify(GAME.save().rec) + GAME.save().rp + GAME.save().money") === b4, 'B’s own record, ranking points and money did not move');
  await click(A, '#gMatch [data-act=chno]', 1500);
  // ---- 2. a live match between A and B, C watching: cheers show on every screen
  await click(A, '[data-act=tab][data-v=fight]', 1200);
  ok(await click(A, `[data-act=chsend][data-v="${made[1].id}"][data-w=now]`, 2500), 'A challenges B to fight now');
  { const d = await docA(); ok(Array.isArray(d.vs) && d.vs.length === 1 && d.list && !!d.list[made[1].id], 'the challenge keeps the line about the ranked fight in A’s record'); }
  ok(await until(B, "!!document.querySelector('#gMatch [data-act=chyes]')", 30000), 'B gets the challenge'); await click(B, '#gMatch [data-act=chyes]', 0);
  const nameC = NAMES[2] || 'ทดสอบสังคมซี';
  const C = await player('C'); await ev(C, `document.getElementById('gName').value = ${JSON.stringify(nameC)}`); await click(C, '[data-act=create]', 2500); await until(C, "!!GAME.save() && !!document.querySelector('[data-act=tab][data-v=fight]')", 30000); made.push(await me(C));
  const inRing = "!!(window.LAB && LAB.fight && document.querySelector('.app.g-fight') && GAME.fight() && GAME.fight().live && !GAME.fight().loading)";
  ok(await until(A, inRing, 90000) && await until(B, inRing, 30000), 'A and B are in the ring at the bell');
  ok(await until(C, "!!document.querySelector('#gMatch [data-act=chwatch]')", 40000), 'C is offered the live match'); await click(C, '#gMatch [data-act=chwatch]', 0);
  ok(await until(C, inRing, 60000) && await ev(C, 'GAME.fight().me') === -1, 'C watches it');
  ok(await until(C, "document.querySelectorAll('[data-act=cheer]').length === 4", 20000) && await until(A, "document.querySelectorAll('[data-act=cheer]').length === 4", 20000), 'the four cheers are offered to the watcher and to the two players');
  const cheerOf = name => `[...document.querySelectorAll('#gCheers .cheer')].some(e => e.textContent.includes(${JSON.stringify(name)}))`;
  await click(C, '[data-act=cheer][data-v=red]', 150);
  ok(await ev(C, cheerOf(nameC)) && await ev(C, "[...document.querySelectorAll('[data-act=cheer]')].every(b => b.disabled)"), 'C cheers the red corner: on his own screen at once, and the buttons rest a moment');
  const got = await Promise.all([until(A, cheerOf(nameC), 25000), until(B, cheerOf(nameC), 25000)]);
  ok(got[0] && got[1], 'A and B both see C’s cheer');
  await C.screenshot({path: S + 'social-cheer.png', timeout: 20000}).catch(() => {});
  await A.waitForTimeout(4500); await click(A, '[data-act=cheer][data-v=fire]', 150);
  ok(await until(C, cheerOf(NAMES[0]), 25000), 'the watcher sees a cheer from one of the two players');
  ok(await ev(A, "document.querySelectorAll('#gCheers .cheer').length <= 5"), 'old cheers leave the screen');
  ok(!errs.length, 'no script errors', [...new Set(errs)].slice(0, 5).join(' | '));
} catch (e) { bad++; console.log('FAILED: ' + String(e && e.stack || e).split('\n').slice(0, 3).join(' ')); }
for (const b of browsers) await b.close();
for (const k of made) if (k && k.id) await api('me', k, 'DELETE'); // leave nothing behind
console.log(bad ? bad + ' of ' + steps + ' checks FAILED' : 'all ' + steps + ' checks passed');
process.exit(bad ? 1 : 0);
