// @ts-nocheck
// Sprites, recolors, silhouettes/glows and palettes. Species without final art use a recolored fox placeholder.
import { SPECIES } from '../core/data';

export const TAU = Math.PI * 2;
export const PIV = [256, 435]; // feet pivot inside 512px sprite
export const POSES = ['idle', 'attack', 'cast', 'hit', 'burst'];
export const IMG: Record<string, HTMLImageElement> = {};
export const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

export const PAL = {
  fire: { name: 'ไฟ', aura: '#ff8a2a', core: '#ffe1a0', hot: '#fff4d6', rune: '#ffb35a', cut: '#d9481c', dh: 0, sat: 1, lit: 1, all: 1 },
  water: { name: 'น้ำ', aura: '#3fa9ff', core: '#d2efff', hot: '#ffffff', rune: '#7cd0ff', cut: '#1f6fd0', dh: .555, sat: 1.05, lit: 1.03, all: 1 },
  wind: { name: 'ลม', aura: '#4fdc78', core: '#dcffd8', hot: '#f6fff2', rune: '#9af0a0', cut: '#2a9a4a', dh: .27, sat: .95, lit: 1.02, all: 1 },
  earth: { name: 'ดิน', aura: '#c9a04a', core: '#f3e2b0', hot: '#fff6dc', rune: '#e0c070', cut: '#8a6420', dh: .1, sat: .55, lit: .82, all: .93 },
  light: { name: 'แสง', aura: '#ffd54a', core: '#fff6c8', hot: '#ffffff', rune: '#ffe58a', cut: '#c99a10', dh: .075, sat: .7, lit: 1.12, all: 1.04 },
  dark: { name: 'มืด', aura: '#b061ff', core: '#ead0ff', hot: '#ffffff', rune: '#c890ff', cut: '#6a2bb8', dh: .73, sat: 1, lit: .9, all: .72 },
};

// mouth/body anchors per pose (1024 space) for the fox sprite set; placeholders reuse these
const ANCH_RAW = { front_idle: { mouth: [735, 640], body: [520, 640] }, front_attack: { mouth: [750, 690], body: [480, 600] }, front_cast: { mouth: [712, 430], body: [560, 600] }, front_hit: { mouth: [740, 526], body: [480, 640] }, front_burst: { mouth: [776, 756], body: [560, 700] }, back_idle: { mouth: [840, 420], body: [480, 600] }, back_attack: { mouth: [850, 360], body: [560, 560] }, back_cast: { mouth: [800, 400], body: [520, 600] }, back_hit: { mouth: [850, 350], body: [480, 640] }, back_burst: { mouth: [870, 500], body: [540, 640] } };
export const ANCH = {};
for (const k in ANCH_RAW) { ANCH[k] = {}; for (const p in ANCH_RAW[k]) { const a = ANCH_RAW[k][p]; ANCH[k][p] = [a[0] / 2 - PIV[0], a[1] / 2 - PIV[1]]; } }

export async function loadAssets() {
  const A = (window as any).__ASSETS || {};
  await Promise.all(Object.keys(A).map(n => new Promise<void>((res, rej) => { const i = new Image(); i.onload = () => { IMG[n] = i; res(); }; i.onerror = () => rej(new Error('asset ' + n)); i.src = A[n]; })));
}

function hueShift(img, E) {
  const c = mk(img.width, img.height), x = c.getContext('2d'); x.drawImage(img, 0, 0);
  if (E.dh === 0 && E.all === 1) return c;
  const d = x.getImageData(0, 0, c.width, c.height), a = d.data;
  for (let i = 0; i < a.length; i += 4) {
    if (a[i + 3] === 0) continue;
    let r = a[i] / 255, g = a[i + 1] / 255, b = a[i + 2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, dd = mx - mn;
    if (dd >= .06) {
      const s = l > .5 ? dd / (2 - mx - mn) : dd / (mx + mn);
      if (s >= .3 && l <= .84) {
        let h; if (mx === r) h = (g - b) / dd + (g < b ? 6 : 0); else if (mx === g) h = (b - r) / dd + 2; else h = (r - g) / dd + 4; h = (h / 6 + E.dh) % 1;
        const s2 = Math.min(1, s * E.sat), l2 = Math.min(1, l * E.lit), q = l2 < .5 ? l2 * (1 + s2) : l2 + s2 - l2 * s2, p = 2 * l2 - q;
        const f = t => { t < 0 && (t += 1); t > 1 && (t -= 1); return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
        r = f(h + 1 / 3); g = f(h); b = f(h - 1 / 3);
      }
    }
    a[i] = Math.min(255, r * 255 * E.all); a[i + 1] = Math.min(255, g * 255 * E.all); a[i + 2] = Math.min(255, b * 255 * E.all);
  }
  x.putImageData(d, 0, 0); return c;
}

// ---- looks by star grade (evolution): ★1-3 base art · ★4 recoloured · ★5-6 evolved-form art (key + 'e', BATCH08) when it
// exists, otherwise a stronger recolour. A "look id" is `sid~stars` (e.g. 'B05~4'); plain sid = base look. ----
export const baseOf = (sid: string) => sid.split('~')[0];
const SP = sid => SPECIES[baseOf(sid)];
const lookLv = sid => +(sid.split('~')[1] || 0);
export const lookOf = (sid: string, stars: number) => stars >= 4 ? sid + '~' + Math.min(6, stars) : sid;
const VAR_E = { 4: { dh: .09, sat: 1.22, lit: 1, all: 1.02 }, 5: { dh: .09, sat: 1.3, lit: 1.03, all: 1.05 }, 6: { dh: .09, sat: 1.3, lit: 1.03, all: 1.05 } };
const evoArt = sid => { const L = lookLv(sid), s = SP(sid); return L >= 5 && s.art && IMG[s.art + 'e_front_idle'] ? s.art + 'e' : null; };
/** does this species have its own final art? */
export const hasArt = sid => { const s = SP(sid); return !!(s && s.art && (IMG[s.art + '_front_idle'] || IMG[s.art + '_master'])); };
const SPR = {};
/** a pose that may be missing from a set (damaged file awaiting re-export): same view's idle → master → other view's idle */
function artPose(art, key) {
  const view = key.split('_')[0], other = view === 'front' ? 'back' : 'front';
  return IMG[art + '_' + key] || IMG[art + '_' + view + '_idle'] || IMG[art + '_master'] || IMG[art + '_' + other + '_idle'];
}
// extra motion poses (BATCH13+) fall back to the classic five when a set doesn't have them yet
const POSE_FALLBACK = { windup: 'idle', strike: 'attack', follow: 'attack', cast2: 'cast', joy: 'cast', down: 'hit' };
/** pose key for a view: the requested pose if this species' art has it, else its fallback */
export function poseKey(sid, view, pose) {
  const s = SP(sid), art = evoArt(sid) || (hasArt(sid) ? s.art : 'mon001');
  return view + '_' + (IMG[art + '_' + view + '_' + pose] || !POSE_FALLBACK[pose] ? pose : POSE_FALLBACK[pose]);
}
/** "living sprite": draw a 512² sprite (pivot 256,435) in horizontal strips so it can breathe (chest swells, upper body
 *  lifts), bend (top sways sideways — lean / recoil, driven by a spring) and wave (a travelling ripple for follow-through).
 *  Call inside the unit's local transform (same place as drawImage(img, -PIV[0], -PIV[1])). */
export function warpDraw(ctx, img, w) {
  if (!w || (Math.abs(w.bend) < .3 && Math.abs(w.breathe) < .002 && Math.abs(w.wave) < .3)) { ctx.drawImage(img, -PIV[0], -PIV[1]); return; }
  const N = 16, H = 512, f = img.width / 512, hOf = y => Math.max(0, Math.min(1.15, (PIV[1] - y) / 400));
  const Y = y => y - w.breathe * 46 * hOf(y), X = y => { const h = hOf(y); return w.bend * h * h + w.wave * Math.sin(w.wph - h * 3.4) * h; };
  for (let i = 0; i < N; i++) {
    const y0 = i * H / N, y1 = (i + 1) * H / N, ym = (y0 + y1) / 2, h = hOf(ym);
    const sx = 1 + w.breathe * Math.exp(-(((h - .5) / .28) ** 2)), dx = X(ym), dy0 = Y(y0), dy1 = Y(y1);
    ctx.drawImage(img, 0, y0 * f, 512 * f, (y1 - y0) * f, -PIV[0] * sx + dx, dy0 - PIV[1] - .5, 512 * sx, dy1 - dy0 + 1);
  }
}
/** sprite canvas/image for a species & pose key like 'front_idle' */
export function spr(sid, key) {
  const k = sid + key; if (SPR[k]) return SPR[k];
  if (lookLv(sid)) { const ea = evoArt(sid); return (SPR[k] = ea ? artPose(ea, key) : hueShift(spr(baseOf(sid), key), VAR_E[lookLv(sid)])); }
  const s = SPECIES[sid];
  if (hasArt(sid)) return (SPR[k] = artPose(s.art, key));
  return (SPR[k] = hueShift(IMG['mon001_' + key], PAL[s.elem]));
}
const silC = {}, glowC = {};
export function silOf(sid, key, color) {
  const k = sid + key + color; if (silC[k]) return silC[k];
  const src = spr(sid, key), c = mk(512, 512), x = c.getContext('2d');
  x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, 512, 512); return (silC[k] = c);
}
export const GP = 40;
export function glowOf(sid, key, color) {
  const k = sid + key + color; if (glowC[k]) return glowC[k];
  const s = silOf(sid, key, color), c = mk(512 + GP * 2, 512 + GP * 2), x = c.getContext('2d');
  for (const [r, al] of [[5, .16], [11, .1], [19, .06], [28, .035]]) for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; x.globalAlpha = al; x.drawImage(s, GP + Math.cos(a) * r, GP + Math.sin(a) * r); }
  return (glowC[k] = c);
}
const dotC = {};
export function dot(color) {
  if (dotC[color]) return dotC[color];
  const c = mk(64, 64), x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, '#fff'); g.addColorStop(.18, color); g.addColorStop(.5, color + '55'); g.addColorStop(1, color + '00');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); return (dotC[color] = c);
}
// bbox of a sprite's opaque pixels (512 space), cached
const BB = {};
function bbox(img, key) {
  if (BB[key]) return BB[key];
  const c = mk(512, 512), x = c.getContext('2d'); x.drawImage(img, 0, 0, 512, 512);
  const a = x.getImageData(0, 0, 512, 512).data; let x0 = 512, y0 = 512, x1 = 0, y1 = 0;
  for (let y = 0; y < 512; y += 2) for (let xx = 0; xx < 512; xx += 2) if (a[(y * 512 + xx) * 4 + 3] > 40) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return (BB[key] = x1 > x0 ? [x0, y0, x1, y1] : [156, 100, 356, 435]);
}
const ANC2 = {};
/** mouth/body anchors (relative to feet pivot) for a species & pose; fox uses hand-tuned values, other art is auto-derived */
export function anchOf(sid, key) {
  const s = SP(sid);
  if (!hasArt(sid) || (s.art === 'mon001' && !evoArt(sid))) return ANCH[key];
  const k = sid + key; if (ANC2[k]) return ANC2[k];
  const [x0, y0, x1, y1] = bbox(spr(sid, key), k), w = x1 - x0, h = y1 - y0, cx = (x0 + x1) / 2;
  return (ANC2[k] = { mouth: [cx + w * .18 - PIV[0], y0 + h * .36 - PIV[1]], body: [cx - PIV[0], y0 + h * .58 - PIV[1]] });
}
const PORT = {};
export function portrait(sid) {
  if (PORT[sid]) return PORT[sid];
  const s = SP(sid), ea = evoArt(sid), L = lookLv(sid);
  let src = ea && IMG[ea + '_master'] ? IMG[ea + '_master'] : hasArt(sid) && IMG[s.art + '_master'] ? IMG[s.art + '_master'] : hueShift(IMG.mon001_master, PAL[s.elem]);
  if (L && !ea) src = hueShift(src, VAR_E[L]);
  const c = mk(256, 256), x = c.getContext('2d');
  const f = src.width / 512, own = hasArt(sid) && (!!IMG[s.art + '_master'] || !!ea);
  let cr = [200, 70, 300]; // fox: head-centred crop
  if (own && (s.art !== 'mon001' || ea)) { const [x0, y0, x1, y1] = bbox(src, sid + '_master'), side = Math.min(512, Math.max(x1 - x0, (y1 - y0) * .8) * 1.04); cr = [(x0 + x1) / 2 - side / 2, y0 - side * .04, side]; }
  x.drawImage(src, cr[0] * f, cr[1] * f, cr[2] * f, cr[2] * f, 0, 0, 256, 256);
  return (PORT[sid] = c.toDataURL('image/webp', .85));
}
const EGG = {};
export function eggImg(sid) {
  sid = baseOf(sid); if (EGG[sid]) return EGG[sid];
  const s = SPECIES[sid];
  const own = s.art && IMG['egg' + s.art.replace('mon', '')];
  return (EGG[sid] = own || hueShift(IMG.egg001, PAL[s.elem]));
}
const EGGU = {};
export function eggURL(sid) { return EGGU[sid] || (EGGU[sid] = (eggImg(sid).toDataURL ? eggImg(sid) : (() => { const c = mk(512, 512); c.getContext('2d').drawImage(eggImg(sid), 0, 0); return c; })()).toDataURL('image/webp', .85)); }

// ---- mystery eggs: code-drawn shells, the pattern shows the tier (ธรรมดา/เงิน/ทอง/รุ้ง). Base at y≈425 like the art eggs. ----
export const TIER_COL = { common: '#d8c4a0', silver: '#cfe0f0', gold: '#ffd27a', rainbow: '#ff9ad8' };
function eggPath(x, cx = 254, cy = 300, rx = 92, ry = 125) {
  x.beginPath();
  for (let i = 0; i <= 64; i++) { const t = i / 64 * TAU, s = Math.sin(t); const px = cx + rx * Math.cos(t) * (1 + .1 * s), py = cy + ry * s; i ? x.lineTo(px, py) : x.moveTo(px, py); }
  x.closePath();
}
const MEGG = {};
export function mysteryEggImg(tier) {
  if (MEGG[tier]) return MEGG[tier];
  const c = mk(512, 512), x = c.getContext('2d'), base = {
    common: ['#fbf3e2', '#d9c5a2'], silver: ['#f4f8fc', '#9fb2c6'], gold: ['#fff1c2', '#d79a2a'], rainbow: ['#ffffff', '#c9b8ff'] }[tier];
  x.save(); eggPath(x); x.clip();
  const g = x.createRadialGradient(215, 230, 10, 254, 300, 170); g.addColorStop(0, base[0]); g.addColorStop(1, base[1]); x.fillStyle = g; x.fillRect(0, 0, 512, 512);
  if (tier === 'common') { // speckles
    let r = 7; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 46; i++) { x.fillStyle = `rgba(${120 + rnd() * 40},${80 + rnd() * 30},40,${.35 + rnd() * .35})`; x.beginPath(); x.ellipse(160 + rnd() * 190, 180 + rnd() * 240, 3 + rnd() * 7, 2 + rnd() * 5, rnd() * 3, 0, TAU); x.fill(); }
  } else if (tier === 'silver') { // wave bands
    x.lineWidth = 9; for (const [y, a] of [[250, .55], [300, .75], [350, .55]]) { x.strokeStyle = `rgba(110,135,165,${a})`; x.beginPath(); for (let px = 150; px <= 360; px += 6) { const py = y + Math.sin(px * .07) * 9; px === 150 ? x.moveTo(px, py) : x.lineTo(px, py); } x.stroke(); }
    x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 3; x.beginPath(); for (let px = 150; px <= 360; px += 6) { const py = 296 + Math.sin(px * .07) * 9; px === 150 ? x.moveTo(px, py) : x.lineTo(px, py); } x.stroke();
  } else if (tier === 'gold') { // zigzag crown band + gem
    x.fillStyle = 'rgba(150,90,15,.55)'; x.beginPath(); x.moveTo(140, 290); for (let i = 0; i <= 14; i++) x.lineTo(150 + i * 15, i % 2 ? 268 : 292); x.lineTo(370, 330); for (let i = 14; i >= 0; i--) x.lineTo(150 + i * 15, i % 2 ? 312 : 336); x.closePath(); x.fill();
    x.fillStyle = 'rgba(255,248,214,.8)'; for (let i = 0; i < 7; i++) { x.beginPath(); x.arc(165 + i * 30, 312, 3.5, 0, TAU); x.fill(); }
    const gg = x.createLinearGradient(240, 215, 270, 255); gg.addColorStop(0, '#fff6d0'); gg.addColorStop(1, '#e0601c'); x.fillStyle = gg; x.beginPath(); x.moveTo(254, 205); x.lineTo(270, 232); x.lineTo(254, 259); x.lineTo(238, 232); x.closePath(); x.fill();
  } else { // rainbow stripes + stars
    const cols = ['#ff6b6b', '#ffb84d', '#ffe66b', '#6bdc8a', '#5bb8ff', '#a98bff', '#ff8ad8'];
    x.globalAlpha = .62; for (let i = 0; i < 14; i++) { x.fillStyle = cols[i % cols.length]; x.beginPath(); x.moveTo(100 + i * 26, 160); x.lineTo(130 + i * 26, 160); x.lineTo(70 + i * 26, 440); x.lineTo(40 + i * 26, 440); x.closePath(); x.fill(); }
    x.globalAlpha = 1; x.fillStyle = '#ffffff';
    for (const [sx, sy, sr] of [[205, 240, 11], [300, 300, 8], [240, 365, 7], [310, 220, 6]]) { x.beginPath(); for (let k = 0; k < 8; k++) { const a = k / 8 * TAU, rr = k % 2 ? sr * .38 : sr; x.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr); } x.closePath(); x.fill(); }
  }
  // "?" rune
  x.font = '700 64px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = tier === 'rainbow' ? 'rgba(255,255,255,.9)' : 'rgba(70,45,20,.38)'; x.fillText('?', 254, tier === 'gold' ? 372 : 300);
  // shading: rim darkening + top-left highlight
  const sh = x.createRadialGradient(205, 225, 40, 254, 310, 190); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(.75, 'rgba(0,0,0,.05)'); sh.addColorStop(1, 'rgba(40,20,0,.38)'); x.fillStyle = sh; x.fillRect(0, 0, 512, 512);
  x.fillStyle = 'rgba(255,255,255,.55)'; x.beginPath(); x.ellipse(212, 225, 22, 38, -.45, 0, TAU); x.fill();
  x.restore();
  x.strokeStyle = 'rgba(60,35,10,.45)'; x.lineWidth = 3; eggPath(x); x.stroke();
  return (MEGG[tier] = c);
}
/** image / data URL for any egg: named → species egg art, mystery → tier shell */
export const eggOf = egg => egg.kind === 'mystery' ? mysteryEggImg(egg.tier) : eggImg(egg.sid);
const MEGGU = {};
export const eggURLOf = egg => egg.kind === 'mystery' ? (MEGGU[egg.tier] || (MEGGU[egg.tier] = mysteryEggImg(egg.tier).toDataURL('image/webp', .9))) : eggURL(egg.sid);

// ---- light sprites (batch 06): white + alpha images tinted to any colour, drawn additively ----
const TINT = {};
/** a white light sprite (fx_*, hatch_altar_glow) recoloured to `color` (cached); null without the art */
export function tinted(name, color) {
  const img = IMG[name]; if (!img) return null;
  const k = name + color; if (TINT[k]) return TINT[k];
  const c = mk(img.width, img.height), x = c.getContext('2d');
  x.drawImage(img, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
  return (TINT[k] = c);
}
/** draw a light sprite centred at (x, y) with size w×h: tinted glow + a fainter white-hot core, additive */
export function fx(ctx, name, color, x, y, w, h, alpha = 1, rot = 0) {
  const t = tinted(name, color); if (!t || alpha <= 0) return false;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(x, y); if (rot) ctx.rotate(rot);
  ctx.globalAlpha = Math.min(1, alpha); ctx.drawImage(t, -w / 2, -h / 2, w, h);
  ctx.globalAlpha = Math.min(1, alpha) * .35; ctx.drawImage(IMG[name], -w / 2, -h / 2, w, h);
  ctx.restore(); return true;
}
const MULT = {};
/** a colourless object sprite (hatch_crystal) multiplied by `color`, keeping its own alpha (cached) */
export function colored(name, color) {
  const img = IMG[name]; if (!img) return null;
  const k = name + color; if (MULT[k]) return MULT[k];
  const c = mk(img.width, img.height), x = c.getContext('2d');
  x.drawImage(img, 0, 0); x.globalCompositeOperation = 'multiply'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
  x.globalCompositeOperation = 'destination-in'; x.drawImage(img, 0, 0);
  return (MULT[k] = c);
}
