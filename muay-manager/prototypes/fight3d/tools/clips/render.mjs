// A short vertical clip of one fight for TikTok and the like (docs/TIKTOK_PLAN.md): the fight lab plays the fight
// (same seed, same result as anywhere else), full-screen and upright at 1080×1920, and every frame is drawn on a
// virtual clock, so the video is smooth on a machine with no graphics card and the sound is exact. The page's
// timers, animation frames, CSS animations and its audio clock all follow that clock; the sound is rendered offline
// (OfflineAudioContext) and laid under the frames. A line of text opens the clip and an end card closes it.
// usage: node tools/clips/render.mjs --seed 80 --from 80 [--name ko-80] [--hook "EN line|ไทย line"] [--fps 30] [--tail 6] [--max 50]
//        --from: the fight's second to start at (tools/clips/find-fights.mjs gives the knockout's)
// out:   dist/clips/<name>.mp4 (and <name>.jpg, a frame for a preview)
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const ROOT = new URL('../../', import.meta.url).pathname;
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const SEED = +arg('seed', 80), FROM = +arg('from', 0), FPS = +arg('fps', 30), TAIL = +arg('tail', 6), MAX = +arg('max', 50), END = +arg('end', 2.8);
const NAME = arg('name', 'clip-' + SEED), HOOK = arg('hook', 'WAIT FOR IT…|รอดูตอนจบ…').split('|');
const OUT = ROOT + 'dist/clips/', FR = OUT + NAME + '-frames/';
mkdirSync(OUT, {recursive: true}); rmSync(FR, {recursive: true, force: true}); mkdirSync(FR, {recursive: true});
if (!existsSync(ROOT + 'dist/muay-fight-lab.html')) throw new Error('no dist/muay-fight-lab.html: run node build.mjs');

// the game's own typefaces (assets/fonts) in place of the Google Fonts link
const fonts = JSON.parse(readFileSync(ROOT + 'assets/fonts/fonts.json', 'utf8'));
const fontCss = fonts.map(f => `@font-face{font-family:'${f.family}';font-style:${f.style};font-weight:${f.weight};src:url(http://lab.test/fonts/${f.file}) format('woff2');unicode-range:${f.range}}`).join('\n');
const logo = 'data:image/webp;base64,' + readFileSync(ROOT + 'assets/ui/logo.webp').toString('base64');

// Runs before the page: one clock for everything. Nothing moves until __clip.step(ms).
const CLOCK = `(() => {
  let vt = 0, rafs = [], rid = 0, tid = 0; const timers = new Map(), T0 = 1767225600000;
  let s = 0x9e3779b9; Math.random = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; // the same camera cuts every time
  performance.now = () => vt; Date.now = () => T0 + vt;
  window.requestAnimationFrame = cb => { rafs.push([++rid, cb]); return rid; };
  window.cancelAnimationFrame = id => { rafs = rafs.filter(r => r[0] !== id); };
  window.setTimeout = (fn, ms, ...a) => { const id = ++tid; timers.set(id, {at: vt + Math.max(0, +ms || 0), fn, a}); return id; };
  window.setInterval = (fn, ms, ...a) => { const id = ++tid, every = Math.max(1, +ms || 0); timers.set(id, {at: vt + every, fn, a, every}); return id; };
  window.clearTimeout = window.clearInterval = id => { timers.delete(id); };
  const anims = new WeakSet();
  // the page's sound, rendered offline on the same clock
  const SR = 48000, LEN = ${MAX + 90};
  class ClipAudio extends OfflineAudioContext {
    constructor() { super({numberOfChannels: 2, length: SR * LEN, sampleRate: SR}); window.__clipAC = this; }
    get currentTime() { return vt / 1000; } get state() { return 'running'; }
    resume() { return Promise.resolve(); } suspend() { return Promise.resolve(); } close() { return Promise.resolve(); }
  }
  window.AudioContext = window.webkitAudioContext = ClipAudio;
  window.__clip = {
    get t() { return vt; },
    step(ms) {
      const end = vt + ms;
      for (;;) { // the timers due in this step, in order
        let id = null, best = null; for (const [k, v] of timers) if (v.at <= end && (!best || v.at < best.at)) { id = k; best = v; }
        if (!best) break;
        vt = Math.max(vt, best.at); if (best.every) best.at += best.every; else timers.delete(id);
        try { typeof best.fn === 'function' ? best.fn(...best.a) : (0, eval)(best.fn); } catch (e) { console.error(e); }
      }
      vt = end;
      const due = rafs; rafs = []; for (const [, cb] of due) { try { cb(vt); } catch (e) { console.error(e); } }
      // CSS animations and transitions: held still, moved on by exactly one step (a new one starts now)
      for (const a of document.getAnimations()) { try { if (!anims.has(a)) { anims.add(a); a.pause(); a.currentTime = 0; } else { a.pause(); a.currentTime = (a.currentTime || 0) + ms; } } catch (e) { /* a finished one */ } }
    },
    // the sound from t0 to t1 (ms on the clock) as 16-bit stereo WAV, base64
    async wav(t0, t1) {
      if (!window.__clipAC) return null;
      const buf = await window.__clipAC.startRendering(), a = Math.floor(t0 / 1000 * SR), b = Math.min(buf.length, Math.floor(t1 / 1000 * SR)), n = Math.max(0, b - a);
      const L = buf.getChannelData(0), R = buf.getChannelData(1), out = new DataView(new ArrayBuffer(44 + n * 4));
      const w = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
      w(0, 'RIFF'); out.setUint32(4, 36 + n * 4, true); w(8, 'WAVEfmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 2, true);
      out.setUint32(24, SR, true); out.setUint32(28, SR * 4, true); out.setUint16(32, 4, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, n * 4, true);
      for (let i = 0; i < n; i++) { const l = Math.max(-1, Math.min(1, L[a + i])), r = Math.max(-1, Math.min(1, R[a + i])); out.setInt16(44 + i * 4, l * 32767, true); out.setInt16(46 + i * 4, r * 32767, true); }
      const u = new Uint8Array(out.buffer); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
      return btoa(s);
    }
  };
})();`;

// what sits over the fight: the opening line and the end card
const OVERLAY = `(() => {
  const st = document.createElement('style'); st.textContent = \`
    #btnFull,#fps,#replayTag{display:none!important}
    #clipHook{position:fixed;left:0;right:0;top:27%;z-index:200;text-align:center;pointer-events:none;padding:0 18px;animation:clipIn .35s cubic-bezier(.2,1.6,.4,1) both}
    #clipHook b{display:block;font:italic 700 44px/1.05 'Chakra Petch',sans-serif;color:#fff;letter-spacing:.01em;text-shadow:0 3px 0 #000,0 0 14px rgba(0,0,0,.85);-webkit-text-stroke:1.5px #000}
    #clipHook span{display:inline-block;margin-top:8px;font:600 25px/1.2 'Bai Jamjuree',sans-serif;color:#ffd35a;text-shadow:0 2px 0 #000,0 0 10px rgba(0,0,0,.9);-webkit-text-stroke:.6px #000}
    #clipHook.out{animation:clipOut .3s ease-in both}
    @keyframes clipIn{from{transform:scale(.6);opacity:0}to{transform:none;opacity:1}} @keyframes clipOut{to{transform:translateY(-14px);opacity:0}}
    #clipEnd{position:fixed;inset:0;z-index:210;display:none;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center;padding:0 26px;
      background:radial-gradient(ellipse at center,rgba(20,16,8,.78),rgba(8,8,12,.94));color:#fff;animation:clipFade .4s ease-out both}
    #clipEnd.on{display:flex} #clipEnd img{width:82%;max-width:420px;filter:drop-shadow(0 4px 10px #000)}
    #clipEnd .tag{font:600 19px/1.3 'Bai Jamjuree',sans-serif;color:#d6d7de}
    #clipEnd .play{margin-top:10px;font:italic 700 30px/1.1 'Chakra Petch',sans-serif;color:#fff} #clipEnd .th{font:600 21px/1.2 'Bai Jamjuree',sans-serif;color:#ffd35a}
    #clipEnd .url{margin-top:6px;font:700 33px/1 'Chakra Petch',sans-serif;color:#111;background:#f2b83a;border-radius:12px;padding:12px 18px;box-shadow:0 4px 0 #8a5c00}
    #clipEnd .by{margin-top:18px;font:600 15px/1.3 'Bai Jamjuree',sans-serif;color:#9a9ba6} #clipEnd .cr{font:500 11px/1.3 'Bai Jamjuree',sans-serif;color:#6f7080;position:absolute;bottom:22px;left:0;right:0}
    @keyframes clipFade{from{opacity:0}to{opacity:1}}\`;
  document.head.appendChild(st);
  // inside the ring's box: the full-screen ring is in the browser's top layer, above anything else on the page
  const box = document.getElementById('arena');
  const h = document.createElement('div'); h.id = 'clipHook'; h.innerHTML = '<b></b><span></span>'; box.appendChild(h);
  const e = document.createElement('div'); e.id = 'clipEnd';
  e.innerHTML = '<img alt="" src="${logo}"><div class="tag">Manage a Muay Thai fighter · คุมค่ายมวยไทยของคุณเอง</div><div class="play">PLAY FREE IN YOUR BROWSER</div><div class="th">เล่นฟรีบนเว็บ ไม่ต้องโหลด</div><div class="url">muay.eggpact.com</div><div class="by">RR Studio Gaming</div><div class="cr">Crowd sounds: Gregor Quendel (CC BY 4.0)</div>';
  box.appendChild(e);
  window.__overlay = {hook(a, b) { h.querySelector('b').textContent = a; h.querySelector('span').textContent = b || ''; }, hookOut() { h.classList.add('out'); }, end() { e.classList.add('on'); }};
})();`;

const browser = await chromium.launch({args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']});
const page = await (await browser.newContext({viewport: {width: 540, height: 960}, deviceScaleFactor: 2})).newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.addInitScript(CLOCK);
await page.route('**/three.min.js', r => r.fulfill({path: ROOT + 'node_modules/three/build/three.min.js', contentType: 'application/javascript'}));
await page.route('https://fonts.googleapis.com/**', r => r.fulfill({body: fontCss, contentType: 'text/css'}));
await page.route('http://lab.test/fonts/*', r => r.fulfill({path: ROOT + 'assets/fonts/' + r.request().url().split('/').pop(), contentType: 'font/woff2'}));
await page.route('http://lab.test/', r => r.fulfill({path: ROOT + 'dist/muay-fight-lab.html', contentType: 'text/html; charset=utf-8'}));
const ev = js => page.evaluate(js), step = ms => ev(`__clip.step(${ms})`);
// Chromium's own capture: Playwright's screenshot waits for an animation frame, which the page's clock holds back
const cdp = await page.context().newCDPSession(page);
await cdp.send('Emulation.setDeviceMetricsOverride', {width: 540, height: 960, deviceScaleFactor: 2, mobile: false}); // 1080×1920
const grab = async () => Buffer.from((await cdp.send('Page.captureScreenshot', {format: 'jpeg', quality: 92, captureBeyondViewport: false})).data, 'base64');
await page.goto('http://lab.test/', {timeout: 120000});
// let the page come up: its scripts wait on fonts, models and a few timers; the clock moves only when stepped
for (let i = 0; i < 600; i++) { await step(50); if (await ev('!!(window.LAB && LAB.fight && document.fonts.status === "loaded")')) break; await page.waitForTimeout(30); }
for (let i = 0; i < 40; i++) { await step(50); await page.waitForTimeout(20); }
await ev("document.getElementById('btnSound').click()"); // sound on: the game makes its AudioContext, the clip's offline one
for (let i = 0; i < 40; i++) { await step(50); await page.waitForTimeout(20); } // the sounds decode
await ev(`LAB.newFight(${SEED}); document.getElementById('btnFull').click()`);
for (let i = 0; i < 10; i++) await step(1000 / FPS);
await ev(`LAB.seek(${FROM})`);
await ev(OVERLAY); await ev(`__overlay.hook(${JSON.stringify(HOOK[0])}, ${JSON.stringify(HOOK[1] || '')})`);
for (let i = 0; i < 3; i++) await step(1000 / FPS); // the stage settles at the new moment

const info = await ev('({koT: (LAB.fight.events.find(e => e.type === "ko") || {}).t, names: LAB.fight.specs ? LAB.fight.specs.map(s => s.name) : []})');
console.log('seed', SEED, 'from', FROM, 'knockout at', info.koT, info.names.join(' vs '));
const t0 = await ev('__clip.t'), dt = 1000 / FPS;
let n = 0, endAt = null, overAt = null, hookOff = Math.round(3.2 * FPS);
const t1 = Date.now();
while (n < MAX * FPS) {
  await step(dt);
  if (n === hookOff) await ev('__overlay.hookOut()');
  if (overAt == null) { const s = await ev('LAB.state'); if (s.playT >= (info.koT || 1e9) || s.cer) overAt = n; }
  if (overAt != null && endAt == null && n - overAt >= TAIL * FPS) { endAt = n; await ev('__overlay.end()'); }
  if (endAt != null && n - endAt >= END * FPS) break;
  writeFileSync(FR + String(n).padStart(5, '0') + '.jpg', await grab());
  n++;
  if (n % FPS === 0) process.stdout.write(`\r${(n / FPS).toFixed(0)} s of video, ${((Date.now() - t1) / n).toFixed(0)} ms a frame   `);
}
console.log('');
if (endAt == null) await ev('__overlay.end()');
const tEnd = t0 + n * dt;
const wav = await ev(`__clip.wav(${t0}, ${tEnd})`);
await browser.close();
if (errs.length) console.log('page errors:', errs.slice(0, 3).join(' | '));
if (!wav) throw new Error('no sound: the game did not open its AudioContext');
writeFileSync(OUT + NAME + '.wav', Buffer.from(wav, 'base64'));
// H.264 + AAC, the sound brought to the loudness short-video apps play at (-14 LUFS)
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', FR + '%05d.jpg', '-i', OUT + NAME + '.wav',
  '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS),
  '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest', '-movflags', '+faststart', OUT + NAME + '.mp4']);
const frames = readdirSync(FR).sort(); writeFileSync(OUT + NAME + '.jpg', readFileSync(FR + frames[Math.min(frames.length - 1, Math.round(FPS * 1.2))]));
console.log(`${OUT}${NAME}.mp4 · ${(n / FPS).toFixed(1)} s · ${n} frames`);
