// @ts-nocheck
// Turtle home scene: an ancient turtle swimming through a sea of clouds, carrying the player's buildings and monsters.
// Uses the ChatGPT art set (batch 04, imported by tools/import_home.py) when present; the code-drawn versions stay as fallback.
import { E, run, tween, burst, ring, text, shake, flash, addP, drawParts, screenTransform, clamp, lerp, rnd, easeOut, easeBack } from './engine';
import { spr, mk, dot, PAL, PIV, TAU, TIER_COL, IMG, lookOf } from './assets';
import { sfx } from './audio';
import { SPECIES } from '../core/data';
import { BUILDINGS, BDEF, TURTLE_SCALE, home, mineStored, mineCap, unlocked, ELEMS } from '../game/home';

const SKY = ['#7fb8f2', '#b9dcfb', '#ffe9cf'];
const puffCache = {};
function puff(w, h, shade) {
  const k = w + 'x' + h + shade; if (puffCache[k]) return puffCache[k];
  const c = mk(w, h), x = c.getContext('2d'); let seed = w * 7 + h;
  const r = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  for (let i = 0; i < 14; i++) {
    const cx = w * (.15 + r() * .7), cy = h * (.45 + r() * .25), rad = h * (.22 + r() * .26);
    const g = x.createRadialGradient(cx, cy - rad * .3, rad * .1, cx, cy, rad);
    g.addColorStop(0, '#ffffff'); g.addColorStop(.7, shade ? '#eef4ff' : '#f7fbff'); g.addColorStop(1, 'rgba(235,242,255,0)');
    x.fillStyle = g; x.beginPath(); x.arc(cx, cy, rad, 0, TAU); x.fill();
  }
  if (shade) { x.globalCompositeOperation = 'source-atop'; const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,240,220,0)'); g.addColorStop(1, 'rgba(150,170,215,.45)'); x.fillStyle = g; x.fillRect(0, 0, w, h); }
  return (puffCache[k] = c);
}

// ---------- art placement (original canvas px; see tools/import_home.py) ----------
// shell 1536x1024: grass meadow centre (768,415) → turtle-local (0,-6). head/flippers/buildings 1024x1024, buildings' base at (512,900).
const SHELL_K = .78, SHELL_C = [768, 415], HEAD_K = .41, HEAD_C = [512, 560], HEAD_Y = 407, FLIP_K = .27, BLD_K = .3;
const NEST = [480, 590], GATE_HOLE_C = [512, 565];
// top edge (canvas px) of each building sprite, for hit boxes and the mine coin bubble
const ART_TOP = { bld_castle_1: 60, bld_castle_2: 178, bld_castle_3: 239, bld_castle_4: 232, bld_gate: 288, bld_hatchery_1: 468, bld_hatchery_2: 279, bld_hatchery_3: 268, bld_site: 497, bld_mine_1: 372, bld_mine_3: 365, bld_mine_5: 324, bld_shrine: 186, bld_altar: 462, bld_forge: 245, bld_arena: 395 };
const hasHomeArt = () => !!IMG.home_shell;
/** sprite key for a building at its level ('bld_site' when locked / coming soon), or null without art */
function bldArt(bd, lv, ok) {
  const k = !ok || bd.soon ? 'bld_site' : bd.id === 'castle' ? 'bld_castle_' + lv : bd.id === 'hatchery' ? 'bld_hatchery_' + lv : bd.id === 'mine' ? 'bld_mine_' + (lv >= 5 ? 5 : lv >= 3 ? 3 : 1) : 'bld_' + bd.id;
  return IMG[k] ? k : null;
}
const AP = (px, py) => [(px - 512) * BLD_K, (py - 900) * BLD_K]; // building canvas px → local units

// ---------- turtle shell top (pre-rendered once) ----------
let shellC = null;
const SH = { rx: 450, ry: 250, side: 62 };
function buildShell() {
  const S = 1.5, W = 960, H = 640, c = mk(W * S, H * S), x = c.getContext('2d'); x.scale(S, S); x.translate(W / 2, 270);
  // side band
  let g = x.createLinearGradient(0, 0, 0, SH.ry + SH.side); g.addColorStop(0, '#5a4a2c'); g.addColorStop(1, '#2f2817');
  x.fillStyle = g; x.beginPath(); x.ellipse(0, SH.side, SH.rx, SH.ry, 0, 0, TAU); x.fill();
  x.fillRect(-SH.rx, 0, SH.rx * 2, SH.side);
  // marginal scutes along the front of the band
  x.strokeStyle = 'rgba(20,14,6,.55)'; x.lineWidth = 3;
  for (let i = -8; i <= 8; i++) { const a = Math.PI / 2 + i * .17, px = Math.cos(a) * SH.rx, py = Math.sin(a) * SH.ry; x.beginPath(); x.moveTo(px, py); x.lineTo(px * 1.0, py + SH.side * .95); x.stroke(); }
  x.fillStyle = 'rgba(255,220,150,.08)'; for (let i = -8; i < 8; i++) { const a = Math.PI / 2 + (i + .5) * .17; x.beginPath(); x.ellipse(Math.cos(a) * SH.rx * .99, Math.sin(a) * SH.ry + SH.side * .45, 16, 18, 0, 0, TAU); x.fill(); }
  // rim
  g = x.createLinearGradient(0, -SH.ry, 0, SH.ry); g.addColorStop(0, '#8a7448'); g.addColorStop(1, '#6a5632');
  x.fillStyle = g; x.beginPath(); x.ellipse(0, 0, SH.rx, SH.ry, 0, 0, TAU); x.fill();
  // grassy top
  x.save(); x.beginPath(); x.ellipse(0, -6, SH.rx - 26, SH.ry - 22, 0, 0, TAU); x.clip();
  g = x.createRadialGradient(-80, -90, 40, 0, 0, SH.rx); g.addColorStop(0, '#a8d26a'); g.addColorStop(.6, '#7fb54e'); g.addColorStop(1, '#5c8f3a');
  x.fillStyle = g; x.fillRect(-SH.rx, -SH.ry, SH.rx * 2, SH.ry * 2);
  // faint hex scutes under the grass
  x.strokeStyle = 'rgba(60,90,30,.28)'; x.lineWidth = 3;
  const hex = (cx, cy, r) => { x.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + Math.PI / 6; x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r * .56); } x.closePath(); x.stroke(); };
  hex(0, -10, 120); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + Math.PI / 6; hex(Math.cos(a) * 208, -10 + Math.sin(a) * 208 * .56, 104); }
  // tufts & flowers
  let seed = 11; const r = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  for (let i = 0; i < 260; i++) { const a = r() * TAU, d = Math.sqrt(r()), px = Math.cos(a) * d * (SH.rx - 30), py = -6 + Math.sin(a) * d * (SH.ry - 26); x.fillStyle = r() < .5 ? 'rgba(70,110,40,.5)' : 'rgba(190,230,120,.45)'; x.fillRect(px, py, 2, -5 - r() * 5); }
  const fl = ['#fff6d6', '#ffc0d8', '#ffe27a', '#cfe8ff'];
  for (let i = 0; i < 70; i++) { const a = r() * TAU, d = .3 + r() * .7, px = Math.cos(a) * d * (SH.rx - 40), py = -6 + Math.sin(a) * d * (SH.ry - 34); x.fillStyle = fl[i % 4]; x.beginPath(); x.arc(px, py, 2.6, 0, TAU); x.fill(); }
  // stone path ring around the castle
  x.fillStyle = 'rgba(225,210,170,.55)'; for (let i = 0; i < 28; i++) { const a = i / 28 * TAU; x.beginPath(); x.ellipse(Math.cos(a) * 150, -40 + Math.sin(a) * 84, 13, 7, 0, 0, TAU); x.fill(); }
  // rim shading
  g = x.createRadialGradient(0, -6, SH.ry * .9, 0, -6, SH.rx); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(40,50,20,.35)'); x.fillStyle = g; x.fillRect(-SH.rx, -SH.ry, SH.rx * 2, SH.ry * 2);
  x.restore();
  // rim highlight
  x.strokeStyle = 'rgba(255,235,180,.35)'; x.lineWidth = 3; x.beginPath(); x.ellipse(0, 0, SH.rx - 4, SH.ry - 4, 0, Math.PI * 1.08, Math.PI * 1.92); x.stroke();
  shellC = { c, W, H, S, oy: 270 };
}

// ---------- building drawings (local origin = ground center, unit = world px at turtle scale 1) ----------
function shadow(x, w, h = w * .35) { x.fillStyle = 'rgba(30,40,10,.35)'; x.beginPath(); x.ellipse(0, 4, w, h, 0, 0, TAU); x.fill(); }
function roofCone(x, cx, by, w, h, col) { x.fillStyle = col; x.beginPath(); x.moveTo(cx - w, by); x.quadraticCurveTo(cx, by - h * .2, cx + w, by); x.lineTo(cx, by - h); x.closePath(); x.fill(); x.fillStyle = 'rgba(255,255,255,.18)'; x.beginPath(); x.moveTo(cx, by - h); x.lineTo(cx - w * .9, by - 2); x.lineTo(cx - w * .2, by - 3); x.closePath(); x.fill(); }
function tower(x, cx, by, w, h, roof, t, win = true) {
  const g = x.createLinearGradient(cx - w, 0, cx + w, 0); g.addColorStop(0, '#d9ccb0'); g.addColorStop(.6, '#efe4cb'); g.addColorStop(1, '#b5a585');
  x.fillStyle = g; x.fillRect(cx - w, by - h, w * 2, h); x.beginPath(); x.ellipse(cx, by, w, w * .3, 0, 0, Math.PI); x.fill();
  x.fillStyle = 'rgba(80,60,30,.18)'; for (let yy = by - h + 10; yy < by - 4; yy += 12) x.fillRect(cx - w, yy, w * 2, 1.5);
  if (win) { const f = .75 + .25 * Math.sin(t * 3 + cx); x.fillStyle = `rgba(255,${190 + 30 * f | 0},90,${.85 * f})`; x.beginPath(); x.ellipse(cx, by - h * .55, w * .22, w * .32, 0, 0, TAU); x.fill(); }
  roofCone(x, cx, by - h + 2, w * 1.25, w * 2.1, roof);
}
function flag(x, cx, top, t, col) { x.strokeStyle = '#5a4630'; x.lineWidth = 2; x.beginPath(); x.moveTo(cx, top); x.lineTo(cx, top - 26); x.stroke(); x.fillStyle = col; x.beginPath(); x.moveTo(cx, top - 26); for (let i = 0; i <= 6; i++) x.lineTo(cx + i * 4, top - 26 + Math.sin(t * 6 - i * .8) * 2.5 + i * .4); for (let i = 6; i >= 0; i--) x.lineTo(cx + i * 4, top - 16 + Math.sin(t * 6 - i * .8) * 2.5 + i * .4); x.closePath(); x.fill(); }

const DRAW = {
  castle(x, lv, t) {
    shadow(x, 100, 40);
    x.fillStyle = '#9c8a66'; x.beginPath(); x.ellipse(0, 0, 92, 34, 0, 0, TAU); x.fill(); x.fillStyle = '#b7a57e'; x.beginPath(); x.ellipse(0, -6, 88, 30, 0, 0, TAU); x.fill();
    if (lv >= 3) { tower(x, -70, -6, 15, 70, '#3f6fb5', t); tower(x, 70, -6, 15, 70, '#3f6fb5', t); }
    if (lv >= 2) { tower(x, -44, 4, 18, 92, '#b5443a', t); tower(x, 44, 4, 18, 92, '#b5443a', t); }
    // keep
    const g = x.createLinearGradient(-36, 0, 36, 0); g.addColorStop(0, '#d9ccb0'); g.addColorStop(.6, '#f3e9d2'); g.addColorStop(1, '#b8a888');
    x.fillStyle = g; x.fillRect(-34, -96, 68, 104);
    x.fillStyle = '#e8dcc0'; for (let i = -3; i <= 3; i++) x.fillRect(i * 10 - 4, -104, 8, 9);
    x.fillStyle = '#5a3a22'; x.beginPath(); x.moveTo(-12, 8); x.lineTo(-12, -16); x.quadraticCurveTo(0, -30, 12, -16); x.lineTo(12, 8); x.closePath(); x.fill();
    const f = .8 + .2 * Math.sin(t * 2.4); x.fillStyle = `rgba(255,205,110,${f})`; x.beginPath(); x.ellipse(-16, -62, 5, 8, 0, 0, TAU); x.ellipse(16, -62, 5, 8, 0, 0, TAU); x.fill();
    tower(x, 0, -96, 22, 40 + lv * 6, lv >= 4 ? '#d9a521' : '#b5443a', t);
    const top = -96 - (40 + lv * 6) - 22 * 2.1; flag(x, 0, top + 2, t, lv >= 4 ? '#ffd54a' : '#ff7a3a');
    // egg emblem
    x.fillStyle = '#fff3d0'; x.beginPath(); x.ellipse(0, -40, 9, 12, 0, 0, TAU); x.fill(); x.strokeStyle = '#c99a3a'; x.lineWidth = 2; x.stroke();
  },
  gate(x, lv, t) {
    shadow(x, 60, 22);
    x.fillStyle = '#8d8a80'; x.fillRect(-46, -92, 18, 96); x.fillRect(28, -92, 18, 96);
    x.fillStyle = '#a9a69a'; x.beginPath(); x.moveTo(-50, -88); x.quadraticCurveTo(0, -140, 50, -88); x.lineTo(50, -74); x.quadraticCurveTo(0, -124, -50, -74); x.closePath(); x.fill();
    // portal swirl
    x.save(); x.beginPath(); x.moveTo(-28, 2); x.lineTo(-28, -80); x.quadraticCurveTo(0, -116, 28, -80); x.lineTo(28, 2); x.closePath(); x.clip();
    const g = x.createRadialGradient(0, -44, 4, 0, -44, 60); g.addColorStop(0, '#fff8d8'); g.addColorStop(.4, '#9a7bff'); g.addColorStop(1, '#2b1d66'); x.fillStyle = g; x.fillRect(-30, -120, 60, 124);
    x.globalCompositeOperation = 'lighter'; for (let i = 0; i < 3; i++) { x.strokeStyle = `rgba(200,180,255,${.45 - i * .1})`; x.lineWidth = 3; x.beginPath(); for (let a = 0; a < 12; a += .2) { const rr = a * 2.6, aa = a + t * (2 + i) + i * 2; x.lineTo(Math.cos(aa) * rr, -44 + Math.sin(aa) * rr * 1.2); } x.stroke(); }
    x.restore();
    x.fillStyle = '#ffe9a0'; x.beginPath(); x.arc(0, -122, 5 + Math.sin(t * 3), 0, TAU); x.fill();
  },
  hatchery(x, lv, t, h) {
    shadow(x, 58, 22);
    x.fillStyle = '#7a5530'; x.beginPath(); x.ellipse(0, -8, 56, 24, 0, 0, TAU); x.fill();
    x.strokeStyle = '#a07040'; x.lineWidth = 3; for (let i = 0; i < 18; i++) { const a = i / 18 * TAU; x.beginPath(); x.moveTo(Math.cos(a) * 40, -8 + Math.sin(a) * 16); x.lineTo(Math.cos(a + .5) * 58, -10 + Math.sin(a + .5) * 25); x.stroke(); }
    x.fillStyle = '#4a3218'; x.beginPath(); x.ellipse(0, -12, 40, 15, 0, 0, TAU); x.fill();
    nestEggs(x, lv, t, h, 0, 0, 1, true);
    x.globalCompositeOperation = 'lighter'; x.globalAlpha = .35 + .15 * Math.sin(t * 2); x.drawImage(dot('#ffcf6a'), -50, -60, 100, 70); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
  },
  mine(x, lv, t) {
    shadow(x, 56, 22);
    x.fillStyle = '#7d756a'; x.beginPath(); x.moveTo(-54, 4); x.lineTo(-40, -40); x.lineTo(-6, -58); x.lineTo(30, -46); x.lineTo(54, 4); x.closePath(); x.fill();
    x.fillStyle = '#968e80'; x.beginPath(); x.moveTo(-40, -40); x.lineTo(-6, -58); x.lineTo(4, -20); x.lineTo(-30, -6); x.closePath(); x.fill();
    x.fillStyle = '#2a2018'; x.beginPath(); x.ellipse(10, -6, 14, 12, 0, Math.PI, 0); x.fill();
    const n = 2 + lv;
    for (let i = 0; i < n; i++) { const cx = -36 + i * (72 / n) + 8, h = 22 + (i % 3) * 10, cy = -34 - (i % 2) * 14; const g = x.createLinearGradient(cx - 6, cy - h, cx + 6, cy); g.addColorStop(0, '#e6fbff'); g.addColorStop(1, '#3fa9ff'); x.fillStyle = g; x.beginPath(); x.moveTo(cx, cy - h); x.lineTo(cx + 7, cy - h * .4); x.lineTo(cx + 4, cy); x.lineTo(cx - 4, cy); x.lineTo(cx - 7, cy - h * .4); x.closePath(); x.fill(); }
    x.globalCompositeOperation = 'lighter'; x.globalAlpha = .4 + .2 * Math.sin(t * 2.5); x.drawImage(dot('#7cd0ff'), -48, -90, 96, 90); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
    // cart
    x.fillStyle = '#6a4a2a'; x.fillRect(26, -12, 26, 14); x.fillStyle = '#ffd54a'; x.beginPath(); x.ellipse(39, -13, 11, 5, 0, 0, TAU); x.fill();
  },
  shrine(x, lv, t, h) {
    shadow(x, 56, 22);
    x.fillStyle = '#b3a07c'; x.fillRect(-40, -12, 80, 14); x.fillStyle = '#c9b691'; x.fillRect(-34, -22, 68, 12);
    x.fillStyle = '#8f2f2a'; x.fillRect(-24, -70, 6, 50); x.fillRect(18, -70, 6, 50);
    x.fillStyle = '#5b4a3a'; x.beginPath(); x.moveTo(-46, -66); x.quadraticCurveTo(0, -78, 46, -66); x.lineTo(30, -90); x.quadraticCurveTo(0, -98, -30, -90); x.closePath(); x.fill();
    x.fillStyle = '#c9a23a'; x.beginPath(); x.moveTo(-14, -94); x.lineTo(0, -114); x.lineTo(14, -94); x.closePath(); x.fill();
    // 6 element orbs orbit; brightness = level
    for (let i = 0; i < 6; i++) {
      const e = ELEMS[i], l = (h.shrine[e] || 0), a = t * .7 + i / 6 * TAU, ox = Math.cos(a) * 52, oy = -54 + Math.sin(a) * 18, front = Math.sin(a) > 0;
      x.globalAlpha = front ? 1 : .6; x.globalCompositeOperation = 'lighter'; const s = 10 + l * 4; x.drawImage(dot(PAL[e].aura), ox - s, oy - s, s * 2, s * 2); x.globalCompositeOperation = 'source-over';
      x.fillStyle = l ? PAL[e].core : 'rgba(255,255,255,.35)'; x.beginPath(); x.arc(ox, oy, 3.5 + l * .5, 0, TAU); x.fill(); x.globalAlpha = 1;
    }
  },
  altar(x, lv, t, h) {
    shadow(x, 50, 20);
    x.fillStyle = '#a99f8e'; x.beginPath(); x.ellipse(0, -4, 40, 14, 0, 0, TAU); x.fill(); x.fillStyle = '#c4bba8'; x.fillRect(-16, -44, 32, 40); x.beginPath(); x.ellipse(0, -44, 22, 8, 0, 0, TAU); x.fill();
    const y = -70 + Math.sin(t * 2) * 5, r = h.relic, col = { sun: '#ffb340', feather: '#7cf0a0', shell: '#c9a04a', gourd: '#ff8ab0' }[r] || '#ffffff';
    x.globalCompositeOperation = 'lighter'; x.drawImage(dot(col), -34, y - 34, 68, 68); x.globalCompositeOperation = 'source-over';
    x.save(); x.translate(0, y); x.rotate(Math.sin(t) * .2);
    x.fillStyle = col; x.strokeStyle = 'rgba(60,30,10,.6)'; x.lineWidth = 2;
    if (r === 'sun') { x.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * TAU, rr = i % 2 ? 9 : 15; x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } x.closePath(); x.fill(); x.stroke(); }
    else if (r === 'feather') { x.beginPath(); x.ellipse(0, 0, 6, 16, .5, 0, TAU); x.fill(); x.stroke(); }
    else if (r === 'shell') { x.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; x.lineTo(Math.cos(a) * 13, Math.sin(a) * 13); } x.closePath(); x.fill(); x.stroke(); }
    else if (r === 'gourd') { x.beginPath(); x.arc(0, 5, 10, 0, TAU); x.arc(0, -9, 6, 0, TAU); x.fill(); }
    else { x.beginPath(); x.arc(0, 0, 8, 0, TAU); x.stroke(); }
    x.restore();
  },
  forge(x, lv, t) {
    shadow(x, 56, 22);
    x.fillStyle = '#7a6a58'; x.fillRect(-42, -50, 84, 52); x.fillStyle = '#5b3a26'; x.beginPath(); x.moveTo(-50, -48); x.lineTo(0, -82); x.lineTo(50, -48); x.closePath(); x.fill();
    x.fillStyle = '#6a625a'; x.fillRect(22, -92, 14, 34);
    const f = .7 + .3 * Math.sin(t * 9); x.fillStyle = `rgba(255,${120 + 60 * f | 0},40,1)`; x.fillRect(-14, -30, 28, 28);
    x.fillStyle = '#3a3a40'; x.fillRect(-58, -14, 20, 10); x.fillRect(-52, -4, 8, 8);
  },
  arena(x, lv, t) {
    shadow(x, 66, 26);
    x.fillStyle = '#c9b690'; x.beginPath(); x.ellipse(0, -4, 62, 24, 0, 0, TAU); x.fill(); x.fillStyle = '#a8946c'; x.beginPath(); x.ellipse(0, -4, 44, 16, 0, 0, TAU); x.fill();
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, px = Math.cos(a) * 58, py = -4 + Math.sin(a) * 22; x.fillStyle = '#e6dcc4'; x.fillRect(px - 4, py - 34, 8, 34); x.fillStyle = '#b5443a'; x.fillRect(px - 6, py - 38, 12, 5); }
  },
};
/** one egg spot per hatchery slot; incubating mystery eggs show their tier colour and wobble + glow when ready */
function nestEggs(x, lv, t, h, cx, cy, sc, holes) {
  const inc = (h && h.incub) || [], now = Date.now();
  x.save(); x.translate(cx, cy); x.scale(sc, sc);
  for (let i = 0; i < lv; i++) {
    const ex = (i - (lv - 1) / 2) * 24, e = inc[i];
    if (holes) { x.fillStyle = '#2e1e0c'; x.beginPath(); x.ellipse(ex, -16, 10, 4, 0, 0, TAU); x.fill(); }
    if (!e) continue;
    const ready = now >= e.end, tier = e.tier || 'gold';
    const col = tier === 'rainbow' ? `hsl(${(t * 90 + i * 60) % 360},90%,72%)` : TIER_COL[tier] || '#ffd27a';
    const wob = Math.sin(t * (ready ? 9 : 3) + i * 2) * (ready ? .16 : .06);
    x.save(); x.translate(ex, -18); x.rotate(wob); const g = x.createRadialGradient(-4, -14, 2, 0, -8, 18); g.addColorStop(0, '#ffffff'); g.addColorStop(1, col); x.fillStyle = g; x.beginPath(); x.ellipse(0, -10, 11, 15, 0, 0, TAU); x.fill(); x.strokeStyle = 'rgba(60,40,10,.35)'; x.lineWidth = 1.2; x.stroke(); x.restore();
    if (ready) { x.globalCompositeOperation = 'lighter'; x.globalAlpha = .55 + .35 * Math.sin(t * 5 + i); x.drawImage(dot(col.startsWith('hsl') ? '#ff9ad8' : col), ex - 26, -54, 52, 52); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; }
  }
  x.restore();
}
// ---- sprite buildings: image + code overlays (eggs, portal, orbs, floating relic) ----
let portalC = null;
function drawPortal(x, t) { // swirl clipped to the arch opening mask, drawn behind the gate sprite
  const m = IMG.bld_gate_hole; if (!m) return;
  if (!portalC) portalC = mk(256, 256);
  const c = portalC.getContext('2d'), f = 256 / 1024, [hx, hy] = GATE_HOLE_C.map(v => v * f);
  c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, 256, 256);
  const g = c.createRadialGradient(hx, hy, 2, hx, hy, 40); g.addColorStop(0, '#fff8d8'); g.addColorStop(.4, '#9a7bff'); g.addColorStop(1, '#2b1d66'); c.fillStyle = g; c.fillRect(0, 0, 256, 256);
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) { c.strokeStyle = `rgba(200,180,255,${.5 - i * .12})`; c.lineWidth = 2; c.beginPath(); for (let a = 0; a < 12; a += .2) { const rr = a * 2.4, aa = a + t * (2 + i) + i * 2; c.lineTo(hx + Math.cos(aa) * rr, hy + Math.sin(aa) * rr * 1.5); } c.stroke(); }
  c.globalCompositeOperation = 'destination-in'; c.drawImage(m, 0, 0, 256, 256);
  x.drawImage(portalC, -512 * BLD_K, -900 * BLD_K, 1024 * BLD_K, 1024 * BLD_K);
}
function shrineOrbs(x, t, h, front) { // 6 element orbs orbiting the pavilion; brightness = shrine level
  const [cx, cy] = AP(512, 610), rx = 190 * BLD_K, ry = 62 * BLD_K;
  for (let i = 0; i < 6; i++) {
    const e = ELEMS[i], l = (h.shrine[e] || 0), a = t * .7 + i / 6 * TAU, isFront = Math.sin(a) > 0;
    if (isFront !== front) continue;
    const ox = cx + Math.cos(a) * rx, oy = cy + Math.sin(a) * ry;
    x.globalAlpha = front ? 1 : .65; x.globalCompositeOperation = 'lighter'; const sz = 10 + l * 4; x.drawImage(dot(PAL[e].aura), ox - sz, oy - sz, sz * 2, sz * 2); x.globalCompositeOperation = 'source-over';
    x.fillStyle = l ? PAL[e].core : 'rgba(255,255,255,.45)'; x.beginPath(); x.arc(ox, oy, 3.5 + l * .5, 0, TAU); x.fill(); x.globalAlpha = 1;
  }
}
function drawArtBuilding(x, bd, key, lv, t, h, ok) {
  const live = ok && !bd.soon;
  if (live && bd.id === 'gate') drawPortal(x, t);
  if (live && bd.id === 'shrine') shrineOrbs(x, t, h, false);
  x.drawImage(IMG[key], -512 * BLD_K, -900 * BLD_K, 1024 * BLD_K, 1024 * BLD_K);
  if (!live) return;
  if (bd.id === 'hatchery') { const [nx, ny] = AP(...NEST); nestEggs(x, lv, t, h, nx, ny + 18 * 1.25, 1.25, false); }
  else if (bd.id === 'shrine') shrineOrbs(x, t, h, true);
  else if (bd.id === 'altar' && h.relic && IMG['relic_' + h.relic]) {
    const [ax, ay] = AP(505, 470), y = ay + Math.sin(t * 2) * 5, col = { sun: '#ffb340', feather: '#7cf0a0', shell: '#c9a04a', gourd: '#ff8ab0' }[h.relic] || '#ffffff', sz = 62;
    x.globalCompositeOperation = 'lighter'; x.globalAlpha = .8; x.drawImage(dot(col), ax - sz * .7, y - sz * .7, sz * 1.4, sz * 1.4); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
    x.save(); x.translate(ax, y); x.rotate(Math.sin(t) * .15); x.drawImage(IMG['relic_' + h.relic], -sz / 2, -sz / 2, sz, sz); x.restore();
  }
}
function drawSite(x, b, t) { // locked / coming soon: construction site
  shadow(x, b.r * .8, b.r * .3);
  x.strokeStyle = '#8a6a3a'; x.lineWidth = 3; for (const sx of [-30, 0, 30]) { x.beginPath(); x.moveTo(sx, 2); x.lineTo(sx, -50); x.stroke(); } x.beginPath(); x.moveTo(-34, -24); x.lineTo(34, -24); x.moveTo(-34, -48); x.lineTo(34, -48); x.moveTo(-30, 0); x.lineTo(30, -48); x.stroke();
  x.fillStyle = '#e8c860'; x.fillRect(-18, -22, 36, 18); x.fillStyle = '#4a3418'; x.font = '600 12px Mitr, sans-serif'; x.textAlign = 'center'; x.fillText('สร้าง', 0, -9);
}

// ---------- monsters wandering ----------
const EMO = ['♥', '♪', 'z', '!', '★'];
// monster size on the turtle: half the P0 size (.27) so the roster can grow; MR scales hops / hit boxes with it
const MON_SCALE = .135, MR = MON_SCALE / .27, MAX_HOME_MONS = 16;
export class HomeView {
  constructor(S, opts = {}) {
    this.S = S; this.opts = opts; this.sel = null; this.t = 0; this.pan = 0;
    if (!shellC) buildShell();
    this.scale = TURTLE_SCALE[home(S).castle]; this.scaleShow = this.scale;
    this.pops = {}; this.headUp = 0; this.blink = 0; this.nextBlink = 2; this.hum = 0;
    this.clouds = Array.from({ length: 16 }, (_, i) => ({ x: rnd(-1200, 1200), y: rnd(-420, 520), w: rnd(220, 520), sp: rnd(8, 22), layer: i % 3 }));
    this.mons = [];
    this.syncMons();
  }
  syncMons() {
    // one walker per owned unit (team first, then the strongest), drawn with its star look
    const units = this.S.mons.filter(m => SPECIES[m.sid] && !SPECIES[m.sid].boss), inTeam = u => this.S.team.includes(u.uid);
    const ordered = [...units.filter(inTeam), ...units.filter(u => !inTeam(u)).sort((a, b) => b.stars - a.stars || b.lvl - a.lvl)].slice(0, MAX_HOME_MONS);
    const keep = this.mons.filter(m => ordered.some(u => u.uid === m.uid));
    for (const k of keep) { const u = ordered.find(x => x.uid === k.uid); k.sid = lookOf(u.sid, u.stars, !!u.rare); }
    for (const u of ordered) if (!keep.find(m => m.uid === u.uid)) { const p = this.freePoint(); keep.push({ uid: u.uid, sid: lookOf(u.sid, u.stars, !!u.rare), x: p[0], y: p[1], tx: p[0], ty: p[1], wait: rnd(.2, 2), flip: Math.random() < .5, back: false, walk: 0, hop: 0, vz: 0, z: 0, emo: null, emoT: rnd(3, 10), ph: Math.random() * 9 }); }
    this.mons = keep;
  }
  freePoint() {
    for (let k = 0; k < 40; k++) {
      const a = Math.random() * TAU, d = Math.sqrt(Math.random()), x = Math.cos(a) * d * 380, y = -10 + Math.sin(a) * d * 200;
      if (BUILDINGS.every(b => (unlocked(this.S, b.id) || true) && Math.hypot((x - b.pos[0]) / 1, (y - b.pos[1]) / .6) > b.r + 26)) return [x, y];
    }
    return [0, 60];
  }
  // local (turtle) -> world
  bob() { return Math.sin(this.t * .7) * 5; }
  L(x, y) { const s = this.scaleShow; return [x * s, y * s + this.bob() * s]; }
  fit() {
    const s = this.scaleShow, port = E.W < E.H;
    const tall = hasHomeArt() ? 1.13 : 1; // the sprite turtle is taller (shell band + head below it)
    const base = port ? clamp(Math.min(E.W / (840 * s), (E.H - 170) / (860 * tall * s)), .3, 1.3) : clamp(Math.min(E.W / (1150 * s), (E.H - 140) / (880 * tall * s)), .3, 1.3);
    return base;
  }
  update(dt) {
    this.t += dt; const S = this.S, h = home(S);
    this.scale = TURTLE_SCALE[h.castle];
    if (!this.growing) this.scaleShow = this.scale;
    E.zoomT = 1;
    const s = this.scaleShow, port = E.W < E.H, maxPan = port ? Math.max(0, (900 * s - E.W / E.base) / 2) : 0;
    this.pan = clamp(this.pan, -maxPan, maxPan);
    const focus = this.focus ? this.L(...this.focus) : null;
    E.camT.x = focus ? focus[0] * .6 : this.pan; const cy = (hasHomeArt() ? 118 : 70) * s; E.camT.y = (focus ? lerp(cy, focus[1], .5) : cy) + (port ? 20 / E.base : 0);
    // blink / head
    this.nextBlink -= dt; if (this.nextBlink <= 0) { this.blink = .16; this.nextBlink = rnd(2.5, 5.5); }
    this.blink = Math.max(0, this.blink - dt); this.hum = Math.max(0, this.hum - dt); this.headUp = lerp(this.headUp, this.hum > 0 ? 1 : 0, 1 - Math.exp(-dt * 5));
    for (const c of this.clouds) { c.x -= c.sp * dt * (c.layer + 1) * .6; if (c.x < -1400) { c.x = 1400; c.y = rnd(-420, 520); } }
    // monsters
    for (const m of this.mons) {
      m.emoT -= dt; if (m.emoT <= 0) { m.emo = { c: EMO[Math.random() * EMO.length | 0], t: 1.6 }; m.emoT = rnd(6, 14); }
      if (m.emo) { m.emo.t -= dt; if (m.emo.t <= 0) m.emo = null; }
      if (m.z > 0 || m.vz) { m.vz -= 900 * dt; m.z += m.vz * dt; if (m.z <= 0) { m.z = 0; m.vz = 0; } }
      if (m.wait > 0) { m.wait -= dt; m.walk = 0; if (m.wait <= 0) { const p = this.freePoint(); m.tx = p[0]; m.ty = p[1]; } continue; }
      const dx = m.tx - m.x, dy = m.ty - m.y, d = Math.hypot(dx, dy);
      if (d < 4) { m.wait = rnd(1.2, 4.5); m.walk = 0; continue; }
      const sp = 46 * dt; m.x += dx / d * Math.min(sp, d); m.y += dy / d * Math.min(sp, d);
      if (Math.abs(dx) > 2) m.flip = dx < 0; m.back = dy < -Math.abs(dx) * .4; m.walk += dt;
    }
  }
  // ---------- render ----------
  render() {
    const ctx = E.ctx, S = this.S, h = home(S), t = this.t;
    E.base = this.fit();
    // sky (screen space)
    screenTransform(); let g = ctx.createLinearGradient(0, 0, 0, E.H); g.addColorStop(0, SKY[0]); g.addColorStop(.55, SKY[1]); g.addColorStop(1, SKY[2]); ctx.fillStyle = g; ctx.fillRect(0, 0, E.W, E.H);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .55; ctx.drawImage(dot('#fff3c0'), E.W * .78 - 220, E.H * .12 - 220, 440, 440); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    // far cloud layer (parallax)
    const z = E.base * E.zoom, wt = () => ctx.setTransform(E.DPR * z, 0, 0, E.DPR * z, E.DPR * (E.W / 2 - E.cam.x * z), E.DPR * (E.H / 2 - E.cam.y * z));
    for (const c of this.clouds) if (c.layer === 0) { ctx.setTransform(E.DPR * z * .6, 0, 0, E.DPR * z * .6, E.DPR * (E.W / 2 - E.cam.x * z * .3), E.DPR * (E.H / 2 - E.cam.y * z * .3)); ctx.globalAlpha = .75; ctx.drawImage(puff(256, 110, false), c.x, c.y - 200, c.w, c.w * .43); }
    ctx.globalAlpha = 1; wt();
    const s = this.scaleShow, b = this.bob() * s;
    // cloud sea under the turtle
    for (const c of this.clouds) if (c.layer === 1) ctx.drawImage(puff(256, 110, true), c.x, 160 * s + c.y * .25, c.w * 1.2, c.w * .5);
    // wake ripples
    for (let i = 0; i < 3; i++) { const u = ((t * .35 + i / 3) % 1); ctx.globalAlpha = (1 - u) * .5; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, 110 * s + b, (470 + u * 260) * s, (280 + u * 140) * s, 0, 0, TAU); ctx.stroke(); }
    ctx.globalAlpha = 1;
    ctx.save(); ctx.translate(0, b); ctx.scale(s, s * (1 + Math.sin(t * .7 + 1) * .006));
    if (hasHomeArt()) { // flippers + head tuck under the shell; the face shows below the rim, the neck through the front notch
      this.drawLimbs(ctx, t, false); this.drawLimbs(ctx, t, true); this.drawHeadArt(ctx, t);
      ctx.drawImage(IMG.home_shell, -SHELL_C[0] * SHELL_K, -6 - SHELL_C[1] * SHELL_K, 1536 * SHELL_K, 1024 * SHELL_K);
    } else {
      this.drawLimbs(ctx, t, false);
      this.drawHead(ctx, t, true);
      ctx.drawImage(shellC.c, -shellC.W / 2, -shellC.oy, shellC.W, shellC.H);
      this.drawLimbs(ctx, t, true);
      this.drawHead(ctx, t, false);
    }
    ctx.restore();
    // buildings + monsters (y-sorted)
    const ents = [];
    for (const bd of BUILDINGS) ents.push({ y: bd.pos[1], d: () => this.drawBuilding(ctx, bd, t) });
    for (const m of this.mons) ents.push({ y: m.y, d: () => this.drawMon(ctx, m, t) });
    ents.sort((a, b2) => a.y - b2.y); for (const e of ents) e.d();
    // labels
    for (const bd of BUILDINGS) this.drawLabel(ctx, bd);
    // front cloud wisps
    const wy = (hasHomeArt() ? 640 : 440) * s; // below the sprite turtle's face
    for (const c of this.clouds) if (c.layer === 2) { ctx.globalAlpha = .9; ctx.drawImage(puff(256, 110, true), c.x, wy + c.y * .22, c.w * 1.3, c.w * .55); }
    ctx.globalAlpha = 1;
    drawParts();
  }
  drawLimbs(ctx, t, front) {
    const L = front ? [[-1, 1], [1, 1]] : [[-1, -1], [1, -1]];
    const fimg = IMG[front ? 'home_flipper_front' : 'home_flipper_back'];
    if (fimg && hasHomeArt()) { // sprite points left with its root at (900,512); mirrored for the right side
      for (const [sx, sy] of L) {
        const ph = (sx + 2) * 1.3 + (sy + 2), sw = Math.sin(t * 1.3 + ph) * .28;
        ctx.save(); ctx.translate(sx * (sy > 0 ? 400 : 380), sy > 0 ? 215 : -95); ctx.rotate(sx * (sy > 0 ? .5 : -.45) + sw * sx); if (sx > 0) ctx.scale(-1, 1);
        ctx.drawImage(fimg, -900 * FLIP_K, -512 * FLIP_K, 1024 * FLIP_K, 1024 * FLIP_K); ctx.restore();
      }
      return;
    }
    for (const [sx, sy] of L) {
      const ph = (sx + 2) * 1.3 + (sy + 2), sw = Math.sin(t * 1.3 + ph) * .32;
      const px = sx * (sy > 0 ? 380 : 340), py = sy > 0 ? 150 : -150;
      ctx.save(); ctx.translate(px, py + (sy > 0 ? 40 : 30)); ctx.rotate(sx * (sy > 0 ? .55 : -.5) + sw * sx);
      const g = ctx.createLinearGradient(0, -30, 0, 30); g.addColorStop(0, '#9cc274'); g.addColorStop(1, '#5f8a45');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(sx * 70, 0, 92, 34, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(60,90,40,.45)'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(sx * (40 + i * 26), -6 + (i % 2) * 10, 6, 0, TAU); ctx.fill(); }
      ctx.restore();
    }
  }
  drawHeadArt(ctx, t) {
    const up = this.headUp, sway = Math.sin(t * .9) * .04, img = IMG[this.hum > 0 ? 'home_head_hum' : this.blink > 0 ? 'home_head_blink' : 'home_head'] || IMG.home_head;
    const top = HEAD_Y - HEAD_C[1] * HEAD_K; // neck top, the pivot
    ctx.save(); ctx.translate(0, top - up * 22); ctx.rotate(sway);
    ctx.drawImage(img, -HEAD_C[0] * HEAD_K, 0, 1024 * HEAD_K, 1024 * HEAD_K); ctx.restore();
  }
  drawHead(ctx, t, neckOnly) {
    const up = this.headUp, sway = Math.sin(t * .9) * .05;
    ctx.save(); ctx.translate(0, 300 - up * 26); ctx.rotate(sway);
    let g;
    if (neckOnly) { g = ctx.createLinearGradient(0, -60, 0, 40); g.addColorStop(0, '#6f9a52'); g.addColorStop(1, '#93ba6c'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, -10, 66, 80, 0, 0, TAU); ctx.fill(); ctx.restore(); return; }
    // neck (front part, below the rim)
    g = ctx.createLinearGradient(0, 0, 0, 60); g.addColorStop(0, '#7fa85a'); g.addColorStop(1, '#93ba6c'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 40, 58, 44, 0, 0, TAU); ctx.fill();
    // head
    ctx.translate(0, 92);
    g = ctx.createRadialGradient(-20, -30, 10, 0, 0, 92); g.addColorStop(0, '#c2df98'); g.addColorStop(.7, '#93ba6c'); g.addColorStop(1, '#6f9a52');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 92, 74, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(90,130,60,.45)'; for (const [x, y, r] of [[-40, -40, 10], [36, -46, 8], [-6, -58, 7], [54, -16, 6]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
    // moss & sprout on head
    ctx.fillStyle = '#5c9a3a'; ctx.beginPath(); ctx.ellipse(-10, -66, 30, 10, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = '#4a7a2a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-10, -70); ctx.lineTo(-10, -92); ctx.stroke(); ctx.fillStyle = '#7fd04a'; ctx.beginPath(); ctx.ellipse(-20, -94, 11, 6, -.5, 0, TAU); ctx.ellipse(0, -96, 11, 6, .5, 0, TAU); ctx.fill();
    // eyes
    const bl = this.blink > 0 ? .12 : 1;
    for (const ex of [-38, 38]) {
      ctx.fillStyle = '#fffaf0'; ctx.beginPath(); ctx.ellipse(ex, -6, 22, 24 * bl, 0, 0, TAU); ctx.fill();
      if (bl > .5) { ctx.fillStyle = '#2b2a3a'; ctx.beginPath(); ctx.ellipse(ex + 3, -2, 13, 16, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(ex - 2, -9, 5, 0, TAU); ctx.arc(ex + 7, 4, 2.5, 0, TAU); ctx.fill(); }
      else { ctx.strokeStyle = '#3a4a2a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(ex - 18, -6); ctx.quadraticCurveTo(ex, 0, ex + 18, -6); ctx.stroke(); }
    }
    ctx.fillStyle = 'rgba(255,140,140,.35)'; ctx.beginPath(); ctx.ellipse(-62, 24, 14, 8, 0, 0, TAU); ctx.ellipse(62, 24, 14, 8, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#3a4a2a'; ctx.lineWidth = 3.5; ctx.beginPath();
    if (this.hum > 0) { ctx.ellipse(0, 34, 10, 7 + Math.sin(t * 12) * 2, 0, 0, TAU); } else { ctx.moveTo(-16, 30); ctx.quadraticCurveTo(0, 42, 16, 30); }
    ctx.stroke();
    ctx.restore();
  }
  /** height (local units) of a building's sprite, 0 without art */
  artH(bd) { const h = home(this.S), lv = bd.id === 'castle' ? h.castle : (h.lv[bd.id] || 1), k = bldArt(bd, lv, unlocked(this.S, bd.id)); return k ? (900 - ART_TOP[k]) * BLD_K : 0; }
  bPos(bd) { const p = this.pops[bd.id]; return this.L(bd.pos[0], bd.pos[1]); }
  drawBuilding(ctx, bd, t) {
    const h = home(this.S), s = this.scaleShow, [x, y] = this.bPos(bd), ok = unlocked(this.S, bd.id);
    const lv = bd.id === 'castle' ? h.castle : (h.lv[bd.id] || 1);
    const pop = this.pops[bd.id] || 1, k = s * (bd.id === 'castle' ? 1 : .92 + .04 * lv) * pop;
    ctx.save(); ctx.translate(x, y);
    if (this.sel === bd.id) { const p = .5 + .5 * Math.sin(t * 5); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .5 + .3 * p; ctx.strokeStyle = '#ffe9a0'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(0, 2, bd.r * s * 1.05, bd.r * s * .42, 0, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    const art = bldArt(bd, lv, ok);
    if (art) { ctx.scale(s * pop, s * pop); drawArtBuilding(ctx, bd, art, lv, t, h, ok); }
    else { ctx.scale(k, k); if (!ok || bd.soon) drawSite(ctx, bd, t); else DRAW[bd.id](ctx, lv, t, h); }
    ctx.restore();
    // mine coin bubble
    if (bd.id === 'mine' && ok) {
      const st = mineStored(this.S), cap = mineCap(this.S);
      if (st >= 20) { const art = bldArt(bd, h.lv.mine || 1, true), by = y - (art ? (900 - ART_TOP[art]) * BLD_K + 14 : 100) * s + Math.sin(t * 3) * 4, full = st >= cap; ctx.fillStyle = full ? '#ffdf6a' : '#fff6dc'; ctx.strokeStyle = '#8a5a10'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, by, 17 * s + 4, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#e0a020'; ctx.beginPath(); ctx.arc(x, by, 9 * s + 2, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff3b0'; ctx.fillRect(x - 1.5, by - 5, 3, 10); }
    }
  }
  drawLabel(ctx, bd) {
    const s = this.scaleShow, [x, y] = this.bPos(bd), z = E.base * E.zoom, fs = 12.5 / z, h = home(this.S), ok = unlocked(this.S, bd.id);
    const lv = bd.id === 'castle' ? h.castle : (h.lv[bd.id] || 0);
    const str = bd.name + (ok && !bd.soon && BDEF[bd.id].max > 1 ? ' Lv.' + lv : '') + (!ok ? ' 🔒' : '');
    ctx.font = `600 ${fs}px Mitr, sans-serif`; ctx.textAlign = 'center'; const w = ctx.measureText(str).width + 14 / z, ly = y + 30 * s;
    ctx.fillStyle = this.sel === bd.id ? 'rgba(80,46,10,.92)' : 'rgba(20,24,14,.62)'; const r = 9 / z; ctx.beginPath(); ctx.roundRect(x - w / 2, ly - fs * .95, w, fs * 1.45, r); ctx.fill();
    ctx.fillStyle = this.sel === bd.id ? '#ffe9a0' : '#f7f0e3'; ctx.fillText(str, x, ly + fs * .18);
  }
  drawMon(ctx, m, t) {
    const s = this.scaleShow, [x, y] = this.L(m.x, m.y), k = MON_SCALE * s;
    const walking = m.walk > 0, hop = walking ? Math.abs(Math.sin(m.walk * 9)) * 9 * MR : 0, sq = walking ? 1 + Math.sin(m.walk * 18) * .04 : 1 + Math.sin(t * 2.2 + m.ph) * .02;
    ctx.fillStyle = 'rgba(30,40,10,.3)'; ctx.beginPath(); ctx.ellipse(x, y + 2, 40 * k * 2, 14 * k * 2, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(x, y - (hop + m.z * MR) * s); ctx.scale(k * (m.flip ? -1 : 1) / sq, k * sq);
    ctx.drawImage(spr(m.sid, (m.back ? 'back' : 'front') + '_idle'), -PIV[0], -PIV[1]);
    ctx.restore();
    if (m.emo) { const u = 1 - m.emo.t / 1.6, by = y - 110 * k * 2 - (hop + m.z * MR) * s - u * 10; ctx.globalAlpha = Math.min(1, m.emo.t * 2); ctx.fillStyle = '#fffaf0'; ctx.beginPath(); ctx.arc(x + 9 * s, by, 10 * s + 3, 0, TAU); ctx.fill(); ctx.fillStyle = m.emo.c === '♥' ? '#ff5a7a' : '#5a4630'; ctx.font = `600 ${12 * s + 3}px Mitr, sans-serif`; ctx.textAlign = 'center'; ctx.fillText(m.emo.c, x + 9 * s, by + 5 * s); ctx.globalAlpha = 1; }
  }
  // ---------- input ----------
  hit(wx, wy) {
    const s = this.scaleShow;
    for (const m of this.mons) { const [x, y] = this.L(m.x, m.y); if (Math.abs(wx - x) < 34 * MR * s + 6 && wy < y + 8 && wy > y - 80 * MR * s - 6) return { mon: m }; }
    let best = null, bd = 1e9;
    for (const b of BUILDINGS) { const [x, y] = this.bPos(b), hh = this.artH(b), dx = (wx - x) / (b.r * s), dy = hh ? (wy - (y - hh * .42 * s)) / (Math.max(b.r * .9, hh * .55) * s) : (wy - (y - 30 * s)) / (b.r * s * .9), d = dx * dx + dy * dy; if (d < 1.1 && d < bd) { bd = d; best = b; } }
    if (best) return { b: best };
    const [hx, hy] = this.L(0, hasHomeArt() ? HEAD_Y + 20 : 392); if (Math.hypot(wx - hx, (wy - hy) * 1.2) < (hasHomeArt() ? 115 : 100) * s) return { head: true };
    return null;
  }
  tap(wx, wy) {
    const r = this.hit(wx, wy);
    if (r?.mon) { const m = r.mon, [x, y] = this.L(m.x, m.y); m.vz = 260; m.z = .01; m.emo = { c: '♥', t: 1.6 }; burst(x, y - 60 * MR * this.scaleShow, 0, 8, '#ff7a9a', 120, 9, .7, { grav: -40 }); text(x, y - 90 * MR * this.scaleShow, SPECIES[m.sid].name, '#fff3d0', 16); sfx.chime(); this.opts.onMon?.(m.sid); return; }
    if (r?.head) { this.hum = 1.4; sfx.hum(); const [x, y] = this.L(0, 330); for (let i = 0; i < 6; i++) addP({ type: 'text', x: x + rnd(-40, 40), y: y - 40, z: 0, vz: rnd(50, 90), vx: rnd(-30, 30), life: 1.4, str: '♪', color: '#fff3d0', size: 22, add: false, keep: true }); this.opts.onHead?.(); return; }
    if (r?.b) { this.sel = r.b.id; sfx.click(); this.opts.onSelect?.(r.b.id); return; }
    this.sel = null; this.opts.onSelect?.(null);
  }
  // ---------- effects ----------
  celebrate(id, label) {
    const bd = BDEF[id], [x, y] = this.bPos(bd), s = this.scaleShow;
    sfx.build(); setTimeout(() => sfx.starup(), 380);
    burst(x, y - 10, 10, 26, '#d8c6a0', 220, 26, .9, { type: 'smoke', add: false, grav: -30 });
    burst(x, y - 40 * s, 30, 22, '#ffd54a', 260, 10, 1, { type: 'twinkle' });
    ring(x, y, 20, bd.r * s * 1.6, '#ffe9a0', .7, 6);
    text(x, y - 120 * s, label, '#ffe9a0', 24);
    const self = this; run((function* () { yield* tween(.18, u => self.pops[id] = 1 - .25 * u); yield* tween(.45, u => self.pops[id] = .75 + .25 * easeBack(u)); self.pops[id] = 1; })());
  }
  grow(from, to) {
    const self = this; this.growing = true; this.focus = [0, 200];
    sfx.hum(); this.hum = 2.2;
    run((function* () {
      yield .5; shake(10); sfx.quake(); flash(.35, '#fff6d8');
      yield* tween(1.3, u => { self.scaleShow = lerp(from, to, easeOut(u)); if (Math.random() < .3) shake(4); });
      self.growing = false; self.focus = null;
      const [x, y] = self.L(0, 0); burst(x, y, 0, 40, '#ffe9a0', 520, 14, 1.2, { type: 'twinkle' }); ring(x, y, 60, 600 * to, '#ffffff', 1, 8); sfx.starup();
      self.syncMons();
    })());
  }
  collectFx(g) {
    const bd = BDEF.mine, [x, y] = this.bPos(bd), s = this.scaleShow; sfx.coin(); setTimeout(() => sfx.coin(), 120);
    burst(x, y - 100 * s, 0, 18, '#ffd54a', 200, 12, .8, { grav: 300 }); text(x, y - 130 * s, '+' + g.toLocaleString(), '#ffe27a', 24);
  }
}
