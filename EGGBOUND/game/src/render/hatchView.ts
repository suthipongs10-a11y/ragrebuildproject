// @ts-nocheck
// Hatch scene: egg on a rune pedestal → wobble → 3 crack stages → light rays → burst → silhouette → reveal.
import { SPECIES, LOOT_GRADES, LOOT_ORDER } from '../core/data';
import { PAL, PIV, TAU, spr, silOf, glowOf, GP, dot, eggImg, mk, TIER_COL, IMG, fx, tinted, colored } from './assets';
import { sfx } from './audio';
import { E, SQ, lerp, rnd, clamp, easeOut, easeBack, run, tween, addP, burst, ring, shake, flash, drawParts, drawDecals, drawGround, drawLantern, drawBush, drawLanternPools, drawFlies, LANTERNS, BUSHES, worldTransform, drawOverlays } from './engine';

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
  constructor(sid, opts) {
    this.sid = sid; this.P = PAL[SPECIES[sid].elem]; Object.assign(this, opts);
    this.egg = { x: PED.x, y: PED.y - 38, rot: 0, hop: 0, sx: 1, sy: 1, glow: 0, white: 0, vis: true, cracks: [], cv: mk(512, 512), stage: 0, t: 0 };
    this.mon = { x: PED.x, y: PED.y - 38, hop: 0, sx: .3, sy: .3, sil: 1, vis: false, k: .4 * (SPECIES[sid].scale || 1) };
    // mystery eggs glow in their tier colour so the element stays hidden until the reveal
    // monster rarity drives how grand the hatch is: 0 common · 1 rare · 2 epic · 3 legendary
    this.rk = Math.max(0, LOOT_ORDER.indexOf(this.rarityOverride || SPECIES[sid].rarity));
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
  drawSky() {
    if (this.rk < 2 || !this.revealed || this.postT > 4) return; const m = this.mon, a = Math.min(1, this.postT * 3) * Math.max(0, 1 - Math.max(0, this.postT - 3));
    fx(E.ctx, 'fx_column', this.col(), m.x, m.y - 430, 200 + this.rk * 50, 980, a * .55);
  }
  update(dt) {
    for (const f of this.fxs) f.t += dt; this.fxs = this.fxs.filter(f => f.t < f.dur);
    if (this.phase === 'hatching' && this.egg.vis && ART() && Math.random() < dt * (4 + this.egg.glow * 14)) this.addFx('fx_sparkle', this.col(), PED.x + rnd(-70, 70), PED.y - 90 + rnd(-70, 50), 20, rnd(50, 90), .5, rnd(0, 1));
    const g = this.egg, m = this.mon, P = this.P;
    g.t += dt; const t = g.t;
    if (this.phase === 'ready') { g.rot = Math.sin(t * 2) * .02 + (t % 3.2 > 2.8 ? Math.sin(t * 40) * .05 : 0); g.glow = .25 + .15 * Math.sin(t * 2.4); return; }
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
        if (u > 1.25 && u < 1.75) { const q = (u - 1.25) / .5; m.hop = -Math.sin(q * Math.PI) * 26; m.sy = 1 + Math.sin(q * Math.PI * 2) * .08; m.sx = 2 - m.sy; }
        if (this.dup && u > 1.9 && !this.starFx) { this.starFx = true; sfx.starup(); ring(m.x, m.y, 10, 220, '#ffd27a', .7, 10); addP({ type: 'beam', x: m.x, y: m.y + 1, life: 1, size: 90, color: P.aura }); burst(m.x, m.y, 80, 50, '#ffe39a', 420, 16, .9); flash(.6, P.hot); }
        if (this.revealed && this.rk >= 2) this.afterFx(dt);
        if (u > (this.dup ? 3.2 : 2.4) + this.rk * .6 && this.phase !== 'done') { this.phase = 'done'; this.onDone && this.onDone(); }
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
    this.drawRays(); this.drawFx(); drawParts(); drawFlies(); drawOverlays();
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
    for (const [ry, sp, rr] of [[-110, .9, 92], [-160, -1.3, 72]]) { ctx.save(); ctx.translate(x, y + ry); ctx.rotate(Math.sin(t * .7) * .15); ctx.globalAlpha = Math.min(1, pw) * .55; ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.setLineDash([14, 10]); ctx.lineDashOffset = t * 40 * sp; ctx.beginPath(); ctx.ellipse(0, 0, rr, rr * .28, 0, 0, TAU); ctx.stroke(); ctx.restore(); }
    ctx.restore();
    // rising motes
    if (Math.random() < .25 + pw * .4) { const a = Math.random() * TAU, r = rnd(40, 250); addP({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r * .39, z: 0, vz: rnd(40, 110), life: rnd(1, 1.8), size: rnd(5, 10), size2: 0, color: this.col() }); }
  }
  drawAltarArt() {
    const ctx = E.ctx, t = E.time, c = this.col(), pw = this.power(), K = ALT_K, ox = PED.x - DISH[0] * K, oy = PED.y - 38 - DISH[1] * K, sz = 1024 * K;
    ctx.drawImage(IMG.hatch_altar, ox, oy, sz, sz);
    const gl = tinted('hatch_altar_glow', c);
    if (gl) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, pw); ctx.drawImage(gl, ox, oy, sz, sz); ctx.globalAlpha = Math.min(1, pw) * .45; ctx.drawImage(IMG.hatch_altar_glow, ox, oy, sz, sz); ctx.restore(); }
    fx(ctx, 'fx_column', c, PED.x, PED.y - 38 - 205, 170, 430, Math.min(1, pw * .75));
    for (const [ry, sp, rr] of [[-110, .9, 92], [-160, -1.3, 72]]) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(PED.x, PED.y + ry); ctx.rotate(Math.sin(t * .7) * .15); ctx.globalAlpha = Math.min(1, pw) * .5; ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.setLineDash([14, 10]); ctx.lineDashOffset = t * 40 * sp; ctx.beginPath(); ctx.ellipse(0, 0, rr, rr * .28, 0, 0, TAU); ctx.stroke(); ctx.restore(); }
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
    if (this.phase === 'ready' || !this.egg.vis) return; const ctx = E.ctx, t = E.time, k = clamp(this.egg.glow, 0, 1), ex = this.egg.x, ey = this.egg.y - 55;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    crystals().forEach((cr, i) => { const [sx, sy] = this.crystalPos(cr), mx = (sx + ex) / 2, my = Math.min(sy, ey) - 60; const c = this.col(i);
      for (const [w, a] of [[9, .25], [3, .9]]) { ctx.globalAlpha = k * a * (.7 + .3 * Math.sin(t * 20 + i)); ctx.strokeStyle = w > 4 ? c : '#ffffff'; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(mx + Math.sin(t * 9 + i) * 20, my, ex, ey); ctx.stroke(); } });
    ctx.restore();
  }
  drawEgg() {
    const g = this.egg; if (!g.vis) return; const ctx = E.ctx, P = this.EP;
    ctx.fillStyle = 'rgba(15,10,5,.35)'; ctx.beginPath(); ctx.ellipse(g.x, g.y + 2, 44, 13, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(g.x, g.y - g.hop); ctx.rotate(g.rot); ctx.scale(EGGK * g.sx, EGGK * g.sy);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, g.glow * .9); ctx.drawImage(dot(P.aura), -260, -133 - 260, 520, 520); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
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
    ctx.drawImage(spr(this.sid, key), -PIV[0], -PIV[1]);
    if (m.sil > 0) { ctx.globalAlpha = m.sil; ctx.drawImage(silOf(this.sid, key, '#1a0f08'), -PIV[0], -PIV[1]); }
    ctx.restore();
    if (this.rk > 0 && this.revealed) { // rarity banner pops in above the monster
      const sz = (this.rk >= 3 ? 40 : this.rk === 2 ? 34 : 28) * (0.6 + 0.4 * easeBack(Math.min(1, (this.bannerT = (this.bannerT || 0) + .016) * 3)));
      const txt = LOOT_GRADES[LOOT_ORDER[this.rk]].name + (this.rk >= 3 ? '!!' : '!'), ty = m.y - 270 * m.k / .4;
      ctx.save(); ctx.font = `700 ${sz}px Mitr, sans-serif`; ctx.textAlign = 'center'; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 6; ctx.strokeText(txt, m.x, ty);
      ctx.fillStyle = this.rk >= 3 ? PRISM[Math.floor(E.time * 6) % PRISM.length] : LOOT_GRADES[LOOT_ORDER[this.rk]].col; ctx.fillText(txt, m.x, ty); ctx.restore();
    }
    if (this.rare && this.revealed) { ctx.save(); ctx.font = '700 24px "IBM Plex Sans Thai",sans-serif'; ctx.textAlign = 'center'; const ty = m.y - 210 * m.k / .4 + Math.sin(E.time * 3) * 4; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 5; ctx.strokeText('ร่างหายาก!', m.x, ty); ctx.fillStyle = PRISM[Math.floor(E.time * 4) % PRISM.length]; ctx.fillText('ร่างหายาก!', m.x, ty); ctx.restore(); }
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
