// Two players on the local site fight a live match: the banner and its countdown, both taken into the ring at the bell,
// the same venue, the same second and the same score on both screens, a timed rest with a plan each, the same result.
// usage: node two-live2.mjs [seconds until the bell, default 40]    (needs the local site at 127.0.0.1:8788)
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url); const { chromium } = require('playwright'); // the cloud session has it on NODE_PATH
const ROOT = new URL('../../', import.meta.url).pathname, S = ROOT + 'dist/e2e/', THREE = ROOT + 'node_modules/three/build/three.min.js'; mkdirSync(S, {recursive: true}); // screenshots go to dist/e2e (not committed)
const URL0 = process.env.SITE || 'http://127.0.0.1:8788/', LEAD = +(process.argv[2] || 40);
// one browser each: a page that is not in front gets few frames, and a starved screen falls behind the clock
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'];
const browsers = [];
const errs = [];
async function player(tag, vp) {
  const browser = await chromium.launch({args: ARGS}); browsers.push(browser);
  const ctx = await browser.newContext({viewport: vp});
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|fonts/.test(m.text())) errs.push(tag + ': ' + m.text()); });
  page.on('pageerror', e => errs.push(tag + ' PAGEERROR: ' + e.message));
  await page.route('**/three.min.js', r => r.fulfill({path: THREE, contentType: 'application/javascript'}));
  await page.route('**/fonts.googleapis.com/**', r => r.abort());
  await page.goto(URL0); await page.waitForFunction("!!window.MUAY && !!document.getElementById('gName')", null, {timeout: 60000});
  return page;
}
const ev = (p, js) => p.evaluate(js);
const both = async js => Promise.all([ev(A, js), ev(B, js)]);
const until = async (p, js, ms, what) => { try { await p.waitForFunction(js, null, {timeout: ms, polling: 250}); return true; } catch (e) { console.log('  TIMEOUT waiting for: ' + what); return false; } };
const NAMES = (process.env.NAMES || 'ทดสอบเอ,ทดสอบบี').split(',');
const t0 = Date.now(), T = () => ((Date.now() - t0) / 1000).toFixed(0).padStart(3) + 's';
const A = await player('A', {width: 390, height: 700}), B = await player('B', {width: 760, height: 620});
await ev(A, `document.getElementById('gName').value='${NAMES[0]}';document.querySelector('[data-act=create]').click()`);
await ev(B, `document.getElementById('gName').value='${NAMES[1]}';document.querySelector('[data-act=create]').click()`);
try {
await A.waitForTimeout(5000);
await A.reload(); await B.reload(); // the leaderboard knows both now
await until(A, "!!window.MUAY && !!document.querySelector('[data-act=tab][data-v=fight]')", 60000, 'A game'); await until(B, "!!window.MUAY && !!document.querySelector('[data-act=tab][data-v=fight]')", 60000, 'B game');
await A.waitForTimeout(3000);
const idB = await ev(B, "JSON.parse(localStorage.getItem('muaySitePlayer')).id"), btn = `[data-act=chsend][data-v="${idB}"]`;
await ev(A, "document.querySelector('[data-act=tab][data-v=fight]').click()"); await until(A, `!!document.querySelector('${btn}')`, 30000, 'A sees B to challenge');
await ev(A, `document.getElementById('chWhen').value='n5'; document.querySelector('${btn}').click()`); await A.waitForTimeout(2500);
// the bell LEAD seconds from now (A owns his challenge record; nothing else writes to it before the answer)
console.log(T(), 'start moved:', await ev(A, `(async()=>{const me=JSON.parse(localStorage.getItem('muaySitePlayer')),h={Authorization:'Bearer '+me.id+'.'+me.secret};
  const d=(await (await fetch('/api/db/challenges/'+me.id,{headers:h})).json()).data; for(const k in d.list) d.list[k].time=Date.now()+${LEAD}*1000;
  return (await fetch('/api/db/challenges/'+me.id,{method:'PUT',headers:Object.assign({'Content-Type':'application/json'},h),body:JSON.stringify(d)})).status;})()`));
await ev(B, "document.querySelector('[data-act=tab][data-v=fight]').click()"); await until(B, "!!document.querySelector('[data-act=chyes]')", 25000, 'B sees the challenge');
await ev(B, "document.querySelector('[data-act=chyes]').click()");
const bar = "(() => { const b = document.querySelector('.matchbar'); return b ? b.innerText.replace(/\\s+/g, ' ') + ' | online dots ' + b.querySelectorAll('.p.on').length : null; })()";
await until(A, "!!document.querySelector('.matchbar')", 25000, 'A banner'); await until(B, "!!document.querySelector('.matchbar')", 25000, 'B banner');
console.log(T(), 'A banner:', await ev(A, bar)); console.log(T(), 'B banner:', await ev(B, bar));
await until(A, "document.querySelectorAll('.matchbar .p.on').length === 2", 30000, 'A sees both online'); await until(B, "document.querySelectorAll('.matchbar .p.on').length === 2", 30000, 'B sees both online');
console.log(T(), 'A banner:', await ev(A, bar)); console.log(T(), 'B banner:', await ev(B, bar));
await A.screenshot({path: S + 'live2-banner-a.png'}); await B.screenshot({path: S + 'live2-banner-b.png'});
// the bell: nobody presses anything
await until(A, "!!(window.LAB && LAB.fight && document.querySelector('.app.g-fight'))", (LEAD + 40) * 1000, 'A in the ring'); await until(B, "!!(window.LAB && LAB.fight && document.querySelector('.app.g-fight'))", 40000, 'B in the ring');
await both("(() => { let n = 0, t = performance.now(); const f = () => { n++; const now = performance.now(); if (now - t > 2000) { window.__fps = +(n * 1000 / (now - t)).toFixed(1); n = 0; t = now; } requestAnimationFrame(f); }; requestAnimationFrame(f); })()");
const snap = `(() => ({t: +LAB.t.toFixed(2), at: MUAY.liveAt() == null ? null : +MUAY.liveAt().toFixed(2), venue: MUAY.venueNow(), pts: [...document.querySelectorAll('.board .pts')].map(e => e.textContent).join(':'), names: [...document.querySelectorAll('.board .nm')].map(e => e.textContent).join(' v '),
  rest: !!document.querySelector('[data-restcd]'), restLeft: (document.querySelector('.cd.big') || {}).textContent || '', pick: document.querySelectorAll('.plan [data-act=plan]').length, card: (document.querySelector('#gBody .gcard') || {innerText: ''}).innerText.replace(/\\s+/g, ' ').slice(0, 110), over: !!document.querySelector('#gBody [data-act=home]'), seed: LAB.cfg.seed, w: LAB.clock == null ? null : +LAB.clock.toFixed(1), rate: +LAB.rate.toFixed(2), fps: window.__fps || 0}))()`;
let worst = 0, picked = {}, n = 0, mism = 0;
for (;;) {
  const [a, b] = await both(snap); n++;
  const d = a.at != null && b.at != null ? Math.abs(a.at - b.at) : 0; if (!a.rest && !b.rest) worst = Math.max(worst, d);
  if (a.pts !== b.pts && a.at != null && b.at != null && d < .6) mism++;
  if (n % 3 === 1 || a.rest !== b.rest) console.log(T(), `A ${a.fps}fps w=${a.w} x${a.rate} t=${a.t} at=${a.at} ${a.venue} ${a.pts}${a.rest ? ' REST ' + a.restLeft + ' pick=' + a.pick : ''} | B ${b.fps}fps w=${b.w} x${b.rate} t=${b.t} at=${b.at} ${b.venue} ${b.pts}${b.rest ? ' REST ' + b.restLeft + ' pick=' + b.pick : ''} | apart ${d.toFixed(2)}s`);
  // each rest: A and B press a plan each (once per rest)
  if (a.rest && b.rest) {
    const k = a.t.toFixed(1);
    if (!picked[k] && a.pick && b.pick) {
      picked[k] = 1;
      await ev(A, "document.querySelector('.plan [data-act=plan][data-g=ag][data-v=attack]').click()"); await ev(B, "document.querySelector('.plan [data-act=plan][data-g=range][data-v=out]').click()");
      await A.waitForTimeout(600);
      console.log(T(), '  rest: A card:', (await ev(A, snap)).card); console.log(T(), '  rest: B card:', (await ev(B, snap)).card);
      await A.screenshot({path: S + `live2-rest${Object.keys(picked).length}-a.png`}); await B.screenshot({path: S + `live2-rest${Object.keys(picked).length}-b.png`});
    }
  }
  if (a.over && b.over) { console.log(T(), 'A result:', a.card); console.log(T(), 'B result:', b.card); break; }
  if (Date.now() - t0 > 480000) { console.log('gave up after 8 minutes'); break; }
  await A.waitForTimeout(1500);
}
const fin = "(() => { const r = LAB.fight.result; return JSON.stringify({w: r.w, how: r.how, round: r.round, pts: r.pts, seed: LAB.cfg.seed, plans: LAB.cfg.plans, venue: MUAY.venueNow()}); })()";
const [fa, fb] = await both(fin);
console.log('A fight:', fa); console.log('B fight:', fb);
console.log(fa === fb ? 'SAME FIGHT on both screens' : 'DIFFERENT FIGHTS');
console.log('furthest apart during the rounds:', worst.toFixed(2), 's · samples with different scores while in step:', mism, 'of', n);
await A.screenshot({path: S + 'live2-end-a.png'}); await B.screenshot({path: S + 'live2-end-b.png'});
console.log([...new Set(errs)].slice(0, 10).join('\n') || 'no errors');
} catch (e) { console.log('FAILED: ' + String(e.message).split('\n')[0]); }
// on the real site: take the two test players' records away again (each deletes his own)
if (process.env.CLEAN) for (const [tag, p] of [['A', A], ['B', B]]) console.log('cleanup ' + tag + ':', await ev(p, `(async()=>{const me=JSON.parse(localStorage.getItem('muaySitePlayer')),h={Authorization:'Bearer '+me.id+'.'+me.secret},out=[];
  for (const d of ['board/'+me.id,'challenges/'+me.id,'answers/'+me.id,'data/users/'+me.id+'/save']) out.push((await fetch('/api/db/'+d,{method:'DELETE',headers:h})).status); localStorage.clear(); return out.join(',');})()`));
for (const b of browsers) await b.close();
