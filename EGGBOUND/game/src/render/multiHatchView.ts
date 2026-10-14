// @ts-nocheck
// Multi-hatch scene (ฟักทีละ 5 / 10 ฟอง, owner 2026-10-14): the eggs stand in a grid and crack ONE BY ONE; each monster
// pops out with an effect that grows with its rarity — rare: blue ring · epic: purple light pillar + "มหากาพย์!" ·
// legendary: gold flash, lightning, rotating rays + "ตำนาน!" — and rare forms add prism rings. Once revealed, every
// rare-or-better monster keeps a glowing aura frame around its slot (rare form = rainbow). Tap = skip the wait;
// main.ts adds a "skip all" button and shows the DOM summary when onDone fires. Results are saved before it starts.
import { SPECIES, LOOT_GRADES, LOOT_ORDER } from '../core/data';
import { PIV, TAU, spr, silOf, glowOf, GP, dot, fx } from './assets';
import { sfx } from './audio';
import { E, rnd, clamp, easeBack, burst, ring, shake, flash, drawParts, drawGround, worldTransform, screenTransform, drawOverlays } from './engine';

const PRISM = ['#ff6b6b', '#ffb84d', '#ffe66b', '#6bdc8a', '#5bb8ff', '#a98bff'];
const SL = 180, SH = 230;              // slot size in world units
const EK = .3;                          // egg sprite scale (512² art, base at y≈433)
const SHAKE_T = [.5, .75, 1.05, 1.35];  // wobble time before the burst, by rarity (0 common … 3 legendary)
const GAP_T = [.22, .45, .95, 1.6];     // pause after the burst before the next egg
const CALL = ['', '', 'มหากาพย์!', 'ตำนาน!'];
const colOf = rk => rk ? LOOT_GRADES[LOOT_ORDER[rk]].col : '#e8e0d0';
function jag(x0, y0, x1, y1, disp, depth = 5) { // jagged lightning path
  let pts = [[x0, y0], [x1, y1]];
  for (let d = 0; d < depth; d++) { const n = [pts[0]]; for (let i = 1; i < pts.length; i++) { const [ax, ay] = pts[i - 1], [bx, by] = pts[i]; n.push([(ax + bx) / 2 + rnd(-disp, disp), (ay + by) / 2 + rnd(-disp * .3, disp * .3)], [bx, by]); } pts = n; disp *= .55; }
  return pts;
}

export class MultiHatchView {
  items; phase = 'intro'; t = 0; cur = 0; onDone = null; callout = null; bolts = []; cols = 5; rows = 1; ended = 0;
  /** list: [{ sid (look id to draw), base (species id), eggSrc, tier, rare, stars, isNew }] */
  constructor(list) {
    this.items = list.map((o, i) => { const s = SPECIES[o.base]; return { ...o, i, rk: Math.max(0, LOOT_ORDER.indexOf(s.rarity)), name: s.name, k: clamp(.3 * (s.scale || 1), .24, .4), st: 'wait', t: 0, pt: 0, glow: 0, rot: 0, hop: 0, step: 0, pillar: 0, rays: 0, x: 0, y: 0 }; });
    this.layout();
  }
  start() { E.camT.x = E.cam.x = 0; E.camT.y = E.cam.y = 0; sfx.whoosh(); }
  /** grid: up to 5 per row on wide screens, 3 per row on phones; zoom so the whole grid fits */
  layout() {
    const n = this.items.length, portrait = E.W < E.H * .9;
    this.cols = portrait ? Math.min(n, n <= 4 ? 2 : 3) : Math.min(n, 5); this.rows = Math.ceil(n / this.cols);
    const z = Math.min(E.W * .94 / (this.cols * SL), (E.H - 150) / (this.rows * SH), 1.35);
    E.zoomT = E.zoom = z / E.base;
    this.items.forEach((it, i) => {
      const r = Math.floor(i / this.cols), inRow = Math.min(this.cols, n - r * this.cols), c = i - r * this.cols;
      it.x = (c - (inRow - 1) / 2) * SL; it.y = (r - (this.rows - 1) / 2) * SH + SH * .3 + 6; // y = feet line inside the slot
    });
  }
  hitTest() { return true; }
  /** tap: the egg that is wobbling bursts now; during a pause, the next egg starts */
  tap() {
    if (this.phase !== 'run') return;
    const it = this.items[this.cur]; if (!it) return;
    if (it.st === 'shake') it.t = SHAKE_T[it.rk]; else if (it.st === 'pop') it.pt = Math.max(it.pt, GAP_T[it.rk] + (it.rare ? .3 : 0));
  }
  /** reveal everything left at once (the "ข้าม" button) */
  skipAll() {
    if (this.phase === 'done') return;
    for (const it of this.items) if (it.st !== 'pop' && it.st !== 'shown') { it.st = 'shown'; it.pt = 9; }
    flash(.35); sfx.chime(); this.cur = this.items.length; this.phase = 'end'; this.ended = 0;
  }
  burstFx(it) {
    const { x, y, rk } = it, C = colOf(rk), cy = y - 55;
    it.st = 'pop'; it.pt = 0;
    burst(x, cy, 30, 14 + rk * 10, C, 220 + rk * 90, 9 + rk * 2, .7); burst(x, cy, 30, 10, '#fff6e0', 160, 7, .5);
    ring(x, y, 8, 80 + rk * 40, C, .55, 5);
    if (rk === 0) sfx.crack();
    if (rk >= 1) { ring(x, y, 8, 130 + rk * 30, C, .7, 7); flash(.12 + rk * .08, C); sfx.chime(); }
    if (rk >= 2) { it.pillar = 1.5; shake(5 + rk * 3); sfx.perfect(); this.callout = { text: CALL[rk], col: C, t: 0 }; }
    if (rk >= 3) {
      it.rays = 1.8; flash(.8, '#fff3c0'); sfx.boom(); setTimeout(() => sfx.starup(), 250);
      for (let b = 0; b < 4; b++) this.bolts.push({ pts: jag(x + rnd(-160, 160), y - 760, x + rnd(-12, 12), cy, 70), t: 0, life: .35 + b * .1, col: b % 2 ? '#fff6c8' : C });
      burst(x, cy, 40, 50, '#ffe28a', 520, 14, 1.1); ring(x, y, 10, 300, '#ffd24a', .9, 10);
    }
    if (it.rare) { PRISM.forEach((c, k) => ring(x, y, 8, 110 + k * 18, c, .5 + k * .06, 4)); burst(x, cy, 40, 24, '#ffffff', 300, 9, .8); sfx.starup(); if (!this.callout || rk < 2) this.callout = { text: 'ร่างหายาก!', col: '#ff9ad8', t: 0, prism: true }; }
  }
  update(dt) {
    this.layout(); this.t += dt;
    for (const b of this.bolts) b.t += dt; this.bolts = this.bolts.filter(b => b.t < b.life);
    if (this.callout) { this.callout.t += dt; if (this.callout.t > 1.4) this.callout = null; }
    for (const it of this.items) {
      if (it.st === 'pop' || it.st === 'shown') { it.pt += dt; it.pillar = Math.max(0, it.pillar - dt); it.rays = Math.max(0, it.rays - dt * .6); }
    }
    if (this.phase === 'intro') { if (this.t > .55) { this.phase = 'run'; this.next(); } return; }
    if (this.phase === 'run') {
      const it = this.items[this.cur];
      if (it.st === 'shake') {
        it.t += dt; const T = SHAKE_T[it.rk], h = it.t / T;
        it.rot = Math.sin(it.t * (16 + h * 18)) * (.03 + h * .12); it.hop = Math.max(0, Math.sin(it.t * 14)) * h * 6; it.glow = Math.min(1, h * 1.2);
        // the glow steps up through the rarity colours (same language as the chest and the single hatch)
        if (it.rk > 0) { const s = Math.min(it.rk, Math.floor(h * (it.rk + 1))); if (s > it.step) { it.step = s; sfx.perfect(); flash(.12, colOf(s)); } }
        if (it.t >= T) this.burstFx(it);
      } else if (it.st === 'pop' && it.pt >= GAP_T[it.rk] + (it.rare ? .3 : 0)) { it.st = 'shown'; this.cur++; this.next(); }
      return;
    }
    if (this.phase === 'end') { this.ended += dt; if (this.ended > .7) { this.phase = 'done'; this.onDone && this.onDone(); } }
  }
  next() {
    const it = this.items[this.cur];
    if (!it) { this.phase = 'end'; this.ended = 0; return; }
    it.st = 'shake'; it.t = 0; sfx.whoosh();
  }
  render() {
    const ctx = E.ctx; worldTransform(); drawGround();
    ctx.fillStyle = 'rgba(8,8,18,.55)'; ctx.fillRect(-3000, -3000, 6000, 6000); // dim the field so the eggs stand out
    const intro = clamp(this.t / .55, 0, 1);
    for (const it of this.items) this.drawSlot(it, intro);
    for (const it of this.items) this.drawBehind(it);
    for (const it of this.items) { if (it.st === 'pop' || it.st === 'shown') this.drawMon(it); else this.drawEgg(it, intro); }
    for (const it of this.items) this.drawLabel(it);
    drawParts(); this.drawBolts();
    screenTransform(); this.drawCallout(); this.drawTitle();
    drawOverlays();
  }
  slotRect(it) { return [it.x - SL * .46, it.y - SH * .78, SL * .92, SH * .92]; }
  rr(x, y, w, h, r) { const ctx = E.ctx; ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  drawSlot(it, intro) {
    const ctx = E.ctx, [x, y, w, h] = this.slotRect(it), shown = it.st === 'pop' || it.st === 'shown';
    ctx.save(); ctx.globalAlpha = intro;
    this.rr(x, y, w, h, 16); ctx.fillStyle = 'rgba(14,12,22,.72)'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,230,180,.16)'; ctx.stroke();
    // aura frame for rare-or-better (rainbow for a rare form): drawn once revealed, pulsing
    if (shown && (it.rk >= 1 || it.rare)) {
      const pop = clamp(it.pt / .35, 0, 1), pulse = .75 + .25 * Math.sin(E.time * (3 + it.rk)), C = it.rare ? PRISM[Math.floor(E.time * 6) % PRISM.length] : colOf(it.rk);
      const g = ctx.createRadialGradient(it.x, it.y - 20, 10, it.x, it.y - 40, SH * .7); g.addColorStop(0, C + '55'); g.addColorStop(1, C + '00');
      this.rr(x, y, w, h, 16); ctx.fillStyle = g; ctx.globalAlpha = intro * pop; ctx.fill();
      ctx.shadowColor = C; ctx.shadowBlur = 10 + it.rk * 8 * pulse; ctx.lineWidth = 2 + it.rk * 1.2;
      if (it.rare) { const lg = ctx.createLinearGradient(x, y, x + w, y + h); PRISM.forEach((c, k) => lg.addColorStop(((k / PRISM.length) + E.time * .4) % 1, c)); ctx.strokeStyle = lg; } else ctx.strokeStyle = C;
      ctx.globalAlpha = intro * pop * pulse; this.rr(x, y, w, h, 16); ctx.stroke();
      if (it.rk >= 3) { ctx.lineWidth = 1.5; ctx.shadowBlur = 24; ctx.globalAlpha = intro * pop * (.4 + .3 * Math.sin(E.time * 5)); this.rr(x - 5, y - 5, w + 10, h + 10, 20); ctx.stroke(); }
    }
    ctx.restore();
  }
  drawBehind(it) {
    const ctx = E.ctx;
    if (it.rays > 0) { const a = Math.min(1, it.rays); if (!fx(ctx, 'fx_rays', '#ffd24a', it.x, it.y - 60, 420 * a, 420 * a, a * .8, E.time * .4)) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * .7; ctx.drawImage(dot('#ffd24a'), it.x - 200, it.y - 260, 400, 400); ctx.restore(); } }
    if (it.pillar > 0) { // epic+: a light pillar rising from the slot
      const a = Math.min(1, it.pillar), C = colOf(it.rk), w = 46 + it.rk * 10;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createLinearGradient(0, it.y, 0, it.y - 900); g.addColorStop(0, C); g.addColorStop(.4, C + '88'); g.addColorStop(1, C + '00');
      ctx.globalAlpha = a * .8; ctx.fillStyle = g; ctx.fillRect(it.x - w / 2, it.y - 900, w, 900); ctx.globalAlpha = a; ctx.fillStyle = '#ffffff'; ctx.fillRect(it.x - w * .12, it.y - 700, w * .24, 700); ctx.restore();
    }
  }
  drawEgg(it, intro) {
    const ctx = E.ctx, drop = (1 - intro) * -60, C = colOf(it.step);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(it.x, it.y + 2, 34, 10, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(it.x, it.y - it.hop + drop); ctx.rotate(it.rot); ctx.scale(EK, EK);
    if (it.glow > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = it.glow * (.6 + .3 * Math.sin(E.time * 20)); ctx.drawImage(dot(C), -260, -433 - 130, 520, 520); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
    ctx.drawImage(it.eggSrc, -254, -433, 512, 512);
    if (it.st === 'shake' && it.t / SHAKE_T[it.rk] > .6) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (it.t / SHAKE_T[it.rk] - .6) * 2.2; ctx.drawImage(dot('#ffffff'), -280, -433 - 150, 560, 560); }
    ctx.restore();
  }
  drawMon(it) {
    const ctx = E.ctx, key = 'front_idle', s = easeBack(clamp(it.pt / .4, 0, 1)), sil = 1 - clamp((it.pt - .25) / .3, 0, 1), k = it.k * Math.max(.2, s);
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(it.x, it.y + 2, 40 * s, 11 * s, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(it.x, it.y + Math.sin(E.time * 2 + it.i) * 1.5); ctx.scale(k, k);
    if (it.rk >= 2 || it.rare) { const C = it.rare ? PRISM[Math.floor(E.time * 5) % PRISM.length] : colOf(it.rk); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .55 + .25 * Math.sin(E.time * 5); ctx.drawImage(glowOf(it.sid, key, C), -PIV[0] - GP, -PIV[1] - GP); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
    ctx.drawImage(spr(it.sid, key), -PIV[0], -PIV[1]);
    if (sil > 0) { ctx.globalAlpha = sil; ctx.drawImage(silOf(it.sid, key, '#fff6e0'), -PIV[0], -PIV[1]); }
    ctx.restore();
  }
  drawLabel(it) {
    const ctx = E.ctx, shown = it.st === 'pop' || it.st === 'shown'; if (!shown) return;
    const a = clamp((it.pt - .3) / .3, 0, 1); if (a <= 0) return;
    ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    ctx.font = '700 17px "IBM Plex Sans Thai",sans-serif'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.fillStyle = it.rk ? colOf(it.rk) : '#f4ead8';
    ctx.strokeText(it.name, it.x, it.y + 24); ctx.fillText(it.name, it.x, it.y + 24);
    ctx.font = '700 15px sans-serif'; const st = '★'.repeat(it.stars); ctx.fillStyle = it.rare ? '#ff9ad8' : '#ffd24a'; ctx.strokeText(st, it.x, it.y + 44); ctx.fillText(st, it.x, it.y + 44);
    if (it.isNew) { // NEW tag in the slot's top-left corner
      const [x, y] = this.slotRect(it); ctx.translate(x + 30, y + 16); ctx.rotate(-.18); ctx.font = '900 15px sans-serif';
      const g = ctx.createLinearGradient(-24, 0, 24, 0); PRISM.forEach((c, k) => g.addColorStop(k / (PRISM.length - 1), c)); ctx.fillStyle = g; ctx.strokeText('NEW!', 0, 0); ctx.fillText('NEW!', 0, 0);
    }
    ctx.restore();
  }
  drawBolts() {
    const ctx = E.ctx; if (!this.bolts.length) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const b of this.bolts) { const a = 1 - b.t / b.life; for (const [w, c, al] of [[10, b.col, .35], [3, '#ffffff', 1]]) { ctx.globalAlpha = a * al; ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); b.pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); } }
    ctx.restore();
  }
  drawCallout() {
    const c = this.callout; if (!c) return; const ctx = E.ctx, t = c.t, s = easeBack(clamp(t / .3, 0, 1)), a = t < 1.1 ? 1 : 1 - (t - 1.1) / .3;
    ctx.save(); ctx.globalAlpha = clamp(a, 0, 1); ctx.translate(E.W / 2, Math.min(E.H * .2, 150)); ctx.scale(s, s); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `900 ${Math.round(Math.min(64, E.W / 9))}px "Mitr","IBM Plex Sans Thai",sans-serif`; ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(20,10,0,.85)'; ctx.strokeText(c.text, 0, 0);
    if (c.prism) { const g = ctx.createLinearGradient(-150, 0, 150, 0); PRISM.forEach((p, k) => g.addColorStop(k / (PRISM.length - 1), p)); ctx.fillStyle = g; } else ctx.fillStyle = c.col;
    ctx.shadowColor = c.col; ctx.shadowBlur = 24; ctx.fillText(c.text, 0, 0); ctx.restore();
  }
  drawTitle() {
    const ctx = E.ctx, n = this.items.length, done = this.items.filter(i => i.st === 'pop' || i.st === 'shown').length;
    ctx.save(); ctx.textAlign = 'center'; ctx.font = '700 16px "IBM Plex Sans Thai",sans-serif'; ctx.fillStyle = 'rgba(255,246,228,.85)'; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 4;
    const txt = `ฟักไข่ ${n} ฟอง · ${done}/${n}${this.phase === 'run' ? ' · แตะจอเพื่อเร่ง' : ''}`; ctx.strokeText(txt, E.W / 2, 34); ctx.fillText(txt, E.W / 2, 34);
    ctx.restore();
  }
}
