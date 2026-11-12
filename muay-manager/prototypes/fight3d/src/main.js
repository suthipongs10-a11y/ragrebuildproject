// Presenter: plays a simulated fight in three.js. It reads the event log and never decides a result.
// One fight can be re-watched under different presentation settings to compare what feels best.
import { simulate } from './sim.js';
import { MOVES, COMBOS, STYLES, STAT_TH, RULES } from './data.js';
import { bake, EFF_NAME } from './timeline.js';
import { Fighter, EFF_JOINT, STYLE_BUILD, setDims, DIM_DEFAULT } from './rig.js';
import { NP, FLAT, IDX, scalePoses } from './poses.js';
import { loadModel, ModelFighter } from './model.js';
import { COLORS, PATTERNS, HEADGEAR, HAIR } from './outfit.js';
import { buildArena, VENUES } from './arena.js';
import { buildDrill, TARGETS } from './drill.js';
import { buildFx } from './fx.js';
import { buildAudio } from './audio.js';
const THREE = globalThis.THREE;
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
const smooth = k => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };

// ---------- options ----------
const PRESETS = {
  tv:        {look: 'broadcast', cam: 'tv', style: 'real', slow: 1, stop: 1, shake: 1, trail: 0, labels: 1, replay: 2},
  cinema:    {look: 'cinema', cam: 'director', style: 'real', slow: 2, stop: 1, shake: 1, trail: 1, labels: 1, replay: 1},
  ringside:  {look: 'ringside', cam: 'low', style: 'real', slow: 1, stop: 1, shake: 1, trail: 0, labels: 0, replay: 0},
  arcade:    {look: 'arcade', cam: 'side', style: 'toon', slow: 2, stop: 2, shake: 2, trail: 1, labels: 2, replay: 1}
};
const PRESET_TH = {tv: 'ถ่ายทอดสด', cinema: 'ภาพยนตร์', ringside: 'ข้างเวที', arcade: 'อาร์เคด'};
const PRESET_NOTE = {
  tv: 'ตัดสลับหลายกล้องแบบรายการมวย: กล้องหลัก กล้องแน่น กล้องมุมสูง กล้องข้างเวที และภาพหน้านักมวย มีภาพช้าช่วงพักยกและตอนน็อก',
  cinema: 'กล้องผู้กำกับตัดมุมตอนท่าไม้ตายและตอนล้ม สโลว์หมัดใหญ่ แสงจัด',
  ringside: 'มุมต่ำข้างเวที กล้องถือมือ เหมือนคลิปจากคนดูแถวหน้า',
  arcade: 'ตัวการ์ตูนตัดเส้น หยุดภาพและจอสั่นแรง มีป้ายชื่อท่าและตัวนับชุด'
};
const DETAIL = [
  {key: 'venue', th: 'เวที', opts: Object.keys(VENUES).filter(k => k !== 'camp').map(k => [k, VENUES[k]])},
  {key: 'agR', th: 'ท่าทีมุมแดง', opts: [['attack', 'เดินตี'], ['balanced', 'ดูเชิง'], ['counter', 'ตั้งรับ']]},
  {key: 'agB', th: 'ท่าทีมุมน้ำเงิน', opts: [['attack', 'เดินตี'], ['balanced', 'ดูเชิง'], ['counter', 'ตั้งรับ']]},
  {key: 'cam', th: 'มุมกล้อง', opts: [['tv', 'ถ่ายทอดสด'], ['side', 'ด้านข้าง'], ['director', 'ผู้กำกับ'], ['low', 'ข้างเวที'], ['orbit', 'วนรอบ']]},
  {key: 'fighter', th: 'ตัวนักมวย', opts: [['model', 'โมเดล 3D'], ['code', 'สร้างจากโค้ด']]},
  {key: 'build', th: 'รูปร่าง (แบบโค้ด)', opts: [['auto', 'ตามสายมวย'], ['heavy', 'ถึก'], ['athletic', 'สมส่วน'], ['lean', 'เพรียว']]},
  {key: 'style', th: 'ผิวภาพ', opts: [['real', 'สมจริง'], ['toon', 'การ์ตูน']]},
  {key: 'slow', th: 'สโลว์', opts: [[0, 'ปิด'], [1, 'ตอนน็อก'], [2, 'หมัดใหญ่']]},
  {key: 'stop', th: 'หยุดภาพตอนโดน', opts: [[0, 'ปิด'], [1, 'ปกติ'], [2, 'หนัก']]},
  {key: 'shake', th: 'จอสั่น', opts: [[0, 'ปิด'], [1, 'ปกติ'], [2, 'หนัก']]},
  {key: 'trail', th: 'เส้นความเร็ว', opts: [[0, 'ปิด'], [1, 'เปิด']]},
  {key: 'labels', th: 'ป้ายชื่อท่า', opts: [[0, 'ปิด'], [1, 'ท่าใหญ่'], [2, 'ทุกจังหวะ']]},
  {key: 'replay', th: 'ภาพช้า', opts: [[0, 'ปิด'], [1, 'ตอนน็อก'], [2, 'น็อกและพักยก']]}
];
const OPT = Object.assign({preset: 'tv', build: 'auto', fighter: 'model', venue: 'stadium', agR: 'attack', agB: 'counter'}, PRESETS.tv);
let MODEL = null, MODELS = []; // generated characters per corner, when they loaded (MODEL = shared proportions)
// Roster of base bodies. Outfit is separate, so any body can wear any look. [label, key colour of the model's shorts and gloves, flags]
// bald: no hair to dye, so the shop does not offer hair colours.
const ROSTER = {
  c: ['รุ่นเก๋า ยันต์เต็มอก', 'blue'], d: ['ช่วงยาว ผิวเข้ม', 'blue'], e: ['ฝรั่งไหล่กว้าง', 'blue'], f: ['ดาวรุ่งผมจุก', 'blue'],
  b: ['เพรียวคมกริบ', 'blue'], a: ['ตัวถึก กางเกงลายทอง', 'red'],
  i: ['มวยยุคทอง หนวดเข้ม', 'blue'], j: ['โย่งช่วงยาว ผมม้า', 'blue'], k: ['ตัวบาง ผมเสยเรียบ', 'blue'],
  g: ['เชื้อสายจีน สูงเพรียว', 'blue'], h: ['นักสู้ญี่ปุ่น ผมตั้ง', 'blue'], l: ['ฝรั่งหัวโล้น เคราแดง', 'blue', {bald: true}]
};
const LOOK = [
  {name: '', fighter: 'c', shorts: 'red', trim: 'gold', pattern: 'zigzag', gloves: 'red', head: 'mongkol', hair: 'natural'},
  {name: '', fighter: 'd', shorts: 'blue', trim: 'white', pattern: 'stripe', gloves: 'blue', head: 'mongkol', hair: 'natural'}
];
const LOOK_FIELDS = {fighter: ROSTER, shorts: COLORS, trim: COLORS, pattern: PATTERNS, gloves: COLORS, head: HEADGEAR, hair: HAIR};
const cleanName = v => String(v || '').replace(/[<>&"']/g, '').trim().slice(0, 24);
try { // remembered per viewer
  const sv = JSON.parse(localStorage.getItem('muayLabLook'));
  if (Array.isArray(sv)) sv.forEach((l, i) => { if (!LOOK[i] || !l) return; LOOK[i].name = cleanName(l.name); for (const k in LOOK_FIELDS) if (LOOK_FIELDS[k][l[k]]) LOOK[i][k] = l[k]; });
} catch (e) { /* storage unavailable: defaults apply */ }
const modelCache = {};
function ensureModel(id) { return modelCache[id] || (modelCache[id] = loadModel(id, ROSTER[id][1])); }
async function loadPair() {
  $('modelNote').textContent = 'กำลังโหลดนักมวย… ';
  try {
    MODELS = await Promise.all(LOOK.map(l => ensureModel(l.fighter)));
    for (const id in modelCache) if (!LOOK.some(l => l.fighter === id)) delete modelCache[id]; // keep memory for the two in the ring
    // both fighters share one skeleton, sized halfway between the two bodies
    const dims = {}; for (const k in MODELS[0].dims) dims[k] = (MODELS[0].dims[k] + MODELS[1].dims[k]) / 2;
    MODEL = {dims, standHips: (MODELS[0].standHips + MODELS[1].standHips) / 2};
    $('modelNote').textContent = '';
  } catch (e) {
    for (const id in modelCache) delete modelCache[id];
    MODEL = null; MODELS = []; OPT.fighter = 'code'; console.warn('3D model not loaded, using the code-built fighter:', e.message);
    $('modelNote').textContent = 'โหลดโมเดลนักมวยไม่ได้ จึงใช้ตัวที่สร้างจากโค้ดแทน (' + e.message + ') ';
  }
}
const REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- scene ----------
const stage = $('stage'), canvas = $('cv');
const renderer = new THREE.WebGLRenderer({canvas, antialias: true, powerPreference: 'high-performance'});
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1.5, .1, 120);
const audio = buildAudio();
let arena = null, fx = null, drill = null, drillF = null; // built once fonts are ready, the mat texture draws text
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
let replays = [], rpi = 0, curRp = null, tvCuts = [], builtAs = '', slowWins = [], moments = [], marks = null, resultShown = false, galleryOn = false, frozen = false;
let CFG = {seed: 1, specs: null, plans: null};                      // what the current fight was simulated from
const HOOK = {onRoundBreak: null, onOver: null}, pausedRounds = new Set(); // set by the game layer
let previewF = null, previewPose = 'guard';                         // a single fighter shown outside a fight (create, dress, camp)
const buf = [new Float32Array(NP), new Float32Array(NP)];
const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), lastTrail = [new THREE.Vector3(), new THREE.Vector3()];

const fighterKey = () => (OPT.fighter === 'model' && MODEL ? 'model' : 'code:' + OPT.build) + (OPT.venue === 'chuek' ? ':rope' : '');
// at the rope-fist ground the gloves come off
const venueLook = (look, venue) => venue === 'chuek' ? Object.assign({}, look, {gloves: 'rope'}) : look;
// The skeleton takes the proportions of whichever body is in use, and the poses scale to match.
function useDims() {
  if (OPT.fighter === 'model' && MODEL) {
    const D = DIM_DEFAULT, m = MODEL.dims, kHip = MODEL.standHips / (D.thigh + D.shin + D.ankle + D.hipY);
    const g = .88, kY = (g * kHip + m.spine + m.neck + m.head) / (g + D.spine + D.neck + D.head);
    setDims(m); scalePoses(kHip, kY);
  } else { setDims(); scalePoses(1, 1); }
}
function makeFighters() {
  fighters.forEach(f => scene.remove(f.root));
  fighters = fight.specs.map((sp, i) => OPT.fighter === 'model' && MODEL ? new ModelFighter(i, MODELS[i], venueLook(LOOK[i], OPT.venue))
    : new Fighter(i, {skin: sp.skin + i, build: OPT.build === 'auto' ? STYLE_BUILD[sp.style] : OPT.build, hair: sp.skin + sp.stats.spd + i, tattoo: (sp.stats.pow + i) % 2 === 0}));
  fighters.forEach(f => { scene.add(f.root); f.setStyle(OPT.style); });
  builtAs = fighterKey();
}
function newFight(seed, cfg) {
  CFG = Object.assign({seed, specs: null, plans: null, rules: null}, cfg || {plans: [OPT.agR, OPT.agB].map(ag => [{ag, range: 'mixed', target: 'mixed'}])}); pausedRounds.clear(); // the lab sets each corner's attitude itself
  useDims(); buildFight(); makeFighters(); renderCards(); restart();
  $('seed').textContent = String(seed);
}
// Simulates CFG and prepares everything playback needs. Same seed and same plans for the rounds already seen give the same events,
// so a plan changed at a round break only alters what comes after.
function buildFight() {
  fight = simulate({seed: CFG.seed, specs: CFG.specs ? JSON.parse(JSON.stringify(CFG.specs)) : null, plans: CFG.plans, rules: CFG.rules, names: CFG.specs ? null : LOOK.map(l => cleanName(l.name))});
  TL = bake(fight); EV = fight.events;
  // landmarks the director and the slow motion need
  marks = {scores: [], specials: [], kds: [], rests: [], stuns: [], clinches: [], bigHits: [], hits: [], rounds: [], introEnd: RULES.introTime, ko: null, dec: null, decPhase: null, over: fight.duration};
  let kdOpen = null, restOpen = null, stunOpen = [null, null], round = null, clinchOpen = null;
  for (const e of EV) {
    if (e.type === 'move' && e.special) marks.specials.push({t0: e.t, t1: (e.hit ? e.hit.t : e.tHit) + .75, by: e.by, hit: e.hit});
    else if (e.type === 'hit') { marks.hits.push(e.t); if (e.res === 'hit' && e.sev >= 3) marks.bigHits.push(e); if (e.res === 'hit' && round && (!round.best || e.raw + (e.special ? 8 : 0) > round.best.raw + (round.best.special ? 8 : 0))) round.best = e; }
    else if (e.type === 'stun') { stunOpen[e.on] = {t0: e.t, t1: e.t + e.dur, on: e.on}; marks.stuns.push(stunOpen[e.on]); }
    else if (e.type === 'stun_end' && stunOpen[e.on]) { stunOpen[e.on].t1 = e.t; stunOpen[e.on] = null; }
    else if (e.type === 'kd') { kdOpen = {t0: e.t + .5, t1: fight.duration, on: e.on, by: e.by, t: e.t, up: null}; marks.kds.push(kdOpen); if (stunOpen[e.on]) { stunOpen[e.on].t1 = e.t; stunOpen[e.on] = null; } if (round) round.kd = e; }
    else if (e.type === 'getup' && kdOpen && !e.thrown) { kdOpen.t1 = e.t + .5; kdOpen.up = e.t; kdOpen = null; }
    else if (e.type === 'ko') { marks.ko = e; if (kdOpen) { kdOpen.t1 = e.t; } }
    else if (e.type === 'clinch') { clinchOpen = {t0: e.t, t1: e.t + 4}; marks.clinches.push(clinchOpen); }
    else if (e.type === 'break' && clinchOpen) { clinchOpen.t1 = e.t; clinchOpen = null; }
    else if (e.type === 'decision') marks.dec = e;
    else if (e.type === 'score') marks.scores.push(e);
    else if (e.type === 'phase') {
      if (e.phase === 'rest') { restOpen = {t: e.t, t0: e.t + .4, t1: fight.duration, round}; marks.rests.push(restOpen); }
      if (e.phase === 'fight') { if (restOpen) { restOpen.t1 = e.t - .5; restOpen = null; } if (e.round === 1) marks.introEnd = e.t; round = {n: e.round, t0: e.t, best: null, kd: null}; marks.rounds.push(round); }
      if (e.phase === 'dec') marks.decPhase = e.t;
      if (e.phase === 'over') marks.over = e.t;
    }
  }
  moments = [];
  marks.specials.forEach(s => { if (s.hit && s.hit.res === 'hit') moments.push(s.hit.t); });
  marks.kds.forEach(k => moments.push(k.t));
  if (marks.ko) moments.push(marks.ko.t);
  moments = Array.from(new Set(moments.map(t => Math.round(t * 100) / 100))).sort((a, b) => a - b);
  // replays: the best moment of each round during the break, and the blow that ended the fight
  replays = [];
  marks.rests.forEach(r => {
    const b = r.round && (r.round.kd || r.round.best);
    if (b && (b.type === 'kd' || b.raw >= 15)) replays.push({kind: 'round', n: r.round.n, blow: b.t, from: Math.max(0, b.t - .75), to: b.t + .65, trigger: r.t + .9, by: b.by});
  });
  if (marks.ko) {
    const ko = marks.ko, lastKd = marks.kds.length ? marks.kds[marks.kds.length - 1] : null;
    const byBlow = EV.some(e => e.type === 'hit' && e.res === 'hit' && e.t === ko.t); // otherwise counted out
    const blow = !byBlow && lastKd && lastKd.on === ko.on ? lastKd.t : ko.t;
    replays.push({kind: 'ko', blow, from: Math.max(0, blow - .8), to: blow + .8, trigger: ko.t + 1.55, by: ko.by});
  }
  marks.rests.forEach(r => { r.pauseAt = r.t + 2.3; });
  buildTv(); buildSlow();
}
const replayOn = r => r.kind === 'ko' ? OPT.replay >= 1 : OPT.replay >= 2;

// Broadcast cut list: which camera is live at each moment. Built once per fight so the same fight always cuts the same way.
function buildTv() {
  let a = (fight.seed ^ 0x51ed27) >>> 0;
  const R = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
  const forced = [], add = (t, cam, who, hold) => forced.push({t, cam, who: who == null ? -1 : who, hold: hold || 0});
  add(0, 'high', -1, 1.2); add(1.2, 'face', 0, .8); add(2.0, 'face', 1, .8); add(marks.introEnd - .15, 'main', -1, 2.5);
  marks.kds.forEach(k => {
    add(k.t + .8, 'low', k.on, 1.5); add(k.t + 2.3, 'face', k.by, 1.3); add(k.t + 3.6, 'main', -1, 1);
    if (k.up != null) { add(k.up + .1, 'face', k.on, 1.3); add(k.up + 1.4, 'main', -1, 1.5); }
  });
  marks.stuns.forEach(st => { if (st.t1 - st.t0 > .8) add(st.t0 + .25, 'tight', -1, st.t1 - st.t0); });
  marks.clinches.forEach(c => { if (c.t1 - c.t0 > .9) add(c.t0 + .3, 'tight', -1, c.t1 - c.t0); });
  marks.rests.forEach(r => { add(r.t + .25, 'high', -1, .9); add(r.t + 1.2, 'face', 0, .9); add(r.t + 2.1, 'face', 1, .9); add(r.t1 + .3, 'main', -1, 2.5); });
  if (marks.ko) { add(marks.ko.t + .85, 'low', marks.ko.on, 9); add(marks.ko.t + 1.75, 'face', marks.ko.by, 99); }
  if (marks.decPhase != null) { add(marks.decPhase + .2, 'high', -1, 9); if (marks.dec) add(marks.dec.t + .1, 'face', marks.dec.w, 99); }
  forced.sort((x, y) => x.t - y.t);
  const quiet = t => !marks.hits.some(h => h > t - .3 && h < t + .7) && !marks.specials.some(sp => t > sp.t0 - .3 && t < sp.t1);
  const cycle = ['tight', 'main', 'low', 'main', 'tight', 'main', 'high', 'main'], end = marks.ko ? marks.ko.t : marks.decPhase != null ? marks.decPhase : marks.over;
  const cuts = forced.slice();
  let ci = 0, next = marks.introEnd + 4 + R() * 3, fi = 0, busy = 0;
  for (let t = marks.introEnd; t < end; t += .1) {
    while (fi < forced.length && forced[fi].t <= t) { busy = Math.max(busy, forced[fi].t + forced[fi].hold + 1.2); fi++; }
    if (t < next || t < busy || !quiet(t)) continue;
    if (fi < forced.length && forced[fi].t - t < 1.6) continue;
    if (marks.rests.some(r => t > r.t - .5 && t < r.t1 + 1)) continue;
    const cam = cycle[ci++ % cycle.length];
    cuts.push({t, cam, who: -1, hold: 0}); next = t + (cam === 'main' ? 5 + R() * 4 : 2.8 + R() * 1.8);
  }
  tvCuts = cuts.sort((x, y) => x.t - y.t);
}
const tvCutAt = t => { let c = tvCuts[0]; for (const x of tvCuts) { if (x.t > t) break; c = x; } return c; };

function buildSlow() {
  slowWins = [];
  const koRp = replays.find(r => r.kind === 'ko');
  if (OPT.slow >= 1 && koRp) slowWins.push({t0: koRp.blow - .22, t1: koRp.blow + 1.2, s: .22});
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
  $('pops').innerHTML = ''; $('result').hidden = true; $('replayTag').hidden = true; $('count').hidden = true; $('banner').hidden = true; $('combo').hidden = true; $('scorecard').hidden = true;
  fx.trailClear(); resultShown = false; stage.classList.remove('slow');
}
function restart() { seek(0); }
function seek(t) {
  playT = clamp(t, 0, TL.duration); evi = indexAt(playT); mode = 'live'; stopT = 0; shake = 0; zoomKick = 0; frozen = false;
  rpi = replays.findIndex(r => r.trigger > playT); if (rpi < 0) rpi = replays.length; curRp = null;
  clearOverlays(); cam.id = null;
  let last = '';
  for (let i = 0; i < evi; i++) if (EV[i].type === 'say') last = EV[i].html;
  $('call').innerHTML = last;
  if (playT >= marks.over) finish();
}
function finish() { if (HOOK.onOver) { if (!resultShown) { resultShown = true; HOOK.onOver(fight.result); } } else showResult(); }

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
  $('resD').textContent = (r.move ? 'ปิดเกมด้วย' + MOVES[r.move].th + ' · ' : '') + 'แต้ม ' + r.pts[0] + ' ต่อ ' + r.pts[1] + (r.how === 'คะแนน' && r.pts[0] === r.pts[1] ? ' (แต้มเท่ากัน ตัดสินจากความเสียหายที่ทำได้)' : '') +
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
    case 'score':
      if (!rp) { $('scR').textContent = e.pts[0]; $('scB').textContent = e.pts[1]; $('scT').textContent = 'หมดยก ' + e.round + ' · ยกนี้ ' + e.rpts[0] + ' : ' + e.rpts[1] + ' · แต้มรวม'; $('scorecard').hidden = false; }
      break;
    case 'clinch':
      hype = Math.min(1, hype + .3);
      if (!rp && OPT.labels >= 1) { poseFighters(e.t); pop('กอดคอตีเข่า!', fighters[e.by].world('head', tmpV).add(tmpV2.set(0, .4, 0)), 'gold'); }
      break;
    case 'throw':
      if (e.ok) { hype = 1; shake = Math.max(shake, OPT.shake * .04 * (REDUCED ? 0 : 1)); if (!rp) { audio.roar(.7); setTimeout(() => audio.thud(), 330); if (OPT.labels >= 1) { poseFighters(e.t); pop('+' + RULES.throwPoints + ' แต้ม', fighters[e.by].world('head', tmpV).add(tmpV2.set(0, .45, 0)), 'gold', 1.3); pop(e.teep ? 'ถีบล้ม!' : 'เหวี่ยงล้ม!', fighters[e.on].world('head', tmpV).add(tmpV2.set(0, .4, 0)), 'gold big', 1.2); } } }
      break;
    case 'break':
      if (!rp && e.reason === 'elbow' && OPT.labels >= 1) { poseFighters(e.t); pop('ศอกสวนหลุด!', fighters[e.on].world('head', tmpV).add(tmpV2.set(0, .45, 0)), 'gold', 1.2); }
      else if (!rp && OPT.labels >= 2) { poseFighters(e.t); pop(e.reason === 'escape' ? 'สะบัดหลุด' : 'กรรมการแยก', fighters[e.on].world('head', tmpV).add(tmpV2.set(0, .4, 0)), 'small'); }
      break;
    case 'guard':
      if (!rp && OPT.labels >= 2) { poseFighters(e.t); pop('ตั้งการ์ด', fighters[e.by].world('head', tmpV).add(tmpV2.set(0, .35, 0)), 'small'); }
      break;
    case 'phase':
      if (rp) break;
      if (e.phase === 'fight') banner('ยก ' + e.round, 'gold');
      else if (e.phase === 'rest') banner('หมดยก ' + e.round, '');
      if (e.phase === 'fight') $('scorecard').hidden = true;
      else if (e.phase === 'dec') banner('ครบยก', 'gold');
      else if (e.phase === 'over') finish();
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
          if (OPT.labels >= 1 && (s >= 3 || m.inClinch && m.sfx === 'elbow') && !e.special && !covered) pop((m.inClinch && m.sfx === 'elbow' ? 'ศอก' : m.th) + '!', p.clone().add(tmpV2.set(0, .32, 0)), 'gold');
          if (OPT.labels >= 2 && e.counter) pop('สวน!', p.clone().add(tmpV2.set(0, .55, 0)), 'small red');
          else if (OPT.labels >= 2 && e.crit) pop('จังๆ!', p.clone().add(tmpV2.set(0, .55, 0)), 'small red');
          if (OPT.labels >= 1 && e.chain >= 3) { const c = $('combo'); c.textContent = e.chain + ' HIT'; c.className = 'combo ' + (e.by ? 'b' : 'r'); c.hidden = false; c.style.animation = 'none'; void c.offsetWidth; c.style.animation = ''; }
        }
      } else if (e.res === 'block') {
        fx.sparks(p, 5, 0xcfd6e6, .7, -away); fx.flash(p, .35, 0xcfe0ff, .12);
        stopT = Math.max(stopT, OPT.stop * .018); shake = Math.max(shake, OPT.shake * .008 * (REDUCED ? 0 : 1));
        audio.block();
        if (!rp && m.inClinch && m.sfx === 'elbow' && OPT.labels >= 1) pop('กันศอกได้', p.clone().add(tmpV2.set(0, .32, 0)), 'small', 1.1);
        else if (!rp && OPT.labels >= 2) pop('บัง', p.clone().add(tmpV2.set(0, .3, 0)), 'small');
      } else if (e.res === 'catch') {
        audio.block(); hype = Math.min(1, hype + .35);
        if (!rp && OPT.labels >= 1) pop('จับขา!', df.world('haL', tmpV2).clone().add(tmpV.set(0, .35, 0)), 'gold');
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
      hype = 1; if (!rp) { audio.roar(1); flash(.3); poseFighters(e.t); pop('ล้ม!', fighters[e.on].world('head', tmpV).add(tmpV2.set(0, .5, 0)), 'red big', 1.3); pop('+' + RULES.kdPoints + ' แต้ม', fighters[e.by].world('head', tmpV).add(tmpV2.set(0, .5, 0)), 'gold big', 1.6); setTimeout(() => audio.thud(), 380); }
      break;
    case 'count': if (!rp) { const c = $('count'); c.textContent = e.n; c.hidden = false; c.style.animation = 'none'; void c.offsetWidth; c.style.animation = ''; audio.count(); } break;
    case 'getup': if (!rp && !e.thrown) { $('count').hidden = true; audio.roar(.4); } break;
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
  if (mode === 'live' && HOOK.onRoundBreak) { // the corner gets a moment to change the plan
    const rb = marks.rests.find(r => r.round && !pausedRounds.has(r.round.n) && playT < r.pauseAt && target >= r.pauseAt && !(rpi < replays.length && replays[rpi].trigger <= r.pauseAt && replayOn(replays[rpi])));
    if (rb) {
      while (evi < EV.length && EV[evi].t <= rb.pauseAt) handle(EV[evi++]);
      playT = rb.pauseAt; pausedRounds.add(rb.round.n); frozen = true; HOOK.onRoundBreak(rb.round.n, roundStats(rb.round.n));
      return 0;
    }
  }
  if (mode === 'live' && rpi < replays.length && target >= replays[rpi].trigger) {
    const r = replays[rpi];
    while (evi < EV.length && EV[evi].t <= r.trigger) handle(EV[evi++]);
    if (!replayOn(r)) { rpi++; playT = Math.min(target, TL.duration); return playT - t0; }
    mode = 'replay'; curRp = r; playT = r.from; evi = indexAt(playT); fx.trailClear(); stopT = 0; cam.id = null;
    $('replayTag').textContent = r.kind === 'round' ? 'ภาพช้า ยก ' + r.n : 'ภาพช้า'; $('replayTag').hidden = false; $('banner').hidden = true; $('scorecard').hidden = true;
    return 0;
  }
  if (mode === 'replay' && target >= curRp.to) {
    if (curRp.kind === 'round') $('scorecard').hidden = false; // back to the break: bring the round score back up
    mode = 'live'; playT = curRp.trigger; evi = indexAt(playT); rpi++; curRp = null; $('replayTag').hidden = true; fx.trailClear(); cam.id = null;
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
// A shot is either an orbit around the action (az, h, fitted distance) or a fixed broadcast position with a zoom lens.
const cam = {id: null, az: 0, h: 1.5, fit: 5, fitH: 2.3, tx: 0, ty: 1.05, px: 0, py: 2, pz: 8, fixed: false};
const shot = {id: '', az: 0, h: 1.5, fit: 5, fitH: 2.3, tx: 0, ty: 1.05, px: 0, py: 0, pz: 0, fixed: false, cut: false, hand: 0, ropes: 0};
function direct(t) {
  const xa = TL.val(0, t, 0) * .01, xb = TL.val(1, t, 0) * .01, mid = (xa + xb) / 2, sep = Math.abs(xb - xa);
  const s = shot; s.cut = false; s.hand = 0; s.tx = mid; s.ty = 1.02; s.id = 'base'; s.fitH = 2.3; s.fixed = false; s.ropes = 0;
  const inIntro = t < marks.introEnd, rest = marks.rests.find(r => t >= r.t0 && t < r.t1);
  let push = 0;
  for (const e of marks.bigHits) { const d = e.t - t; if (d > -.35 && d < .5) push = Math.max(push, d > 0 ? smooth(1 - d / .5) : smooth(1 + d / .35)); }
  if (mode === 'replay') {
    s.id = 'replay'; s.cut = true; s.tx = mid; s.ty = 1.2; s.fit = sep + 2.0; s.fitH = 1.9; s.h = 1.0;
    s.az = (curRp.by ? -1 : 1) * (.8 - (t - curRp.from) * .16);
    return s;
  }
  if (OPT.cam === 'tv') {
    const c = tvCutAt(t), who = c.who, wx = who === 1 ? xb : xa, flip = (Math.floor(c.t * 3) % 2) ? 1 : -1;
    s.id = 'tv' + c.t + c.cam; s.cut = true; s.fixed = true; s.ropes = .45;
    if (c.cam === 'main') { s.px = mid * .3; s.py = 2.55; s.pz = 8.8; s.fit = sep + 2.7; s.fitH = 2.5; s.ty = 1.0; }
    else if (c.cam === 'tight') { s.px = mid * .3; s.py = 1.8; s.pz = 8.4; s.fit = sep + 1.5; s.fitH = 1.75; s.ty = 1.2; }
    else if (c.cam === 'high') { s.px = flip * 6.6; s.py = 4.6; s.pz = 6.6; s.tx = mid * .6; s.ty = .8; s.fit = sep + 4.2; s.fitH = 3.5; }
    else if (c.cam === 'low') {
      s.px = mid + flip * 1.4; s.py = .55; s.pz = 4.75; s.hand = 1; s.fit = sep + 2.3; s.fitH = 2.5; s.ty = 1.08; s.ropes = .45;
      if (who >= 0) { s.px = wx + (who ? -1.6 : 1.6); s.py = 1.1; s.tx = lerp(mid, wx - (who ? -.7 : .7), .6); s.ty = .5; s.fit = 3.6; s.fitH = 2.0; s.ropes = .18; }
    } else { s.px = wx * .4; s.py = 1.85; s.pz = 8.6; s.tx = wx; s.ty = 1.42; s.fit = 1.25; s.fitH = 1.1; }
    if (c.cam === 'main' || c.cam === 'tight') { s.fit *= 1 - push * .12; s.fitH *= 1 - push * .12; }
    return s;
  }
  if (OPT.cam === 'side') { s.az = 0; s.h = 1.45; s.fit = Math.max(3.3, sep + 2.5); }
  else if (OPT.cam === 'orbit') { s.az = .62 * Math.sin(realT * .21); s.h = 2.05; s.fit = sep + 3.0; s.ty = 1.0; s.ropes = 1; }
  else if (OPT.cam === 'low') { s.az = .3 * Math.sin(realT * .15) + .12; s.h = .55; s.fit = sep + 2.3; s.fitH = 2.55; s.ty = 1.12; s.hand = 1; s.ropes = 1; }
  else { s.az = .26 * Math.sin(realT * .13); s.h = 1.5; s.fit = sep < 1.25 ? sep + 2.0 : sep + 2.5; }
  if (inIntro) { const k = smooth(t / marks.introEnd); s.fit = lerp(7.4, s.fit, k); s.h = lerp(2.7, s.h, k); if (OPT.cam !== 'side') s.az = lerp(-1.3, s.az, k); }
  else if (rest) { s.fit = 7; if (OPT.cam !== 'side' && OPT.cam !== 'low') { s.az = realT * .16; s.h = 3.3; s.ty = .9; s.tx = 0; } }
  s.fit *= 1 - push * (OPT.cam === 'director' ? .2 : .1); s.fitH *= 1 - push * (OPT.cam === 'director' ? .22 : .1);
  if (OPT.cam === 'director') {
    const sp = marks.specials.find(x => t >= x.t0 && t < x.t1);
    const kd = marks.kds.find(x => t >= x.t0 && t < x.t1);
    if (kd) {
      const vx = (kd.on ? xb : xa) - (kd.on ? -1 : 1) * .7;
      s.id = 'kd' + kd.t; s.cut = true; s.tx = lerp(mid, vx, .55); s.ty = .55; s.h = 1.25; s.fit = 4.4; s.fitH = 1.9; s.az = (kd.on ? -.55 : .55) + (t - kd.t0) * .04 * (kd.on ? 1 : -1);
    } else if (sp) {
      s.id = 'sp' + sp.t0; s.cut = true; s.az = sp.by ? .72 : -.72; s.h = 1.15; s.fit = sep + 2.3; s.fitH = 2.0; s.ty = 1.15;
    }
  }
  const winT = marks.ko ? marks.ko.t + 1.75 : marks.dec ? marks.dec.t : Infinity;
  if (t >= winT) {
    const w = fight.result.w, wx = w ? xb : xa;
    s.id = 'win'; s.cut = OPT.cam === 'director'; s.tx = wx; s.ty = 1.25; s.fit = 3.2; s.fitH = 2.2; s.h = OPT.cam === 'low' ? .6 : 1.05;
    if (OPT.cam !== 'side') s.az = (w ? .5 : -.5) + (t - winT) * .12 * (w ? -1 : 1);
  } else if (marks.ko && t >= marks.ko.t + .55 && OPT.cam === 'director' && !(marks.kds.find(x => t >= x.t0 && t < x.t1))) {
    const on = marks.ko.on, vx = (on ? xb : xa) - (on ? -1 : 1) * .7;
    s.id = 'kofall'; s.cut = true; s.tx = lerp(mid, vx, .5); s.ty = .55; s.h = 1.25; s.fit = 4.4; s.fitH = 1.9; s.az = on ? -.5 : .5;
  }
  return s;
}
function applyCamera(dt) {
  const s = direct(playT);
  if (cam.id === null || (s.cut && s.id !== cam.id) || (cam.cutId && !s.cut) || cam.fixed !== s.fixed) {
    cam.az = s.az; cam.h = s.h; cam.fit = s.fit; cam.fitH = s.fitH; cam.tx = s.tx; cam.ty = s.ty; cam.px = s.px; cam.py = s.py; cam.pz = s.pz;
  } else {
    const k = 1 - Math.exp(-dt * 4.5), kf = 1 - Math.exp(-dt * (s.fixed ? 3.2 : 7));
    cam.az = lerp(cam.az, s.az, k); cam.h = lerp(cam.h, s.h, k); cam.fit = lerp(cam.fit, s.fit, kf); cam.fitH = lerp(cam.fitH, s.fitH, kf);
    cam.tx = lerp(cam.tx, s.tx, k); cam.ty = lerp(cam.ty, s.ty, k); cam.px = lerp(cam.px, s.px, k); cam.py = lerp(cam.py, s.py, k); cam.pz = lerp(cam.pz, s.pz, k);
  }
  cam.id = s.id; cam.cutId = s.cut; cam.fixed = s.fixed;
  let px, py, pz, lx = cam.tx, ly = cam.ty, fov = 30;
  if (s.fixed) { // fixed position, the lens zooms to frame the action
    px = cam.px; py = cam.py; pz = cam.pz;
    const dist = Math.hypot(px - lx, py - ly, pz), half = Math.max(cam.fitH / 2, cam.fit / 2 / camera.aspect) * (1 - zoomKick);
    fov = clamp(2 * Math.atan(half / dist) * 180 / Math.PI, 4, 50);
  } else {
    const vf = 15 * Math.PI / 180, hf = Math.atan(Math.tan(vf) * camera.aspect);
    const D = Math.max(2.3, (cam.fit / 2) / Math.tan(hf), (cam.fitH / 2) / Math.tan(vf)) * (1 - zoomKick);
    px = cam.tx + Math.sin(cam.az) * D; py = cam.h; pz = Math.cos(cam.az) * D;
  }
  if (Math.abs(camera.fov - fov) > .01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  const sway = s.fixed ? fov / 30 : 1; // a long lens magnifies every wobble, so scale it down
  if (s.hand && !REDUCED) { px += Math.sin(realT * 1.7) * .035 + Math.sin(realT * 4.1) * .012; py += Math.sin(realT * 2.3) * .025; ly += Math.sin(realT * 3.1) * .02; lx += Math.sin(realT * 1.3) * .03; }
  if (shake > .0005) { const k = s.fixed ? 2.5 : 1; lx += (Math.random() - .5) * shake * 2 * k * sway; ly += (Math.random() - .5) * shake * 2 * k * sway; if (!s.fixed) { px += (Math.random() - .5) * shake * 2; py += (Math.random() - .5) * shake * 2; } }
  camera.position.set(px, py, pz); camera.lookAt(lx, ly, 0);
  arena.fadeRopes(camera.position, s.ropes);
}

// ---------- frame ----------
let last = 0, fpsAcc = 0, fpsN = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  if (!last) last = ts;
  const dt = Math.min(.05, (ts - last) / 1000); last = ts; realT += dt;
  layout();
  if (drill && drill.on && W) { // training: the fighter works a target, the game layer calls the strikes
    drill.update(dt, realT, buf[0]); drillF.setWear(0, 0, 0);
    if (camera.fov !== 30) { camera.fov = 30; camera.updateProjectionMatrix(); }
    const sh = REDUCED ? 0 : drill.shake, far = camera.aspect < 1.5 ? 4.5 : 4.1;
    camera.position.set(.3 + (Math.random() - .5) * sh, 1.3 + (Math.random() - .5) * sh, far * (1 - drill.kick)); camera.lookAt(.1, 1.02, 0);
    arena.keyAt(0); arena.fadeRopes(camera.position, 0);
    arena.update(realT, 0, dt); fx.update(dt, camera); renderer.render(scene, camera); movePops(dt); return;
  }
  if (previewF && W) { // one fighter, slow orbit
    const P = buf[0]; P.set(FLAT[previewPose] || FLAT.guard);
    if (previewPose === 'guard') { const b = realT * 5.2; P[IDX.fL + 1] += Math.max(0, Math.sin(b)) * .04; P[IDX.hip + 1] += Math.sin(b) * .012; P[IDX.hL + 1] += Math.sin(b + 1) * .01; }
    previewF.update(P, 0, 0); previewF.setWear(0, 0, 0);
    if (camera.fov !== 30) { camera.fov = 30; camera.updateProjectionMatrix(); }
    const az = .55 * Math.sin(realT * .35) + .5, D = 3.5;
    camera.position.set(Math.sin(az) * D, 1.25, Math.cos(az) * D); camera.lookAt(0, .92, 0);
    arena.keyAt(0); arena.fadeRopes(camera.position, .25);
    arena.update(realT, .05, dt); fx.update(dt, camera); renderer.render(scene, camera); return;
  }
  if (!W || !TL || galleryOn) { if (galleryOn) renderer.render(scene, camera); return; }
  const adv = advance(dt);
  shake *= Math.pow(.0006, dt); zoomKick *= Math.pow(.002, dt);
  hype = Math.max(0, hype - dt * .3);
  poseFighters(playT);
  const pre = playT < marks.introEnd - .25;
  for (let i = 0; i < 2; i++) {
    fighters[i].setMongkol(pre);
    fighters[i].setWear(TL.val(i, playT, 5), TL.val(i, playT, 6), TL.val(i, playT, 7));
    const ef = TL.effAt(i, playT);
    if (OPT.trail && ef && adv > 0) { const p = fighters[i].world(EFF_JOINT[EFF_NAME[ef]], tmpV); if (p.distanceToSquared(lastTrail[i]) > .0009) { fx.trailPush(i, p); lastTrail[i].copy(p); } }
  }
  const mid = (fighters[0].root.position.x + fighters[1].root.position.x) / 2;
  arena.keyAt(mid);
  applyCamera(dt);
  if (window.LAB.eye) { const e = window.LAB.eye; camera.position.set(e[0], e[1], e[2]); camera.lookAt(e[3], e[4], e[5]); camera.fov = e[6] || 40; camera.updateProjectionMatrix(); arena.fadeRopes(camera.position, 1); } // fixed viewpoint for checks
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
  $('liveTag').hidden = !(OPT.cam === 'tv' && mode === 'live' && playT < marks.over);
  if (mode !== 'replay') {
    const ids = ['R', 'B'];
    for (let i = 0; i < 2; i++) {
      const hp = TL.val(i, playT, 1), el = $('hp' + ids[i]);
      el.style.width = hp + '%'; el.className = hp < 30 ? 'low' : hp < 55 ? 'mid' : '';
      $('st' + ids[i]).style.width = TL.val(i, playT, 2) + '%'; $('sp' + ids[i]).style.width = TL.val(i, playT, 3) + '%';
    }
    // The number by each name is the fighter's points, live: it goes up the moment a strike lands clean or the other man goes down.
    // Under the clock: the points scored in the round being fought.
    const pa = Math.round(TL.val(0, playT, 8)), pb = Math.round(TL.val(1, playT, 8));
    let r0 = -1; for (const r of marks.rounds) if (r.t0 <= playT) r0 = r.t0;
    const inRest = marks.rests.some(r => playT >= r.t && playT < r.t1 + .5), live = r0 >= 0 && !inRest && (marks.decPhase == null || playT < marks.decPhase);
    $('ld').textContent = live ? 'ยกนี้ ' + (pa - Math.round(TL.val(0, r0, 8))) + ' : ' + (pb - Math.round(TL.val(1, r0, 8))) : '';
    for (const [id, v, lead] of [['ptR', pa, pa > pb], ['ptB', pb, pb > pa]]) {
      const el = $(id);
      if (el.textContent !== String(v)) { el.textContent = v; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
      el.classList.toggle('lead', lead);
    }
    const c = TL.clock(playT); $('rd').textContent = 'ยก ' + c.round + '/' + RULES.rounds; $('tm').textContent = fmt(c.clock);
  }
  movePops(dt);
}
function movePops(dt) {
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
      '<div class="spx">ท่าไม้ตาย: ' + (s.sp && s.sp.length ? s.sp : st.sp).map(k => MOVES[k].th).join(' · ') + '</div>';
  });
}
function applyOpt() {
  arena.setVenue(OPT.venue); arena.setLook(OPT.look, renderer, scene);
  if (fight && builtAs !== fighterKey()) { const t = playT; useDims(); TL = bake(fight); makeFighters(); seek(t); } // another body: re-aim every strike for its reach
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
    if (d.key === 'agR' || d.key === 'agB') { newFight(fight.seed); applyOpt(); return; } // another attitude is another fight
    OPT.preset = Object.keys(PRESETS).find(k => DETAIL.every(x => !(x.key in PRESETS[k]) || PRESETS[k][x.key] === OPT[x.key]) && PRESETS[k].look === OPT.look) || '';
    applyOpt();
  });
  const opts = (map, cur) => Object.keys(map).map(k => '<option value="' + k + '"' + (k === cur ? ' selected' : '') + '>' + (Array.isArray(map[k]) ? map[k][0] : map[k]) + '</option>').join('');
  const LABEL = {fighter: 'ตัวนักมวย', shorts: 'สีกางเกง', pattern: 'ลายกางเกง', trim: 'สีลายและมงคล', gloves: 'สีนวม', head: 'มงคล', hair: 'สีผม'};
  $('lookUi').innerHTML = LOOK.map((l, i) => '<div class="lk ' + (i ? 'b' : 'r') + '"><h3>' + (i ? 'มุมน้ำเงิน' : 'มุมแดง') + '</h3>' +
    '<label for="lk' + i + 'name">ชื่อ</label><input id="lk' + i + 'name" data-i="' + i + '" data-k="name" maxlength="24" placeholder="ตั้งชื่อเอง" value="' + cleanName(l.name) + '">' +
    Object.keys(LABEL).map(k => '<label for="lk' + i + k + '">' + LABEL[k] + '</label><select id="lk' + i + k + '" data-i="' + i + '" data-k="' + k + '">' + opts(LOOK_FIELDS[k], l[k]) + '</select>').join('') + '</div>').join('');
  $('lookUi').addEventListener('change', async e => {
    const el = e.target, i = +el.dataset.i, k = el.dataset.k; if (!k || !LOOK[i]) return;
    LOOK[i][k] = k === 'name' ? cleanName(el.value) : el.value;
    try { localStorage.setItem('muayLabLook', JSON.stringify(LOOK)); } catch (err) { /* not remembered, still applied */ }
    if (OPT.fighter !== 'model' && k !== 'name') { OPT.fighter = 'model'; }
    if (k === 'fighter' || !MODEL) await loadPair();
    const t = playT; newFight(fight.seed); applyOpt(); seek(t);
  });
  $('btnRematch').addEventListener('click', () => restart());
  $('btnNew').addEventListener('click', () => newFight(1 + Math.floor(Math.random() * 999999)));
  $('btnNext').addEventListener('click', () => {
    if (!moments.length) return;
    const cur = mode === 'replay' ? curRp.trigger : playT;
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
  OPT, seek, applyOpt, newFight, get fight() { return fight; }, get models() { return MODELS; }, get tl() { return TL; }, three: {scene, camera, renderer}, get t() { return playT; }, get mode() { return mode; },
  set(o) { Object.assign(OPT, o); OPT.preset = o.preset || ''; applyOpt(); },
  preset(k) { OPT.preset = k; Object.assign(OPT, PRESETS[k]); applyOpt(); },
  freeze(t) { seek(t); frozen = true; },
  // play t0..t1 in fixed steps so effects and overlays are in the state a viewer would see, then hold
  runTo(t0, t1) { seek(t0); let g = 0; while (playT < t1 && g++ < 60000) { const a = advance(1 / 60); fx.update(Math.max(a, .004), camera); } frozen = true; },
  // Check for a generated body: how much skin stretches into flaps in each pose. Per pose: [triangles, cm2] on the upper body
  // whose longest edge more than doubled against the rest pose. A clean body scores near zero in 'guard'.
  stretch(names) {
    this.gallery(names, 0); const v = new THREE.Vector3(), out = {};
    window.LAB._g.forEach((f, pi) => {
      const bm = f.model.mesh, pm = f.mesh, idx = bm.geometry.index, n = bm.geometry.attributes.position.count, B = new Float32Array(n * 3), P = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { bm.getVertexPosition(i, v); v.applyMatrix4(bm.matrixWorld); v.toArray(B, i * 3); pm.getVertexPosition(i, v); v.applyMatrix4(pm.matrixWorld); v.toArray(P, i * 3); }
      const len = (A, a, b) => Math.hypot(A[a * 3] - A[b * 3], A[a * 3 + 1] - A[b * 3 + 1], A[a * 3 + 2] - A[b * 3 + 2]);
      let cnt = 0, area = 0;
      for (let t = 0; t < idx.count; t += 3) {
        const a = idx.getX(t), b = idx.getX(t + 1), c = idx.getX(t + 2); if (B[a * 3 + 1] < 1) continue;
        const ab = len(P, a, b), bc = len(P, b, c), ca = len(P, a, c);
        if (Math.max(ab, bc, ca) < .06 || Math.max(ab / (len(B, a, b) + 1e-6), bc / (len(B, b, c) + 1e-6), ca / (len(B, a, c) + 1e-6)) < 2.2) continue;
        const s = (ab + bc + ca) / 2; cnt++; area += Math.sqrt(Math.max(0, s * (s - ab) * (s - bc) * (s - ca))) * 1e4;
      }
      out[names[pi]] = [cnt, Math.round(area)];
    });
    return out;
  },
  gallery(names, az, style) {
    galleryOn = true; fighters.forEach(f => { f.root.visible = false; }); arena.group.visible = false; scene.fog = null; scene.background = new THREE.Color(0x3a4150);
    (window.LAB._g || []).forEach(f => scene.remove(f.root));
    window.LAB._g = names.map((n, i) => { const f = OPT.fighter === 'model' && MODEL ? new ModelFighter(i % 2, MODELS[i % 2], LOOK[i % 2]) : new Fighter(i % 2, typeof style === 'object' ? style : {skin: i, build: ['heavy', 'athletic', 'lean'][i % 3], hair: i, tattoo: i % 2 === 0}); f.setStyle(typeof style === 'string' ? style : 'real'); scene.add(f.root); f.update(FLAT[n], 0, (i - (names.length - 1) / 2) * 1.3); return f; });
    const D = names.length * 1.3 / 2 / Math.tan(Math.atan(Math.tan(camera.fov * Math.PI / 360) * camera.aspect)) + .4, a = az || 0;
    camera.position.set(Math.sin(a) * D, 1.3, Math.cos(a) * D); camera.lookAt(0, 1.0, 0);
  }
};

// What happened in a round, for the corner's advice. Index 0 is the red corner.
function roundStats(n) {
  const r = marks.rounds.find(x => x.n === n), rest = marks.rests.find(x => x.round && x.round.n === n), t1 = rest ? rest.t : fight.duration, t0 = r ? r.t0 : 0;
  const sc = marks.scores.find(x => x.round === n) || {rpts: [0, 0], pts: [0, 0]};
  const out = [0, 1].map(i => ({rp: sc.rpts[i], head: 0, body: 0, leg: 0, landed: 0, blocked: 0, thrown: 0, kd: 0, hp: TL.val(i, t1, 1), st: TL.val(i, t1, 2), wearHead: TL.val(i, t1, 5), wearBody: TL.val(i, t1, 6), wearLeg: TL.val(i, t1, 7), pts: TL.val(i, t1, 8)}));
  for (const e of EV) {
    if (e.t < t0 || e.t > t1) continue;
    if (e.type === 'move') out[e.by].thrown++;
    else if (e.type === 'hit' && e.res === 'hit') { out[e.by].landed++; out[e.by][e.lvl]++; }
    else if (e.type === 'hit' && e.res === 'block') out[e.on].blocked++;
    else if (e.type === 'kd') out[e.on].kd++;
  }
  return out;
}
// ---------- hooks for the game layer ----------
const API = {
  LOOK, ROSTER, COLORS, PATTERNS, HEADGEAR, HAIR, HOOK, VENUES, TARGETS, cleanName,
  hasModels: () => !!document.getElementById('model-c'),
  async startFight(cfg) { // cfg: {seed, specs: [player, opponent], plans, looks: [look, look], venue, rules}
    API.endPreview(); API.drillStop(); OPT.venue = VENUES[cfg.venue] ? cfg.venue : 'stadium';
    cfg.looks.forEach((l, i) => Object.assign(LOOK[i], l));
    OPT.fighter = 'model'; await loadPair();
    newFight(cfg.seed, {specs: cfg.specs, plans: cfg.plans, rules: cfg.rules || null}); applyOpt(); frozen = false;
  },
  replan(plans) { CFG.plans = plans; const t = playT; buildFight(); evi = indexAt(t); rpi = replays.findIndex(r => r.trigger > t); if (rpi < 0) rpi = replays.length; },
  resume() { frozen = false; },
  skip() { seek(marks.over); },
  stop() { TL = null; fighters.forEach(f => scene.remove(f.root)); fighters = []; clearOverlays(); },
  result: () => fight && fight.result, fight: () => fight,
  async preview(look, pose, venue) { // show one fighter in the given look, standing in a venue
    const model = await API.single(look); if (!model) return false;
    API.endPreview(); API.drillStop(); // a second call may have finished while this one was loading
    fighters.forEach(f => { f.root.visible = false; });
    venue = VENUES[venue] ? venue : 'camp'; arena.setVenue(venue);
    previewF = new ModelFighter(0, model, venueLook(look, venue)); previewPose = pose || 'guard'; scene.add(previewF.root); clearOverlays();
    return true;
  },
  // load one body, size the skeleton to it and clear the stage for it
  async single(look) {
    let model = null;
    try { model = await ensureModel(look.fighter); } catch (e) { $('modelNote').textContent = 'โหลดโมเดลนักมวยไม่ได้ (' + e.message + ') '; return null; }
    const m = model.dims, D = DIM_DEFAULT, kHip = model.standHips / (D.thigh + D.shin + D.ankle + D.hipY);
    setDims(m); scalePoses(kHip, (.88 * kHip + m.spine + m.neck + m.head) / (.88 + D.spine + D.neck + D.head));
    API.endPreview(); API.drillStop(); fighters.forEach(f => { f.root.visible = false; });
    return model;
  },
  // training drill: the fighter in the camp with a target in front; the caller throws the strikes
  async drillStart(look, target) {
    const model = await API.single(look); if (!model) return false;
    API.endPreview(); API.drillStop(); fighters.forEach(f => { f.root.visible = false; });
    arena.setVenue('camp'); drillF = new ModelFighter(0, model, look); scene.add(drillF.root); clearOverlays();
    drillF.setMongkol(false); drill.start(drillF, target, arena.V.beamY); return true;
  },
  drillStrike: move => drill.strike(move),
  drillStop() { if (drill) drill.stop(); if (drillF) { scene.remove(drillF.root); drillF = null; } },
  pop(text, cls) { if (drillF) pop(text, drillF.world('head', tmpV).add(tmpV2.set(.3, .42, 0)), cls, .7); },
  endPreview() { if (previewF) { scene.remove(previewF.root); previewF = null; } fighters.forEach(f => { f.root.visible = true; }); },
  setSpeed(v) { speed = v; }, applyOpt
};
window.MUAY = API;

buildUi(); layout();
const GAME_MODE = !!document.getElementById('game');
const start = async () => {
  arena = buildArena(scene); fx = buildFx(scene); drill = buildDrill(scene, fx, audio);
  await Promise.resolve(); // the game entry registers its boot function after this module has run
  if (GAME_MODE && window.MUAY_BOOT) { arena.setVenue('camp'); arena.setLook(OPT.look, renderer, scene); requestAnimationFrame(frame); window.MUAY_BOOT(API); return; }
  await loadPair();
  $('ver').textContent = 'รุ่น 20 · ' + (MODEL ? 'โมเดล 3D' : 'ตัวจากโค้ด'); // lets a viewer tell a stale cached page from a failed model load
  newFight(SAMPLE_SEEDS[Math.floor(Math.random() * SAMPLE_SEEDS.length)]); applyOpt(); requestAnimationFrame(frame);
};
// sample fights that end in different ways: hook, high kick, elbow, flying knee, and a decision
const SAMPLE_SEEDS = [300, 512, 84, 1607, 5];
if (document.fonts && document.fonts.ready) document.fonts.ready.then(start, start); else start();
