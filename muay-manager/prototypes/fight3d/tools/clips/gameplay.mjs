// A longer clip of the game being played, 1–3 minutes (docs/TIKTOK_PLAN.md, owner 21 Nov 2026: "ทุกการเล่นในเกมจะต้องมี
// ให้เห็น"): a new fighter is made, his camp, two training drills played on the beat, the pick of an opponent and a game
// plan, then the fight: the start of round one (feeling each other out), new orders at the break, a lively stretch of
// round two, the finish and its replay, the pay and the ranking, and the end card. A line of text sits over each step
// and every tap shows as a ring. The first seconds are the knockout itself, as a teaser.
// The fight is the game's own; only its seed is chosen, before it starts, out of a few thousand, so that the new
// fighter wins it by knockout after round one with the plans the clip gives him (the presenter still only plays what
// the simulation decided; the check at the end says if the fight played out otherwise).
// Recorded from the website build on the local server, on a database of its own, upright at 1080×1920 on the
// virtual clock of clip-kit.mjs. The two recorded ring tracks are taken out (no known licence); the game's own music stays.
// needs:  server/server.mjs on --site (MUAY_DB pointing at a clip-only file) and a current dist/site (node build.mjs)
// usage:  node tools/clips/gameplay.mjs [--name gameplay-1] [--fighter "สายฟ้า RR"] [--fps 30] [--tries 6000] [--site http://127.0.0.1:8788/]
// out:    dist/clips/<name>.mp4 and <name>.jpg (a frame for a preview)
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { clockScript, MUSIC_PACK, ringMusicIn, soundOf, encode, ROOT } from './clip-kit.mjs';
import { simulate } from '../../src/sim.js';
import { rate } from './find-fights.mjs';
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const NAME = arg('name', 'gameplay-1'), FIGHTER = arg('fighter', 'สายฟ้า RR'), FPS = +arg('fps', 30), TRIES = +arg('tries', 6000), SITE = arg('site', 'http://127.0.0.1:8788/');
const HOOK = arg('hook', 'I TRAINED HIM FROM ZERO…|ปั้นจากศูนย์ จนน็อกคาเวที').split('|');
const OUT = ROOT + 'dist/clips/', FR = OUT + NAME + '-frames/', TZ = FR + 'teaser/', ALL = FR + 'all/';
rmSync(FR, {recursive: true, force: true}); mkdirSync(TZ, {recursive: true}); mkdirSync(ALL, {recursive: true});
const dt = 1000 / FPS, pad = i => String(i).padStart(5, '0'), t1 = Date.now(), T = () => ((Date.now() - t1) / 1000).toFixed(0).padStart(5) + 's';
const say = (...a) => console.log(T(), ...a);

// ---- the fight: the seed that gives the best finish for the new fighter, with the plans this clip gives him
const PRESS = {ag: 'attack', range: 'in', target: 'mixed'}; // the "press forward" order at the break (game.js QUICK.press)
let FIGHT = null;
function pickFight(cfg) {
  const plans = [[cfg.plans[0][0], PRESS, PRESS], cfg.plans[1]];
  let best = null, n = 0;
  for (let s = 1; s <= TRIES; s++) {
    const f = simulate({seed: s, specs: JSON.parse(JSON.stringify(cfg.specs)), plans, rules: cfg.rules}); f.seed = s;
    const r = rate(f); if (!r || f.result.w !== 0 || f.result.round < 2) continue; // he wins, by knockout, and there is a break first
    n++; if (!best || r.score > best.r.score) best = {r, f};
  }
  if (!best) throw new Error(`no knockout win for the new fighter in ${TRIES} fights: try another opponent or more --tries`);
  const f = best.f, ev = f.events, rests = ev.filter(e => e.phase === 'rest').map(e => e.t), ko = ev.find(e => e.type === 'ko');
  const r2 = ev.find(e => e.type === 'phase' && e.phase === 'fight' && e.round === 2).t, r2end = rests[1] || ko.t;
  // the busiest eight seconds of round two that end well before the finish is shown
  let w = r2 + 4, wBest = -1;
  for (let a = r2 + 1; a + 8 <= Math.min(r2end, ko.t - 9); a += .5) {
    const k = ev.filter(e => e.type === 'hit' && e.res === 'hit' && e.t >= a && e.t < a + 8).reduce((s, e) => s + 1 + (e.sev || 0), 0);
    if (k > wBest) { wBest = k; w = a; }
  }
  FIGHT = {seed: f.seed, koT: ko.t, round: f.result.round, how: f.result.how, move: best.r.moveTh, rests, r2win: wBest >= 0 ? w : null, score: best.r.score, wins: n, kds: best.r.kds};
  say(`fight: seed ${f.seed} of ${n} knockout wins in ${TRIES}: ${f.result.how} round ${f.result.round} at ${ko.t.toFixed(1)} s by ${best.r.moveTh}, knockdowns ${best.r.kds}, score ${best.r.score}`);
  return f.seed;
}

// ---- what sits over the game: the line for each step, the taps, the teaser line, the end card
const logo = 'data:image/webp;base64,' + readFileSync(ROOT + 'assets/ui/logo.webp').toString('base64');
const OVERLAY = `(() => {
  const st = document.createElement('style'); st.textContent = \`
    #btnFull,#fps,#replayTag{opacity:0!important;pointer-events:none}
    #clipCap{position:fixed;left:50%;top:112px;transform:translateX(-50%);z-index:2147483000;width:max-content;max-width:88%;padding:9px 18px 10px;border-radius:16px;background:rgba(10,10,14,.8);
      border:2px solid #f2b83a;box-shadow:0 6px 18px rgba(0,0,0,.55);text-align:center;pointer-events:none;animation:capIn .32s cubic-bezier(.2,1.5,.4,1) both}
    #arena.full #clipCap{position:absolute}
    #clipCap b{display:block;font:italic 700 29px/1.05 'Chakra Petch',sans-serif;color:#fff;letter-spacing:.01em}
    #clipCap span{display:block;margin-top:4px;font:600 20px/1.2 'Bai Jamjuree',sans-serif;color:#ffd35a}
    @keyframes capIn{from{transform:translateX(-50%) scale(.7);opacity:0}to{transform:translateX(-50%);opacity:1}}
    .clipTap{position:fixed;width:66px;height:66px;margin:-33px 0 0 -33px;border-radius:50%;border:4px solid rgba(255,255,255,.95);background:rgba(255,255,255,.28);
      box-shadow:0 0 0 2px rgba(0,0,0,.35);z-index:2147483001;pointer-events:none;animation:tapGo .5s ease-out both}
    @keyframes tapGo{from{transform:scale(.35);opacity:1}to{transform:scale(1.35);opacity:0}}
    #clipHook{position:absolute;left:0;right:0;top:27%;z-index:2147483002;text-align:center;pointer-events:none;padding:0 18px;display:none}
    #clipHook.on{display:block}
    #clipHook b{display:block;font:italic 700 44px/1.05 'Chakra Petch',sans-serif;color:#fff;letter-spacing:.01em;text-shadow:0 3px 0 #000,0 0 14px rgba(0,0,0,.85);-webkit-text-stroke:1.5px #000}
    #clipHook span{display:inline-block;margin-top:8px;font:600 25px/1.2 'Bai Jamjuree',sans-serif;color:#ffd35a;text-shadow:0 2px 0 #000,0 0 10px rgba(0,0,0,.9);-webkit-text-stroke:.6px #000}
    #clipEnd{position:fixed;inset:0;z-index:2147483003;display:none;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center;padding:0 26px;
      background:radial-gradient(ellipse at center,rgba(20,16,8,.8),rgba(8,8,12,.95));color:#fff;animation:clipFade .4s ease-out both}
    #clipEnd.on{display:flex} #clipEnd img{width:82%;max-width:420px;filter:drop-shadow(0 4px 10px #000)}
    #clipEnd .tag{font:600 19px/1.3 'Bai Jamjuree',sans-serif;color:#d6d7de}
    #clipEnd .play{margin-top:10px;font:italic 700 30px/1.1 'Chakra Petch',sans-serif;color:#fff} #clipEnd .th{font:600 21px/1.2 'Bai Jamjuree',sans-serif;color:#ffd35a}
    #clipEnd .url{margin-top:6px;font:700 33px/1 'Chakra Petch',sans-serif;color:#111;background:#f2b83a;border-radius:12px;padding:12px 18px;box-shadow:0 4px 0 #8a5c00}
    #clipEnd .by{margin-top:18px;font:600 15px/1.3 'Bai Jamjuree',sans-serif;color:#9a9ba6} #clipEnd .cr{font:500 11px/1.3 'Bai Jamjuree',sans-serif;color:#6f7080;position:absolute;bottom:22px;left:0;right:0}
    @keyframes clipFade{from{opacity:0}to{opacity:1}}\`;
  document.head.appendChild(st);
  const cap = document.createElement('div'); cap.id = 'clipCap'; cap.innerHTML = '<b></b><span></span>'; cap.hidden = true;
  const hook = document.createElement('div'); hook.id = 'clipHook'; hook.innerHTML = '<b></b><span></span>';
  hook.querySelector('b').textContent = ${JSON.stringify(HOOK[0])}; hook.querySelector('span').textContent = ${JSON.stringify(HOOK[1] || '')};
  const end = document.createElement('div'); end.id = 'clipEnd';
  end.innerHTML = '<img alt="" src="${logo}"><div class="tag">Manage a Muay Thai fighter · คุมค่ายมวยไทยของคุณเอง</div><div class="play">PLAY FREE IN YOUR BROWSER</div><div class="th">เล่นฟรีบนเว็บ ไม่ต้องโหลด</div><div class="url">muay.eggpact.com</div><div class="by">RR Studio Gaming</div><div class="cr">Crowd sounds: Gregor Quendel (CC BY 4.0)</div>';
  document.body.appendChild(end);
  // the line goes where it can be seen: over the page, or inside the ring when the ring has the whole screen
  const place = () => { const box = document.querySelector('#arena.full') || document.body; if (cap.parentNode !== box) box.appendChild(cap); const a = document.getElementById('arena'); if (hook.parentNode !== a) a.appendChild(hook); };
  window.__overlay = {
    place,
    cap(en, th) { if (!en) { cap.hidden = true; return; } cap.querySelector('b').textContent = en; cap.querySelector('span').textContent = th || ''; cap.hidden = false; place(); cap.style.animation = 'none'; void cap.offsetWidth; cap.style.animation = ''; },
    // a tap where a finger would go: brought into view if it is not, a ring, then the press itself
    tap(sel) {
      const el = document.querySelector(sel); if (!el || el.disabled) return false;
      let r = el.getBoundingClientRect(); if (r.top < 150 || r.bottom > innerHeight - 40) { el.scrollIntoView({block: 'center', behavior: 'instant'}); r = el.getBoundingClientRect(); }
      const d = document.createElement('div'); d.className = 'clipTap'; d.style.left = (r.left + r.width / 2) + 'px'; d.style.top = (r.top + r.height / 2) + 'px';
      (document.querySelector('#arena.full') || document.body).appendChild(d); setTimeout(() => d.remove(), 600);
      el.click(); return true;
    },
    hook(on) { place(); hook.classList.toggle('on', !!on); },
    end() { cap.hidden = true; end.classList.add('on'); }
  };
})();`;

// ---- the browser, the page and the clock
const browser = await chromium.launch({args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']});
const context = await browser.newContext({viewport: {width: 540, height: 960}, deviceScaleFactor: 2, hasTouch: true});
const page = await context.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.addInitScript(clockScript({len: 600, t0: Date.now()}));
// the game's assets bundle carries the recorded ring music: taken out on the way in
let stripped = 0;
await page.route(/\/a\/[0-9a-f]+\.html$/, async r => { const res = await r.fetch(), body = await res.text(); if (MUSIC_PACK.test(body)) stripped++; await r.fulfill({response: res, body: body.replace(MUSIC_PACK, '')}); });
await page.exposeFunction('__pickFight', cfg => pickFight(cfg));
const ev = js => page.evaluate(js), step = ms => ev(`__clip.step(${ms})`), until = async (js, sec, stepMs = 50) => { for (let t = 0; t < sec * 1000; t += stepMs) { if (await ev(js)) return true; await step(stepMs); await page.waitForTimeout(15); } return false; };
const cdp = await context.newCDPSession(page);
await cdp.send('Emulation.setDeviceMetricsOverride', {width: 540, height: 960, deviceScaleFactor: 2, mobile: false}); // 1080×1920
const grab = async () => Buffer.from((await cdp.send('Page.captureScreenshot', {format: 'jpeg', quality: 92, captureBeyondViewport: false})).data, 'base64');

// ---- recording: every frame is one step of the clock; stretches not recorded are cut, sound and picture alike
let n = 0, lastT = null, tz = 0, tzSpan = null; const spans = [];
async function frame(teaser) {
  await step(dt); const t = await ev('__clip.t');
  writeFileSync(FR + pad(n++) + '.jpg', await grab());
  if (lastT != null && Math.abs(t - dt - lastT) < 1e-3) spans[spans.length - 1][1] = t; else spans.push([t - dt, t]);
  lastT = t;
  if (teaser) { // the same moment again with the teaser's line over it, for the opening seconds
    await ev('__overlay.hook(true)'); writeFileSync(TZ + pad(tz++) + '.jpg', await grab()); await ev('__overlay.hook(false)');
    if (tzSpan) tzSpan[1] = t; else tzSpan = [t - dt, t];
  }
  if (n % FPS === 0) process.stdout.write(`\r${T()} ${(n / FPS).toFixed(0)} s recorded, ${((Date.now() - t1) / n).toFixed(0)} ms a frame   `);
}
const rec = async (sec, each) => { const k = Math.round(sec * FPS); for (let i = 0; i < k; i++) { if (each) await each(i); await frame(); } };
const idle = async (sec, each, stepMs = 50) => { for (let t = 0; t < sec * 1000; t += stepMs) { if (each) await each(); await step(stepMs); } };
const cap = (en, th) => ev(`__overlay.cap(${JSON.stringify(en || '')}, ${JSON.stringify(th || '')})`);
const tap = async (sel, after = .6) => { const ok = await ev(`__overlay.tap(${JSON.stringify(sel)})`); if (!ok) say('could not tap', sel); await rec(after); return ok; };
// a drill note pressed on its beat (half a frame either side is well inside "perfect")
const PRESS_NOTE = `(() => { const d = GAME.drill(); if (!d || !d.ready) return; const now = (performance.now() - d.t0) / 1000;
  const n = d.notes.find(x => !x.res && x.t - now <= ${dt / 2000 + .004} && x.t - now > -.08); if (n) GAME.press(n.kind); })()`;
const pressNote = () => ev(PRESS_NOTE);
// the ring full screen, or back in the page (the game may have left full screen by itself)
const full = async on => { if (await ev("document.getElementById('arena').classList.contains('full')") !== on) await ev("document.getElementById('btnFull').click()"); await step(dt); await ev('__overlay.place()'); };

// ---- 0. the page up, the sound on
await page.goto(SITE, {timeout: 120000});
if (!await until("!!(window.MUAY && document.getElementById('gName') && document.fonts.status === 'loaded')", 120)) throw new Error('the game did not come up');
await idle(2); await ev("document.getElementById('btnSound').click()"); await idle(2.5);
if (!stripped) say('note: no recorded ring music was found in the assets (nothing to take out)');
if (await ev("!!document.getElementById('music-pack')")) throw new Error('the recorded ring music is still in the page');
await ev(OVERLAY);
await ev(`(() => { const api = window.MUAY, go = api.startFight; api.startFight = async function (cfg) { cfg.seed = await window.__pickFight({specs: cfg.specs, plans: cfg.plans, rules: cfg.rules || null}); return go.call(this, cfg); }; })()`);
say('page up');

// ---- 1. a new fighter
await cap('CREATE YOUR FIGHTER', 'สร้างนักมวยของคุณ'); await rec(1.2);
for (const [f, v] of [['shorts', 'blue'], ['gloves', 'white'], ['band', 'red']]) await tap(`[data-act=dlook][data-f=${f}][data-v=${v}]`, .55);
await ev("document.getElementById('gName').scrollIntoView({block: 'center', behavior: 'instant'})"); await rec(.3);
for (const ch of FIGHTER) { await ev(`(() => { const i = document.getElementById('gName'); i.value += ${JSON.stringify(ch)}; i.dispatchEvent(new Event('input', {bubbles: true})); })()`); await rec(2 / FPS); }
await rec(.5); await tap('[data-act=create]', 1.6);
if (!await ev('!!GAME.save()')) throw new Error('the fighter was not created: ' + await ev("document.getElementById('gCreateMsg') && document.getElementById('gCreateMsg').textContent"));
say('created', await ev('GAME.save().name'));

// ---- 2. the camp
await ev('scrollTo(0, 0)'); await cap('RUN YOUR OWN CAMP', 'ดูแลค่ายมวยของคุณ'); await rec(2.2);
const deep = await ev('Math.min(1500, document.documentElement.scrollHeight - innerHeight)');
await rec(2.2, i => ev(`scrollTo(0, ${Math.round(deep * Math.min(1, (i + 1) / (2.2 * FPS * .85)))})`)); await rec(.6);
await ev('scrollTo(0, 0)');

// ---- 3. training: two drills, every call hit on the beat
await cap('TRAIN ON THE BEAT', 'ซ้อมตามจังหวะครู'); await tap('[data-act=tab][data-v=train]', 1.0); await tap('[data-act=train][data-v=bag]', 0);
if (!await until('GAME.drill() && GAME.drill().ready', 60)) throw new Error('the bag drill did not start');
await rec(7.5, pressNote);
const lastNote = await ev('GAME.drill() ? GAME.drill().notes.at(-1).t - (performance.now() - GAME.drill().t0) / 1000 : 0');
await idle(Math.max(0, lastNote - 2), pressNote, dt);
await rec(3.2, pressNote); await until('!GAME.drill()', 10, dt);
await cap('EVERY SESSION BUILDS HIM UP', 'ซ้อมแล้วค่าพลังขึ้นทุกครั้ง'); await rec(2.6);
say('drill 1:', await ev("((document.querySelector('#gBody .gain') || {}).textContent || '').slice(0, 90)"));
await ev('scrollTo(0, 0)'); await tap('[data-act=tab][data-v=train]', .3); await cap('KICKS, KNEES, SKIPPING, SPARRING…', 'เตะ ถีบ กระโดดเชือก ซ้อมคู่…'); await tap('[data-act=train][data-v=banana]', 0);
if (await until('GAME.drill() && GAME.drill().ready', 60)) { await idle(2.1, pressNote, dt); await rec(4.2, pressNote); for (let i = 0; i < 30 * FPS && await ev('!!GAME.drill()'); i++) { await pressNote(); await step(dt); } }
await until('!GAME.drill()', 10, dt);

// ---- 4. an opponent and a plan
await ev('scrollTo(0, 0)'); await cap('PICK YOUR OPPONENT', 'เลือกคู่ชก'); await tap('[data-act=tab][data-v=fight]', 1.3);
await tap('[data-act=pick][data-v=l1]', 2.2);
await cap('SET THE GAME PLAN', 'วางแผนการชก'); await tap('.plan [data-act=plan][data-g=ag][data-v=counter]', .7); await tap('.plan [data-act=plan][data-g=range][data-v=out]', .7);
await tap('[data-act=fans][data-v=small]', 1.0);
await cap(''); await tap('[data-act=startfight]', 0);
if (!await until(`!!(window.LAB && LAB.fight && document.querySelector('.app.g-fight'))`, 240)) throw new Error('the fight did not start');
for (let i = 0; i < 200 && !(FIGHT && await ev(`LAB.cfg.seed === ${FIGHT.seed}`)); i++) { await step(50); await page.waitForTimeout(200); }
if (!FIGHT || !await ev(`LAB.cfg.seed === ${FIGHT.seed}`)) throw new Error('the chosen fight is not the one playing');
await ev('LAB.seek(0)'); await full(true);
say('fight on', await ev('MUAY.venueNow()'), 'from', await ev('LAB.state.playT'));

// ---- 5. round one: feeling out
await cap('ROUND 1: FEEL HIM OUT', 'ยก 1 ดูเชิงกันก่อน'); await rec(10.5);
// ---- 6. the break: new orders
await ev(`LAB.seek(${FIGHT.rests[0] + 2.3 - .4})`);
if (!await until("!!document.querySelector('#gBody [data-act=resume]')", 60)) throw new Error('no round break');
await full(false); await idle(.6);
await cap('BETWEEN ROUNDS: NEW ORDERS', 'พักยก สั่งแผนใหม่'); await rec(1.4);
await tap('#gBody [data-act=quick][data-v=press]', 1.1);
const plan = await ev('JSON.stringify(GAME.fight().plan)'); if (plan !== JSON.stringify(PRESS)) say('note: the order at the break is', plan, 'not', JSON.stringify(PRESS));
await tap('#gBody .btn.go.wide[data-act=resume]', .5);
await full(true);
// ---- 7. round two
if (FIGHT.r2win != null) { await ev(`LAB.seek(${FIGHT.r2win})`); await idle(.15); await cap('ROUND 2: GO FORWARD!', 'ยก 2 เดินหน้าบี้'); await rec(8); }
// ---- 8. the finish, its replay; the teaser is taken from here
await ev(`LAB.seek(${FIGHT.koT - 7})`); await idle(.15);
await cap(FIGHT.round === 3 ? 'ROUND 3: FINISH HIM' : 'THE FINISH', FIGHT.round === 3 ? 'ยก 3 ปิดฉาก' : 'ปิดฉาก');
let k = 0, overAt = null, rpOn = false, rpDone = null;
for (;;) {
  const s = await ev('({p: LAB.state.playT, m: LAB.state.mode, c: LAB.state.cer})');
  const teaser = s.m === 'live' && s.p >= FIGHT.koT - 2.2 && s.p <= FIGHT.koT + .5;
  await frame(teaser); k++;
  if (k === Math.round(4.5 * FPS)) await cap('');
  if (overAt == null && (s.p >= FIGHT.koT || s.c)) overAt = k;
  if (overAt != null) {
    if (s.m === 'replay') rpOn = true; else if (rpOn && rpDone == null) rpDone = k;
    const since = k - overAt; if ((rpDone != null && k - rpDone >= FPS) || since >= 14 * FPS || (!rpOn && since >= 9 * FPS)) break;
  }
  if (k > 40 * FPS) break;
}
// ---- 9. the pay and the ranking
if (!await until("!!document.querySelector('#gBody [data-act=home]')", 120)) say('note: no result screen');
await full(false); await idle(.5); await ev("(() => { const h = document.querySelector('#gBody h2'); if (h) h.scrollIntoView({block: 'start', behavior: 'instant'}); scrollBy(0, -150); })()");
await cap('GET PAID, CLIMB THE RANKS', 'รับเงินรางวัล ไต่อันดับ'); await rec(4.6);
const played = await ev('({how: LAB.fight.result.how, round: LAB.fight.result.round, w: LAB.fight.result.w, head: (document.querySelector("#gBody h2") || {}).textContent})');
// ---- 10. the end card
await ev('__overlay.end()'); await rec(3.0);
console.log('');

// ---- the sound, the checks, the video
const long = await ev('window.__long');
const wavFile = OUT + NAME + '.wav', secs = await soundOf(ev, [tzSpan, ...spans].filter(Boolean), wavFile);
await browser.close();
if (ringMusicIn(long).length) throw new Error('the recorded ring music played: ' + ringMusicIn(long).join(', ') + ' s');
if (played.w !== 0 || played.round !== FIGHT.round || played.how !== FIGHT.how) say(`WARNING: the fight played out otherwise than chosen: ${JSON.stringify(played)} (wanted ${FIGHT.how} round ${FIGHT.round})`);
say('result on screen:', played.head);
if (errs.length) say('page errors:', errs.slice(0, 3).join(' | '));
// the teaser first, then the rest, one numbered run of pictures
let m = 0; for (const d of [TZ, FR]) for (const f of readdirSync(d).filter(x => x.endsWith('.jpg')).sort()) symlinkSync(d + f, ALL + pad(m++) + '.jpg');
encode(ALL + '%05d.jpg', FPS, wavFile, OUT + NAME + '.mp4');
writeFileSync(OUT + NAME + '.jpg', readFileSync(TZ + pad(Math.min(tz - 1, Math.round(FPS * .8)))));
say(`${OUT}${NAME}.mp4 · ${(m / FPS).toFixed(1)} s (${tz} teaser frames + ${n}) · sound ${secs.toFixed(1)} s`);
