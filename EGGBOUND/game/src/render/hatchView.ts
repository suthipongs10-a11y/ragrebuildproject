// @ts-nocheck
// Hatch scene: egg on a rune pedestal → wobble → 3 crack stages → light rays → burst → silhouette → reveal.
import { SPECIES, LOOT_GRADES, LOOT_ORDER } from '../core/data';
import { PAL, PIV, TAU, spr, silOf, glowOf, GP, dot, eggImg, mk, TIER_COL, IMG, fx, tinted, colored, baseOf } from './assets';
import { sfx } from './audio';
import { E, SQ, lerp, rnd, clamp, easeOut, easeBack, run, tween, addP, burst, ring, shake, flash, drawParts, drawDecals, drawGround, drawLantern, drawBush, drawLanternPools, drawFlies, LANTERNS, BUSHES, worldTransform, screenTransform, drawOverlays } from './engine';

const PED = { x: 0, y: -40 }, EGGK = .42;
const PRISM = ['#ff6b6b', '#ffb84d', '#ffe66b', '#6bdc8a', '#5bb8ff', '#a98bff'];
// 4 floating crystal obelisks around the altar: [x, y offset from the pedestal, phase] — two behind, two in front at the sides
const CRYSTALS = [[-178, -72, 0], [178, -72, 1.7], [-196, 52, 3.1], [196, 52, 4.4]];
// ---- batch 06 art (tools/import_fx.py): positions in the original canvas px ----
const ART = () => !!IMG.hatch_altar;
const ALT_K = .45, DISH = [511, 548];            // altar 1024²: egg sits on the dish centre
const FLOOR_K = .5, FLOOR_C = [768, 560], FLOOR_Y = 50; // floor 1536×1024, ellipse centre → PED.y + FLOOR_Y
const STAND_K = .25, CRY_K = .27;                 // stand 512² (base front y=470, top disc y=300) · crystal 512² (tips y=50..470)
const CRYSTALS_ART = [[-190, -58, 0], [190, -58, 1.7], [-222, 74, 3.1], [222, 74, 4.4]];
const crystals = () => ART() ? CRYSTALS_ART : CRYSTALS;
const lighten = (hex, f) => { const n = parseInt(hex.slice(1), 16), m = c => Math.round(c + (255 - c) * f); return '#' + [m(n >> 16 & 255), m(n >> 8 & 255), m(n & 255)].map(v => v.toString(16).padStart(2, '0')).join(''); };
const IDLE_COL = '#7fe8ff', GOLD = ['#fff0b8', '#e8b84a', '#8a5a14'];
const AW_GOLD = '#ffd24a', AW_PALE = '#fff3c0';
/** jagged lightning polyline from a to b (midpoint displacement) */
function jag(a, b, disp, depth = 5) {
  if (depth === 0) return [a, b];
  const m = [(a[0] + b[0]) / 2 + rnd(-disp, disp), (a[1] + b[1]) / 2 + rnd(-disp, disp) * .6];
  return [...jag(a, m, disp / 2, depth - 1), ...jag(m, b, disp / 2, depth - 1).slice(1)];
}
function starPath(ctx, x, y, r) { ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); }
const colC = {};
/** soft light column sprite (fades at the sides and toward the top), cached per colour */
function column(c) {
  if (colC[c]) return colC[c];
  const cv = mk(64, 256), x = cv.getContext('2d'); let g = x.createLinearGradient(0, 0, 64, 0);
  g.addColorStop(0, c + '00'); g.addColorStop(.5, c + 'aa'); g.addColorStop(1, c + '00'); x.fillStyle = g; x.fillRect(0, 0, 64, 256);
  x.globalCompositeOperation = 'destination-in'; g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)'); x.fillStyle = g; x.fillRect(0, 0, 64, 256);
  return (colC[c] = cv);
}
const RUNES = ['ᚠ', 'ᚢ', 'ᚦ', 'ᚨ', 'ᚱ', 'ᚲ', 'ᚷ', 'ᚹ', 'ᚺ', 'ᚾ', 'ᛁ', 'ᛃ'];
export class HatchView {
  sid; P; EP; egg; mon; fxs = []; phase = 'ready'; rays = 0; onDone = null; dup = false; newStars = 1; eggSrc = null; tier = null; rare = false; revealed = false; rarityOverride = null; rk = 0; step = 0; postT = 0;
  // awakening (after the reveal): charge → gold burst + lightning → stars stamp in one by one. Grander with rarity.
  fromStars = 0; toStars = 1; aT = 0; bolts = []; goldRays = 0; awGlow = 0; dark = 0; stamps = []; awBurst = false; nSpray = 0; nArc = 0; nStrike = 0;
  // epic+ pre-hatch: crystals gather power → fire into the egg → egg overloads (lightning, power aura, light shafts) → BOOM
  auraW = 66; auraH = 130; arcK = 1; bannerText = null; bannerCol = null; drawExtra = null; // hooks for EvolveView
  pt = 0; preDone = false; gatherK = 0; beamK = 0; auraK = 0; shots = []; fired = 0; nEggArc = 0; nSky = 0; nCryArc = 0;
  constructor(sid, opts) {
    this.sid = sid; const SPc = SPECIES[baseOf(sid)]; this.P = PAL[SPc.elem]; Object.assign(this, opts);
    this.egg = { x: PED.x, y: PED.y - 38, rot: 0, hop: 0, sx: 1, sy: 1, glow: 0, white: 0, vis: true, cracks: [], cv: mk(512, 512), stage: 0, t: 0 };
    this.mon = { x: PED.x, y: PED.y - 38, hop: 0, sx: .3, sy: .3, sil: 1, vis: false, k: .4 * (SPc.scale || 1) };
    // mystery eggs glow in their tier colour so the element stays hidden until the reveal
    // monster rarity drives how grand the hatch is: 0 common · 1 rare · 2 epic · 3 legendary
    this.rk = Math.max(0, LOOT_ORDER.indexOf(this.rarityOverride || SPc.rarity));
    this.EP = this.tier ? { aura: TIER_COL[this.tier], core: '#fff6e0' } : this.P;
    if (!this.eggSrc) this.eggSrc = eggImg(sid);
  }
  start() { E.camT.x = 0; E.camT.y = PED.y - 40; E.zoomT = 1.15; }
  tap() { if (this.phase === 'ready') { this.phase = 'hatching'; sfx.whoosh(); } }
  eggWorld(lx, ly) { const g = this.egg, c = Math.cos(g.rot), s = Math.sin(g.rot), x = (lx - 254) * EGGK * g.sx, y = (ly - 433) * EGGK * g.sy; return [g.x + x * c - y * s, -(x * s + y * c) + g.hop]; }
  crack(stage) {
    const g = this.egg, x = g.cv.getContext('2d');
    for (let b = 0; b < 1 + stage; b++) {
      let px = 254 + (Math.random() - .5) * 90, py = 230 + Math.random() * 120; const pts = [[px, py]]; let ang = Math.random() * TAU;
      for (let i = 0; i < 5 + stage * 2; i++) { ang += (Math.random() - .5) * 1.6; const l = 9 + Math.random() * 14; px += Math.cos(ang) * l; py += Math.sin(ang) * l * .8; pts.push([px, py]); }
      g.cracks.push(pts); x.lineJoin = 'round'; x.lineCap = 'round';
      x.strokeStyle = '#3a1606'; x.lineWidth = 4.2; x.beginPath(); pts.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.stroke();
      x.strokeStyle = '#fff0c4'; x.lineWidth = 1.3; x.beginPath(); pts.forEach((p, i) => i ? x.lineTo(p[0] - 1.2, p[1] - 1.2) : x.moveTo(p[0] - 1.2, p[1] - 1.2)); x.stroke();
    }
    x.globalCompositeOperation = 'destination-in'; x.drawImage(this.eggSrc, 0, 0, 512, 512); x.globalCompositeOperation = 'source-over';
    const w = this.eggWorld(254, 300); burst(w[0], g.y, w[1], 10, '#f6e6cc', 200, 5, .6, { add: false, type: 'chip', grav: 700, vz: 160 }); burst(w[0], g.y, w[1], 8, this.EP.core, 160, 14, .4);
    sfx.crack(); shake(2 + stage * 1.5);
  }
  addFx(name, col, x, y, s0, s1, dur, rot = 0, a = 1) { if (IMG[name]) this.fxs.push({ name, col, x, y, s0, s1, dur, rot, a, t: 0 }); }
  breakFx() { // the egg bursts: hot flash + shockwaves in the egg's colour, bigger and more of them the rarer the monster
    const x = PED.x, y = PED.y - 90, c = this.col(), rk = this.rk;
    this.addFx('fx_burst', c, x, y, 220, 900 * (1 + rk * .35), .55 + rk * .1, Math.random()); this.addFx('fx_ring', '#ffffff', x, y, 40, 620, .5);
    for (let i = 0; i <= rk; i++) this.addFx('fx_ring', rk >= 3 ? PRISM[i * 2 % PRISM.length] : c, x, y, 80, 980 + i * 260, .7 + i * .12);
    if (rk >= 3) PRISM.forEach((pc, i) => this.addFx('fx_ring', pc, x, y, 60, 700 + i * 140, .9 + i * .06));
    if (rk >= 1) { shake(8 + rk * 6); this.rays = 1.2 + rk * .3; }
    if (rk === 2) sfx.react(); if (rk >= 3) { sfx.starup(); setTimeout(() => sfx.win(), 450); flash(1, '#fff6d0'); }
  }
  afterFx(dt) { // epic / legendary: a light pillar from the sky and twinkles around the new monster for a few seconds
    this.postT += dt; if (this.postT > 3.5) return; const m = this.mon;
    if (Math.random() < dt * (10 + this.rk * 8)) this.addFx('fx_sparkle', this.col(Math.random() * 6 | 0), m.x + rnd(-170, 170), m.y - rnd(20, 300), 20, rnd(50, 110), .6, rnd(0, 1));
  }
  /** awakening timeline (seconds after the reveal) */
  tl() { // epic+ already charged before the egg broke, so their burst comes right after the reveal
    const rk = this.rk, C = [0, .55, 0, 0][rk], burstAt = rk === 1 ? .35 + C : rk ? .15 : .25, S = [0, .7, 1.1, 1.5][rk];
    const stamp0 = burstAt + (rk ? .3 : 0), gap = .3, stampEnd = stamp0 + Math.max(1, this.toStars - this.fromStars) * gap;
    return { C, burstAt, S, stamp0, gap, end: Math.max(burstAt + S, stampEnd) + .9 };
  }
  bodyH() { return 75 * this.mon.k / .4; }
  preTl() { const L = this.rk >= 3; return { G: L ? 2.1 : 1.7, F: .5, O: L ? 2.5 : 2.0, W: .35 }; }
  eggC() { return [this.egg.x, this.egg.y - 52]; }
  /** epic / legendary: the four crystals gather power, fire it into the egg, the egg overloads, then the normal break (ht = 3) */
  epicPre(dt) {
    const g = this.egg, rk = this.rk, T = this.preTl(), t = (this.pt += dt), [ex, ey] = this.eggC(), cr = crystals();
    const s = Math.min(rk, Math.floor(t / (T.G / (rk + 1)))); // the light steps up through the rarity colours while gathering
    if (s > this.step) { this.step = s; sfx.perfect(); flash(.2, LOOT_GRADES[LOOT_ORDER[s]].col); this.addFx('fx_ring', this.col(), PED.x, PED.y - 90, 60, 420 + s * 120, .55); }
    if (t < dt * 1.5) sfx.charge(T.G + T.F);
    g.glow = clamp(t / (T.G + T.F + T.O), 0, 1);
    if (t < T.G) { // GATHER: light spirals up around each crystal, sparks crackle on them
      const q = t / T.G; this.gatherK = q; this.dark = .5 * q;
      g.rot = Math.sin(t * 9) * .025 * q;
      if (t > this.nCryArc) { const c = cr[Math.random() * 4 | 0], [cx, cy] = this.crystalPos(c), a0 = rnd(0, TAU); this.bolts.push({ pts: jag([cx + Math.cos(a0) * 40, cy + Math.sin(a0) * 60], [cx + rnd(-40, 40), cy + rnd(-70, 70)], 22, 3), br: [], t: 0, life: .12, w: .45 }); this.nCryArc = t + .25 - .18 * q; }
      for (const c of cr) if (Math.random() < dt * (6 + 14 * q)) { const [cx, cy] = this.crystalPos(c); addP({ x: cx + rnd(-50, 50), y: PED.y + c[1], z: PED.y + c[1] - cy + rnd(-60, 20), vz: rnd(80, 200), life: rnd(.5, .9), size: rnd(4, 8), size2: 0, color: this.col() }); }
    } else if (t < T.G + T.F) { // FIRE: each crystal shoots its gathered power into the egg
      const f = t - T.G; this.gatherK = Math.max(.45, 1 - f * 1.2);
      while (this.fired < 4 && f >= this.fired * .08) { const [cx, cy] = this.crystalPos(cr[this.fired]); this.shots.push({ i: this.fired, t: 0 }); burst(cx, PED.y + cr[this.fired][1], PED.y + cr[this.fired][1] - cy, 16, this.col(), 300, 12, .5); this.fired++; sfx.zap(); shake(7); }
      if (f > .3 && !this.hitEgg) { this.hitEgg = true; sfx.beam(); flash(.45, this.col()); shake(12); this.beamK = 1; this.addFx('fx_burst', this.col(), ex, ey, 60, 520, .45, Math.random()); ring(g.x, g.y, 10, 260, this.col(), .6, 8); }
      this.dark = .55;
    } else if (t < T.G + T.F + T.O) { // OVERLOAD: lightning crackles over the egg, power aura and light shafts erupt, cracks spread
      const q = (t - T.G - T.F) / T.O; this.auraK = Math.min(1, q * 2.2); this.beamK = 1; this.dark = .55 + .1 * q; this.rays = q * .45;
      E.zoomT = 1.15 + .14 * q; E.camT.y = PED.y - 40 - 25 * q; shake(2 + 5 * q);
      const amp = .03 + q * .14, fr = 11 + q * 14; g.rot = Math.sin(t * fr) * amp; g.hop = Math.max(0, Math.sin(t * fr * .5)) * q * 7; g.sx = 1 + Math.sin(t * fr * 2) * .03 * q; g.sy = 2 - g.sx;
      const st = q > .72 ? 3 : q > .42 ? 2 : q > .12 ? 1 : 0; while (g.stage < st) { g.stage++; this.crack(g.stage); }
      if (t > this.nEggArc) { this.eggArc(); if (q > .5) this.eggArc(); this.nEggArc = t + .11 - .07 * q; if (Math.random() < .3) sfx.zap(); }
      if (t > this.nSky) { const a = rnd(0, TAU), r = rnd(120, 300); this.strike(g.x + Math.cos(a) * r, g.y + 10 + Math.sin(a) * r * SQ); shake(6 + rk * 2); this.nSky = t + rnd(.3, .55) / (rk - 1) / (.6 + q); }
      for (let n = 0; n < (14 + 26 * q) * dt + Math.random(); n++) { const a = rnd(0, TAU), r = rnd(40, 80); addP({ type: 'streak', x: g.x + Math.cos(a) * r, y: g.y + Math.sin(a) * r * SQ, z: rnd(0, 60), vz: rnd(500, 900), vx: rnd(-40, 40), life: rnd(.3, .5), size: rnd(2, 4), color: Math.random() < .7 ? this.col() : AW_PALE, drag: 1 }); }
    } else if (t < T.G + T.F + T.O + T.W) { // WHITE-OUT just before the break
      const q = (t - T.G - T.F - T.O) / T.W; g.white = q; g.sx = 1 + q * .5; g.sy = 1 + q * .3; g.rot *= .8; this.rays = 1.2; shake(8);
      if (t > this.nEggArc) { this.eggArc(); this.eggArc(); this.nEggArc = t + .04; }
    } else { this.preDone = true; this.ht = 3.0; this.beamK = 0; this.auraK = 0; this.gatherK = 0; }
    for (const sh of this.shots) sh.t += dt;
  }
  /** lightning crawling over the egg's shell */
  eggArc() {
    const [ex, ey] = this.eggC(), K = this.arcK, p = a => [ex + Math.cos(a) * rnd(44, 66) * K, ey + Math.sin(a) * rnd(56, 80) * K], a0 = rnd(0, TAU);
    this.bolts.push({ pts: jag(p(a0), p(a0 + rnd(.9, 2.4) * (Math.random() < .5 ? -1 : 1)), 26, 4), br: [], t: 0, life: rnd(.08, .15), w: .6 });
  }
  /** crystals: spiralling light while gathering */
  drawGather() {
    if (this.gatherK <= 0) return; const ctx = E.ctx, t = E.time, q = this.gatherK;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    crystals().forEach((c, i) => {
      const [cx, cy] = this.crystalPos(c), col = this.col(i), base = PED.y + c[1];
      fx(ctx, 'fx_orb', col, cx, cy, 160 + 160 * q, 160 + 160 * q, q * .8);
      if (fx(ctx, 'fx_vortex_spiral', col, cx, (base + cy) / 2 - 20, 150, 300, q * .9, 0)) return;
      for (let k = 0; k < 3; k++) { // three helix ribbons climbing the crystal
        ctx.beginPath(); for (let j = 0; j <= 24; j++) { const s = j / 24, a = t * (5 + q * 6) + k * TAU / 3 + s * 9, r = 52 * (1 - s * .45), x = cx + Math.cos(a) * r, y = base - s * (base - cy + 90) + Math.sin(a) * r * .3; j ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.globalAlpha = q * .35; ctx.stroke(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.6; ctx.globalAlpha = q * .8; ctx.stroke();
      }
      for (let k = 0; k < 8; k++) { const s = (t * .9 + k / 8) % 1, a = t * 7 + k * 2.4, r = 60 * (1 - s * .5); ctx.globalAlpha = q * Math.sin(s * Math.PI); ctx.drawImage(dot(col), cx + Math.cos(a) * r - 9, base - s * (base - cy + 90) + Math.sin(a) * r * .3 - 9, 18, 18); }
    });
    ctx.restore();
  }
  /** the crystals' power streams into the egg: thick beams with lightning running along them */
  drawPowerBeams() {
    if (this.beamK <= 0 && !this.shots.length || !this.egg.vis) return; const ctx = E.ctx, [ex, ey] = this.eggC(), cr = crystals();
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const sh of this.shots) {
      const [sx, sy] = this.crystalPos(cr[sh.i]), col = this.col(sh.i), u = clamp(sh.t / .18, 0, 1), k = this.beamK > 0 ? this.beamK : u;
      const hx = lerp(sx, ex, u), hy = lerp(sy, ey, u), len = Math.hypot(hx - sx, hy - sy), ang = Math.atan2(hy - sy, hx - sx), fl = .8 + .2 * Math.sin(E.time * 40 + sh.i);
      if (!fx(ctx, 'fx_energy_beam', col, (sx + hx) / 2, (sy + hy) / 2, len, 60 * k * fl, k, ang)) {
        for (const [w, c, a] of [[30, col, .22], [12, col, .7], [4, '#ffffff', 1]]) { ctx.globalAlpha = a * k * fl; ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(hx, hy); ctx.stroke(); }
      }
      if (u > .1) { const pts = jag([sx, sy], [hx, hy], 26, 4); for (const [w, c, a] of [[5, col, .5], [1.6, '#ffffff', .9]]) { ctx.globalAlpha = a * k; ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); pts.forEach((p, j) => j ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke(); } }
      if (u < 1) { ctx.globalAlpha = 1; ctx.drawImage(dot(col), hx - 40, hy - 40, 80, 80); ctx.drawImage(dot('#ffffff'), hx - 16, hy - 16, 32, 32); }
    }
    ctx.restore();
  }
  /** power-up aura (code version; uses fx_aura_flame / fx_light_shaft art when present): rising flame tongues hugging the body,
   *  sharp light shafts shooting up, and light ribbons spiralling around it. (x, yB) = feet, w/h = body size, k = strength */
  drawPowerAura(x, yB, w, h, col, k) {
    if (k <= 0) return; const ctx = E.ctx, t = E.time;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = k * .3; ctx.drawImage(dot(col), x - w * 1.5, yB - h * .5 - w * 1.5, w * 3, w * 3);
    const flick = Math.floor(t * 16) % 2;
    if (!fx(ctx, flick ? 'fx_aura_flame' : 'fx_aura_flame_b', col, x, yB - h * .95, w * 2.6, h * 2.4, k, 0) && !fx(ctx, 'fx_aura_flame', col, x, yB - h * .95, w * 2.6, h * 2.4, k, 0)) {
      // flame tongues rooted along the body outline, leaning out and licking upward (tallest over the top), like an anime power-up
      const cx = x, cy = yB - h * .45, rx = w * .78, ry = h * .58, N = 26;
      ctx.globalAlpha = k * .55; ctx.strokeStyle = col; ctx.lineWidth = w * .12; ctx.beginPath(); ctx.ellipse(cx, cy, rx * .92, ry * .95, 0, 0, TAU); ctx.stroke();
      for (let i = 0; i < N; i++) {
        const v = (i + .5) / N, ang = Math.PI * (.5 + v * 2) - Math.PI, bx = cx + Math.cos(ang + Math.PI / 2) * rx, by = cy - Math.sin(ang + Math.PI / 2) * ry;
        const side = (bx - cx) / rx, up = clamp((cy - by) / ry * .5 + .5, 0, 1), nz = .5 + .5 * Math.sin(t * 11 + i * 2.1) * Math.sin(t * 6.7 + i * 1.3);
        const L = h * (.25 + .55 * up + .45 * nz), wd = w * (.1 + .05 * nz), lean = side * w * .35 + Math.sin(t * 14 + i) * w * .08, tx = bx + lean, ty = by - L;
        const gr = ctx.createLinearGradient(bx, by, tx, ty); gr.addColorStop(0, col); gr.addColorStop(.35, col + 'cc'); gr.addColorStop(1, col + '00');
        ctx.globalAlpha = k * (.45 + .3 * nz); ctx.fillStyle = gr;
        ctx.beginPath(); ctx.moveTo(bx - wd, by + wd * .5); ctx.quadraticCurveTo(bx - wd * .4 + lean * .4, by - L * .5, tx, ty); ctx.quadraticCurveTo(bx + wd * .4 + lean * .4, by - L * .5, bx + wd, by + wd * .5); ctx.closePath(); ctx.fill();
        ctx.globalAlpha = k * .5 * nz; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx + lean * .4, by - L * .5, tx, ty); ctx.stroke();
      }
    }
    for (let i = 0; i < 12; i++) { // sharp light shafts that shoot up and vanish, each at a new spot every cycle
      const per = .42 + (i % 4) * .07, cyc = Math.floor((t + i * .137) / per), u = ((t + i * .137) % per) / per, rr = Math.sin(cyc * 12.9898 + i * 78.233) * 43758.5453, rn = rr - Math.floor(rr);
      const a = rn * TAU, px = x + Math.cos(a) * w * (.35 + rn * .5), by = yB + Math.sin(a) * w * .15, len = h * (1.6 + rn * 1.6) * easeOut(Math.min(1, u * 3)), al = k * (1 - u) * .95;
      if (fx(ctx, 'fx_light_shaft', col, px, by - len / 2, w * .35, len, al, 0)) continue;
      const gr = ctx.createLinearGradient(0, by, 0, by - len); gr.addColorStop(0, '#ffffff'); gr.addColorStop(.4, col); gr.addColorStop(1, col + '00');
      ctx.globalAlpha = al; ctx.fillStyle = gr; const ww = w * (.05 + rn * .05); ctx.beginPath(); ctx.moveTo(px - ww, by); ctx.lineTo(px, by - len); ctx.lineTo(px + ww, by); ctx.closePath(); ctx.fill();
    }
    for (let r = 0; r < 3; r++) { // ribbons spiralling up around the body
      ctx.beginPath(); for (let j = 0; j <= 30; j++) { const s = j / 30, a = t * 7 + r * TAU / 3 + s * 8, rad = w * .8 * (1 - s * .35), px = x + Math.cos(a) * rad, py = yB - s * h * 1.6 + Math.sin(a) * rad * .3; j ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.strokeStyle = col; ctx.lineWidth = 6; ctx.globalAlpha = k * .3; ctx.stroke(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.8; ctx.globalAlpha = k * .75; ctx.stroke();
    }
    fx(ctx, 'fx_arc_ring', col, x, yB - h * .5, w * 1.9, h * 1.5, k * (.5 + .5 * Math.random()), Math.random() < .5 ? 0 : Math.PI); // electric sheath art (flips to flicker)
    ctx.restore();
  }
  /** lightning from the sky onto a ground point (x,y), optionally ending at height z */
  strike(x, y, z = 0, w = 1) {
    const top = [x + rnd(-90, 90), y - z - 760], end = [x, y - z], pts = jag(top, end, 90);
    const br = []; for (let i = 0; i < 2; i++) { const k = 4 + (Math.random() * (pts.length - 8) | 0), a = pts[k]; br.push(jag(a, [a[0] + rnd(-120, 120), a[1] + rnd(40, 140)], 40, 3)); }
    this.bolts.push({ pts, br, t: 0, life: rnd(.3, .45), w });
    burst(x, y, z, 10, AW_GOLD, 340, 12, .5); ring(x, y, 6, 70 * w, AW_PALE, .35, 4);
  }
  /** a short crackling arc around the monster's body */
  arc() {
    const m = this.mon, bh = this.bodyH(), R = 95 * m.k / .4, a0 = rnd(0, TAU), a1 = a0 + rnd(.8, 2.2) * (Math.random() < .5 ? -1 : 1);
    const p = a => [m.x + Math.cos(a) * R * rnd(.8, 1.15), m.y - bh + Math.sin(a) * R * 1.1];
    this.bolts.push({ pts: jag(p(a0), p(a1), 34, 4), br: [], t: 0, life: rnd(.1, .18), w: .55 });
  }
  starPos(i) { const m = this.mon, n = this.toStars, sp = 36; return [m.x + (i - (n - 1) / 2) * sp, m.y - 222 * m.k / .4]; }
  awaken(dt) {
    const a = this.aT, T = this.tl(), rk = this.rk, m = this.mon, bh = this.bodyH();
    if (rk && a > .35 && a < T.burstAt) { // charge: the world darkens, gold motes rush into the monster, it crouches
      const q = (a - .35) / T.C; this.dark = Math.min(.55, q * .65); this.awGlow = q;
      E.zoomT = 1.15 + q * (rk >= 2 ? .3 : .15); E.camT.y = PED.y - 40 - 60 * q; shake(1 + rk * q * 2.5);
      m.sx = 1 + .07 * q; m.sy = 1 - .08 * q;
      for (let n = 0; n < (40 + rk * 35) * dt + Math.random(); n++) {
        const ang = rnd(0, TAU), r = rnd(170, 340), z0 = bh + rnd(-70, 160), life = rnd(.32, .45);
        addP({ type: Math.random() < .5 ? 'streak' : 'glow', x: m.x + Math.cos(ang) * r, y: m.y + Math.sin(ang) * r * SQ, z: z0, vx: -Math.cos(ang) * r / life, vy: -Math.sin(ang) * r * SQ / life, vz: (bh - z0) / life, life, size: rnd(3, 8), size2: 2, color: Math.random() < .5 ? AW_GOLD : AW_PALE });
      }
      if (rk >= 2 && a > this.nArc) { this.arc(); this.nArc = a + .13; }
    }
    if (rk && !this.awBurst && a >= T.burstAt) { // BURST: gold explosion + lightning strikes all around
      this.awBurst = true; this.goldRays = 1; this.dark = .62; this.awGlow = 1; m.sx = .88; m.sy = 1.16;
      flash(rk >= 2 ? .35 : .75, '#fff1b8'); shake(rk >= 2 ? 10 : 14 + rk * 5); sfx.boom(); sfx.zap(); if (rk >= 2) setTimeout(() => sfx.zap(), 140); if (rk >= 3) setTimeout(() => sfx.win(), 300);
      this.addFx('fx_burst', AW_GOLD, m.x, m.y - bh, 120, rk >= 2 ? 700 : 900 + rk * 260, rk >= 2 ? .5 : .75, Math.random());
      this.addFx('fx_burst', '#ffffff', m.x, m.y - bh, 60, 340 + rk * 80, .35, Math.random());
      for (let i = 0; i < rk + 2; i++) this.addFx('fx_ring', i % 2 ? AW_GOLD : AW_PALE, m.x, m.y - bh, 60, 700 + i * 280, .6 + i * .14);
      if (rk >= 3) PRISM.forEach((pc, i) => this.addFx('fx_ring', pc, m.x, m.y - bh, 60, 760 + i * 150, .9 + i * .07));
      ring(m.x, m.y, 10, 300 + rk * 70, AW_GOLD, .8, 10); ring(m.x, m.y, 10, 200 + rk * 50, AW_PALE, .6, 5);
      this.strike(m.x, m.y, bh * .6, 1.6);
      for (let i = 0; i < rk * 2; i++) { const ang = rnd(0, TAU), r = rnd(110, 260); this.strike(m.x + Math.cos(ang) * r, m.y + Math.sin(ang) * r * SQ); }
      burst(m.x, m.y, bh, 40 + rk * 15, AW_GOLD, 620, 14, .8); burst(m.x, m.y, bh, 20, '#ffffff', 420, 10, .6);
      this.nSpray = 0; this.nArc = 0; this.nStrike = .25;
    }
    if (this.awBurst) {
      const s = a - T.burstAt;
      m.sx = lerp(m.sx, 1, 1 - Math.exp(-dt * 9)); m.sy = lerp(m.sy, 1, 1 - Math.exp(-dt * 9));
      this.goldRays = clamp(1 - (s - T.S) / 1.1, 0, 1);
      if (s < T.S) { // power keeps pouring out: gold streaks shoot in every direction, arcs crackle, bolts keep striking
        while (this.nSpray <= s) {
          this.nSpray += .05;
          for (let k = 0; k < 5 + rk * 3; k++) { const ang = rnd(0, TAU), sp = rnd(520, 1150); addP({ type: 'streak', x: m.x, y: m.y, z: bh + rnd(-40, 40), vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp * SQ, vz: rnd(-250, 800), life: rnd(.32, .55), size: rnd(2.5, 5.5), color: Math.random() < .6 ? AW_GOLD : AW_PALE, drag: 1.6 }); }
          if (Math.random() < .5) burst(m.x, m.y, bh + rnd(-30, 60), 3, AW_GOLD, 320, 10, .6);
        }
        if (s > this.nArc) { this.arc(); if (rk >= 2) this.arc(); this.nArc = s + [.2, .15, .1, .07][rk]; }
        if (rk >= 2 && s > this.nStrike) { const ang = rnd(0, TAU), r = rnd(90, 280); this.strike(m.x + Math.cos(ang) * r, m.y + Math.sin(ang) * r * SQ); if (Math.random() < .5) sfx.zap(); shake(5 + rk); this.nStrike = s + rnd(.12, .26) / (rk - 1); }
        shake(2 + rk); this.awGlow = 1;
      } else {
        this.awGlow = Math.max(.35, this.awGlow - dt * .9);
        if (rk >= 2 && a < T.end - .5 && s > this.nArc) { this.arc(); this.nArc = s + .3; }
      }
      this.dark = s < T.S ? .62 : Math.max(0, .62 - (s - T.S) * .45);
    }
    // stars stamp in one by one above the monster (★ = rarity's natural stars; a duplicate keeps its old ones and slams the new)
    for (let i = this.stamps.length; i < this.toStars; i++) {
      const old = i < this.fromStars, at = old ? T.stamp0 : T.stamp0 + (i - this.fromStars) * T.gap; if (a < at) break;
      this.stamps.push({ i, t: 0, slam: !old }); if (old) continue;
      const [sx, sy] = this.starPos(i), last = i === this.toStars - 1, h = m.y - sy;
      sfx.perfect(); flash(.18 + rk * .05, AW_GOLD); burst(sx, m.y, h, 14 + rk * 4, AW_GOLD, 260, 10, .55); ring(sx, m.y, 4, 60, AW_PALE, .3, 3);
      if (rk >= 2) this.bolts.push({ pts: jag([sx + rnd(-60, 60), sy - 520], [sx, sy], 70), br: [], t: 0, life: .22, w: .9 });
      if (last) { sfx.starup(); shake(5 + rk * 2); burst(sx, m.y, h, 30, '#ffffff', 380, 10, .7); }
      if (i === 5 && this.rare) { // ★6 at birth (rare-form legendary): heaven strikes the star in, rainbow
        this.stamps[this.stamps.length - 1].mythic = true; flash(.85, '#ffffff'); shake(18); sfx.perfect();
        for (let b = 0; b < 5; b++) this.bolts.push({ pts: jag([sx + rnd(-220, 220), sy - 700], [sx + rnd(-20, 20), sy], 90), br: [], t: -b * .05, life: .35, w: 1.3 });
        PRISM.forEach((c, j) => { ring(sx, m.y, 6, 120 + j * 30, c, .5 + j * .06, 5); burst(sx, m.y, h, 10, c, 420, 12, .9); });
      }
    }
    if (rk && a > T.end - .6) { E.zoomT = 1.15; E.camT.y = PED.y - 40; }
  }
  drawDark() { if (this.dark <= 0) return; const ctx = E.ctx; ctx.save(); screenTransform(); ctx.fillStyle = `rgba(10,6,0,${this.dark})`; ctx.fillRect(0, 0, E.W, E.H); ctx.restore(); }
  drawGoldRays() {
    const g = this.goldRays; if (g <= 0) return; const ctx = E.ctx, m = this.mon, by = m.y - this.bodyH(), pulse = 1 + .06 * Math.sin(E.time * 18);
    fx(ctx, 'fx_rays', AW_GOLD, m.x, by, 1350 * pulse, 1350 * pulse, g * .85, E.time * 1.1);
    fx(ctx, 'fx_rays', AW_PALE, m.x, by, 820, 820, g * .35, -E.time * .8);
    if (this.rk >= 3) fx(ctx, 'fx_rays', PRISM[Math.floor(E.time * 6) % PRISM.length], m.x, by, 1100, 1100, g * .5, E.time * .5);
    fx(ctx, 'fx_burst', AW_GOLD, m.x, by, 420 * pulse, 420 * pulse, g * .25, E.time * .7);
  }
  drawBolts() {
    if (!this.bolts.length) return; const ctx = E.ctx; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const line = pts => { ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke(); };
    for (const b of this.bolts) {
      if (b.t < 0) continue; // staggered strike, not yet
      const a = (1 - b.t / b.life) * (.65 + .35 * Math.random());
      for (const [w, c, al] of [[24, AW_GOLD, .18], [9, AW_GOLD, .6], [3, '#ffffff', 1]]) { ctx.globalAlpha = a * al; ctx.strokeStyle = c; ctx.lineWidth = w * b.w; line(b.pts); for (const br of b.br) { ctx.lineWidth = w * b.w * .5; line(br); } }
    }
    ctx.restore();
  }
  drawLabels() {
    const m = this.mon; if (!m.vis) return; const ctx = E.ctx;
    if (this.rk > 0 && this.revealed) { // rarity banner pops in above the monster
      const sz = (this.rk >= 3 ? 40 : this.rk === 2 ? 34 : 28) * (0.6 + 0.4 * easeBack(Math.min(1, (this.bannerT = (this.bannerT || 0) + .016) * 3)));
      const txt = this.bannerText || LOOT_GRADES[LOOT_ORDER[this.rk]].name + (this.rk >= 3 ? '!!' : '!'), ty = m.y - 270 * m.k / .4;
      ctx.save(); ctx.font = `700 ${sz}px Mitr, sans-serif`; ctx.textAlign = 'center'; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 6; ctx.strokeText(txt, m.x, ty);
      ctx.fillStyle = this.bannerCol || (this.rk >= 3 ? PRISM[Math.floor(E.time * 6) % PRISM.length] : LOOT_GRADES[LOOT_ORDER[this.rk]].col); ctx.fillText(txt, m.x, ty); ctx.restore();
    }
    for (const st of this.stamps) { // gold stars: slam in big, settle, shine
      const [x, y] = this.starPos(st.i), q = st.slam ? clamp(st.t / .22, 0, 1) : 1, sc = st.slam ? lerp(3.2, 1, easeOut(q)) : 1, r = 15 * sc;
      ctx.save(); ctx.globalAlpha = st.slam ? Math.min(1, st.t * 7) : 1;
      ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(dot(AW_GOLD), x - r * 2.4, y - r * 2.4, r * 4.8, r * 4.8); ctx.globalCompositeOperation = 'source-over';
      const g = ctx.createLinearGradient(x, y - r, x, y + r);
      if (st.mythic) { const o = Math.floor(E.time * 6); PRISM.forEach((c, j) => g.addColorStop(j / (PRISM.length - 1), PRISM[(j + o) % PRISM.length])); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(dot(PRISM[o % PRISM.length]), x - r * 3.4, y - r * 3.4, r * 6.8, r * 6.8); ctx.globalCompositeOperation = 'source-over'; }
      else { g.addColorStop(0, '#fff8d6'); g.addColorStop(.5, '#ffd24a'); g.addColorStop(1, '#c47d12'); }
      starPath(ctx, x, y, r); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 2.2; ctx.strokeStyle = '#6a3a06'; ctx.stroke();
      if (st.slam && st.t < .5) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1 - st.t * 2; starPath(ctx, x, y, r * (1 + st.t * 2)); ctx.strokeStyle = AW_PALE; ctx.lineWidth = 3; ctx.stroke(); }
      ctx.restore();
    }
    if (this.rare && this.revealed) { ctx.save(); ctx.font = '700 24px "IBM Plex Sans Thai",sans-serif'; ctx.textAlign = 'center'; const ty = m.y - 318 * m.k / .4 + Math.sin(E.time * 3) * 4; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 5; ctx.strokeText('ร่างหายาก!', m.x, ty); ctx.fillStyle = PRISM[Math.floor(E.time * 4) % PRISM.length]; ctx.fillText('ร่างหายาก!', m.x, ty); ctx.restore(); }
  }
  drawSky() {
    if (this.rk < 2 || !this.revealed || this.postT > 4) return; const m = this.mon, a = Math.min(1, this.postT * 3) * Math.max(0, 1 - Math.max(0, this.postT - 3));
    fx(E.ctx, 'fx_column', this.col(), m.x, m.y - 430, 200 + this.rk * 50, 980, a * .55);
  }
  update(dt) {
    for (const f of this.fxs) f.t += dt; this.fxs = this.fxs.filter(f => f.t < f.dur);
    for (const b of this.bolts) b.t += dt; this.bolts = this.bolts.filter(b => b.t < b.life); for (const st of this.stamps) st.t += dt;
    if (this.phase === 'hatching' && this.egg.vis && ART() && Math.random() < dt * (4 + this.egg.glow * 14)) this.addFx('fx_sparkle', this.col(), PED.x + rnd(-70, 70), PED.y - 90 + rnd(-70, 50), 20, rnd(50, 90), .5, rnd(0, 1));
    const g = this.egg, m = this.mon, P = this.P;
    g.t += dt; const t = g.t;
    if (this.phase === 'ready') { g.rot = Math.sin(t * 2) * .02 + (t % 3.2 > 2.8 ? Math.sin(t * 40) * .05 : 0); g.glow = .25 + .15 * Math.sin(t * 2.4); return; }
    if (this.phase === 'hatching' && this.rk >= 2 && !this.preDone) { this.epicPre(dt); return; }
    if (this.phase === 'hatching') {
      if (!this.ht) this.ht = 0; this.ht += this.ht < 2.7 ? dt * [1, .85, .7, .55][this.rk] : dt; const h = this.ht;
      // the light steps up through the rarity colours (same language as the treasure chest) until it reaches the real one
      if (this.rk > 0 && h < 2.7) { const s = Math.min(this.rk, Math.floor(h / (2.6 / (this.rk + 1)))); if (s > this.step) { this.step = s; sfx.perfect(); flash(.25, LOOT_GRADES[LOOT_ORDER[s]].col); this.addFx('fx_ring', this.col(), PED.x, PED.y - 90, 60, 420 + s * 120, .55); } }
      if (h < 2.7) { const amp = .025 + h / 2.7 * .17, fr = 7 + h * 5; g.rot = Math.sin(h * fr) * amp; g.hop = Math.max(0, Math.sin(h * fr * .5)) * h * 3; g.sx = 1 + Math.sin(h * fr * 2) * .02 * h; g.sy = 2 - g.sx; g.glow = h / 2.7;
        const st = h > 2.1 ? 3 : h > 1.4 ? 2 : h > .7 ? 1 : 0; while (g.stage < st) { g.stage++; this.crack(g.stage); }
        this.rays = Math.max(0, (h - 1.3) / 1.4);
        if (Math.random() < dt * 20 * g.glow) { const w = this.eggWorld(254 + rnd(-80, 80), 300 + rnd(-80, 80)); addP({ x: w[0], y: g.y, z: w[1], vz: rnd(60, 140), vx: rnd(-30, 30), life: .8, size: rnd(8, 14), size2: 0, color: this.EP.core }); } }
      else if (h < 3.0) { g.rot *= .8; g.white = (h - 2.7) / .3; g.sx = 1 + (h - 2.7) * .5; g.sy = 1 + (h - 2.7) * .3; this.rays = 1.2; }
      else if (g.vis) {
        g.vis = false; flash(1); shake(12); sfx.boom(); this.breakFx();
        const cols = ['#f7ecd9', P.aura, P.core, '#fff6e8', P.rune];
        for (let i = 0; i < 40; i++) { const a = Math.random() * TAU, s = rnd(140, 420); addP({ type: 'chip', add: false, x: g.x, y: g.y, z: 55, vx: Math.cos(a) * s, vy: Math.sin(a) * s * SQ, vz: rnd(180, 480), grav: 1000, life: rnd(1.2, 1.8), size: rnd(6, 14), color: cols[i % cols.length], rot: rnd(0, TAU), vr: rnd(-12, 12), drag: .6, keep: true }); }
        ring(g.x, g.y, 10, 240, P.aura, .6, 12); ring(g.x, g.y, 10, 170, P.hot, .45, 5); burst(g.x, g.y, 60, 60, P.aura, 560, 22, .8); burst(g.x, g.y, 60, 30, P.hot, 380, 12, .6);
        m.vis = true; m.sil = 1; m.sx = m.sy = .3;
      } else {
        const u = h - 3.0; const pop = clamp(u / .45, 0, 1); const s = easeBack(pop); m.sx = m.sy = Math.max(.3, s);
        this.rays = Math.max(0, 1.2 - u * .5);
        if (u > .7 && m.sil > 0) { m.sil = Math.max(0, 1 - (u - .7) / .45); if (m.sil === 0) { burst(m.x, m.y, 70, 40, P.core, 320, 14, .8); sfx.chime(); this.revealed = true; if (this.rare) { PRISM.forEach((c, i) => { ring(m.x, m.y, 10, 150 + i * 22, c, .5 + i * .06, 5); burst(m.x, m.y, 70, 10, c, 380, 12, .9); }); flash(.5, '#ffffff'); sfx.starup(); } this.onReveal && this.onReveal(); } }
        if (this.rk === 0 && u > 1.25 && u < 1.75) { const q = (u - 1.25) / .5; m.hop = -Math.sin(q * Math.PI) * 26; m.sy = 1 + Math.sin(q * Math.PI * 2) * .08; m.sx = 2 - m.sy; }
        if (this.revealed) { this.aT += dt; this.awaken(dt); }
        if (this.revealed && this.rk >= 2) this.afterFx(dt);
        if (this.revealed && this.aT > this.tl().end && this.phase !== 'done') { this.phase = 'done'; this.onDone && this.onDone(); }
      }
    }
  }
  render() {
    const ctx = E.ctx; worldTransform(); drawGround(); drawDecals(); drawLanternPools();
    const art = ART(), ay = art ? PED.y + 55 : PED.y; // the sprite altar's footprint centre sits lower
    const ents = [{ y: art ? -1e9 : PED.y - 1, d: () => this.drawRuneCircle() }, { y: ay, d: () => this.drawPedestal() }, { y: ay + .5, d: () => this.drawEgg() }, { y: ay + 1, d: () => this.drawMon() }];
    for (const c of crystals()) ents.push({ y: PED.y + c[1], d: () => this.drawCrystal(c) });
    ents.push({ y: ay + .7, d: () => this.drawBeams() }, { y: ay + .9, d: () => this.drawSky() });
    for (const L of LANTERNS) ents.push({ y: L.y, d: () => drawLantern(L) }); for (const b of BUSHES) ents.push({ y: b.y, d: () => drawBush(b) });
    ents.sort((a, b) => a.y - b.y); for (const e of ents) e.d();
    if (this.egg.vis && this.rk >= 2 && this.phase === 'hatching') { // epic+ pre-hatch: dim the scene, crystals + egg stay lit on top
      this.drawDark(); const es = [{ y: (art ? PED.y + 55 : PED.y) + .5, d: () => this.drawEgg() }]; for (const c of crystals()) es.push({ y: PED.y + c[1], d: () => this.drawCrystal(c) });
      es.sort((a, b) => a.y - b.y); this.drawGather(); this.drawPowerBeams(); // beams run into the egg, aura flares behind it
      const [ex] = this.eggC();
      if (this.auraK > 0) { const ctx = E.ctx; ctx.save(); ctx.translate(this.egg.x, this.egg.y + 4); ctx.scale(1, .38); fx(ctx, 'fx_aura_burst_ground', this.col(), 0, 0, 380 * (1 + .06 * Math.sin(E.time * 20)), 380 * (1 + .06 * Math.sin(E.time * 20)), this.auraK * .9, E.time * .6); ctx.restore(); }
      this.drawPowerAura(ex, this.egg.y + 4, this.auraW, this.auraH, this.col(), this.auraK); for (const e of es) e.d(); this.drawExtra && this.drawExtra();
    } else if (this.dark > 0 || this.goldRays > 0) { // awakening: dim the scene, monster on top
      this.drawDark(); this.drawGoldRays();
      if (this.rk >= 2 && this.awBurst) { const m = this.mon; this.drawPowerAura(m.x, m.y, 105 * m.k / .4, 150 * m.k / .4, AW_GOLD, this.goldRays * .9); }
      this.drawMon();
    }
    this.drawRays(); this.drawFx(); drawParts(); this.drawBolts(); this.drawLabels(); drawFlies(); drawOverlays();
  }
  cyl(x, yB, rx, h, top, side, ry) { const ctx = E.ctx; const g = ctx.createLinearGradient(x - rx, 0, x + rx, 0); g.addColorStop(0, '#5a5246'); g.addColorStop(.35, side); g.addColorStop(1, '#4a4238'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x + rx, yB - h); ctx.lineTo(x + rx, yB); ctx.ellipse(x, yB, rx, ry, 0, 0, Math.PI); ctx.lineTo(x - rx, yB - h); ctx.closePath(); ctx.fill(); ctx.fillStyle = top; ctx.beginPath(); ctx.ellipse(x, yB - h, rx, ry, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(50,40,30,.5)'; ctx.lineWidth = 1.5; ctx.stroke(); }
  /** altar colour: teal while idle, the egg's colour while hatching (rainbow eggs cycle) */
  col(i = 0) {
    if (this.phase === 'ready') return IDLE_COL;
    if (this.rk > 0 && this.step > 0) return this.step >= 3 ? PRISM[(Math.floor(E.time * 6) + i) % PRISM.length] : LOOT_GRADES[LOOT_ORDER[this.step]].col;
    return this.tier === 'rainbow' ? PRISM[(Math.floor(E.time * 5) + i) % PRISM.length] : this.EP.aura;
  }
  power() { return this.phase === 'ready' ? .45 + .15 * Math.sin(E.time * 2) : clamp(.6 + this.egg.glow * .9 + (this.egg.vis ? 0 : .6), 0, 1.6); }
  drawRuneCircle() { // big engraved rune circle on the ground, rotating glyph ring
    if (ART()) {
      const ctx = E.ctx, fy = PED.y + FLOOR_Y, pw = this.power();
      if (IMG.hatch_floor) ctx.drawImage(IMG.hatch_floor, PED.x - FLOOR_C[0] * FLOOR_K, fy - FLOOR_C[1] * FLOOR_K, 1536 * FLOOR_K, 1024 * FLOOR_K);
      ctx.save(); ctx.translate(PED.x, fy); ctx.scale(1, .38); fx(ctx, 'fx_rune_circle', this.col(), 0, 0, 640, 640, Math.min(1, pw * .95), E.time * .12); ctx.restore();
      return;
    }
    const ctx = E.ctx, x = PED.x, y = PED.y + 6, t = E.time, pw = this.power(), c = this.col();
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(12,10,8,.35)'; ctx.beginPath(); ctx.ellipse(0, 4, 300, 118, 0, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    for (const [r, wd, a] of [[285, 3, .55], [250, 1.5, .4], [175, 2, .5]]) { ctx.globalAlpha = a * pw; ctx.strokeStyle = c; ctx.lineWidth = wd; ctx.beginPath(); ctx.ellipse(0, 0, r, r * .39, 0, 0, TAU); ctx.stroke(); }
    // hexagram between the rings
    ctx.globalAlpha = .35 * pw; ctx.lineWidth = 1.5; for (let k = 0; k < 2; k++) { ctx.beginPath(); for (let i = 0; i <= 3; i++) { const a = (i / 3) * TAU + k * Math.PI / 3 - t * .15; ctx.lineTo(Math.cos(a) * 245, Math.sin(a) * 245 * .39); } ctx.stroke(); }
    // rotating runes
    ctx.font = '600 22px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = c;
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + t * .25, px = Math.cos(a) * 268, py = Math.sin(a) * 268 * .39; ctx.globalAlpha = pw * (.55 + .45 * Math.sin(t * 3 + i)); ctx.save(); ctx.translate(px, py); ctx.scale(1, .55); ctx.fillText(RUNES[i], 0, 0); ctx.restore(); }
    ctx.restore();
  }
  drawPedestal() { // three-tier carved altar with gold trim and a glowing core gem
    if (ART()) return this.drawAltarArt();
    const ctx = E.ctx, x = PED.x, y = PED.y, t = E.time, c = this.col(), pw = this.power();
    this.cyl(x, y, 150, 16, '#b5ab96', '#857b6a', 54); this.trim(x, y - 16, 150, 54);
    this.cyl(x, y - 16, 114, 14, '#c6bca6', '#91877a', 41); this.trim(x, y - 30, 114, 41);
    this.cyl(x, y - 30, 86, 8, '#d6ccb6', '#9d9384', 31); this.trim(x, y - 38, 86, 31);
    // carved front panels on the base tier + glowing gems
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const gx of [-90, 0, 90]) { const gy = y + 2 - Math.abs(gx) * .12 - 6, big = gx === 0; ctx.globalAlpha = Math.min(1, pw) * (big ? 1 : .7); ctx.drawImage(dot(c), gx - (big ? 22 : 14), gy - (big ? 22 : 14), big ? 44 : 28, big ? 44 : 28); }
    ctx.restore();
    ctx.fillStyle = GOLD[1]; for (const gx of [-90, 0, 90]) { const gy = y + 2 - Math.abs(gx) * .12 - 6, r = gx === 0 ? 7 : 4.5; ctx.beginPath(); ctx.moveTo(gx, gy - r * 1.6); ctx.lineTo(gx + r, gy); ctx.lineTo(gx, gy + r * 1.6); ctx.lineTo(gx - r, gy); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(gx - r * .2, gy - r * .4, r * .3, 0, TAU); ctx.fill(); ctx.fillStyle = GOLD[1]; }
    // glowing ring on the top tier under the egg
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(x, y - 38); ctx.strokeStyle = c; ctx.globalAlpha = Math.min(1, pw); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(0, 0, 64, 23, 0, 0, TAU); ctx.stroke();
    for (let i = 0; i < 10; i++) { const a = i / 10 * TAU + t * .5; ctx.globalAlpha = Math.min(1, pw) * (.6 + .4 * Math.sin(t * 3 + i)); ctx.drawImage(dot(this.col(i)), Math.cos(a) * 64 - 9, Math.sin(a) * 23 - 9, 18, 18); }
    ctx.restore();
    // halo: light column + tilted spinning rings around the egg
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, pw * .85); ctx.drawImage(column(c), x - 90, y - 440, 180, 404);
    this.eggHalo(x, y, pw);
    ctx.restore();
    // rising motes
    if (Math.random() < .25 + pw * .4) { const a = Math.random() * TAU, r = rnd(40, 250); addP({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r * .39, z: 0, vz: rnd(40, 110), life: rnd(1, 1.8), size: rnd(5, 10), size2: 0, color: this.col() }); }
  }
  /** around the waiting egg: comets of light orbiting on two tilted paths (bright head, fading tail) and short
   *  electric crackles that jump off the shell now and then — stronger as the egg's power rises */
  eggHalo(x, y, pw) {
    const ctx = E.ctx, t = E.time, a0 = Math.min(1, .55 + pw * .5);
    // a soft dark under-glow keeps the light trails readable over the pale altar
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const [ry, sp, rr, n] of [[-112, .9, 96, 3], [-160, -1.25, 74, 2]]) {
      const tilt = Math.sin(t * .7 + ry) * .14, ct = Math.cos(tilt), st = Math.sin(tilt);
      const pt = a => { const ex = Math.cos(a) * rr, ey = Math.sin(a) * rr * .3; return [x + ex * ct - ey * st, y + ry + ex * st + ey * ct, Math.sin(a)]; };
      for (let k = 0; k < n; k++) {
        const head = t * sp * 1.7 + k * TAU / n;
        for (let i = 13; i >= 0; i--) { // tail first, head last
          const [px, py, front] = pt(head - Math.sign(sp) * i * .07), f = 1 - i / 14, s = (i ? 22 : 40) * (.35 + .65 * f);
          ctx.globalAlpha = a0 * f * (front > 0 ? 1 : .45); ctx.drawImage(dot(i < 2 ? '#ffffff' : this.col(k + i)), px - s / 2, py - s / 2, s, s);
          if (i === 0) { ctx.globalAlpha = a0 * (front > 0 ? .9 : .4); ctx.drawImage(dot(this.col(k)), px - 30, py - 30, 60, 60); }
        }
      }
    }
    ctx.restore();
    if (Math.random() < .06 + pw * .08) { // a short crackle off the shell
      const ang = Math.random() * TAU, ex = x + Math.cos(ang) * 58, ey = y - 120 + Math.sin(ang) * 78, pts = [[ex, ey]];
      let px = ex, py = ey; for (let i = 0; i < 5; i++) { px += Math.cos(ang) * rnd(8, 14) + rnd(-9, 9); py += Math.sin(ang) * rnd(8, 14) + rnd(-9, 9); pts.push([px, py]); }
      addP({ type: 'bolt', pts, life: .16, color: this.col(), keep: true }); addP({ x: ex, y: ey, z: 0, life: .2, size: 26, size2: 0, color: '#ffffff', keep: true });
    }
  }
  drawAltarArt() {
    const ctx = E.ctx, t = E.time, c = this.col(), pw = this.power(), K = ALT_K, ox = PED.x - DISH[0] * K, oy = PED.y - 38 - DISH[1] * K, sz = 1024 * K;
    ctx.drawImage(IMG.hatch_altar, ox, oy, sz, sz);
    const gl = tinted('hatch_altar_glow', c);
    if (gl) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, pw); ctx.drawImage(gl, ox, oy, sz, sz); ctx.globalAlpha = Math.min(1, pw) * .45; ctx.drawImage(IMG.hatch_altar_glow, ox, oy, sz, sz); ctx.restore(); }
    fx(ctx, 'fx_column', c, PED.x, PED.y - 38 - 205, 170, 430, Math.min(1, pw * .75));
    this.eggHalo(PED.x, PED.y, pw);
    if (Math.random() < .25 + pw * .4) { const a = Math.random() * TAU, r = rnd(60, 300); addP({ x: PED.x + Math.cos(a) * r, y: PED.y + FLOOR_Y + Math.sin(a) * r * .38, z: 0, vz: rnd(40, 110), life: rnd(1, 1.8), size: rnd(5, 10), size2: 0, color: this.col() }); }
  }
  /** centre of a crystal (it hovers above its stand) */
  crystalPos([cx, oy, ph]) {
    const y = PED.y + oy, bob = Math.sin(E.time * 1.6 + ph) * 6;
    if (!ART()) return [cx, y - 70 + bob];
    return [cx, y - (470 - 300) * STAND_K - 12 + bob - 210 * CRY_K];
  }
  drawFx() { const ctx = E.ctx; for (const f of this.fxs) { const u = f.t / f.dur, s = lerp(f.s0, f.s1, easeOut(u)); fx(ctx, f.name, f.col, f.x, f.y, s, s, f.a * (1 - u * u), f.rot); } }
  trim(x, yT, rx, ry) { const ctx = E.ctx; ctx.strokeStyle = GOLD[1]; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, yT, rx - 2, ry - 1, 0, 0, Math.PI); ctx.stroke(); ctx.strokeStyle = 'rgba(255,240,190,.55)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(x, yT - 1, rx - 6, ry - 3, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke(); }
  drawCrystal([cx, oy, ph]) { // floating crystal obelisk on a small carved stand
    if (ART() && IMG.hatch_crystal) {
      const ctx = E.ctx, y = PED.y + oy, c = this.col(ph | 0), pw = this.power(), [, my] = this.crystalPos([cx, oy, ph]);
      ctx.fillStyle = 'rgba(12,10,8,.3)'; ctx.beginPath(); ctx.ellipse(cx, y + 2, 34, 11, 0, 0, TAU); ctx.fill();
      if (IMG.hatch_crystal_stand) ctx.drawImage(IMG.hatch_crystal_stand, cx - 256 * STAND_K, y - 470 * STAND_K, 512 * STAND_K, 512 * STAND_K);
      fx(ctx, 'fx_orb', c, cx, my, 120, 120, Math.min(1, pw * .9));
      const cr = colored('hatch_crystal', lighten(c, .4)), top = my - 260 * CRY_K, sz = 512 * CRY_K;
      ctx.drawImage(cr, cx - 256 * CRY_K, top, sz, sz);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, pw) * .35; ctx.drawImage(cr, cx - 256 * CRY_K, top, sz, sz); ctx.restore();
      return;
    }
    const ctx = E.ctx, t = E.time, y = PED.y + oy, c = this.col(ph | 0), pw = this.power(), bob = Math.sin(t * 1.6 + ph) * 6, hy = y - 70 + bob;
    ctx.fillStyle = 'rgba(12,10,8,.35)'; ctx.beginPath(); ctx.ellipse(cx, y + 3, 30, 11, 0, 0, TAU); ctx.fill();
    this.cyl(cx, y, 24, 22, '#c6bca6', '#8d8372', 9); ctx.strokeStyle = GOLD[1]; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(cx, y - 22, 23, 8, 0, 0, Math.PI); ctx.stroke();
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, pw); ctx.drawImage(dot(c), cx - 46, hy - 50, 92, 92); ctx.restore();
    ctx.save(); ctx.translate(cx, hy); ctx.rotate(Math.sin(t * .8 + ph) * .06);
    const g = ctx.createLinearGradient(-14, -48, 14, 30); g.addColorStop(0, '#ffffff'); g.addColorStop(.35, c); g.addColorStop(1, '#1d2a40');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -48); ctx.lineTo(14, -18); ctx.lineTo(11, 22); ctx.lineTo(0, 32); ctx.lineTo(-11, 22); ctx.lineTo(-14, -18); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.moveTo(0, -48); ctx.lineTo(-14, -18); ctx.lineTo(-3, 18); ctx.lineTo(0, -10); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  drawBeams() { // energy streams from the crystals into the egg while it hatches
    if (this.phase === 'ready' || !this.egg.vis || this.rk >= 2) return; const ctx = E.ctx, t = E.time, k = clamp(this.egg.glow, 0, 1), ex = this.egg.x, ey = this.egg.y - 55;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    crystals().forEach((cr, i) => { const [sx, sy] = this.crystalPos(cr), mx = (sx + ex) / 2, my = Math.min(sy, ey) - 60; const c = this.col(i);
      for (const [w, a] of [[9, .25], [3, .9]]) { ctx.globalAlpha = k * a * (.7 + .3 * Math.sin(t * 20 + i)); ctx.strokeStyle = w > 4 ? c : '#ffffff'; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(mx + Math.sin(t * 9 + i) * 20, my, ex, ey); ctx.stroke(); } });
    ctx.restore();
  }
  drawEgg() {
    const g = this.egg; if (!g.vis) return; const ctx = E.ctx, P = this.EP;
    ctx.fillStyle = 'rgba(15,10,5,.35)'; ctx.beginPath(); ctx.ellipse(g.x, g.y + 2, 44, 13, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(g.x, g.y - g.hop); ctx.rotate(g.rot); ctx.scale(EGGK * g.sx, EGGK * g.sy);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(this.rk >= 2 ? .4 : 1, g.glow * .9); ctx.drawImage(dot(P.aura), -260, -133 - 260, 520, 520); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.drawImage(this.eggSrc, -254, -433, 512, 512); ctx.drawImage(g.cv, -254, -433);
    if (g.cracks.length) { ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = P.core; ctx.lineCap = 'round'; ctx.globalAlpha = Math.min(1, (this.ht || 0) / 2.2); ctx.lineWidth = 5; for (const c of g.cracks) { ctx.beginPath(); c.forEach((q, i) => i ? ctx.lineTo(q[0] - 254, q[1] - 433) : ctx.moveTo(q[0] - 254, q[1] - 433)); ctx.stroke(); } ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
    if (g.white > 0) { ctx.globalAlpha = g.white; ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(dot('#ffffff'), -300, -133 - 300, 600, 600); }
    ctx.restore();
    if (this.phase === 'ready') { ctx.save(); ctx.font = '600 20px "IBM Plex Sans Thai",sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = `rgba(255,246,228,${.7 + .3 * Math.sin(E.time * 3)})`; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 4; const ty = g.y - 150 + Math.sin(E.time * 3) * 4; ctx.strokeText('แตะไข่เพื่อฟัก', g.x, ty); ctx.fillText('แตะไข่เพื่อฟัก', g.x, ty); ctx.restore(); }
  }
  drawMon() {
    const m = this.mon; if (!m.vis) return; const ctx = E.ctx, P = this.P, key = 'front_idle';
    ctx.save(); ctx.translate(m.x, m.y + m.hop); ctx.scale(m.sx * m.k, m.sy * m.k);
    if (this.rare && this.revealed) { const i = Math.floor(E.time * 4) % PRISM.length; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .7 + .3 * Math.sin(E.time * 6); ctx.drawImage(glowOf(this.sid, key, PRISM[i]), -PIV[0] - GP, -PIV[1] - GP); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
    if (m.sil > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = m.sil; ctx.drawImage(glowOf(this.sid, key, P.aura), -PIV[0] - GP, -PIV[1] - GP); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
    if (this.awGlow > 0) { const t = E.time, gw = glowOf(this.sid, key, AW_GOLD); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = this.awGlow * (.75 + .25 * Math.sin(t * 16)); ctx.drawImage(gw, -PIV[0] - GP, -PIV[1] - GP);
      ctx.save(); ctx.translate(0, 0); ctx.scale(1.1 + .04 * Math.sin(t * 11), 1.14 + .06 * Math.sin(t * 9)); ctx.globalAlpha = this.awGlow * .45; ctx.drawImage(gw, -PIV[0] - GP, -PIV[1] - GP); ctx.restore(); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
    ctx.drawImage(spr(this.sid, key), -PIV[0], -PIV[1]);
    if (m.sil > 0) { ctx.globalAlpha = m.sil; ctx.drawImage(silOf(this.sid, key, '#1a0f08'), -PIV[0], -PIV[1]); }
    ctx.restore();
  }
  drawRays() {
    if (this.rays <= 0) return;
    if (fx(E.ctx, 'fx_rays', this.col(), PED.x, PED.y - 90, 820 * Math.min(1.2, this.rays), 820 * Math.min(1.2, this.rays), Math.min(1, this.rays) * .9, E.time * .3)) { fx(E.ctx, 'fx_rays', '#fff6dc', PED.x, PED.y - 90, 520 * Math.min(1.2, this.rays), 520 * Math.min(1.2, this.rays), Math.min(1, this.rays) * .5, -E.time * .2); return; } const ctx = E.ctx, cx = PED.x, cy = PED.y - 90;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(cx, cy);
    for (let i = 0; i < 14; i++) { const a = i / 14 * TAU + E.time * .35 + (i % 2) * .1, len = (260 + ((i * 73) % 5) * 60) * Math.min(1.2, this.rays), w = .05 + ((i * 37) % 4) * .02; const g = ctx.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len); g.addColorStop(0, 'rgba(255,236,190,.5)'); g.addColorStop(1, 'rgba(255,200,120,0)'); ctx.fillStyle = g; ctx.globalAlpha = Math.min(1, this.rays) * (.5 + .5 * Math.sin(E.time * 4 + i)); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a - w) * len, Math.sin(a - w) * len); ctx.lineTo(Math.cos(a + w) * len, Math.sin(a + w) * len); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }
  hitTest(wx, wy) { return Math.hypot(wx - this.egg.x, wy - (this.egg.y - 50)) < 120; }
}
