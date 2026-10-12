// @ts-nocheck
// Hatch scene: egg on a rune pedestal → wobble → 3 crack stages → light rays → burst → silhouette → reveal.
import { SPECIES } from '../core/data';
import { PAL, PIV, TAU, spr, silOf, glowOf, GP, dot, eggImg, mk, TIER_COL } from './assets';
import { sfx } from './audio';
import { E, SQ, lerp, rnd, clamp, easeOut, easeBack, run, tween, addP, burst, ring, shake, flash, drawParts, drawDecals, drawGround, drawLantern, drawBush, drawLanternPools, drawFlies, LANTERNS, BUSHES, worldTransform, drawOverlays } from './engine';

const PED = { x: 0, y: -40 }, EGGK = .42;
const PRISM = ['#ff6b6b', '#ffb84d', '#ffe66b', '#6bdc8a', '#5bb8ff', '#a98bff'];
// 4 floating crystal obelisks around the altar: [x, y offset from the pedestal, phase] — two behind, two in front at the sides
const CRYSTALS = [[-178, -72, 0], [178, -72, 1.7], [-196, 52, 3.1], [196, 52, 4.4]];
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
  sid; P; EP; egg; mon; phase = 'ready'; rays = 0; onDone = null; dup = false; newStars = 1; eggSrc = null; tier = null; rare = false; revealed = false;
  constructor(sid, opts) {
    this.sid = sid; this.P = PAL[SPECIES[sid].elem]; Object.assign(this, opts);
    this.egg = { x: PED.x, y: PED.y - 38, rot: 0, hop: 0, sx: 1, sy: 1, glow: 0, white: 0, vis: true, cracks: [], cv: mk(512, 512), stage: 0, t: 0 };
    this.mon = { x: PED.x, y: PED.y - 38, hop: 0, sx: .3, sy: .3, sil: 1, vis: false, k: .4 * (SPECIES[sid].scale || 1) };
    // mystery eggs glow in their tier colour so the element stays hidden until the reveal
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
  update(dt) {
    const g = this.egg, m = this.mon, P = this.P;
    g.t += dt; const t = g.t;
    if (this.phase === 'ready') { g.rot = Math.sin(t * 2) * .02 + (t % 3.2 > 2.8 ? Math.sin(t * 40) * .05 : 0); g.glow = .25 + .15 * Math.sin(t * 2.4); return; }
    if (this.phase === 'hatching') {
      if (!this.ht) this.ht = 0; this.ht += dt; const h = this.ht;
      if (h < 2.7) { const amp = .025 + h / 2.7 * .17, fr = 7 + h * 5; g.rot = Math.sin(h * fr) * amp; g.hop = Math.max(0, Math.sin(h * fr * .5)) * h * 3; g.sx = 1 + Math.sin(h * fr * 2) * .02 * h; g.sy = 2 - g.sx; g.glow = h / 2.7;
        const st = h > 2.1 ? 3 : h > 1.4 ? 2 : h > .7 ? 1 : 0; while (g.stage < st) { g.stage++; this.crack(g.stage); }
        this.rays = Math.max(0, (h - 1.3) / 1.4);
        if (Math.random() < dt * 20 * g.glow) { const w = this.eggWorld(254 + rnd(-80, 80), 300 + rnd(-80, 80)); addP({ x: w[0], y: g.y, z: w[1], vz: rnd(60, 140), vx: rnd(-30, 30), life: .8, size: rnd(8, 14), size2: 0, color: this.EP.core }); } }
      else if (h < 3.0) { g.rot *= .8; g.white = (h - 2.7) / .3; g.sx = 1 + (h - 2.7) * .5; g.sy = 1 + (h - 2.7) * .3; this.rays = 1.2; }
      else if (g.vis) {
        g.vis = false; flash(1); shake(12); sfx.boom();
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
        if (u > (this.dup ? 3.2 : 2.4) && this.phase !== 'done') { this.phase = 'done'; this.onDone && this.onDone(); }
      }
    }
  }
  render() {
    const ctx = E.ctx; worldTransform(); drawGround(); drawDecals(); drawLanternPools();
    const ents = [{ y: PED.y - 1, d: () => this.drawRuneCircle() }, { y: PED.y, d: () => this.drawPedestal() }, { y: PED.y + .5, d: () => this.drawEgg() }, { y: PED.y + 1, d: () => this.drawMon() }];
    for (const c of CRYSTALS) ents.push({ y: PED.y + c[1], d: () => this.drawCrystal(c) });
    ents.push({ y: PED.y + .7, d: () => this.drawBeams() });
    for (const L of LANTERNS) ents.push({ y: L.y, d: () => drawLantern(L) }); for (const b of BUSHES) ents.push({ y: b.y, d: () => drawBush(b) });
    ents.sort((a, b) => a.y - b.y); for (const e of ents) e.d();
    this.drawRays(); drawParts(); drawFlies(); drawOverlays();
  }
  cyl(x, yB, rx, h, top, side, ry) { const ctx = E.ctx; const g = ctx.createLinearGradient(x - rx, 0, x + rx, 0); g.addColorStop(0, '#5a5246'); g.addColorStop(.35, side); g.addColorStop(1, '#4a4238'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x + rx, yB - h); ctx.lineTo(x + rx, yB); ctx.ellipse(x, yB, rx, ry, 0, 0, Math.PI); ctx.lineTo(x - rx, yB - h); ctx.closePath(); ctx.fill(); ctx.fillStyle = top; ctx.beginPath(); ctx.ellipse(x, yB - h, rx, ry, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(50,40,30,.5)'; ctx.lineWidth = 1.5; ctx.stroke(); }
  /** altar colour: teal while idle, the egg's colour while hatching (rainbow eggs cycle) */
  col(i = 0) { return this.phase === 'ready' ? IDLE_COL : this.tier === 'rainbow' ? PRISM[(Math.floor(E.time * 5) + i) % PRISM.length] : this.EP.aura; }
  power() { return this.phase === 'ready' ? .45 + .15 * Math.sin(E.time * 2) : clamp(.6 + this.egg.glow * .9 + (this.egg.vis ? 0 : .6), 0, 1.6); }
  drawRuneCircle() { // big engraved rune circle on the ground, rotating glyph ring
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
  trim(x, yT, rx, ry) { const ctx = E.ctx; ctx.strokeStyle = GOLD[1]; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, yT, rx - 2, ry - 1, 0, 0, Math.PI); ctx.stroke(); ctx.strokeStyle = 'rgba(255,240,190,.55)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(x, yT - 1, rx - 6, ry - 3, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke(); }
  drawCrystal([cx, oy, ph]) { // floating crystal obelisk on a small carved stand
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
    CRYSTALS.forEach(([cx, oy, ph], i) => { const sx = cx, sy = PED.y + oy - 70 + Math.sin(t * 1.6 + ph) * 6, mx = (sx + ex) / 2, my = Math.min(sy, ey) - 60; const c = this.col(i);
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
    if (this.rare && this.revealed) { ctx.save(); ctx.font = '700 24px "IBM Plex Sans Thai",sans-serif'; ctx.textAlign = 'center'; const ty = m.y - 210 * m.k / .4 + Math.sin(E.time * 3) * 4; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 5; ctx.strokeText('ร่างหายาก!', m.x, ty); ctx.fillStyle = PRISM[Math.floor(E.time * 4) % PRISM.length]; ctx.fillText('ร่างหายาก!', m.x, ty); ctx.restore(); }
  }
  drawRays() {
    if (this.rays <= 0) return; const ctx = E.ctx, cx = PED.x, cy = PED.y - 90;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(cx, cy);
    for (let i = 0; i < 14; i++) { const a = i / 14 * TAU + E.time * .35 + (i % 2) * .1, len = (260 + ((i * 73) % 5) * 60) * Math.min(1.2, this.rays), w = .05 + ((i * 37) % 4) * .02; const g = ctx.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len); g.addColorStop(0, 'rgba(255,236,190,.5)'); g.addColorStop(1, 'rgba(255,200,120,0)'); ctx.fillStyle = g; ctx.globalAlpha = Math.min(1, this.rays) * (.5 + .5 * Math.sin(E.time * 4 + i)); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a - w) * len, Math.sin(a - w) * len); ctx.lineTo(Math.cos(a + w) * len, Math.sin(a + w) * len); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }
  hitTest(wx, wy) { return Math.hypot(wx - this.egg.x, wy - (this.egg.y - 50)) < 120; }
}
