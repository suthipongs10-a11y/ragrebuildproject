// Presenter: plays a simulated fight in three.js. It reads the event log and never decides a result.
// One fight can be re-watched under different presentation settings to compare what feels best.
import { simulate } from './sim.js';
import { MOVES, COMBOS, STYLES, STAT_TH, RULES } from './data.js';
import { bake, EFF_NAME } from './timeline.js';
import { Fighter, EFF_JOINT } from './rig.js';
import { NP, FLAT } from './poses.js';
import { buildArena } from './arena.js';
import { buildFx } from './fx.js';
import { buildAudio } from './audio.js';
const THREE = globalThis.THREE;
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
const smooth = k => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };

// ---------- options ----------
const PRESETS = {
  broadcast: {look: 'broadcast', cam: 'side', style: 'real', slow: 1, stop: 1, shake: 1, trail: 0, labels: 0, replay: 1},
  cinema:    {look: 'cinema', cam: 'director', style: 'real', slow: 2, stop: 1, shake: 1, trail: 1, labels: 1, replay: 1},
  arcade:    {look: 'arcade', cam: 'side', style: 'toon', slow: 2, stop: 2, shake: 2, trail: 1, labels: 2, replay: 1},
  ringside:  {look: 'ringside', cam: 'low', style: 'real', slow: 1, stop: 1, shake: 1, trail: 0, labels: 0, replay: 0}
};
const PRESET_TH = {broadcast: 'ถ่ายทอดสด', cinema: 'ภาพยนตร์', arcade: 'อาร์เคด', ringside: 'ข้างเวที'};
const PRESET_NOTE = {
  broadcast: 'กล้องด้านข้างนิ่งแบบถ่ายทอดสด เอฟเฟกต์น้อย สโลว์เฉพาะตอนน็อก',
  cinema: 'กล้องผู้กำกับตัดมุมตอนท่าไม้ตายและตอนล้ม สโลว์หมัดใหญ่ แสงจัด',
  arcade: 'ตัวการ์ตูนตัดเส้น หยุดภาพและจอสั่นแรง มีป้ายชื่อท่าและตัวนับชุด',
  ringside: 'มุมต่ำข้างเวที กล้องถือมือ เหมือนคลิปจากคนดูแถวหน้า'
};
const DETAIL = [
  {key: 'cam', th: 'มุมกล้อง', opts: [['side', 'ด้านข้าง'], ['director', 'ผู้กำกับ'], ['low', 'ข้างเวที'], ['orbit', 'วนรอบ']]},
  {key: 'style', th: 'ตัวนักมวย', opts: [['real', 'สมจริง'], ['toon', 'การ์ตูน']]},
  {key: 'slow', th: 'สโลว์', opts: [[0, 'ปิด'], [1, 'ตอนน็อก'], [2, 'หมัดใหญ่']]},
  {key: 'stop', th: 'หยุดภาพตอนโดน', opts: [[0, 'ปิด'], [1, 'ปกติ'], [2, 'หนัก']]},
  {key: 'shake', th: 'จอสั่น', opts: [[0, 'ปิด'], [1, 'ปกติ'], [2, 'หนัก']]},
  {key: 'trail', th: 'เส้นความเร็ว', opts: [[0, 'ปิด'], [1, 'เปิด']]},
  {key: 'labels', th: 'ป้ายชื่อท่า', opts: [[0, 'ปิด'], [1, 'ท่าใหญ่'], [2, 'ทุกจังหวะ']]},
  {key: 'replay', th: 'ภาพช้าหมัดน็อก', opts: [[0, 'ปิด'], [1, 'เปิด']]}
];
const OPT = Object.assign({preset: 'cinema'}, PRESETS.cinema);
const REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- scene ----------
const stage = $('stage'), canvas = $('cv');
const renderer = new THREE.WebGLRenderer({canvas, antialias: true, powerPreference: 'high-performance'});
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1.5, .1, 120);
const audio = buildAudio();
let arena = null, fx = null; // built once fonts are ready, the mat texture draws text
let fighters = [], W = 0, H = 0;

function layout() {
  const w = stage.clientWidth; if (!w) return;
  const h = Math.round(w / (w < 560 ? 4 / 3 : 16 / 9));
  if (w === W && h === H) return;
  W = w; H = h; stage.style.height = h + 'px';
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}

// ---------- fight state ----------
let fight = null, TL = null, EV = [], playT = 0, stopT = 0, mode = 'live', evi = 0, speed = 1, hype = 0, shake = 0, zoomKick = 0, realT = 0;
let replayPlan = null, replayDone = false, slowWins = [], moments = [], marks = null, resultShown = false, galleryOn = false, frozen = false;
const buf = [new Float32Array(NP), new Float32Array(NP)];
const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), lastTrail = [new THREE.Vector3(), new THREE.Vector3()];

function newFight(seed) {
  fight = simulate({seed}); TL = bake(fight); EV = fight.events;
  fighters.forEach(f => scene.remove(f.root));
  fighters = [new Fighter(0, fight.specs[0].skin), new Fighter(1, fight.specs[1].skin + 1)];
  fighters.forEach(f => { scene.add(f.root); f.setStyle(OPT.style); });
  // landmarks the director and the slow motion need
  marks = {specials: [], kds: [], rests: [], bigHits: [], introEnd: RULES.introTime, ko: null, dec: null, over: fight.duration};
  let kdOpen = null, restOpen = null;
  for (const e of EV) {
    if (e.type === 'move' && e.special) marks.specials.push({t0: e.t, t1: (e.hit ? e.hit.t : e.tHit) + .75, by: e.by, hit: e.hit});
    else if (e.type === 'hit' && e.res === 'hit' && e.sev >= 3) marks.bigHits.push(e);
    else if (e.type === 'kd') { kdOpen = {t0: e.t + .5, t1: fight.duration, on: e.on, by: e.by, t: e.t}; marks.kds.push(kdOpen); }
    else if (e.type === 'getup' && kdOpen) { kdOpen.t1 = e.t + .5; kdOpen = null; }
    else if (e.type === 'ko') { marks.ko = e; if (kdOpen) { kdOpen.t1 = e.t; } }
    else if (e.type === 'decision') marks.dec = e;
    else if (e.type === 'phase') {
      if (e.phase === 'rest') { restOpen = {t0: e.t + .4, t1: fight.duration}; marks.rests.push(restOpen); }
      if (e.phase === 'fight') { if (restOpen) { restOpen.t1 = e.t - .5; restOpen = null; } if (e.round === 1) marks.introEnd = e.t; }
      if (e.phase === 'over') marks.over = e.t;
    }
  }
  moments = [];
  marks.specials.forEach(s => { if (s.hit && s.hit.res === 'hit') moments.push(s.hit.t); });
  marks.kds.forEach(k => moments.push(k.t));
  if (marks.ko) moments.push(marks.ko.t);
  moments = Array.from(new Set(moments.map(t => Math.round(t * 100) / 100))).sort((a, b) => a - b);
  // the knockout replay shows the blow that ended it
  replayPlan = null;
  if (marks.ko) {
    const ko = marks.ko, lastKd = marks.kds.length ? marks.kds[marks.kds.length - 1] : null;
    const byBlow = EV.some(e => e.type === 'hit' && e.res === 'hit' && e.t === ko.t); // otherwise counted out
    const blow = !byBlow && lastKd && lastKd.on === ko.on ? lastKd.t : ko.t;
    replayPlan = {blow, from: Math.max(0, blow - .8), to: blow + .8, trigger: ko.t + 1.55, by: ko.by};
  }
  buildSlow(); renderCards(); restart();
  $('seed').textContent = String(seed);
}
function buildSlow() {
  slowWins = [];
  if (OPT.slow >= 1 && marks.ko) { const b = replayPlan ? replayPlan.blow : marks.ko.t; slowWins.push({t0: b - .22, t1: b + 1.2, s: .22}); }
  if (OPT.slow >= 2) {
    marks.kds.forEach(k => slowWins.push({t0: k.t - .14, t1: k.t + .85, s: .3}));
    marks.specials.forEach(s => { slowWins.push({t0: s.t0, t1: s.t0 + .2, s: .45}); if (s.hit && s.hit.res === 'hit') slowWins.push({t0: s.hit.t - .13, t1: s.hit.t + .4, s: .28}); });
    marks.bigHits.forEach(e => { if (e.raw >= 19 && !e.special) slowWins.push({t0: e.t - .07, t1: e.t + .24, s: .42}); });
  }
}
function slowAt(t) {
  let s = 1;
  for (const w of slowWins) {
    if (t < w.t0 - .1 || t > w.t1 + .25) continue;
    const k = t < w.t0 ? 1 - (w.t0 - t) / .1 : t > w.t1 ? 1 - (t - w.t1) / .25 : 1;
    s = Math.min(s, lerp(1, w.s, smooth(k)));
  }
  return s;
}
const indexAt = t => { let lo = 0, hi = EV.length; while (lo < hi) { const m = (lo + hi) >> 1; if (EV[m].t <= t) lo = m + 1; else hi = m; } return lo; };

function clearOverlays() {
  $('pops').innerHTML = ''; $('result').hidden = true; $('replayTag').hidden = true; $('count').hidden = true; $('banner').hidden = true; $('combo').hidden = true;
  fx.trailClear(); resultShown = false; stage.classList.remove('slow');
}
function restart() { seek(0); }
function seek(t) {
  playT = clamp(t, 0, TL.duration); evi = indexAt(playT); mode = 'live'; stopT = 0; shake = 0; zoomKick = 0; frozen = false;
  replayDone = !!(replayPlan && playT >= replayPlan.trigger);
  clearOverlays(); cam.id = null;
  let last = '';
  for (let i = 0; i < evi; i++) if (EV[i].type === 'say') last = EV[i].html;
  $('call').innerHTML = last;
  if (playT >= marks.over) showResult();
}

// ---------- overlays ----------
const popList = [];
function pop(text, world, cls, life) {
  const el = document.createElement('div'); el.className = 'pop ' + (cls || ''); el.textContent = text;
  $('pops').appendChild(el);
  popList.push({el, w: world.clone(), t: 0, life: life || 1.05});
}
function banner(text, cls) {
  const b = $('banner'); b.textContent = text; b.className = 'banner ' + (cls || ''); b.hidden = false;
  b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
}
function flash(a) { if (REDUCED) return; const f = $('flash'); f.style.transition = 'none'; f.style.opacity = a; void f.offsetWidth; f.style.transition = 'opacity .35s'; f.style.opacity = 0; }
function fmt(t) { t = Math.max(0, Math.ceil(t)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); }
function showResult() {
  if (resultShown) return; resultShown = true;
  const r = fight.result, w = fight.specs[r.w];
  $('resM').textContent = r.how === 'คะแนน' ? 'ชนะคะแนน ครบ ' + RULES.rounds + ' ยก' : 'ชนะ' + r.how + ' ยก ' + r.round + ' นาทีที่ ' + fmt(r.time);
  $('resW').textContent = w.name; $('resW').className = 'w ' + (r.w ? 'b' : 'r');
  $('resD').textContent = (r.move ? 'ปิดเกมด้วย' + MOVES[r.move].th + ' · ' : '') + 'คะแนน ' + Math.round(r.pts[0]) + ' ต่อ ' + Math.round(r.pts[1]) +
    ' · เข้าเป้า ' + r.landed[0] + ' ต่อ ' + r.landed[1];
  $('result').hidden = false;
}

// ---------- events -> picture and sound ----------
function poseFighters(t) {
  for (let i = 0; i < 2; i++) { TL.sample(i, t, buf[i]); fighters[i].update(buf[i], 0, TL.val(i, t, 0) * .01); }
}
function handle(e) {
  const rp = mode === 'replay';
  switch (e.type) {
    case 'say': if (!rp) $('call').innerHTML = e.html; break;
    case 'bell': if (!rp) audio.bell(e.n); break;
    case 'phase':
      if (rp) break;
      if (e.phase === 'fight') banner('ยก ' + e.round, 'gold');
      else if (e.phase === 'rest') banner('หมดยก ' + e.round, '');
      else if (e.phase === 'dec') banner('ครบยก', 'gold');
      else if (e.phase === 'over') showResult();
      break;
    case 'move': {
      const m = MOVES[e.move];
      if (m.kind === 'kick' || m.special) audio.swish(m.special);
      if (m.special && !rp) {
        hype = 1; audio.roar(.3);
        if (OPT.labels >= 1) { poseFighters(e.t); pop(m.th + '!', fighters[e.by].world('head', tmpV).add(tmpV2.set(0, .45, 0)), 'gold big', .85); }
      }
      break;
    }
    case 'combo':
      if (!rp && OPT.labels >= 2) { poseFighters(e.t); pop(COMBOS[e.id].th, fighters[e.by].world('head', tmpV).add(tmpV2.set(0, .35, 0)), 'small'); }
      break;
    case 'hit': {
      const m = MOVES[e.move];
      poseFighters(e.t);
      const at = fighters[e.by], df = fighters[e.on], p = at.world(EFF_JOINT[m.eff], tmpV).clone();
      const away = df.root.position.x > at.root.position.x ? 1 : -1;
      if (e.res === 'hit') {
        const s = e.sev, ko = marks.ko && marks.ko.t === e.t;
        fx.sparks(p, [0, 7, 14, 26][s], s >= 3 ? 0xffd35a : 0xffffff, s >= 3 ? 1.5 : 1, away);
        fx.flash(p, [0, .55, .9, 1.5][s] * (OPT.look === 'arcade' ? 1.35 : 1), s >= 3 ? 0xffe9a8 : 0xffffff, s >= 3 ? .26 : .16);
        if (s >= 2) fx.ring(p, s >= 3 ? .85 : .5, s >= 3 ? 0xffd35a : 0xffffff);
        if (m.lvl === 'head' && s >= 2) fx.sweat(df.world('head', tmpV2), s >= 3 ? 16 : 7, away);
        if (m.lvl === 'body' && s >= 3) fx.sweat(p, 8, away);
        stopT = Math.max(stopT, OPT.stop * ([0, .028, .055, .085][s] + (e.special ? .03 : 0) + (ko ? .05 : 0)));
        shake = Math.max(shake, OPT.shake * [0, .012, .03, .06][s] * (REDUCED ? 0 : 1));
        if (s >= 3) zoomKick = Math.max(zoomKick, .05 * OPT.shake);
        hype = Math.min(1, hype + e.raw / 22);
        audio.hit(m.sfx, e.raw, rp);
        if (s >= 3 && !rp) audio.roar(e.special ? .8 : .35);
        if ((e.special || ko) && !rp) flash(.45);
        if (!rp) {
          const nx = EV[evi], covered = nx && nx.t === e.t && (nx.type === 'kd' || nx.type === 'ko' || nx.type === 'stun'); // that label takes the spot
          if (OPT.labels >= 1 && s >= 3 && !e.special && !covered) pop(m.th + '!', p.clone().add(tmpV2.set(0, .32, 0)), 'gold');
          if (OPT.labels >= 2 && e.counter) pop('สวน!', p.clone().add(tmpV2.set(0, .55, 0)), 'small red');
          else if (OPT.labels >= 2 && e.crit) pop('จังๆ!', p.clone().add(tmpV2.set(0, .55, 0)), 'small red');
          if (OPT.labels >= 1 && e.chain >= 3) { const c = $('combo'); c.textContent = e.chain + ' HIT'; c.className = 'combo ' + (e.by ? 'b' : 'r'); c.hidden = false; c.style.animation = 'none'; void c.offsetWidth; c.style.animation = ''; }
        }
      } else if (e.res === 'block') {
        fx.sparks(p, 5, 0xcfd6e6, .7, -away); fx.flash(p, .35, 0xcfe0ff, .12);
        stopT = Math.max(stopT, OPT.stop * .018); shake = Math.max(shake, OPT.shake * .008 * (REDUCED ? 0 : 1));
        audio.block();
        if (!rp && OPT.labels >= 2) pop('บัง', p.clone().add(tmpV2.set(0, .3, 0)), 'small');
      } else {
        audio.whiff();
        if (!rp && OPT.labels >= 2 && e.res === 'dodge') pop('หลบ!', df.world('head', tmpV2).clone().add(tmpV.set(0, .3, 0)), 'small');
      }
      break;
    }
    case 'stun':
      hype = 1; if (!rp) { audio.roar(.5); if (OPT.labels >= 1) { poseFighters(e.t); pop('เมาหมัด!', fighters[e.on].world('head', tmpV).add(tmpV2.set(0, .4, 0)), 'red'); } }
      break;
    case 'kd':
      hype = 1; if (!rp) { audio.roar(1); flash(.3); poseFighters(e.t); pop('ล้ม!', fighters[e.on].world('head', tmpV).add(tmpV2.set(0, .5, 0)), 'red big', 1.3); setTimeout(() => audio.thud(), 380); }
      break;
    case 'count': if (!rp) { const c = $('count'); c.textContent = e.n; c.hidden = false; c.style.animation = 'none'; void c.offsetWidth; c.style.animation = ''; audio.count(); } break;
    case 'getup': if (!rp) { $('count').hidden = true; audio.roar(.4); } break;
    case 'ko':
      hype = 1; $('count').hidden = true;
      if (!rp) { banner(e.how === 'น็อก' ? 'น็อก!!' : 'ทีเคโอ!', 'red huge'); audio.roar(1.2); setTimeout(() => audio.thud(), 420); }
      break;
    case 'decision': if (!rp) { banner('ชนะคะแนน', fight.result.w ? 'blue' : 'redc'); audio.roar(.8); } break;
  }
}

function advance(dt) {
  if (frozen) return 0;
  if (stopT > 0) { stopT -= dt; return 0; }
  const t0 = playT, ts = mode === 'replay' ? .3 : speed * slowAt(playT);
  let target = playT + dt * ts;
  if (mode === 'live' && replayPlan && OPT.replay && !replayDone && target >= replayPlan.trigger) {
    while (evi < EV.length && EV[evi].t <= replayPlan.trigger) handle(EV[evi++]);
    mode = 'replay'; playT = replayPlan.from; evi = indexAt(playT); fx.trailClear(); $('replayTag').hidden = false; $('banner').hidden = true; cam.id = null; stopT = 0;
    return 0;
  }
  if (mode === 'replay' && target >= replayPlan.to) {
    mode = 'live'; replayDone = true; playT = replayPlan.trigger; evi = indexAt(playT); $('replayTag').hidden = true; fx.trailClear(); cam.id = null;
    return 0;
  }
  while (evi < EV.length && EV[evi].t <= target) {
    const e = EV[evi++]; playT = e.t; handle(e);
    if (stopT > 0) return playT - t0;
  }
  playT = Math.min(target, TL.duration);
  return playT - t0;
}

// ---------- camera director ----------
const cam = {id: null, az: 0, h: 1.5, fit: 5, fitH: 2.3, tx: 0, ty: 1.05};
const shot = {id: '', az: 0, h: 1.5, fit: 5, fitH: 2.3, tx: 0, ty: 1.05, cut: false, hand: 0};
function direct(t) {
  const xa = TL.val(0, t, 0) * .01, xb = TL.val(1, t, 0) * .01, mid = (xa + xb) / 2, sep = Math.abs(xb - xa);
  const s = shot; s.cut = false; s.hand = 0; s.tx = mid; s.ty = 1.02; s.id = 'base'; s.fitH = 2.3;
  const inIntro = t < marks.introEnd, rest = marks.rests.find(r => t >= r.t0 && t < r.t1);
  if (OPT.cam === 'side') { s.az = 0; s.h = 1.45; s.fit = Math.max(3.3, sep + 2.5); }
  else if (OPT.cam === 'orbit') { s.az = .62 * Math.sin(realT * .21); s.h = 2.05; s.fit = sep + 3.0; s.ty = 1.0; }
  else if (OPT.cam === 'low') { s.az = .3 * Math.sin(realT * .15) + .12; s.h = .55; s.fit = sep + 2.3; s.fitH = 2.55; s.ty = 1.12; s.hand = 1; }
  else { s.az = .26 * Math.sin(realT * .13); s.h = 1.5; s.fit = sep < 1.25 ? sep + 2.0 : sep + 2.5; }
  if (inIntro) { const k = smooth(t / marks.introEnd); s.fit = lerp(7.4, s.fit, k); s.h = lerp(2.7, s.h, k); if (OPT.cam !== 'side') s.az = lerp(-1.3, s.az, k); }
  else if (rest) { s.fit = 7; if (OPT.cam !== 'side' && OPT.cam !== 'low') { s.az = realT * .16; s.h = 3.3; s.ty = .9; s.tx = 0; } }
  // push in just before a heavy blow lands
  let push = 0;
  for (const e of marks.bigHits) { const d = e.t - t; if (d > -.35 && d < .5) push = Math.max(push, d > 0 ? smooth(1 - d / .5) : smooth(1 + d / .35)); }
  s.fit *= 1 - push * (OPT.cam === 'director' ? .2 : .1); s.fitH *= 1 - push * (OPT.cam === 'director' ? .22 : .1);
  if (OPT.cam === 'director' && mode !== 'replay') {
    const sp = marks.specials.find(x => t >= x.t0 && t < x.t1);
    const kd = marks.kds.find(x => t >= x.t0 && t < x.t1);
    if (kd) {
      const vx = (kd.on ? xb : xa) - (kd.on ? -1 : 1) * .7;
      s.id = 'kd' + kd.t; s.cut = true; s.tx = lerp(mid, vx, .55); s.ty = .55; s.h = 1.25; s.fit = 4.4; s.fitH = 1.9; s.az = (kd.on ? -.55 : .55) + (t - kd.t0) * .04 * (kd.on ? 1 : -1);
    } else if (sp) {
      s.id = 'sp' + sp.t0; s.cut = true; s.az = sp.by ? .72 : -.72; s.h = 1.15; s.fit = sep + 2.3; s.fitH = 2.0; s.ty = 1.15;
    }
  }
  // winner
  const winT = marks.ko ? marks.ko.t + 1.75 : marks.dec ? marks.dec.t : Infinity;
  if (t >= winT && mode !== 'replay') {
    const w = fight.result.w, wx = w ? xb : xa;
    s.id = 'win'; s.cut = OPT.cam === 'director'; s.tx = wx; s.ty = 1.25; s.fit = 3.2; s.fitH = 2.2; s.h = OPT.cam === 'low' ? .6 : 1.05;
    if (OPT.cam !== 'side') s.az = (w ? .5 : -.5) + (t - winT) * .12 * (w ? -1 : 1);
  } else if (marks.ko && t >= marks.ko.t + .55 && mode !== 'replay' && OPT.cam === 'director' && !(marks.kds.find(x => t >= x.t0 && t < x.t1))) {
    const on = marks.ko.on, vx = (on ? xb : xa) - (on ? -1 : 1) * .7;
    s.id = 'kofall'; s.cut = true; s.tx = lerp(mid, vx, .5); s.ty = .55; s.h = 1.25; s.fit = 4.4; s.fitH = 1.9; s.az = on ? -.5 : .5;
  }
  if (mode === 'replay') {
    s.id = 'replay'; s.cut = true; s.tx = mid; s.ty = 1.2; s.fit = sep + 2.0; s.fitH = 1.9; s.h = 1.0; s.hand = 0;
    s.az = (replayPlan.by ? -1 : 1) * (.8 - (t - replayPlan.from) * .16);
  }
  return s;
}
function applyCamera(dt) {
  const s = direct(playT);
  if (cam.id === null || (s.cut && s.id !== cam.id) || (cam.cutId && !s.cut)) {
    cam.az = s.az; cam.h = s.h; cam.fit = s.fit; cam.fitH = s.fitH; cam.tx = s.tx; cam.ty = s.ty;
  } else {
    const k = 1 - Math.exp(-dt * 4.5), kf = 1 - Math.exp(-dt * 7);
    cam.az = lerp(cam.az, s.az, k); cam.h = lerp(cam.h, s.h, k); cam.fit = lerp(cam.fit, s.fit, kf); cam.fitH = lerp(cam.fitH, s.fitH, kf); cam.tx = lerp(cam.tx, s.tx, k); cam.ty = lerp(cam.ty, s.ty, k);
  }
  cam.id = s.id; cam.cutId = s.cut;
  const vf = camera.fov * Math.PI / 360, hf = Math.atan(Math.tan(vf) * camera.aspect);
  const D = Math.max(2.3, (cam.fit / 2) / Math.tan(hf), (cam.fitH / 2) / Math.tan(vf)) * (1 - zoomKick);
  let px = cam.tx + Math.sin(cam.az) * D, py = cam.h, pz = Math.cos(cam.az) * D, lx = cam.tx, ly = cam.ty;
  if (s.hand && !REDUCED) { px += Math.sin(realT * 1.7) * .035 + Math.sin(realT * 4.1) * .012; py += Math.sin(realT * 2.3) * .025; ly += Math.sin(realT * 3.1) * .02; lx += Math.sin(realT * 1.3) * .03; }
  if (shake > .0005) { px += (Math.random() - .5) * shake * 2; py += (Math.random() - .5) * shake * 2; ly += (Math.random() - .5) * shake; }
  camera.position.set(px, py, pz); camera.lookAt(lx, ly, 0);
  arena.fadeRopes(camera.position, OPT.cam === 'low' || OPT.cam === 'orbit');
}

// ---------- frame ----------
let last = 0, fpsAcc = 0, fpsN = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  if (!last) last = ts;
  const dt = Math.min(.05, (ts - last) / 1000); last = ts; realT += dt;
  layout(); if (!W || !TL || galleryOn) { if (galleryOn) renderer.render(scene, camera); return; }
  const adv = advance(dt);
  shake *= Math.pow(.0006, dt); zoomKick *= Math.pow(.002, dt);
  hype = Math.max(0, hype - dt * .3);
  poseFighters(playT);
  for (let i = 0; i < 2; i++) {
    fighters[i].setWear(TL.val(i, playT, 5), TL.val(i, playT, 6), TL.val(i, playT, 7));
    const ef = TL.effAt(i, playT);
    if (OPT.trail && ef && adv > 0) { const p = fighters[i].world(EFF_JOINT[EFF_NAME[ef]], tmpV); if (p.distanceToSquared(lastTrail[i]) > .0009) { fx.trailPush(i, p); lastTrail[i].copy(p); } }
  }
  const mid = (fighters[0].root.position.x + fighters[1].root.position.x) / 2;
  arena.key.position.set(mid + 1.5, 7, 4.5); arena.key.target.position.set(mid, 0, 0);
  applyCamera(dt);
  fx.update(Math.max(adv, dt * .2), camera);
  const fighting = mode === 'live' && playT > marks.introEnd && playT < marks.over;
  arena.update(realT, hype, dt); audio.update(dt, hype, fighting && !frozen, TL.clock(playT).round);
  renderer.render(scene, camera);
  hud(dt);
  fpsAcc += dt; fpsN++; if (fpsAcc > 1) { $('fps').textContent = Math.round(fpsN / fpsAcc) + ' fps'; fpsAcc = 0; fpsN = 0; }
}
function hud(dt) {
  const slow = mode === 'replay' || (speed * slowAt(playT) < .7 && OPT.slow > 0);
  stage.classList.toggle('slow', slow);
  if (mode !== 'replay') {
    const ids = ['R', 'B'];
    for (let i = 0; i < 2; i++) {
      const hp = TL.val(i, playT, 1), el = $('hp' + ids[i]);
      el.style.width = hp + '%'; el.className = hp < 30 ? 'low' : hp < 55 ? 'mid' : '';
      $('st' + ids[i]).style.width = TL.val(i, playT, 2) + '%'; $('sp' + ids[i]).style.width = TL.val(i, playT, 3) + '%';
    }
    const c = TL.clock(playT); $('rd').textContent = 'ยก ' + c.round + '/' + RULES.rounds; $('tm').textContent = fmt(c.clock);
  }
  for (let i = popList.length - 1; i >= 0; i--) {
    const p = popList[i]; p.t += dt;
    if (p.t >= p.life) { p.el.remove(); popList.splice(i, 1); continue; }
    tmpV.copy(p.w).project(camera);
    const x = clamp((tmpV.x * .5 + .5) * W, 46, W - 46), y = clamp((-tmpV.y * .5 + .5) * H - p.t * 14, H * .12 + 10, H * .88 - 10);
    p.el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) translate(-50%,-50%)';
    p.el.style.opacity = p.t > p.life - .3 ? (p.life - p.t) / .3 : 1;
  }
}

// ---------- page ----------
function renderCards() {
  [['R', 0, 'r'], ['B', 1, 'b']].forEach(c => {
    const s = fight.specs[c[1]], st = STYLES.find(x => x.id === s.style);
    $('nm' + c[0]).textContent = s.name;
    $('card' + c[0]).innerHTML = '<h2>' + s.name + '</h2><div class="sty">สาย' + st.th + ' · มุม' + (c[2] === 'r' ? 'แดง' : 'น้ำเงิน') + '</div>' +
      Object.keys(STAT_TH).map(k => '<div class="stat"><span>' + STAT_TH[k] + '</span><span class="t"><i style="width:' + s.stats[k] + '%"></i></span><span class="v">' + s.stats[k] + '</span></div>').join('') +
      '<div class="spx">ท่าไม้ตาย: ' + st.sp.map(k => MOVES[k].th).join(' · ') + '</div>';
  });
}
function applyOpt() {
  arena.setLook(OPT.look, renderer, scene);
  fighters.forEach(f => f.setStyle(OPT.style));
  fx.amount = OPT.look === 'arcade' ? 1.5 : OPT.look === 'broadcast' ? .7 : 1; fx.trailWidth = OPT.look === 'arcade' ? .13 : .085;
  stage.dataset.look = OPT.look;
  if (marks) buildSlow();
  document.querySelectorAll('#presets button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === OPT.preset)));
  document.querySelectorAll('#detail button').forEach(b => b.setAttribute('aria-pressed', String(String(OPT[b.dataset.k]) === b.dataset.v)));
  $('presetNote').textContent = OPT.preset ? PRESET_NOTE[OPT.preset] : 'ตั้งค่าเอง: ' + DETAIL.map(d => d.th + ' ' + d.opts.find(o => o[0] === OPT[d.key])[1]).join(' · ');
  cam.id = null;
}
function buildUi() {
  $('presets').innerHTML = Object.keys(PRESETS).map(k => '<button class="btn seg" data-v="' + k + '" aria-pressed="false">' + PRESET_TH[k] + '</button>').join('');
  $('presets').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; OPT.preset = b.dataset.v; Object.assign(OPT, PRESETS[b.dataset.v]); applyOpt(); });
  $('detail').innerHTML = DETAIL.map(d => '<div class="row"><span class="lab">' + d.th + '</span><span class="segs">' +
    d.opts.map(o => '<button class="btn seg sm" data-k="' + d.key + '" data-v="' + o[0] + '" aria-pressed="false">' + o[1] + '</button>').join('') + '</span></div>').join('');
  $('detail').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const d = DETAIL.find(x => x.key === b.dataset.k); OPT[d.key] = d.opts.find(o => String(o[0]) === b.dataset.v)[0];
    OPT.preset = Object.keys(PRESETS).find(k => DETAIL.every(x => PRESETS[k][x.key] === OPT[x.key]) && PRESETS[k].look === OPT.look) || '';
    applyOpt();
  });
  $('btnRematch').addEventListener('click', () => restart());
  $('btnNew').addEventListener('click', () => newFight(1 + Math.floor(Math.random() * 999999)));
  $('btnNext').addEventListener('click', () => {
    if (!moments.length) return;
    const cur = mode === 'replay' ? replayPlan.trigger : playT;
    const nx = moments.find(t => t - 1.6 > cur + .2);
    seek((nx == null ? moments[0] : nx) - 1.6);
  });
  $('btnSpeed').addEventListener('click', e => { speed = speed === 1 ? 2 : 1; e.currentTarget.setAttribute('aria-pressed', String(speed === 2)); });
  $('btnSound').addEventListener('click', e => { const on = audio.toggle(); e.currentTarget.setAttribute('aria-pressed', String(on)); e.currentTarget.textContent = on ? 'ปิดเสียง' : 'เปิดเสียง'; if (on) audio.bell(1); });
  window.addEventListener('resize', layout);
  if (window.ResizeObserver) new ResizeObserver(layout).observe(stage);
}

// hooks for tuning and automated checks
window.LAB = {
  OPT, seek, applyOpt, newFight, get fight() { return fight; }, get t() { return playT; }, get mode() { return mode; },
  set(o) { Object.assign(OPT, o); OPT.preset = o.preset || ''; applyOpt(); },
  preset(k) { OPT.preset = k; Object.assign(OPT, PRESETS[k]); applyOpt(); },
  freeze(t) { seek(t); frozen = true; },
  // play t0..t1 in fixed steps so effects and overlays are in the state a viewer would see, then hold
  runTo(t0, t1) { seek(t0); let g = 0; while (playT < t1 && g++ < 60000) { const a = advance(1 / 60); fx.update(Math.max(a, .004), camera); } frozen = true; },
  gallery(names, az, style) {
    galleryOn = true; fighters.forEach(f => { f.root.visible = false; }); arena.group.visible = false; scene.fog = null; scene.background = new THREE.Color(0x3a4150);
    (window.LAB._g || []).forEach(f => scene.remove(f.root));
    window.LAB._g = names.map((n, i) => { const f = new Fighter(0, 0); f.setStyle(style || 'real'); f.update(FLAT[n], 0, (i - (names.length - 1) / 2) * 1.3); scene.add(f.root); return f; });
    const D = names.length * 1.3 / 2 / Math.tan(Math.atan(Math.tan(camera.fov * Math.PI / 360) * camera.aspect)) + .4, a = az || 0;
    camera.position.set(Math.sin(a) * D, 1.3, Math.cos(a) * D); camera.lookAt(0, 1.0, 0);
  }
};

buildUi(); layout();
const start = () => { arena = buildArena(scene); fx = buildFx(scene); newFight(DEFAULT_SEED); applyOpt(); requestAnimationFrame(frame); };
const DEFAULT_SEED = 4207;
if (document.fonts && document.fonts.ready) document.fonts.ready.then(start, start); else start();
