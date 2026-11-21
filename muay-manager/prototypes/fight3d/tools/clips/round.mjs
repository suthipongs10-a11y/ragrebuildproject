// One whole round, as the game plays it (owner 21 Nov 2026: "คลิปถ่ายจากเกมจริง ชกจริงๆ ทั้งยก ไม่ต้องเอาเฉพาะช็อตเด็ด
// ... เอาดนตรีในเกมได้เลย ... 1.20 นาที"): the plan screen before the fight and the tap into the ring, then the ring full
// screen from the walk-out to the bell that ends round one, nothing cut, the game's own commentary, crowd and music;
// then the round's numbers at the break and the end card. About 1 minute 20.
// The fight is the game's own ranked fight; only its seed is chosen before it starts, out of a few thousand, for the
// busiest first round that goes the distance (knockdowns, big shots, signature moves). The fighter is made new and
// given the record of a fighter who has reached the stadium league (rating 1420, every stat 62), so the bout is at
// the standard stadium with its crowd.
// Recorded from the website build on the local server (a database of its own), upright at 1080×1920, on the virtual
// clock of clip-kit.mjs.
// needs:  server/server.mjs on --site (MUAY_DB pointing at a clip-only file) and a current dist/site (node build.mjs)
// usage:  node tools/clips/round.mjs [--name round-1] [--fighter "สายฟ้า RR"] [--fps 30] [--tries 4000] [--rp 1420] [--stat 62] [--site http://127.0.0.1:8788/]
// out:    dist/clips/<name>.mp4 and <name>.jpg (a frame for a preview)
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { clockScript, soundOf, encode, ROOT } from './clip-kit.mjs';
import { simulate } from '../../src/sim.js';
import { MOVES } from '../../src/data.js';
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const NAME = arg('name', 'round-1'), FIGHTER = arg('fighter', 'สายฟ้า RR'), FPS = +arg('fps', 30), TRIES = +arg('tries', 4000), SITE = arg('site', 'http://127.0.0.1:8788/');
const RP = +arg('rp', 1420), STAT = +arg('stat', 62);
const OUT = ROOT + 'dist/clips/', FR = OUT + NAME + '-frames/';
rmSync(FR, {recursive: true, force: true}); mkdirSync(FR, {recursive: true});
const dt = 1000 / FPS, pad = i => String(i).padStart(5, '0'), t1 = Date.now(), T = () => ((Date.now() - t1) / 1000).toFixed(0).padStart(5) + 's';
const say = (...a) => console.log(T(), ...a);

// ---- the fight: the busiest first round that lasts the three minutes (here one) and ends on the bell
let FIGHT = null;
function pickFight(cfg) {
  const plans = [[0, 1, 2].map(() => cfg.plans[0][0]), cfg.plans[1]];
  let best = null;
  for (let s = 1; s <= TRIES; s++) {
    const f = simulate({seed: s, specs: JSON.parse(JSON.stringify(cfg.specs)), plans, rules: cfg.rules}), ev = f.events;
    const rest = ev.find(e => e.type === 'phase' && e.phase === 'rest' && e.round === 1); if (!rest) continue; // finished inside round one
    const r1 = ev.filter(e => e.t < rest.t), hits = r1.filter(e => e.type === 'hit' && e.res === 'hit');
    const kd = r1.filter(e => e.type === 'kd'), kdOpp = kd.filter(e => e.on === 1).length, big = hits.filter(e => e.sev >= 3).length;
    const sp = r1.filter(e => e.type === 'move' && e.special).length, combos = r1.filter(e => e.type === 'combo').length;
    const quiet = Math.max(...r1.filter(e => e.type === 'hit').map((e, i, a) => i ? e.t - a[i - 1].t : 0), 0); // the longest wait for a blow
    const score = kdOpp * 14 + (kd.length - kdOpp) * 9 + big * 2 + hits.length * .3 + sp * 3 + combos * .8 - Math.max(0, quiet - 5) * 2;
    if (!best || score > best.score) best = {score, s, rest: rest.t, kd: kd.length, kdOpp, big, hits: hits.length, sp, quiet};
  }
  if (!best) throw new Error(`every one of ${TRIES} fights ended inside round one`);
  FIGHT = best;
  say(`fight: seed ${best.s} (score ${best.score.toFixed(1)}): round one ends at ${best.rest.toFixed(1)} s, knockdowns ${best.kd} (${best.kdOpp} of the opponent), landed ${best.hits}, big ${best.big}, signature moves ${best.sp}, longest quiet ${best.quiet.toFixed(1)} s`);
  return best.s;
}

// ---- over the game: the end card only (and the lab's frame counter, the full-screen button out of sight)
const logo = 'data:image/webp;base64,' + readFileSync(ROOT + 'assets/ui/logo.webp').toString('base64');
const OVERLAY = `(() => {
  const st = document.createElement('style'); st.textContent = \`
    #btnFull,#fps{opacity:0!important;pointer-events:none}
    #clipEnd{position:fixed;inset:0;z-index:2147483003;display:none;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center;padding:0 26px;
      background:radial-gradient(ellipse at center,rgba(20,16,8,.8),rgba(8,8,12,.95));color:#fff;animation:clipFade .4s ease-out both}
    #clipEnd.on{display:flex} #clipEnd img{width:82%;max-width:420px;filter:drop-shadow(0 4px 10px #000)}
    #clipEnd .tag{font:600 19px/1.3 'Bai Jamjuree',sans-serif;color:#d6d7de}
    #clipEnd .play{margin-top:10px;font:italic 700 30px/1.1 'Chakra Petch',sans-serif;color:#fff} #clipEnd .th{font:600 21px/1.2 'Bai Jamjuree',sans-serif;color:#ffd35a}
    #clipEnd .url{margin-top:6px;font:700 33px/1 'Chakra Petch',sans-serif;color:#111;background:#f2b83a;border-radius:12px;padding:12px 18px;box-shadow:0 4px 0 #8a5c00}
    #clipEnd .by{margin-top:18px;font:600 15px/1.3 'Bai Jamjuree',sans-serif;color:#9a9ba6} #clipEnd .cr{font:500 11px/1.3 'Bai Jamjuree',sans-serif;color:#6f7080;position:absolute;bottom:22px;left:0;right:0}
    @keyframes clipFade{from{opacity:0}to{opacity:1}}\`;
  document.head.appendChild(st);
  const end = document.createElement('div'); end.id = 'clipEnd';
  end.innerHTML = '<img alt="" src="${logo}"><div class="tag">Manage a Muay Thai fighter · คุมค่ายมวยไทยของคุณเอง</div><div class="play">PLAY FREE IN YOUR BROWSER</div><div class="th">เล่นฟรีบนเว็บ ไม่ต้องโหลด</div><div class="url">muay.eggpact.com</div><div class="by">RR Studio Gaming</div><div class="cr">Crowd sounds: Gregor Quendel (CC BY 4.0)</div>';
  document.body.appendChild(end);
  window.__overlay = {end() { end.classList.add('on'); }};
})();`;

// ---- the browser, the page and the clock
const browser = await chromium.launch({args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']});
const context = await browser.newContext({viewport: {width: 540, height: 960}, deviceScaleFactor: 2, hasTouch: true});
const page = await context.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.addInitScript(clockScript({len: 400, t0: Date.now()}));
await page.exposeFunction('__pickFight', cfg => pickFight(cfg));
const ev = js => page.evaluate(js), step = ms => ev(`__clip.step(${ms})`);
const until = async (js, sec, stepMs = 50) => { for (let t = 0; t < sec * 1000; t += stepMs) { if (await ev(js)) return true; await step(stepMs); await page.waitForTimeout(15); } return false; };
const idle = async sec => { for (let t = 0; t < sec * 1000; t += 50) await step(50); };
const click = async sel => { const ok = await ev(`(() => { const b = document.querySelector(${JSON.stringify(sel)}); if (!b || b.disabled) return false; b.click(); return true; })()`); if (!ok) say('could not press', sel); return ok; };
const cdp = await context.newCDPSession(page);
await cdp.send('Emulation.setDeviceMetricsOverride', {width: 540, height: 960, deviceScaleFactor: 2, mobile: false}); // 1080×1920
const grab = async () => Buffer.from((await cdp.send('Page.captureScreenshot', {format: 'jpeg', quality: 92, captureBeyondViewport: false})).data, 'base64');

// ---- recording: one frame, one step of the clock; the sound of the stretches recorded
let n = 0, lastT = null; const spans = [];
async function frame() {
  await step(dt); const t = await ev('__clip.t');
  writeFileSync(FR + pad(n++) + '.jpg', await grab());
  if (lastT != null && Math.abs(t - dt - lastT) < 1e-3) spans[spans.length - 1][1] = t; else spans.push([t - dt, t]);
  lastT = t;
  if (n % FPS === 0) process.stdout.write(`\r${T()} ${(n / FPS).toFixed(0)} s recorded, ${((Date.now() - t1) / n).toFixed(0)} ms a frame   `);
}
const rec = async sec => { for (let i = 0, k = Math.round(sec * FPS); i < k; i++) await frame(); };
const full = async on => { if (await ev("document.getElementById('arena').classList.contains('full')") !== on) await ev("document.getElementById('btnFull').click()"); await step(dt); };

// ---- 0. the page up, the sound on, a fighter who has reached the stadium league
await page.goto(SITE, {timeout: 120000});
if (!await until("!!(window.MUAY && document.getElementById('gName') && document.fonts.status === 'loaded')", 120)) throw new Error('the game did not come up');
await idle(2); await ev("document.getElementById('btnSound').click()"); await idle(2.5);
await ev(OVERLAY);
await ev(`(() => { const api = window.MUAY, go = api.startFight; api.startFight = async function (cfg) { cfg.seed = await window.__pickFight({specs: cfg.specs, plans: cfg.plans, rules: cfg.rules || null}); return go.call(this, cfg); }; })()`);
for (const [f, v] of [['shorts', 'blue'], ['gloves', 'white'], ['band', 'red']]) { await click(`[data-act=dlook][data-f=${f}][data-v=${v}]`); await idle(.3); }
await ev(`document.getElementById('gName').value = ${JSON.stringify(FIGHTER)}`); await click('[data-act=create]'); await idle(2.5);
if (!await ev('!!GAME.save()')) throw new Error('the fighter was not created');
await ev(`(() => { const S = GAME.save(); S.rp = ${RP}; for (const k in S.stats) S.stats[k] = ${STAT}; S.fatigue = 0; S.rec = {w: 14, l: 3, ko: 8}; })()`);
await click('[data-act=tab][data-v=home]'); await idle(1); await click('[data-act=tab][data-v=fight]'); await idle(1.5);
await click('[data-act=pick][data-v=r]'); await idle(2);
if (!await ev("!!document.querySelector('[data-act=startfight]')")) throw new Error('no plan screen for the ranked fight');
say('ready:', await ev('GAME.save().name'), 'rating', await ev('GAME.save().rp'), 'against', await ev('GAME.fight().opp.name'), 'at', await ev('GAME.fight().opp.venue'));

// ---- 1. the plan screen, the tap into the ring
await ev("(() => { const h = document.querySelector('#gBody h2'); if (h) h.scrollIntoView({block: 'start', behavior: 'instant'}); scrollBy(0, -8); })()");
await rec(2.2);
await click('.plan [data-act=plan][data-g=ag][data-v=attack]'); await rec(1.0);
await ev("document.querySelector('[data-act=startfight]').scrollIntoView({block: 'center', behavior: 'instant'})"); await rec(1.2);
await click('[data-act=startfight]'); await rec(.4);
// the fight is being set up (and its seed chosen): the clock waits for it
for (let i = 0; i < 400 && !(FIGHT && await ev(`!!(window.LAB && LAB.fight && LAB.cfg.seed === ${FIGHT ? FIGHT.s : -1})`)); i++) { await step(50); await page.waitForTimeout(150); }
if (!FIGHT || !await ev(`LAB.cfg.seed === ${FIGHT.s}`)) throw new Error('the chosen fight is not the one playing');
await ev('LAB.seek(0)'); await full(true);
say('fight on at', await ev('MUAY.venueNow()'));

// ---- 2. the whole of round one, to the bell and the walk to the corners
// (the game holds the fight at the break until the player goes on: then the picture stands still, so a second of that is enough)
let held = 0;
for (let i = 0; i < 200 * FPS; i++) {
  await frame();
  const s = await ev("({p: LAB.state.playT, brk: !!document.querySelector('#gBody [data-act=resume]')})");
  if (s.p >= FIGHT.rest + 2.6) break;
  if (s.brk && ++held >= FPS) break;
}
// ---- 3. the break: the round in numbers
await full(false); await step(dt);
await ev("(() => { const c = document.querySelector('#gBody [data-act=resume]'); const card = c && c.closest('section'); if (card) card.scrollIntoView({block: 'start', behavior: 'instant'}); scrollBy(0, -8); })()");
await rec(3.2);
// ---- 4. the end card
await ev('__overlay.end()'); await rec(3.5);
console.log('');

const wavFile = OUT + NAME + '.wav', secs = await soundOf(ev, spans, wavFile);
await browser.close();
if (errs.length) say('page errors:', errs.slice(0, 3).join(' | '));
encode(FR + '%05d.jpg', FPS, wavFile, OUT + NAME + '.mp4');
const frames = readdirSync(FR).filter(f => f.endsWith('.jpg')).sort();
writeFileSync(OUT + NAME + '.jpg', readFileSync(FR + frames[Math.min(frames.length - 1, Math.round(FPS * 30))]));
say(`${OUT}${NAME}.mp4 · ${(n / FPS).toFixed(1)} s · ${n} frames · sound ${secs.toFixed(1)} s`);
