// Two players on the local site: an agreed match that one side withdraws from, then a "fight now" challenge to an
// online player: the incoming banner, accept, the 30 second countdown, the last ten seconds full screen, both in the ring.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url); const { chromium } = require('playwright'); // the cloud session has it on NODE_PATH
const ROOT = new URL('../../', import.meta.url).pathname, S = ROOT + 'dist/e2e/', THREE = ROOT + 'node_modules/three/build/three.min.js'; mkdirSync(S, {recursive: true}); // screenshots go to dist/e2e (not committed)
import { execFileSync } from 'node:child_process';
const URL0 = process.env.SITE || 'http://127.0.0.1:8788/';
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'];
const browsers = [], errs = [], NAMES = (process.env.NAMES || 'ทดสอบเอ,ทดสอบบี').split(',');
async function player(tag, vp) {
  const browser = await chromium.launch({args: ARGS}); browsers.push(browser);
  const page = await (await browser.newContext({viewport: vp})).newPage();
  page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|fonts/.test(m.text())) errs.push(tag + ': ' + m.text()); });
  page.on('pageerror', e => errs.push(tag + ' PAGEERROR: ' + e.message));
  await page.route('**/three.min.js', r => r.fulfill({path: THREE, contentType: 'application/javascript'}));
  await page.route('**/fonts.googleapis.com/**', r => r.abort());
  await page.goto(URL0); await page.waitForFunction("!!window.MUAY && !!document.getElementById('gName')", null, {timeout: 60000});
  return page;
}
const ev = (p, js) => p.evaluate(js);
const until = async (p, js, ms, what) => { try { await p.waitForFunction(js, null, {timeout: ms, polling: 200}); return true; } catch (e) { console.log('  TIMEOUT waiting for: ' + what); return false; } };
const t0 = Date.now(), T = () => ((Date.now() - t0) / 1000).toFixed(0).padStart(3) + 's';
const bars = "[...document.querySelectorAll('#gMatch .matchbar')].map(b => b.className.replace('matchbar', '').trim() + ': ' + b.innerText.replace(/\\s+/g, ' ').slice(0, 150))";
const A = await player('A', {width: 390, height: 760}), B = await player('B', {width: 760, height: 620});
await ev(A, `document.getElementById('gName').value='${NAMES[0]}';document.querySelector('[data-act=create]').click()`);
await ev(B, `document.getElementById('gName').value='${NAMES[1]}';document.querySelector('[data-act=create]').click()`);
try {
  await A.waitForTimeout(5000); await A.reload(); await B.reload();
  for (const p of [A, B]) await until(p, "!!window.MUAY && !!document.querySelector('[data-act=tab][data-v=fight]')", 60000, 'game');
  const idB = await ev(B, "JSON.parse(localStorage.getItem('muaySitePlayer')).id"), row = `[data-act=chsend][data-v="${idB}"]`;
  await ev(A, "document.querySelector('[data-act=tab][data-v=fight]').click()");
  await until(A, `!!document.querySelector('${row}[data-w=now]')`, 60000, 'A sees B online with a fight-now button');
  console.log(T(), 'A list:', await ev(A, `[...document.querySelectorAll('.opp')].map(o => o.innerText.replace(/\\s+/g, ' ').slice(0, 110))`));
  await A.screenshot({path: S + 'quick-list-a.png'});
  // 0. B closes the game: A sees him offline soon; B opens it again: online again
  const bOn = `(() => { const b = document.querySelector('${row}'); return b ? b.closest('.opp').querySelector('.pres').classList.contains('on') : null; })()`;
  let t1 = Date.now(); await B.goto('about:blank');
  console.log(T(), 'B closed the game → A shows him offline:', await until(A, bOn + ' === false', 60000, 'B offline on A'), 'after', ((Date.now() - t1) / 1000).toFixed(0), 's ·', await ev(A, `document.querySelector('${row}').closest('.opp').querySelector('.pres').textContent`));
  t1 = Date.now(); await B.goto(URL0); await until(B, "!!window.MUAY && !!document.querySelector('[data-act=tab][data-v=fight]')", 60000, 'B back');
  console.log(T(), 'B opened it again → online on A:', await until(A, bOn + ' === true', 60000, 'B online on A'), 'after', ((Date.now() - t1) / 1000).toFixed(0), 's');
  // 1. a match by appointment, then B withdraws
  await ev(A, `document.getElementById('chWhen').value='n5'; document.querySelector('${row}:not([data-w])').click()`);
  await until(B, "!!document.querySelector('#gMatch .matchbar.ask [data-act=chyes]')", 30000, 'B gets the challenge banner');
  console.log(T(), 'B banners:', await ev(B, bars));
  await ev(B, "document.querySelector('#gMatch .matchbar.ask [data-act=chyes]').click()");
  await until(A, "!!document.querySelector('#gMatch .mb-cd')", 30000, 'A sees the agreed match'); await until(B, "!!document.querySelector('#gMatch [data-act=chquit]')", 30000, 'B can withdraw');
  console.log(T(), 'A banners:', await ev(A, bars)); console.log(T(), 'B banners:', await ev(B, bars));
  await B.screenshot({path: S + 'quick-agreed-b.png'});
  await ev(B, "document.querySelector('#gMatch [data-act=chquit]').click()"); await B.waitForTimeout(600);
  console.log(T(), 'B asked:', await ev(B, bars));
  await ev(B, "document.querySelector('#gMatch .btn.danger[data-act=chquit]').click()");
  await until(A, "!!document.querySelector('#gMatch .matchbar.note')", 30000, 'A is told B withdrew');
  console.log(T(), 'A banners after B withdrew:', await ev(A, bars)); console.log(T(), 'B banners:', await ev(B, bars));
  // 2a. fight now, accepted, and B withdraws on the full-screen count: no fight on either screen
  await ev(A, "document.querySelector('[data-act=tab][data-v=fight]').click()");
  await until(A, `!!document.querySelector('${row}[data-w=now]')`, 40000, 'A can challenge B');
  await ev(A, `document.querySelector('${row}[data-w=now]').click()`);
  await until(B, "!!document.querySelector('#gMatch .matchbar.ask [data-act=chyes]')", 30000, 'B gets the fight-now banner (2a)');
  await ev(B, "document.querySelector('#gMatch .matchbar.ask [data-act=chyes]').click()");
  await until(B, "!!document.getElementById('gCountQ')", 40000, 'B full-screen count (2a)'); await until(A, "!!document.getElementById('gCount')", 10000, 'A full-screen count (2a)');
  await ev(B, "document.getElementById('gCountQ').click()"); await B.waitForTimeout(400);
  console.log(T(), 'B on the count asked:', await ev(B, "document.getElementById('gCountQ').textContent"), '· seconds left:', await ev(B, "document.getElementById('gCountN').textContent"));
  await ev(B, "document.getElementById('gCountQ').click()"); await B.waitForTimeout(14000);
  const off = "({count: !!document.getElementById('gCount'), fight: !!document.querySelector('.app.g-fight'), bars: [...document.querySelectorAll('#gMatch .matchbar')].map(b => b.innerText.replace(/\\s+/g, ' ').slice(0, 60))})";
  console.log(T(), 'after the withdrawal, past the bell: A', JSON.stringify(await ev(A, off)), '| B', JSON.stringify(await ev(B, off)));
  // 2. fight now
  await ev(A, "document.querySelector('[data-act=tab][data-v=fight]').click()");
  await until(A, `!!document.querySelector('${row}[data-w=now]')`, 40000, 'A can challenge B again');
  await ev(A, `document.querySelector('${row}[data-w=now]').click()`);
  await until(B, "!!document.querySelector('#gMatch .matchbar.ask [data-act=chyes]')", 30000, 'B gets the fight-now banner');
  console.log(T(), 'A banners:', await ev(A, bars)); console.log(T(), 'B banners:', await ev(B, bars));
  await B.screenshot({path: S + 'quick-ask-b.png'}); await A.screenshot({path: S + 'quick-wait-a.png'});
  const tAcc = Date.now(); await ev(B, "document.querySelector('#gMatch .matchbar.ask [data-act=chyes]').click()");
  await until(B, "!!document.querySelector('#gMatch .mb-cd')", 20000, 'B countdown'); await until(A, "!!document.querySelector('#gMatch .mb-cd')", 20000, 'A countdown');
  console.log(T(), 'after accept (' + ((Date.now() - tAcc) / 1000).toFixed(1) + ' s): A:', await ev(A, bars), '| B:', await ev(B, bars));
  await until(A, "!!document.getElementById('gCount')", 40000, 'A full-screen count'); await until(B, "!!document.getElementById('gCount')", 10000, 'B full-screen count');
  await A.waitForTimeout(2500);
  console.log(T(), 'count: A', await ev(A, "(document.getElementById('gCount') || {innerText: 'gone'}).innerText.replace(/\\s+/g, ' ')"), '| B', await ev(B, "(document.getElementById('gCount') || {innerText: 'gone'}).innerText.replace(/\\s+/g, ' ')"));
  await A.screenshot({path: S + 'quick-count-a.png'}); await B.screenshot({path: S + 'quick-count-b.png'});
  await until(A, "!!(window.LAB && LAB.fight && document.querySelector('.app.g-fight'))", 40000, 'A in the ring'); await until(B, "!!(window.LAB && LAB.fight && document.querySelector('.app.g-fight'))", 40000, 'B in the ring');
  console.log(T(), 'in the ring ' + ((Date.now() - tAcc) / 1000).toFixed(1) + ' s after the accept · count gone:', await ev(A, "!document.getElementById('gCount')"), await ev(B, "!document.getElementById('gCount')"));
  await A.waitForTimeout(12000);
  const snap = "({w: LAB.clock == null ? null : +LAB.clock.toFixed(1), t: +LAB.t.toFixed(1), venue: MUAY.venueNow(), seed: LAB.cfg.seed, viewers: (document.querySelector('[data-viewers]') || {}).textContent, bars: document.querySelectorAll('#gMatch .matchbar').length})";
  console.log(T(), 'A', JSON.stringify(await ev(A, snap)), '| B', JSON.stringify(await ev(B, snap)));
  // 3. a friend opens the invitation link while the match is on: created his fighter, then taken to the ring to watch
  const idA = await ev(A, "JSON.parse(localStorage.getItem('muaySitePlayer')).id"), seed = await ev(A, "LAB.cfg.seed"), key = idA + '>' + idB + '>' + seed;
  const C = await player('C', {width: 390, height: 700}); // (player() opens the plain address; go to the link itself)
  await C.goto(URL0 + '?watch=' + encodeURIComponent(key)); await C.waitForFunction("!!window.MUAY && !!document.getElementById('gName')", null, {timeout: 60000});
  await ev(C, "document.getElementById('gName').value='คนดู';document.querySelector('[data-act=create]').click()");
  console.log(T(), 'C in the ring as a spectator:', await until(C, "!!(window.LAB && LAB.fight && document.querySelector('.app.g-fight'))", 60000, 'C watching'), JSON.stringify(await ev(C, "({w: LAB.clock == null ? null : +LAB.clock.toFixed(1), t: +LAB.t.toFixed(1), venue: MUAY.venueNow(), seed: LAB.cfg.seed, card: (document.querySelector('#gBody .gcard') || {innerText: ''}).innerText.replace(/\\s+/g, ' ').slice(0, 120)})")));
  console.log(T(), 'A is told somebody watches:', await until(A, "(document.querySelector('[data-viewers]') || {}).textContent === '1'", 70000, 'viewer count on A'));
  await C.screenshot({path: S + 'quick-watch-c.png'});
} catch (e) { console.log('FAILED: ' + String(e.message).split('\n')[0]); }
// on the real site the test players are taken away again: the pages are closed first (an open game writes its record
// again), then each one's own records are deleted with his own key
const creds = []; for (const b of browsers) for (const c of b.contexts()) for (const p of c.pages()) { try { const me = JSON.parse(await ev(p, "localStorage.getItem('muaySitePlayer')")); if (me && me.id) creds.push(me); } catch (e) { /* no player on this page */ } }
console.log([...new Set(errs)].slice(0, 10).join('\n') || 'no errors');
for (const b of browsers) await b.close();
if (process.env.CLEAN) for (const me of creds) { const out = []; for (const d of ['board/' + me.id, 'challenges/' + me.id, 'answers/' + me.id, 'data/users/' + me.id + '/save']) out.push(execFileSync('curl', ['-sS', '-o', '/dev/null', '-w', '%{http_code}', '-X', 'DELETE', '-H', 'Authorization: Bearer ' + me.id + '.' + me.secret, URL0 + 'api/db/' + d]).toString()); console.log('cleanup ' + me.id.slice(0, 8) + ':', out.join(',')); }
