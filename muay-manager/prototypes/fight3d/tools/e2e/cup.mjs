// The players' cup from sign-up to prize, with three browsers and a server of its own on a schedule of a few minutes:
//   A and B enter, C does not -> the list closes -> all three screens hold the same bracket and the same results
//   -> at the bell the bouts can be watched live (C watches one, a cheer crosses to another watcher) -> the results
//   come up round by round -> the cup is over: A and B take their prizes, once; C sees who won.
// usage: node tools/e2e/cup.mjs      (starts server/server.mjs itself on port 8789; needs the build in dist/site)
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, openSync } from 'node:fs';
import { spawn } from 'node:child_process';
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const ROOT = new URL('../../', import.meta.url).pathname, S = ROOT + 'dist/e2e/', THREE = ROOT + 'node_modules/three/build/three.min.js'; mkdirSync(S, {recursive: true});
const PORT = 8789, URL0 = `http://127.0.0.1:${PORT}/`, DATA = ROOT + 'dist/e2e-cup-data';
const LEAD = 20e3, GAP = 40e3, OPEN = +(process.env.OPEN || 85) * 1e3; // the list closes OPEN - LEAD after the server starts; rounds GAP apart
rmSync(DATA, {recursive: true, force: true});
const T0 = Date.now(), START = T0 + OPEN;
const server = spawn('node', ['--disable-warning=ExperimentalWarning', 'server/server.mjs'], {cwd: ROOT, stdio: ['ignore', openSync(S + 'cup-server.log', 'w'), openSync(S + 'cup-server.log', 'a')], env: Object.assign({}, process.env, {PORT: String(PORT), MUAY_DB: DATA + '/muay.db', MUAY_CUP_EVERY: String(3600e3), MUAY_CUP_ANCHOR: String(START), MUAY_CUP_LEAD: String(LEAD), MUAY_CUP_GAP: String(GAP)})});
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'];
const browsers = [], errs = [], made = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));
for (let i = 0; i < 40; i++) { try { if ((await fetch(URL0 + 'api/health')).ok) break; } catch (e) { /* not up yet */ } await sleep(250); }
async function player(tag, name) {
  const browser = await chromium.launch({args: ARGS}); browsers.push(browser);
  const page = await (await browser.newContext({viewport: {width: 390, height: 780}})).newPage();
  page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|fonts|Failed to load resource/.test(m.text())) errs.push(tag + ': ' + m.text()); });
  page.on('pageerror', e => errs.push(tag + ' PAGEERROR: ' + e.message));
  await page.route('**/three.min.js', r => r.fulfill({path: THREE, contentType: 'application/javascript'}));
  await page.route('**/fonts.googleapis.com/**', r => r.abort());
  await page.goto(URL0 + (process.env.UI_LANG ? '?lang=' + process.env.UI_LANG : ''), {timeout: 120000}).catch(() => {}); await page.waitForFunction("!!window.MUAY && !!document.getElementById('gName')", null, {timeout: 90000});
  await page.evaluate(n => { document.getElementById('gName').value = n; document.querySelector('[data-act=create]').click(); }, name);
  await page.waitForFunction("!!window.GAME && !!GAME.save() && !!document.querySelector('[data-act=tab][data-v=fight]')", null, {timeout: 30000});
  await page.waitForFunction("!!localStorage.getItem('muaySitePlayer') && !!GAME.uid()", null, {timeout: 30000}); // the player is registered a moment after the page is up
  page.key = await page.evaluate("JSON.parse(localStorage.getItem('muaySitePlayer'))"); made.push(page.key);
  return page;
}
const ev = (p, js) => p.evaluate(js);
const until = (p, js, ms) => p.waitForFunction(js, null, {timeout: ms || 30000, polling: 200}).then(() => true, () => false);
const click = async (p, sel, pause) => { const done = await ev(p, `(() => { const b = document.querySelector(${JSON.stringify(sel)}); if (!b || b.disabled) return false; b.click(); return true; })()`); await p.waitForTimeout(pause == null ? 500 : pause); return done; };
const T = () => ((Date.now() - T0) / 1000).toFixed(0).padStart(3) + 's';
let bad = 0, steps = 0;
const ok = (c, what, got) => { steps++; if (!c) bad++; console.log(T(), (c ? 'ok   ' : 'FAIL ') + what + (got !== undefined && got !== '' ? ' → ' + got : '')); return c; };
const api = async (path, key, method, body) => { const r = await fetch(URL0 + 'api/' + path, {method: method || 'GET', headers: Object.assign(body ? {'Content-Type': 'application/json'} : {}, key ? {Authorization: 'Bearer ' + key.id + '.' + key.secret} : {}), body: body ? JSON.stringify(body) : undefined}); return {status: r.status, body: await r.json().catch(() => null)}; };
const at = async ms => { const w = START + ms - Date.now(); if (w > 0) await sleep(w); }; // wait until so long after the first bell
const card = p => ev(p, "(() => { const c = [...document.querySelectorAll('#gBody .gcard')].find(x => x.innerText.includes('ศึกชิงถ้วยผู้เล่น')); return c ? c.innerText.replace(/\\s+/g, ' ') : ''; })()");
const NAMES = ['ถ้วยทดสอบเอ', 'ถ้วยทดสอบบี', 'ถ้วยทดสอบซี'];
try {
  const [A, B, C] = await Promise.all(NAMES.map((n, i) => player('ABC'[i], n)));
  for (const p of [A, B, C]) { await click(p, '[data-act=tab][data-v=fight]', 300); await until(p, "!!document.querySelector('[data-act=cupin]')", 20000); }
  // ---- 1. signing up
  const c0 = await card(A); ok(/ปิดรับสมัครใน/.test(c0) && /ยังไม่มีใครลงชื่อ/.test(c0) && /ลงชื่อเข้าแข่ง/.test(c0), 'the fight menu has the cup: when it is, that nobody is in yet, a button to enter', c0.slice(0, 90));
  await click(A, '[data-act=cupin]', 0); ok(await until(A, "!!document.querySelector('.pent.me') && !!document.querySelector('[data-act=cupout]')", 15000), 'A enters: his name is on the list, and he can withdraw');
  await click(B, '[data-act=cupin]', 0); ok(await until(B, "document.querySelectorAll('.pent').length === 2 && !!document.querySelector('.pent.me')", 15000), 'B enters and sees both names');
  await click(B, '[data-act=cupout]', 0); ok(await until(B, "document.querySelectorAll('.pent').length === 1 && !document.querySelector('.pent.me')", 15000), 'B withdraws: off the list');
  await click(B, '[data-act=cupin]', 0); await until(B, "!!document.querySelector('.pent.me')", 15000);
  await A.locator('#gBody').screenshot({path: S + 'cup-open.png', timeout: 20000}).catch(() => {});
  const list = (await api('cup')).body; ok(list.next.entries.length === 2 && list.next.entries.every(e => e.data.spec && e.data.plan && e.data.name), 'the server holds two entries with fighter and plan', list.next.entries.map(e => e.data.name).join(', '));
  // ---- 2. the list closes: one bracket on every screen
  await at(-LEAD + 1500);
  { const late = await api('cup', C.key, 'POST', {name: 'มาช้า'}), out = await api('cup', A.key, 'DELETE'); ok(late.status === 409 && out.status === 409, 'after the list has closed the server takes no entry and no withdrawal', late.status + ' ' + out.status + ' ' + JSON.stringify(late.body)); }
  for (const p of [A, B, C]) await until(p, "GAME.cup() && !!GAME.cup().cup && GAME.cup().cup.held && !!document.querySelector('#gBody .bout')", 25000);
  const sig = p => ev(p, "(c => JSON.stringify([c.n, c.ents.map(e => e.name), c.res.map(r => r.map(x => [x.a, x.b, x.w, x.how, x.pts]))]))(GAME.cup().cup)");
  const [sa, sb, sc] = await Promise.all([sig(A), sig(B), sig(C)]);
  ok(sa === sb && sb === sc, 'A, B and C hold the same bracket and the same results', sa.slice(0, 120));
  const cupA = JSON.parse(sa); ok(cupA[0] === 8 && NAMES.slice(0, 2).every(n => cupA[1].includes(n)) && !cupA[1].includes(NAMES[2]) && cupA[2].length === 3, 'eight in the bracket: the two players and six of the game’s own fighters, three rounds');
  ok(await ev(A, "document.querySelectorAll('#gBody .bout').length === 7 && !document.querySelector('[data-act=cupwatch]') && !document.querySelector('.bout .won') && document.querySelectorAll('#gBody .bout .hint').length === 3"), 'before the bell: the first round’s pairs, no results, later rounds not shown, nothing to watch yet');
  // ---- 3. the bell: live bouts, and a cheer
  await at(1500); for (const p of [A, C]) await until(p, "document.querySelectorAll('[data-act=cupwatch]').length === 4", 20000);
  ok(await ev(A, "document.querySelectorAll('[data-act=cupwatch]').length === 4 && [...document.querySelectorAll('[data-act=cupwatch]')].every(b => b.textContent === 'ดูสด') && !document.querySelector('.bout .won')"), 'at the bell the four bouts of the round can be watched live, results still hidden');
  await click(B, '[data-act=tab][data-v=home]', 300);
  ok(await until(B, "[...document.querySelectorAll('#gMatch .matchbar')].some(b => b.innerText.includes('ศึกชิงถ้วยผู้เล่นกำลังชก') && !!b.querySelector('[data-act=tab][data-v=fight]'))", 15000), 'on the other screens of the game a bar at the top says the cup is on, with a button to it');
  await click(B, '#gMatch [data-act=tab][data-v=fight]', 600); ok(await ev(B, "document.querySelectorAll('[data-act=cupwatch]').length === 4"), 'the button opens the bracket');
  await A.locator('#gBody').screenshot({path: S + 'cup-live.png', timeout: 20000}).catch(() => {});
  const mine = await ev(A, "(c => { const i = c.ents.findIndex(e => e.id === GAME.uid()); const k = c.res[0].findIndex(x => x.a === i || x.b === i); return c.k + ':0:' + k; })(GAME.cup().cup)");
  await click(A, `[data-act=cupwatch][data-v="${mine}"]`, 0); await click(C, `[data-act=cupwatch][data-v="${mine}"]`, 0);
  const inRing = "!!(window.LAB && LAB.fight && document.querySelector('.app.g-fight') && GAME.fight() && GAME.fight().live && GAME.fight().live.cup && !GAME.fight().loading)";
  ok(await until(A, inRing, 60000) && await until(C, inRing, 60000), 'A and C are at the ringside of A’s bout');
  const seat = p => ev(p, "JSON.stringify({seed: LAB.cfg.seed, clock: !!GAME.fight().clock, me: GAME.fight().me, names: LAB.cfg.specs.map(s => s.name), noDraw: !!(LAB.cfg.rules && LAB.cfg.rules.noDraw), venue: MUAY.venueNow()})");
  const [fa, fc] = [await seat(A), await seat(C)]; ok(fa === fc && JSON.parse(fa).clock && JSON.parse(fa).me === -1 && JSON.parse(fa).noDraw && JSON.parse(fa).names.includes(NAMES[0]), 'the same bout by the same clock on both screens; the owner watches like anyone else', fa);
  await click(C, '[data-act=cheer][data-v=fire]', 150);
  ok(await until(A, `[...document.querySelectorAll('#gCheers .cheer')].some(e => e.textContent.includes(${JSON.stringify(NAMES[2])}))`, 25000), 'a cheer from C shows on A’s screen');
  // ---- 4. the results come up round by round (B stays on the fight menu)
  await at(GAP + 2500); ok(await until(B, "document.querySelectorAll('#gBody .bout .won').length === 4 && [...document.querySelectorAll('[data-act=cupwatch]')].filter(b => b.textContent === 'ดูสด').length === 2", 20000), 'after the first round: four results, and the two semi-finals live', await ev(B, "[...document.querySelectorAll('[data-act=cupwatch]')].map(b => b.textContent).join(',')"));
  await at(3 * GAP + 3000);
  // ---- 5. the final is over: prizes at once
  for (const [p, n] of [[A, 'A'], [C, 'C']]) { const left = await click(p, '#gBody [data-act=home]', 1500) && await ev(p, '!GAME.fight()'); if (n === 'A') ok(left, 'a watcher can leave a live bout'); await click(p, '[data-act=tab][data-v=fight]', 300); } // out of the bout they were watching, by the button a watcher has
  for (const p of [A, B, C]) await until(p, "document.getElementById('gBody').innerText.includes('แชมป์: ')", 30000);
  const champ = cupA[1][cupA[2][2][0][2]];
  ok(await ev(C, `document.getElementById('gBody').innerText.includes('แชมป์: ' + ${JSON.stringify(champ)})`) && !await ev(C, "!!document.querySelector('[data-act=cupclaim]')"), 'the final is over: C, who did not enter, sees the champion and has nothing to claim', champ);
  for (const [p, n] of [[A, 'A'], [B, 'B']]) {
    await until(p, "!!document.querySelector('[data-act=cupclaim]')", 20000);
    const m0 = await ev(p, 'GAME.save().money'), txt = await ev(p, "(document.querySelector('[data-act=cupclaim]') || {}).textContent || ''"), want = +((txt.replace(/,/g, '').match(/฿ (\d+)/) || [0, -1])[1]);
    await click(p, '[data-act=cupclaim]', 800);
    ok(await ev(p, 'GAME.save().money') - m0 === want && !await ev(p, "!!document.querySelector('[data-act=cupclaim]')") && await ev(p, "document.getElementById('gBody').innerText.includes('รับรางวัลแล้ว')"), n + ' takes his prize as soon as the final is over, once', txt);
  }
  if (NAMES.slice(0, 2).includes(champ)) { const P = champ === NAMES[0] ? A : B; ok(await ev(P, "GAME.save().honors.some(h => h.k === 'pcup')"), 'the champion’s cup is in his trophy room'); }
  await B.locator('#gBody').screenshot({path: S + 'cup-over.png', timeout: 20000}).catch(() => {});
  // ---- 6. the server hands the cup over as "the last one": the next is open, the last keeps its results and stays claimed
  ok(await until(B, "!!document.querySelector('[data-act=cupin]') && document.getElementById('gBody').innerText.includes('ผลศึกชิงถ้วยผู้เล่น')", 90000), 'a little later the next cup is open for entries, and the last one is shown under it');
  ok(await ev(B, `document.getElementById('gBody').innerText.includes('แชมป์: ' + ${JSON.stringify(champ)})`) && !await ev(B, "!!document.querySelector('[data-act=cupclaim]')") && await ev(B, "document.getElementById('gBody').innerText.includes('รับรางวัลแล้ว')"), 'the last cup still shows its champion, and B’s prize as taken');
  await click(B, 'details.pbr summary', 400); ok(await ev(B, "[...document.querySelectorAll('details.pbr [data-act=cupwatch]')].length === 7 && [...document.querySelectorAll('details.pbr [data-act=cupwatch]')].every(b => b.textContent === 'ดูย้อนหลัง')"), 'every bout of the finished cup can be watched again');
  ok(!errs.length, 'no script errors', [...new Set(errs)].slice(0, 5).join(' | '));
} catch (e) { bad++; console.log('FAILED: ' + String(e && e.stack || e).split('\n').slice(0, 3).join(' ')); }
if (process.env.UI_LANG) { // the run in another language: the Thai each screen still showed (tools/e2e/lang.mjs explains)
  const all = new Map(); for (const b of browsers) for (const c of b.contexts()) for (const pg of c.pages()) { const m = await pg.evaluate('JSON.stringify(window.__i18n ? [...window.__i18n.miss.entries()] : [])').catch(() => '[]'); for (const [t, n] of JSON.parse(m)) all.set(t, (all.get(t) || 0) + n); }
  (await import('node:fs')).writeFileSync(new URL('../../dist/e2e/lang-miss-cup-' + process.env.UI_LANG + '.json', import.meta.url), JSON.stringify([...all.keys()], null, 1)); console.log(process.env.UI_LANG + ': ' + all.size + ' texts on screen without a line');
}
for (const b of browsers) await b.close();
server.kill();
console.log(bad ? bad + ' of ' + steps + ' checks FAILED' : 'all ' + steps + ' checks passed');
process.exit(bad ? 1 : 0);
