// @ts-nocheck
// Shared canvas engine: camera, ground/world props, particles, decals, projectiles, coroutine scripts.
import { TAU, mk, dot, fx } from './assets';

export const SQ = .6;
export const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a) * t, rnd = (a, b) => a + Math.random() * (b - a);
export const easeOut = t => 1 - Math.pow(1 - t, 3), easeIn = t => t * t * t, easeIO = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2, easeBack = t => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
export function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

export const E = {
  cv: null, ctx: null, W: 0, H: 0, DPR: 1, base: 1, zoom: 1, zoomT: 1, cam: { x: 0, y: 0 }, camT: { x: 0, y: 0 },
  time: 0, hitstop: 0, dim: 0, dimT: 0, flash: 0, flashC: '#fff', shake: 0, quality: 1,
  parts: [], projs: [], decals: [], scripts: [], vign: null, ground: null, loc: null, // loc: location hooks (render/locations.ts)
};

// ---------- coroutines: yield <seconds> to wait, yield 0 = next frame (receives dt) ----------
export function run(gen) { const s = { gen, wait: 0, done: false }; E.scripts.push(s); return s; }
export function* tween(d, fn) { let t = 0; while (t < d) { fn(Math.min(1, t / d)); t += yield 0; } fn(1); }
export function* waitAll(list) { while (list.some(s => !s.done)) yield 0; }
export function* waitUntil(cond) { while (!cond()) yield 0; }
export function updScripts(dt) {
  let err = null; // a coroutine that throws is dropped (the others keep running); the error is rethrown for the caller to report
  for (const s of E.scripts.slice()) { if (s.done) continue; if (s.wait > 0) { s.wait -= dt; if (s.wait > 0) continue; } try { const r = s.gen.next(dt); if (r.done) s.done = true; else s.wait = r.value || 0; } catch (e) { s.done = true; err = err || e; } }
  E.scripts = E.scripts.filter(s => !s.done);
  if (err) throw err;
}
export function clearAll() { E.scripts = []; E.parts = []; E.projs = []; E.decals = []; E.dim = E.dimT = 0; E.zoom = E.zoomT = 1; E.hitstop = 0; E.flash = 0; E.shake = 0; }

// ---------- particles ----------
export function addP(o) {
  if (E.quality < 1 && !o.keep && Math.random() > E.quality) return;
  if (E.parts.length > 1100) E.parts.shift();
  E.parts.push(Object.assign({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, t: 0, life: 1, size: 10, size2: null, color: '#ffa040', grav: 0, drag: 0, add: true, type: 'glow', rot: 0, vr: 0, alpha: 1 }, o));
}
export function burst(x, y, z, n, color, spd, size, life, o = {}) { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, s = spd * (.3 + Math.random() * .7); addP(Object.assign({ x, y, z, vx: Math.cos(a) * s, vy: Math.sin(a) * s * SQ, vz: rnd(-.2, .6) * s, size: size * rnd(.6, 1.2), size2: 0, life: life * rnd(.6, 1.1), color, drag: 2.5 }, o)); } }
export function ring(x, y, r0, r1, color, life, w = 6) { addP({ type: 'ring', x, y, size: r0, size2: r1, life, color, w, keep: true }); }
export function text(x, y, str, color, size = 20, o = {}) { addP(Object.assign({ type: 'text', x, y, z: 0, vz: 80, vx: rnd(-25, 25), life: .95, str, color, size, add: false, grav: 110, keep: true }, o)); }
/** SW-style damage number: pops in big, settles, floats a little and fades (crit = bigger, gold, tilted, with a flash) */
export function dmgText(x, y, n, crit = false, o = {}) { addP(Object.assign({ type: 'dmg', x, y, z: 0, vz: 55, vx: rnd(-18, 18), life: crit ? 1.15 : .95, str: '' + n, crit, size: crit ? 40 : 30, add: false, grav: 40, drag: 2, keep: true }, o)); }
/** sprite light particle (fx_* images): grows from size to size2 (width), ar = height/width, rot/vr rotation */
export function fxP(name, x, y, z, color, size, size2, life, o = {}) { addP(Object.assign({ type: 'fx', name, x, y, z, color, size, size2, life, ar: 1, rot: 0, keep: true }, o)); }
export function shake(v) { if (!RM) E.shake = Math.max(E.shake, v); }
export function flash(a, c = '#fff') { E.flash = Math.max(E.flash, RM ? Math.min(a, .25) : a); E.flashC = c; }
export function updParts(dt) {
  for (let i = E.parts.length - 1; i >= 0; i--) { const p = E.parts[i]; p.t += dt; if (p.t >= p.life) { E.parts.splice(i, 1); continue; } const dr = Math.exp(-p.drag * dt); p.vx *= dr; p.vy *= dr; if (p.type !== 'chip') p.vz *= dr; p.vz -= p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.rot += p.vr * dt; if (p.type === 'chip' && p.z < 0) { p.z = 0; p.vz *= -.35; p.vx *= .6; p.vy *= .6; p.vr *= .5; } }
  for (let i = E.decals.length - 1; i >= 0; i--) { E.decals[i].t += dt; if (E.decals[i].t >= E.decals[i].life) E.decals.splice(i, 1); }
}
export function drawParts() {
  const ctx = E.ctx;
  for (const p of E.parts) {
    const u = p.t / p.life, a = (1 - u) * p.alpha, sz = p.size2 == null ? p.size : lerp(p.size, p.size2, u), X = p.x, Y = p.y - p.z;
    ctx.globalCompositeOperation = p.add ? 'lighter' : 'source-over';
    switch (p.type) {
      case 'glow': ctx.globalAlpha = a; ctx.drawImage(dot(p.color), X - sz, Y - sz, sz * 2, sz * 2); break;
      case 'flame': { ctx.globalAlpha = a; const s = sz * (1 - u * .5); ctx.save(); ctx.translate(X, Y); ctx.scale(1, 1.7); ctx.drawImage(dot(u < .3 ? (p.core || '#ffe1a0') : p.color), -s / 2, -s / 2, s, s); ctx.restore(); break; }
      case 'twinkle': { ctx.globalAlpha = Math.sin(u * Math.PI); ctx.strokeStyle = p.color; ctx.lineWidth = 1.6; const s = sz; ctx.beginPath(); ctx.moveTo(X - s, Y); ctx.lineTo(X + s, Y); ctx.moveTo(X, Y - s); ctx.lineTo(X, Y + s); ctx.stroke(); break; }
      case 'smoke': ctx.globalAlpha = a; ctx.drawImage(dot(p.color), X - sz, Y - sz * .7, sz * 2, sz * 1.4); break;
      case 'chip': { ctx.globalAlpha = Math.min(1, (1 - u) * 3); ctx.fillStyle = p.color; ctx.save(); ctx.translate(X, Y); ctx.rotate(p.rot); const s = sz; ctx.beginPath(); ctx.moveTo(-s * .6, -s * .4); ctx.lineTo(s * .5, -s * .55); ctx.lineTo(s * .6, s * .35); ctx.lineTo(-s * .3, s * .5); ctx.closePath(); ctx.fill(); ctx.restore(); break; }
      case 'ring': { ctx.globalAlpha = a; ctx.strokeStyle = p.color; ctx.lineWidth = Math.max(.5, p.w * (1 - u)); const r = lerp(p.size, p.size2, easeOut(u)); ctx.beginPath(); ctx.ellipse(X, Y, Math.max(.1, r), Math.max(.1, r * SQ * .7), 0, 0, TAU); ctx.stroke(); break; }
      case 'slash': { ctx.globalAlpha = a; ctx.strokeStyle = p.color; ctx.lineCap = 'round'; ctx.lineWidth = p.w * (1 - u * .6); const sw = 1.8 * easeOut(Math.min(1, u * 2.5)); ctx.beginPath(); ctx.ellipse(X, Y, p.size, p.size * .55, 0, p.rot, p.rot + sw); ctx.stroke(); break; }
      case 'streak': { ctx.globalAlpha = a; ctx.strokeStyle = p.color; ctx.lineWidth = p.size; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X - p.vx * .04, Y + p.vz * .04); ctx.stroke(); break; }
      case 'beam': { const w = p.size * (1 - u * .6); const g = ctx.createLinearGradient(X - w, 0, X + w, 0); g.addColorStop(0, p.color + '00'); g.addColorStop(.5, '#fff7e0'); g.addColorStop(1, p.color + '00'); ctx.globalAlpha = a; ctx.fillStyle = g; ctx.fillRect(X - w, Y - 700, w * 2, 700); break; }
      case 'bolt': { ctx.globalAlpha = a; ctx.strokeStyle = p.color; ctx.lineWidth = 3 * (1 - u) + 1; ctx.lineJoin = 'round'; ctx.beginPath(); const pts = p.pts; ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2; ctx.stroke(); break; }
      case 'arrow': { ctx.globalAlpha = a; ctx.fillStyle = p.color; const s = sz; ctx.beginPath(); ctx.moveTo(X, Y - s); ctx.lineTo(X + s * .8, Y); ctx.lineTo(X + s * .3, Y); ctx.lineTo(X + s * .3, Y + s); ctx.lineTo(X - s * .3, Y + s); ctx.lineTo(X - s * .3, Y); ctx.lineTo(X - s * .8, Y); ctx.closePath(); ctx.fill(); break; }
      case 'banner': { ctx.globalCompositeOperation = 'source-over'; const pop = u < .12 ? easeBack(u / .12) : 1; ctx.globalAlpha = Math.min(1, (1 - u) * 3); ctx.save(); ctx.translate(X, Y); ctx.scale(pop, pop); ctx.font = `600 ${p.size}px Mitr, sans-serif`; ctx.textAlign = 'center'; ctx.lineJoin = 'round'; ctx.lineWidth = 7; ctx.strokeStyle = p.stroke || 'rgba(20,8,30,.9)'; ctx.strokeText(p.str, 0, 0); ctx.fillStyle = p.color; ctx.fillText(p.str, 0, 0); ctx.restore(); break; }
      case 'fx': { const s = lerp(p.size, p.size2 ?? p.size, easeOut(u)); fx(ctx, p.name, p.color, X, Y, s, s * p.ar, (p.fade === false ? 1 : 1 - u * u) * p.alpha, p.rot); break; }
      case 'dmg': { // big bold number with a dark outline and a light gradient; crits are gold, tilted and ring-flashed
        ctx.globalCompositeOperation = 'source-over'; const pop = u < .12 ? lerp(2.1, 1, easeBack(u / .12)) : 1, fs = p.size;
        ctx.globalAlpha = Math.min(1, (1 - u) * 3); ctx.save(); ctx.translate(X, Y); ctx.rotate(p.crit ? -.12 : 0); ctx.scale(pop, pop);
        if (p.crit && u < .3) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (1 - u / .3) * .8; ctx.drawImage(dot('#ffb83a'), -fs * 1.8, -fs * 1.6, fs * 3.6, fs * 2.6); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = Math.min(1, (1 - u) * 3); }
        ctx.font = `800 ${fs}px Mitr, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
        ctx.lineWidth = fs * .26; ctx.strokeStyle = p.crit ? '#5a1a00' : 'rgba(25,10,4,.92)'; ctx.strokeText(p.str, 0, 0);
        const g = ctx.createLinearGradient(0, -fs * .45, 0, fs * .45); if (p.crit) { g.addColorStop(0, '#fffbe0'); g.addColorStop(.45, '#ffd84a'); g.addColorStop(1, '#ff7a1a'); } else if (p.weak) { g.addColorStop(0, '#f2f4ff'); g.addColorStop(1, '#a9b4cf'); } else { g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#ffe2b8'); }
        ctx.fillStyle = g; ctx.fillText(p.str, 0, 0);
        if (p.crit) { ctx.font = `800 ${fs * .42}px Mitr, sans-serif`; ctx.lineWidth = 4; ctx.strokeStyle = '#5a1a00'; ctx.strokeText('CRITICAL', 0, -fs * .78); ctx.fillStyle = '#ffe680'; ctx.fillText('CRITICAL', 0, -fs * .78); }
        ctx.restore(); break; }
      case 'text': { ctx.globalCompositeOperation = 'source-over'; const pop = u < .15 ? easeBack(u / .15) : 1; ctx.globalAlpha = Math.min(1, (1 - u) * 2.2); ctx.save(); ctx.translate(X, Y); ctx.scale(pop, pop); ctx.font = `600 ${p.size}px Mitr, sans-serif`; ctx.textAlign = 'center'; ctx.lineJoin = 'round'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(30,10,4,.85)'; ctx.strokeText(p.str, 0, 0); ctx.fillStyle = p.color; ctx.fillText(p.str, 0, 0); ctx.restore(); break; }
    }
  }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
}
export function drawDecals() {
  const ctx = E.ctx; ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const d of E.decals) {
    const u = d.t / d.life, a = 1 - u;
    if (d.type === 'fire') { ctx.globalAlpha = a; const s = 26 * (1 - u * .4); ctx.save(); ctx.translate(d.x, d.y); ctx.scale(1, 1.6 + .3 * Math.sin(E.time * 18 + d.x)); ctx.drawImage(dot(d.color), -s / 2, -s * .9, s, s); ctx.drawImage(dot(d.core), -s / 4, -s * .6, s / 2, s / 2); ctx.restore(); }
    else if (d.type === 'rune') { ctx.globalAlpha = Math.min(1, a * 2) * .9; ctx.strokeStyle = d.color; ctx.lineWidth = 2; const R = d.R, rot = E.time * 2.4; ctx.beginPath(); ctx.ellipse(d.x, d.y, R, R * .38, 0, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.ellipse(d.x, d.y, R * .78, R * .3, 0, 0, TAU); ctx.stroke(); for (let i = 0; i < 12; i++) { const aa = i / 12 * TAU + rot, a2 = aa + .18; ctx.beginPath(); ctx.moveTo(d.x + Math.cos(aa) * R * .8, d.y + Math.sin(aa) * R * .3); ctx.lineTo(d.x + Math.cos(a2) * R * .98, d.y + Math.sin(a2) * R * .375); ctx.stroke(); } }
    else if (d.type === 'crack') { ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = Math.min(1, a * 2) * .8; ctx.strokeStyle = '#2a1a0c'; ctx.lineWidth = 4; ctx.beginPath(); d.pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = d.color; ctx.lineWidth = 2; ctx.globalAlpha = a * .8; ctx.stroke(); }
  }
  ctx.restore();
}
export function drawProjs() {
  const ctx = E.ctx; ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const p of E.projs) {
    const X = p.x, Y = p.y - p.z;
    if (p.dark) { ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#0a0412'; ctx.beginPath(); ctx.arc(X, Y, p.size * .8, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = p.P.aura; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(X, Y, p.size * .82, 0, TAU); ctx.stroke(); ctx.drawImage(dot(p.P.aura), X - p.size * 1.6, Y - p.size * 1.6, p.size * 3.2, p.size * 3.2); continue; }
    const s = p.size; ctx.drawImage(dot(p.P.aura), X - s * 1.4, Y - s * 1.4, s * 2.8, s * 2.8); ctx.drawImage(dot(p.P.hot), X - s * .55, Y - s * .55, s * 1.1, s * 1.1);
    ctx.globalAlpha = .3; ctx.fillStyle = p.P.aura; ctx.beginPath(); ctx.ellipse(p.x, p.y, s * .6, s * .22, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// ---------- world ----------
const PR = 560, GW = 2800, GH = 1900, GOX = 1400, GOY = 950;
export const GEO = { PR, GW, GH, GOX, GOY };
/** battlefield look per realm (map): 1 ทุ่งไข่ป่วน = green meadow & cobbles · 2 สุวรรณภูมิ = golden grass, laterite
 *  sandstone, lotus & marigold, gold lamps · 3 สวรรค์บูรพา = jade grass, grey-jade stone, peach blossom, red lanterns */
export const THEMES = {
  '1': { base: ['#61803c', '#557336', '#3e5a2a'], blob: [78, 30], grass: [76, 36], stone: [30, 14, 9, 12, 55, 13], plaza: '#6c6252', ring: [80, 30], flowers: ['#f6f2e6', '#b3a6f4', '#7894f2', '#f4d56e', '#f0a0b8'], fcore: '#e9b23a', bush: 90, lamp: [255, 190, 110], glow: '#ffb050', pool: [255, 180, 90], fly: '#ffe9a8' },
  '2': { base: ['#8e8640', '#7c7232', '#58501f'], blob: [44, 22], grass: [46, 26], stone: [24, 14, 32, 14, 56, 12], plaza: '#8a5a3c', ring: [48, 24], flowers: ['#f7b3c8', '#fff4e8', '#f2b233', '#f08a3c', '#f7d06e'], fcore: '#f4c040', bush: 70, lamp: [255, 214, 120], glow: '#ffc860', pool: [255, 200, 110], fly: '#fff0b0' },
  '3': { base: ['#3f7a66', '#356c5a', '#24493e'], blob: [150, 26], grass: [148, 30], stone: [160, 20, 6, 10, 60, 12], plaza: '#56645e', ring: [150, 28], flowers: ['#f7b6c8', '#e8504a', '#fff4f4', '#f39ab4', '#ffd6e0'], fcore: '#f6d36a', bush: 140, lamp: [255, 120, 90], glow: '#ff5a40', pool: [255, 96, 70], fly: '#ffd0c0' },
};
let T = THEMES['1'];
const groundC = {};
/** switch the battlefield look (cached per realm) */
export function setTheme(id) { const k = THEMES[id] ? id : '1'; T = THEMES[k]; E.loc = null; if (E.ctx) E.ground = groundC[k] || (groundC[k] = buildGround()); }
/** set the active palette (a realm id or a palette object) — locations paint stones/bushes with it */
export const useTheme = (id) => { T = typeof id === 'object' ? id : THEMES[id] || THEMES['1']; return T; };
export function stone(g, x, y, r, R) { const n = 7, pts = [], rot = R() * TAU; for (let i = 0; i < n; i++) { const a = rot + i / n * TAU, rr = r * (.78 + R() * .32); pts.push([x + Math.cos(a) * rr * 1.12, y + Math.sin(a) * rr * SQ]); } g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.fillStyle = `hsl(${T.stone[0] + R() * T.stone[1]},${T.stone[2] + R() * T.stone[3]}%,${T.stone[4] + R() * T.stone[5]}%)`; g.fill(); const gr = g.createLinearGradient(x - r, y - r * SQ, x + r, y + r * SQ); gr.addColorStop(0, 'rgba(255,244,215,.42)'); gr.addColorStop(.5, 'rgba(255,240,210,0)'); gr.addColorStop(1, 'rgba(30,20,10,.32)'); g.fillStyle = gr; g.fill(); g.strokeStyle = 'rgba(48,38,28,.55)'; g.lineWidth = 2; g.stroke(); }
export function buildGround() {
  const c = mk(GW, GH), g = c.getContext('2d'), R = mulberry(11);
  let gr = g.createLinearGradient(0, 0, GW, GH); gr.addColorStop(0, T.base[0]); gr.addColorStop(.5, T.base[1]); gr.addColorStop(1, T.base[2]); g.fillStyle = gr; g.fillRect(0, 0, GW, GH);
  for (let i = 0; i < 2600; i++) { const x = R() * GW, y = R() * GH, r = 24 + R() * 110; g.fillStyle = `hsla(${T.blob[0] + R() * T.blob[1]},${30 + R() * 25}%,${R() < .5 ? 20 + R() * 10 : 40 + R() * 12}%,${.05 + R() * .08})`; g.beginPath(); g.ellipse(x, y, r, r * SQ, 0, 0, TAU); g.fill(); }
  g.lineCap = 'round'; for (let i = 0; i < 16000; i++) { const x = R() * GW, y = R() * GH, l = 5 + R() * 10; g.strokeStyle = `hsla(${T.grass[0] + R() * T.grass[1]},${35 + R() * 30}%,${26 + R() * 32}%,${.3 + R() * .45})`; g.lineWidth = 1 + R() * 1.5; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + (R() - .5) * 4, y - l * .6, x + (R() - .5) * 7, y - l); g.stroke(); }
  g.save(); g.translate(GOX, GOY); g.fillStyle = 'rgba(28,24,14,.38)'; g.beginPath(); g.ellipse(0, 10, PR + 18, (PR + 18) * SQ, 0, 0, TAU); g.fill(); g.fillStyle = T.plaza; g.beginPath(); g.ellipse(0, 0, PR, PR * SQ, 0, 0, TAU); g.fill();
  for (let gy = -PR; gy <= PR; gy += 36) { const row = Math.round(gy / 36); for (let gx = -PR; gx <= PR; gx += 42) { const fx = gx + (row & 1 ? 21 : 0) + (R() - .5) * 8, fy = gy + (R() - .5) * 8, e = Math.hypot(fx, fy); if (e > PR - 16) continue; if (R() < (e > PR - 70 ? .35 : .02)) continue; stone(g, fx, fy * SQ, 17.5 + R() * 4, R); } }
  for (let i = 0; i < 22; i++) { const a = i / 22 * TAU, r = 150; stone(g, Math.cos(a) * r, -100 + Math.sin(a) * r * SQ * .9, 22, R); }
  for (let i = 0; i < 900; i++) { const a = R() * TAU, rr = PR + (R() - .4) * 34, x = Math.cos(a) * rr, y = Math.sin(a) * rr * SQ; for (let k = 0; k < 4; k++) { const l = 6 + R() * 12; g.strokeStyle = `hsla(${T.ring[0] + R() * T.ring[1]},${40 + R() * 25}%,${30 + R() * 25}%,.8)`; g.lineWidth = 1.3 + R(); g.beginPath(); g.moveTo(x + (R() - .5) * 8, y); g.lineTo(x + (R() - .5) * 12, y - l); g.stroke(); } }
  const fc = T.flowers; for (let i = 0; i < 420; i++) { const a = R() * TAU, rr = PR * (1.06 + R() * 1.2), x = Math.cos(a) * rr, y = Math.sin(a) * rr * SQ; const col = fc[(R() * fc.length) | 0]; for (let k = 0; k < 3 + R() * 5; k++) { const fx = x + (R() - .5) * 30, fy = y + (R() - .5) * 16; g.fillStyle = col; for (let p = 0; p < 5; p++) { const pa = p / 5 * TAU; g.beginPath(); g.arc(fx + Math.cos(pa) * 2.6, fy + Math.sin(pa) * 2, 2.2, 0, TAU); g.fill(); } g.fillStyle = T.fcore; g.beginPath(); g.arc(fx, fy, 1.4, 0, TAU); g.fill(); } }
  g.restore(); return c;
}
export const LANTERNS = [[-500, -185], [500, -185], [-560, 250], [560, 250]].map(([x, y]) => ({ x, y, ph: Math.random() * 9 }));
export const BUSHES = [[-760, -60, 1.2], [780, 10, 1.1], [-680, 330, 1], [700, 360, 1.25], [-300, -440, .9], [330, -450, 1]].map(([x, y, s]) => ({ x, y, s, seed: (x * 7 + y * 13) | 0 }));
const bushC = {};
function bushImg(b) { const key = b.seed + ':' + T.bush; if (bushC[key]) return bushC[key]; const R = mulberry(b.seed), c = mk(260, 200), g = c.getContext('2d'); g.translate(130, 170); g.fillStyle = 'rgba(20,30,10,.35)'; g.beginPath(); g.ellipse(0, 6, 95, 26, 0, 0, TAU); g.fill(); for (let i = 0; i < 26; i++) { const x = (R() - .5) * 150, y = -R() * 90 - 10, r = 22 + R() * 22, l = 24 + R() * 20 + (-y / 110) * 16; const gg = g.createRadialGradient(x - r * .3, y - r * .4, 2, x, y, r); gg.addColorStop(0, `hsl(${T.bush + R() * 20},45%,${l + 14}%)`); gg.addColorStop(1, `hsl(${T.bush + 10 + R() * 20},45%,${l - 6}%)`); g.fillStyle = gg; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); } return (bushC[key] = c); }
export function drawBush(b) { if (b.kind && E.loc?.prop) return E.loc.prop(b); const im = bushImg(b); E.ctx.drawImage(im, b.x - 130 * b.s, b.y - 170 * b.s, 260 * b.s, 200 * b.s); }
export function drawLantern(L) { if (L.kind && E.loc?.light) return E.loc.light(L); const ctx = E.ctx, x = L.x, y = L.y, f = .8 + .12 * Math.sin(E.time * 7 + L.ph); ctx.fillStyle = 'rgba(18,12,6,.4)'; ctx.beginPath(); ctx.ellipse(x, y + 2, 16, 6, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#4a3424'; ctx.fillRect(x - 4, y - 118, 8, 118); ctx.fillRect(x - 4, y - 118, 26, 6); ctx.fillStyle = '#2e2219'; ctx.fillRect(x + 7, y - 104, 22, 26); ctx.fillStyle = `rgba(${T.lamp[0]},${T.lamp[1] + f * 30 | 0},${T.lamp[2]},1)`; ctx.fillRect(x + 10, y - 101, 16, 20); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = f; ctx.drawImage(dot(T.glow), x + 18 - 60, y - 91 - 60, 120, 120); ctx.restore(); }
export function drawLanternPools() { const ctx = E.ctx; ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (const L of LANTERNS) { if (L.noPool) continue; const f = .75 + .1 * Math.sin(E.time * 7 + L.ph); const g = ctx.createRadialGradient(L.x, L.y, 0, L.x, L.y, 150); const [pr, pg, pb] = L.pool || T.pool; g.addColorStop(0, `rgba(${pr},${pg},${pb},${.22 * f})`); g.addColorStop(1, `rgba(${pr},${pg},${pb},0)`); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(L.x, L.y, 150, 62, 0, 0, TAU); ctx.fill(); } ctx.restore(); }
const flies = Array.from({ length: 34 }, () => ({ x: rnd(-900, 900), y: rnd(-560, 560), ph: rnd(0, 9), sp: rnd(.4, 1) }));
export function drawFlies() { if (E.loc?.ambient) return E.loc.ambient(E.ctx); const ctx = E.ctx; ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (const f of flies) { const x = f.x + Math.sin(E.time * f.sp + f.ph) * 40, y = f.y + Math.cos(E.time * f.sp * .8 + f.ph) * 24 - 40; ctx.globalAlpha = .3 + .3 * Math.sin(E.time * 2 + f.ph * 3); ctx.drawImage(dot(T.fly), x - 7, y - 7, 14, 14); } ctx.restore(); }

export function initCanvas(cv) {
  E.cv = cv; E.ctx = cv.getContext('2d'); E.ground = groundC['1'] = buildGround();
  const resize = () => {
    E.DPR = Math.min(2, devicePixelRatio || 1); E.W = innerWidth; E.H = innerHeight; cv.width = E.W * E.DPR; cv.height = E.H * E.DPR;
    const W = E.W, H = E.H; E.vign = mk(Math.max(1, W), Math.max(1, H)); const v = E.vign.getContext('2d'); const g = v.createRadialGradient(W * .45, H * .4, Math.min(W, H) * .2, W * .5, H * .5, Math.max(W, H) * .75); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(8,10,20,.55)'); v.fillStyle = g; v.fillRect(0, 0, W, H); const w = v.createLinearGradient(0, 0, W, H); w.addColorStop(0, 'rgba(255,190,110,.13)'); w.addColorStop(.5, 'rgba(255,190,110,0)'); w.addColorStop(1, 'rgba(40,60,140,.12)'); v.fillStyle = w; v.fillRect(0, 0, W, H);
  };
  addEventListener('resize', resize); resize();
}
export const Z = () => E.base * E.zoom;
export const toWorld = (sx, sy) => [(sx - E.W / 2) / Z() + E.cam.x, (sy - E.H / 2) / Z() + E.cam.y];
/** apply world transform (with shake) */
export function worldTransform() { const z = Z(), shx = E.shake ? rnd(-E.shake, E.shake) : 0, shy = E.shake ? rnd(-E.shake, E.shake) : 0; E.ctx.setTransform(E.DPR * z, 0, 0, E.DPR * z, E.DPR * (E.W / 2 - E.cam.x * z + shx), E.DPR * (E.H / 2 - E.cam.y * z + shy)); }
export function screenTransform() { E.ctx.setTransform(E.DPR, 0, 0, E.DPR, 0, 0); }
export function drawGround() { E.ctx.drawImage(E.ground, -GOX, -GOY); }
export function drawOverlays() { const ctx = E.ctx; screenTransform(); if (E.loc?.grade) E.loc.grade(ctx, E.W, E.H); ctx.drawImage(E.vign, 0, 0, E.W, E.H); if (E.flash > 0) { ctx.globalAlpha = Math.min(1, E.flash); ctx.fillStyle = E.flashC; ctx.fillRect(0, 0, E.W, E.H); ctx.globalAlpha = 1; } }
export function tickEngine(dt) {
  E.time += dt; E.shake = Math.max(0, E.shake - dt * 40); E.flash = Math.max(0, E.flash - dt * 2.2);
  E.dim = lerp(E.dim, E.dimT, 1 - Math.exp(-dt * 8)); E.zoom = lerp(E.zoom, E.zoomT, 1 - Math.exp(-dt * 6));
  E.cam.x = lerp(E.cam.x, E.camT.x, 1 - Math.exp(-dt * 4)); E.cam.y = lerp(E.cam.y, E.camT.y, 1 - Math.exp(-dt * 4));
}
