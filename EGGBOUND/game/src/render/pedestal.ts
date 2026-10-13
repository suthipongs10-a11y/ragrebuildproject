// Showcase pedestal (คลังมอน): the round dais the monster stands on, themed by element. Uses the BATCH16 art
// `ped_<elem>` when it exists — normalised to PED (1024×512, top-surface centre 512,150, top half-width 380) with
// tools/fit_flow.py anchor mode — otherwise a stone/marble dais is drawn here. Rarity shows in the glowing gem inlays
// and inlay ring (`acc`, one colour per gem, cycling for the rare form) and in the trim (bright gold when `gold`).
import { IMG, TAU, dot } from './assets';

export const PED = { w: 1024, h: 512, cx: 512, cy: 150, rx: 380 };

interface Mat { top: [string, string]; side: [string, string, string]; base: [string, string]; trim: string; line: string; motif: 'sun' | 'wave' | 'leaf' | 'brick' | 'lava' | 'star' }
const MAT: Record<string, Mat> = {
  fire: { top: ['#6e3d2e', '#2a140f'], side: ['#5c3024', '#34170f', '#160806'], base: ['#3c1e16', '#120605'], trim: '#c88b3e', line: 'rgba(255,150,80,.30)', motif: 'lava' },
  water: { top: ['#f3f8fa', '#9dbbcb'], side: ['#d8e6ec', '#8eadbe', '#4a6a7a'], base: ['#9fb8c5', '#43606e'], trim: '#d8b868', line: 'rgba(30,95,140,.30)', motif: 'wave' },
  wind: { top: ['#f0f8ea', '#a0c49a'], side: ['#d2e5ca', '#8db387', '#4b704d'], base: ['#9cbb94', '#43614a'], trim: '#cdb25e', line: 'rgba(35,95,55,.30)', motif: 'leaf' },
  earth: { top: ['#f1dfb6', '#aa8a57'], side: ['#dabd88', '#a3824e', '#5c4325'], base: ['#a98a58', '#4c381f'], trim: '#c08a3a', line: 'rgba(90,55,20,.36)', motif: 'brick' },
  light: { top: ['#fffcf2', '#d8caa6'], side: ['#f5eedc', '#cdbf9b', '#8c7d5c'], base: ['#d4c7a4', '#7c6e4f'], trim: '#e0b64c', line: 'rgba(160,125,50,.32)', motif: 'sun' },
  dark: { top: ['#4d4068', '#18111f'], side: ['#3d3253', '#211a30', '#0b0710'], base: ['#2c2339', '#0a070e'], trim: '#a98fd6', line: 'rgba(205,160,255,.26)', motif: 'star' },
};
const GOLD = '#ffd66a', GOLD_HI = '#fff3c4';

export interface PedOpts { acc: string[]; gold: boolean; t: number; glow: number }

/** draw the pedestal with its top-surface centre at (cx, y) and top half-width rx (top ellipse ry = rx·0.26) */
export function drawPedestal(ctx: CanvasRenderingContext2D, cx: number, y: number, rx: number, elem: string, o: PedOpts) {
  const M = MAT[elem] || MAT.light, ry = rx * .26, t = o.t;
  shade(ctx, cx, y + rx * .3, rx * 1.4, rx * .3);
  const art = IMG['ped_' + elem];
  if (art) {
    const s = rx / PED.rx; ctx.drawImage(art, cx - PED.cx * s, y - PED.cy * s, PED.w * s, PED.h * s);
    inlay(ctx, cx, y, rx * .97, ry * .97, o); return;
  }
  const h1 = rx * .17, R2 = rx * 1.12, e2 = ry * 1.12, y2 = y + h1 + rx * .02, h2 = rx * .075;
  const trim = o.gold ? GOLD : M.trim;
  // lower step
  cyl(ctx, cx, y2, R2, e2, h2, sideGrad(ctx, cx, R2, M.base[0], M.base[1], M.base[1]));
  disc(ctx, cx, y2, R2, e2, M.base[0], M.base[1]);
  arcLine(ctx, cx, y2 + h2, R2, e2, trim, Math.max(1, rx * .008), .7);
  // main tier: side band
  cyl(ctx, cx, y, rx, ry, h1, sideGrad(ctx, cx, rx, M.side[0], M.side[1], M.side[2]));
  sideMotif(ctx, cx, y, rx, ry, h1, M, t);
  // pilasters + gems along the front of the band
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = Math.PI * (.12 + .76 * i / (n - 1)), sn = Math.sin(a), x = cx + rx * Math.cos(a), yb = y + ry * sn;
    if (i < n - 1) { // pilaster between this gem and the next
      const a2 = Math.PI * (.12 + .76 * (i + .5) / (n - 1)), s2 = Math.sin(a2), x2 = cx + rx * Math.cos(a2), y2b = y + ry * s2;
      ctx.globalAlpha = .55; ctx.fillStyle = trim; ctx.fillRect(x2 - rx * .006 * s2, y2b + h1 * .14, rx * .012 * s2, h1 * .72); ctx.globalAlpha = 1;
    }
    const gr = h1 * .2 * (.45 + .55 * sn), gy = yb + h1 * .5, c = o.acc[i % o.acc.length];
    ctx.fillStyle = trim; ctx.beginPath(); ctx.ellipse(x, gy, gr * 1.45 * (.5 + .5 * sn), gr * 1.45, 0, 0, TAU); ctx.fill();
    const g = ctx.createRadialGradient(x - gr * .3, gy - gr * .35, 0, x, gy, gr); g.addColorStop(0, '#ffffff'); g.addColorStop(.35, c); g.addColorStop(1, shadeOf(c));
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, gy, gr * (.5 + .5 * sn), gr, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = o.glow * (.55 + .3 * Math.sin(t * 2.4 + i * .9)) * sn;
    const gs = gr * 5; ctx.drawImage(dot(c), x - gs, gy - gs, gs * 2, gs * 2); ctx.restore();
  }
  // band trims
  arcLine(ctx, cx, y + h1, rx, ry, trim, Math.max(1, rx * .01), .85);
  // top surface
  disc(ctx, cx, y, rx, ry, M.top[0], M.top[1]);
  engrave(ctx, cx, y, rx, ry, M, trim, t);
  arcLine(ctx, cx, y, rx, ry, trim, Math.max(1.5, rx * .022), 1);
  arcLine(ctx, cx, y - Math.max(1, rx * .006), rx * .995, ry * .99, o.gold ? GOLD_HI : 'rgba(255,255,255,.35)', Math.max(1, rx * .006), .8, true);
  inlay(ctx, cx, y, rx * .88, ry * .88, o);
}

function shade(ctx: CanvasRenderingContext2D, cx: number, y: number, r: number, e: number) {
  ctx.save(); ctx.translate(cx, y); ctx.scale(1, e / r);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r); g.addColorStop(0, 'rgba(0,0,0,.62)'); g.addColorStop(.55, 'rgba(0,0,0,.32)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.restore();
}
/** the front of a cylinder: between the top ellipse's front arc and the bottom one */
function cyl(ctx: CanvasRenderingContext2D, cx: number, yt: number, r: number, e: number, h: number, fill: CanvasGradient) {
  ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(cx + r, yt); ctx.lineTo(cx + r, yt + h);
  ctx.ellipse(cx, yt + h, r, e, 0, 0, Math.PI); ctx.lineTo(cx - r, yt); ctx.ellipse(cx, yt, r, e, 0, Math.PI, 0, true);
  ctx.closePath(); ctx.fill();
}
/** side shading, lit from the top-left */
function sideGrad(ctx: CanvasRenderingContext2D, cx: number, r: number, lit: string, mid: string, dark: string) {
  const g = ctx.createLinearGradient(cx - r, 0, cx + r, 0);
  g.addColorStop(0, dark); g.addColorStop(.1, mid); g.addColorStop(.3, lit); g.addColorStop(.6, mid); g.addColorStop(.9, dark); g.addColorStop(1, dark);
  return g;
}
/** a flat elliptical disc with a soft top-left highlight */
function disc(ctx: CanvasRenderingContext2D, cx: number, yt: number, r: number, e: number, c0: string, c1: string) {
  ctx.save(); ctx.translate(cx, yt); ctx.scale(1, e / r);
  const g = ctx.createRadialGradient(-r * .3, -r * .35, r * .05, 0, 0, r * 1.08); g.addColorStop(0, c0); g.addColorStop(1, c1);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.restore();
}
/** stroke the front half of an ellipse (or the back half) */
function arcLine(ctx: CanvasRenderingContext2D, cx: number, y: number, r: number, e: number, c: string, w: number, a: number, back = false) {
  ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath();
  if (back) ctx.ellipse(cx, y, r, e, 0, Math.PI, TAU); else ctx.ellipse(cx, y, r, e, 0, 0, Math.PI);
  ctx.stroke(); ctx.restore();
}
/** glowing inlay ring on the top surface in the rarity colour(s) */
function inlay(ctx: CanvasRenderingContext2D, cx: number, y: number, r: number, e: number, o: PedOpts) {
  const n = o.acc.length, a = o.glow * (.7 + .3 * Math.sin(o.t * 2));
  ctx.save(); // a coloured line (shows on white marble) + an additive bloom (shows on dark stone)
  for (let i = 0; i < n; i++) {
    const a0 = i / n * TAU + o.t * .5, a1 = a0 + TAU / n + .02;
    for (const [w, al, op] of [[Math.max(1.5, r * .014), .75, 'source-over'], [Math.max(4, r * .05), .25, 'lighter'], [Math.max(1.5, r * .012), .7, 'lighter']] as [number, number, GlobalCompositeOperation][]) {
      ctx.globalCompositeOperation = op; ctx.globalAlpha = Math.min(1, a * al); ctx.strokeStyle = o.acc[i]; ctx.lineWidth = w; ctx.beginPath(); ctx.ellipse(cx, y, r, e, 0, n > 1 ? a0 : 0, n > 1 ? a1 : TAU); ctx.stroke();
    }
  }
  ctx.restore();
}
/** carved rings and spokes on the top surface, by element */
function engrave(ctx: CanvasRenderingContext2D, cx: number, y: number, rx: number, ry: number, M: Mat, trim: string, t: number) {
  ctx.save(); ctx.translate(cx, y); ctx.scale(1, ry / rx);
  const ring = (r: number, c: string, w: number) => { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke(); };
  const lw = Math.max(1.2, rx * .012);
  for (const r of [.6, .76]) { ring(rx * r, M.line, lw * 1.4); ctx.save(); ctx.translate(0, lw * 1.6); ring(rx * r, 'rgba(255,255,255,.18)', lw * .8); ctx.restore(); }
  ring(rx * .26, M.line, lw); ctx.globalAlpha = .45; ring(rx * .2, trim, lw * .8); ctx.globalAlpha = 1;
  const k = M.motif;
  if (k === 'sun') { // gold sunburst between the rings
    ctx.fillStyle = trim; ctx.globalAlpha = .55;
    for (let i = 0; i < 24; i++) { const a = i / 24 * TAU, w = i % 2 ? .02 : .045; ctx.beginPath(); ctx.moveTo(Math.cos(a - w) * rx * .61, Math.sin(a - w) * rx * .61); ctx.lineTo(Math.cos(a) * rx * .75, Math.sin(a) * rx * .75); ctx.lineTo(Math.cos(a + w) * rx * .61, Math.sin(a + w) * rx * .61); ctx.fill(); }
  } else if (k === 'leaf') { // pinwheel swirls
    ctx.strokeStyle = M.line; ctx.lineWidth = lw * 1.3;
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; ctx.beginPath(); ctx.arc(Math.cos(a) * rx * .68, Math.sin(a) * rx * .68, rx * .07, a, a + 2.4); ctx.stroke(); }
  } else if (k === 'star') { // twinkling star dots
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 18; i++) { const a = i / 18 * TAU + .17, r = rx * (i % 2 ? .64 : .71), s = rx * .03 * (.6 + .4 * Math.sin(t * 2 + i * 1.7)); ctx.globalAlpha = .55 + .35 * Math.sin(t * 2.3 + i); ctx.drawImage(dot('#c890ff'), Math.cos(a) * r - s, Math.sin(a) * r - s, s * 2, s * 2); }
  } else { // tiles: straight spokes (wave / brick / lava)
    ctx.strokeStyle = M.line; ctx.lineWidth = lw;
    const n = k === 'brick' ? 20 : 16;
    for (let i = 0; i < n; i++) { const a = i / n * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * rx * .6, Math.sin(a) * rx * .6); ctx.lineTo(Math.cos(a) * rx * .76, Math.sin(a) * rx * .76); ctx.stroke(); }
  }
  ctx.restore();
}
/** element pattern running round the side band */
function sideMotif(ctx: CanvasRenderingContext2D, cx: number, y: number, rx: number, ry: number, h: number, M: Mat, t: number) {
  const k = M.motif, pt = (a: number, v: number) => [cx + rx * Math.cos(a), y + ry * Math.sin(a) + h * v] as const;
  ctx.save();
  if (k === 'wave') { // running wave scrolls along the lower band
    ctx.strokeStyle = M.trim; ctx.globalAlpha = .5; ctx.lineWidth = Math.max(1, rx * .008);
    for (let i = 0; i < 22; i++) { const a = Math.PI * (.04 + .92 * i / 21), [x, yy] = pt(a, .8), s = Math.sin(a); ctx.beginPath(); ctx.ellipse(x, yy, h * .16 * s, h * .14, 0, Math.PI, TAU); ctx.stroke(); }
  } else if (k === 'leaf') { // leaf pairs
    ctx.fillStyle = '#6fbf6a'; ctx.globalAlpha = .55;
    for (let i = 0; i < 16; i++) { const a = Math.PI * (.06 + .88 * i / 15), [x, yy] = pt(a, .82), s = Math.sin(a); ctx.beginPath(); ctx.ellipse(x - h * .08 * s, yy, h * .1 * s, h * .05, -.6, 0, TAU); ctx.ellipse(x + h * .08 * s, yy, h * .1 * s, h * .05, .6, 0, TAU); ctx.fill(); }
  } else if (k === 'brick') { // carved blocks
    ctx.strokeStyle = M.line; ctx.lineWidth = Math.max(1, rx * .006);
    for (let i = 0; i < 26; i++) { const a = Math.PI * (.02 + .96 * i / 25), [x, y0] = pt(a, .5), [, y1] = pt(a, i % 2 ? 1 : .5), [, y2] = pt(a, i % 2 ? .5 : 0); ctx.beginPath(); ctx.moveTo(x, y2); ctx.lineTo(x, y1 > y0 ? y1 : y0); ctx.stroke(); }
    ctx.beginPath(); ctx.ellipse(cx, y + h * .5, rx, ry, 0, 0, Math.PI); ctx.stroke();
  } else if (k === 'lava') { // glowing cracks
    ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = Math.max(1, rx * .007); ctx.lineJoin = 'round';
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * (.12 + .76 * i / 6) + .09, [x, yy] = pt(a, .1), fl = .55 + .35 * Math.sin(t * 3.1 + i * 2.3);
      ctx.strokeStyle = `rgba(255,${120 + i * 12},40,${fl})`; ctx.beginPath(); ctx.moveTo(x, yy);
      for (let j = 1; j <= 4; j++) ctx.lineTo(x + (j % 2 ? 1 : -1) * h * .09 * Math.sin(a), yy + h * .2 * j);
      ctx.stroke();
    }
  } else if (k === 'sun') { // gold chevrons
    ctx.strokeStyle = M.trim; ctx.globalAlpha = .45; ctx.lineWidth = Math.max(1, rx * .007);
    for (let i = 0; i < 18; i++) { const a = Math.PI * (.05 + .9 * i / 17), [x, yy] = pt(a, .78), s = Math.sin(a); ctx.beginPath(); ctx.moveTo(x - h * .12 * s, yy + h * .08); ctx.lineTo(x, yy - h * .06); ctx.lineTo(x + h * .12 * s, yy + h * .08); ctx.stroke(); }
  } else if (k === 'star') { // violet rune glints along the band
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 12; i++) { const a = Math.PI * (.08 + .84 * i / 11), [x, yy] = pt(a, .8), s = h * .09 * Math.sin(a) * (.7 + .3 * Math.sin(t * 2.6 + i)); ctx.globalAlpha = .7; ctx.drawImage(dot('#c890ff'), x - s, yy - s, s * 2, s * 2); }
  }
  ctx.restore();
}
/** a darker shade of a #rrggbb colour for gem edges */
function shadeOf(c: string) {
  const n = parseInt(c.slice(1, 7), 16), f = .45;
  return `rgb(${Math.round((n >> 16 & 255) * f)},${Math.round((n >> 8 & 255) * f)},${Math.round((n & 255) * f)})`;
}
