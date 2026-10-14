// @ts-nocheck
// Battle locations: every stage fights in its own arena (Summoners-War-style) — a painted ground plate,
// set dressing around the plaza, animated lights, ambient life and a screen colour grade.
// Everything is code-drawn; a painted plate (art/prompts BATCH17) can replace the ground later.
// Hooks into the engine through E.loc and by refilling the shared LANTERNS / BUSHES arrays.
import { TAU, mk, dot, IMG, fx } from './assets';
import { E, SQ, GEO, rnd, mulberry, stone, useTheme, setTheme, LANTERNS, BUSHES, THEMES } from './engine';

const { PR, GW, GH, GOX, GOY } = GEO, PRY = PR * SQ;
const hsl = (h, s, l, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;
const er = (x, y) => Math.hypot(x, y / SQ); // "elliptic radius" of a ground point (plaza edge = PR)
const outside = (m = 0) => (x, y) => er(x, y) > PR + m;
const pick = (R, a) => a[(R() * a.length) | 0];

// ---------- ground painting helpers (ground canvas is translated so the plaza centre is 0,0) ----------
function fillBase(g, R, cols, [h, hr, s, l], n = 2200) {
  const gr = g.createLinearGradient(-GOX, -GOY, GOX, GOY); cols.forEach((c, i) => gr.addColorStop(i / (cols.length - 1), c));
  g.fillStyle = gr; g.fillRect(-GOX, -GOY, GW, GH);
  for (let i = 0; i < n; i++) { const x = (R() - .5) * GW, y = (R() - .5) * GH, r = 24 + R() * 110; g.fillStyle = hsl(h + R() * hr, s + R() * 20, R() < .5 ? l - 8 + R() * 8 : l + 6 + R() * 10, .05 + R() * .08); g.beginPath(); g.ellipse(x, y, r, r * SQ, 0, 0, TAU); g.fill(); }
}
function blades(g, R, n, [h, hr, s, l, lr], len = 10, keep = null) {
  g.lineCap = 'round';
  for (let i = 0; i < n; i++) { const x = (R() - .5) * GW, y = (R() - .5) * GH; if (keep && !keep(x, y)) continue; const L = len * (.5 + R()); g.strokeStyle = hsl(h + R() * hr, s + R() * 25, l + R() * lr, .3 + R() * .45); g.lineWidth = 1 + R() * 1.5; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + (R() - .5) * 4, y - L * .6, x + (R() - .5) * 7, y - L); g.stroke(); }
}
function specks(g, R, n, cols, r0, r1, keep = null, box = [-GOX, -GOY, GOX, GOY]) {
  for (let i = 0; i < n; i++) { const x = box[0] + R() * (box[2] - box[0]), y = box[1] + R() * (box[3] - box[1]); if (keep && !keep(x, y)) continue; const r = r0 + R() * (r1 - r0); g.fillStyle = pick(R, cols); g.beginPath(); g.ellipse(x, y, r, r * SQ * (.8 + R() * .4), R() * 3, 0, TAU); g.fill(); }
}
function leaf(g, x, y, sz, rot, col) { g.save(); g.translate(x, y); g.scale(1, SQ); g.rotate(rot); g.fillStyle = col; g.beginPath(); g.moveTo(-sz, 0); g.quadraticCurveTo(0, -sz * .55, sz, 0); g.quadraticCurveTo(0, sz * .55, -sz, 0); g.fill(); g.restore(); }
function litter(g, R, n, cols, keep = null, sz = [5, 10]) { for (let i = 0; i < n; i++) { const x = (R() - .5) * GW, y = (R() - .5) * GH; if (keep && !keep(x, y)) continue; leaf(g, x, y, sz[0] + R() * (sz[1] - sz[0]), R() * TAU, pick(R, cols)); } }
function flowers(g, R, n, cols, core, keep, r0 = 1.06, r1 = 2.3) {
  for (let i = 0; i < n; i++) { const a = R() * TAU, rr = PR * (r0 + R() * (r1 - r0)), x = Math.cos(a) * rr, y = Math.sin(a) * rr * SQ; if (keep && !keep(x, y)) continue; const col = pick(R, cols);
    for (let k = 0; k < 3 + R() * 5; k++) { const fx = x + (R() - .5) * 30, fy = y + (R() - .5) * 16; g.fillStyle = col; for (let p = 0; p < 5; p++) { const pa = p / 5 * TAU; g.beginPath(); g.arc(fx + Math.cos(pa) * 2.6, fy + Math.sin(pa) * 2, 2.2, 0, TAU); g.fill(); } g.fillStyle = core; g.beginPath(); g.arc(fx, fy, 1.4, 0, TAU); g.fill(); } }
}
/** dark contact shadow + plaza disc */
function disc(g, fill, m = 0, sh = .38) { g.fillStyle = `rgba(20,16,10,${sh})`; g.beginPath(); g.ellipse(0, 10, PR + 18 + m, (PR + 18 + m) * SQ, 0, 0, TAU); g.fill(); g.fillStyle = fill; g.beginPath(); g.ellipse(0, 0, PR + m, (PR + m) * SQ, 0, 0, TAU); g.fill(); }
function clipPlaza(g, f, m = 0) { g.save(); g.beginPath(); g.ellipse(0, 0, PR + m, (PR + m) * SQ, 0, 0, TAU); g.clip(); f(); g.restore(); }
/** soft radial light/dark wash inside the plaza (worn centre / rim shade) */
function wash(g, inner, outer) { const gr = g.createRadialGradient(0, 0, PR * .1, 0, 0, PR); gr.addColorStop(0, inner); gr.addColorStop(1, outer); g.save(); g.scale(1, SQ); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, PR, 0, TAU); g.fill(); g.restore(); }
function cobbles(g, R, pal, keepOut = .02) {
  useTheme(pal);
  for (let gy = -PR; gy <= PR; gy += 36) { const row = Math.round(gy / 36); for (let gx = -PR; gx <= PR; gx += 42) { const fx = gx + (row & 1 ? 21 : 0) + (R() - .5) * 8, fy = gy + (R() - .5) * 8, e = Math.hypot(fx, fy); if (e > PR - 16) continue; if (R() < (e > PR - 70 ? .35 : keepOut)) continue; stone(g, fx, fy * SQ, 17.5 + R() * 4, R); } }
}
/** grass/moss tufts around the plaza rim */
function rimTufts(g, R, [h, hr, s, l], n = 900) { for (let i = 0; i < n; i++) { const a = R() * TAU, rr = PR + (R() - .4) * 34, x = Math.cos(a) * rr, y = Math.sin(a) * rr * SQ; for (let k = 0; k < 4; k++) { const L = 6 + R() * 12; g.strokeStyle = hsl(h + R() * hr, s + R() * 25, l + R() * 25, .8); g.lineWidth = 1.3 + R(); g.beginPath(); g.moveTo(x + (R() - .5) * 8, y); g.lineTo(x + (R() - .5) * 12, y - L); g.stroke(); } } }
/** rectangular flagstones (world-square tiles, squashed by SQ) over a box, running bond */
function tiles(g, R, { col: [h, s, l], lv = 5, tw = 96, td = 96, grout = 'rgba(30,24,18,.9)', box = [-PR, -PR, PR, PR], crack = .1, moss = 0, chip = .08, bond = 0 }) {
  const [x0, y0, x1, y1] = box; g.fillStyle = grout; g.fillRect(x0, y0 * SQ, x1 - x0, (y1 - y0) * SQ);
  for (let wy = y0, row = 0; wy < y1; wy += td, row++) {
    const off = row & 1 ? tw * bond : 0;
    for (let wx = x0 - off; wx < x1; wx += tw) {
      const x = wx + 2, y = wy * SQ + 1.5, w = tw - 4, d = td * SQ - 3, L = l + (R() - .5) * lv * 2;
      g.fillStyle = hsl(h + (R() - .5) * 6, s + (R() - .5) * 6, L); g.fillRect(x, y, w, d);
      g.fillStyle = 'rgba(255,248,230,.18)'; g.fillRect(x, y, w, 2); g.fillRect(x, y, 2, d);
      g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(x, y + d - 2, w, 2); g.fillRect(x + w - 2, y, 2, d);
      if (R() < chip) { g.fillStyle = grout; g.beginPath(); const cx = R() < .5 ? x : x + w, cy = R() < .5 ? y : y + d; g.moveTo(cx, cy); g.lineTo(cx + (cx === x ? 10 : -10), cy); g.lineTo(cx, cy + (cy === y ? 6 : -6)); g.fill(); }
      if (R() < crack) { g.strokeStyle = 'rgba(20,14,8,.45)'; g.lineWidth = 1.2; g.beginPath(); let cx = x + R() * w, cy = y; g.moveTo(cx, cy); for (let k = 0; k < 4; k++) { cx += (R() - .5) * w * .4; cy += d / 4; g.lineTo(cx, cy); } g.stroke(); }
      if (moss && R() < moss) { g.fillStyle = 'rgba(70,110,40,.32)'; g.beginPath(); g.ellipse(x + (R() < .5 ? 4 : w - 4), y + (R() < .5 ? 3 : d - 3), 8 + R() * 14, 4 + R() * 6, 0, 0, TAU); g.fill(); }
    }
  }
}
/** concentric inlay band + petal rosette in the plaza centre */
function inlay(g, { band, edge, rose, rose2, r = .64, petals = 8, rr = 78 }) {
  const ring = (rad, w, c) => { g.lineWidth = w; g.strokeStyle = c; g.beginPath(); g.ellipse(0, 0, rad, rad * SQ, 0, 0, TAU); g.stroke(); };
  if (band) { const rad = PR * r; ring(rad, 20, edge); ring(rad, 13, band); ring(rad - 13, 2, edge); ring(rad + 13, 2, edge); }
  if (rose) {
    g.save(); g.scale(1, SQ);
    for (let i = 0; i < petals; i++) { g.save(); g.rotate(i / petals * TAU); g.fillStyle = i % 2 ? rose2 || rose : rose; g.strokeStyle = edge; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(rr * .32, -rr * .5, 0, -rr); g.quadraticCurveTo(-rr * .32, -rr * .5, 0, 0); g.fill(); g.stroke(); g.restore(); }
    g.fillStyle = edge; g.beginPath(); g.arc(0, 0, rr * .26, 0, TAU); g.fill(); g.fillStyle = rose; g.beginPath(); g.arc(0, 0, rr * .18, 0, TAU); g.fill();
    g.restore();
  }
}
/** raised curb ring of carved blocks (front lip face shows the plaza is a dais) */
function curb(g, R, [h, s, l], { lip = 16, w = 20, n = 72, band = null } = {}) {
  g.fillStyle = hsl(h, s, l - 22); g.beginPath(); g.ellipse(0, lip, PR + w * .5, (PR + w * .5) * SQ, 0, 0, Math.PI); g.lineTo(-PR - w * .5, 0); g.ellipse(0, 0, PR + w * .5, (PR + w * .5) * SQ, 0, Math.PI, 0, true); g.fill();
  for (let i = 0; i < n; i++) {
    const a0 = i / n * TAU + .004, a1 = (i + 1) / n * TAU - .004, r0 = PR - w * .5, r1 = PR + w * .5, L = l + (R() - .5) * 8;
    g.beginPath(); g.moveTo(Math.cos(a0) * r0, Math.sin(a0) * r0 * SQ); g.lineTo(Math.cos(a0) * r1, Math.sin(a0) * r1 * SQ); g.lineTo(Math.cos(a1) * r1, Math.sin(a1) * r1 * SQ); g.lineTo(Math.cos(a1) * r0, Math.sin(a1) * r0 * SQ); g.closePath();
    g.fillStyle = hsl(h + (R() - .5) * 6, s, L); g.fill(); g.strokeStyle = hsl(h, s, l - 26, .7); g.lineWidth = 1.5; g.stroke();
  }
  g.lineWidth = 2; g.strokeStyle = 'rgba(255,248,230,.3)'; g.beginPath(); g.ellipse(0, -1, PR + w * .5, (PR + w * .5) * SQ, 0, Math.PI, TAU); g.stroke();
  if (band) { g.lineWidth = 5; g.strokeStyle = band; g.beginPath(); g.ellipse(0, lip * .55, PR + w * .5 + 1, (PR + w * .5 + 1) * SQ, 0, .05, Math.PI - .05); g.stroke(); }
}
/** tapered bezier root/branch lying on the ground */
function root(g, R, x0, y0, x1, y1, w, [h, s, l]) {
  const cx = (x0 + x1) / 2 + (R() - .5) * 260, cy = (y0 + y1) / 2 + (R() - .5) * 140, N = 26, P = t => [(1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1, (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1];
  g.lineCap = 'round';
  for (const [dy, col, k] of [[5, 'rgba(10,8,4,.4)', 1.1], [0, hsl(h, s, l), 1], [-.22, hsl(h, s - 5, l + 14), .45]]) {
    for (let i = 0; i < N; i++) { const t = i / N, [ax, ay] = P(t), [bx, by] = P(t + 1 / N), ww = w * (1 - t * .85) * k; g.strokeStyle = col; g.lineWidth = ww; g.beginPath(); g.moveTo(ax, ay + (dy > 1 ? dy : dy * w * (1 - t))); g.lineTo(bx, by + (dy > 1 ? dy : dy * w * (1 - t))); g.stroke(); }
  }
}
// polygons for water/lava bodies
const area = pts => { let s = 0; for (let i = 0; i < pts.length; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length]; s += x0 * y1 - x1 * y0; } return s / 2; };
const orient = pts => (area(pts) < 0 ? pts.reverse() : pts);
const addPts = (g, pts) => { pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); };
function pip(pts, x, y) { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
function blobPts(R, cx, cy, rx, ry, wob = .1, n = 64) { const ph = [R() * TAU, R() * TAU, R() * TAU]; return orient(Array.from({ length: n }, (_, i) => { const a = i / n * TAU, k = 1 + wob * (Math.sin(a * 3 + ph[0]) * .5 + Math.sin(a * 5 + ph[1]) * .3 + Math.sin(a * 9 + ph[2]) * .2); return [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]; })); }
function riverPts(R, ctrl, hw, wob = .2) {
  const C = (p0, p1, p2, p3, t) => .5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t), mid = [];
  for (let i = 0; i < ctrl.length - 1; i++) { const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(ctrl.length - 1, i + 2)]; for (let k = 0; k < 16; k++) { const t = k / 16; mid.push([C(p0[0], p1[0], p2[0], p3[0], t), C(p0[1], p1[1], p2[1], p3[1], t)]); } }
  mid.push(ctrl[ctrl.length - 1]); const L = [], Rr = [], ph = R() * TAU;
  mid.forEach(([x, y], i) => { const [ax, ay] = mid[Math.max(0, i - 1)], [bx, by] = mid[Math.min(mid.length - 1, i + 1)], dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d, w = hw * (1 + wob * Math.sin(i * .35 + ph)), w2 = hw * (1 + wob * Math.sin(i * .29 + ph * 2)); L.push([x + nx * w, y + ny * w * SQ]); Rr.push([x - nx * w2, y - ny * w2 * SQ]); });
  return orient(L.concat(Rr.reverse()));
}
const ellPts = (rx, ry, n = 72) => Array.from({ length: n }, (_, i) => [Math.cos(i / n * TAU) * rx, Math.sin(i / n * TAU) * ry]);
const bboxOf = shapes => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const p of shapes) for (const [x, y] of p) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return [Math.max(-GOX, x0), Math.max(-GOY, y0), Math.min(GOX, x1), Math.min(GOY, y1)]; };
const inShapes = shapes => (x, y) => shapes.some(p => pip(p, x, y));
/** inner rim band of the union of shapes (half-res mask): `col` where a point lies within w of the union's edge */
function rimBand(shapes, w, col, k = .25) {
  const c = mk(GW * k, GH * k), g = c.getContext('2d'); g.setTransform(k, 0, 0, k, GOX * k, GOY * k); g.fillStyle = '#fff'; g.beginPath(); shapes.forEach(p => addPts(g, p)); g.fill(); g.setTransform(1, 0, 0, 1, 0, 0);
  const e = mk(c.width, c.height), x = e.getContext('2d'); x.drawImage(c, 0, 0); x.globalCompositeOperation = 'destination-in'; const d = w * k; for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; x.drawImage(c, Math.cos(a) * d, Math.sin(a) * d * SQ); }
  g.globalCompositeOperation = 'destination-out'; g.drawImage(e, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, c.width, c.height); return c;
}
/** a body of water: muddy bank, bed, depth gradient, shallows, glints, foam line */
function water(g, R, shapes, o) {
  const path = () => { g.beginPath(); for (const p of shapes) addPts(g, p); }, B = bboxOf(shapes), [bx0, by0, bx1, by1] = B;
  g.save(); g.lineJoin = 'round';
  if (o.bank) { path(); g.strokeStyle = o.bank[0]; g.lineWidth = 64; g.stroke(); g.strokeStyle = o.bank[1]; g.lineWidth = 34; g.stroke(); }
  g.restore();
  g.save(); path(); g.clip();
  g.fillStyle = o.bed; g.fillRect(bx0, by0, bx1 - bx0, by1 - by0);
  if (o.pebbles) specks(g, R, o.pebbles[0], o.pebbles[1], 3, 10, null, B);
  const gr = g.createLinearGradient(0, by0, 0, by1); gr.addColorStop(0, o.deep); gr.addColorStop(1, o.shallow); g.fillStyle = gr; g.fillRect(bx0, by0, bx1 - bx0, by1 - by0);
  for (const w of [80, 34]) g.drawImage(rimBand(shapes, w, o.edge || 'rgba(170,225,215,.22)'), -GOX, -GOY, GW, GH); // shallows (union-aware: no seams where shapes overlap)
  if (o.caustic) { g.strokeStyle = o.caustic; g.lineWidth = 1.6; for (let i = 0; i < 900; i++) { const x = bx0 + R() * (bx1 - bx0), y = by0 + R() * (by1 - by0), r = 8 + R() * 16; g.beginPath(); g.ellipse(x, y, r, r * SQ, R() * TAU, 0, Math.PI * (1 + R() * .6)); g.stroke(); } }
  for (let i = 0; i < (o.glints || 1800); i++) { const x = bx0 + R() * (bx1 - bx0), y = by0 + R() * (by1 - by0), l = 6 + R() * 22; g.strokeStyle = `rgba(255,255,255,${.04 + R() * .12})`; g.lineWidth = 1.2 + R() * 1.6; g.beginPath(); g.moveTo(x - l, y); g.quadraticCurveTo(x, y - 3, x + l, y); g.stroke(); }
  if (o.foam !== false) g.drawImage(rimBand(shapes, 5, 'rgba(240,255,250,.42)', .5), -GOX, -GOY, GW, GH);
  g.restore();
}
/** lily pads (+ lotus flowers) on water */
function pads(g, R, n, ok, { flower = .3, cols = ['#f49ab8', '#fbe4ee'], box = [-GOX, -GOY, GOX, GOY] } = {}) {
  for (let i = 0; i < n; i++) {
    const x = box[0] + R() * (box[2] - box[0]), y = box[1] + R() * (box[3] - box[1]); if (!ok(x, y)) continue;
    const r = 13 + R() * 18, a = R() * TAU;
    g.save(); g.translate(x, y); g.scale(1, SQ);
    g.fillStyle = 'rgba(10,30,20,.3)'; g.beginPath(); g.arc(2, 4, r, 0, TAU); g.fill();
    g.fillStyle = hsl(95 + R() * 25, 45, 30 + R() * 10); g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, r, a + .25, a + TAU - .25); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(200,240,170,.35)'; g.lineWidth = 1.2; for (let k = 0; k < 5; k++) { const b = a + .4 + k / 5 * (TAU - .8); g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(b) * r * .85, Math.sin(b) * r * .85); g.stroke(); }
    g.restore();
    if (R() < flower) lotusFlower(g, R, x + (R() - .5) * r, y - 4, 8 + R() * 5, pick(R, cols));
  }
}
function lotusFlower(g, R, x, y, s, col) {
  g.save(); g.translate(x, y);
  for (let k = 0; k < 7; k++) { const a = -Math.PI / 2 + (k - 3) * .42; g.save(); g.rotate(a + Math.PI / 2); g.fillStyle = k % 2 ? col : '#fff4f8'; g.beginPath(); g.ellipse(0, -s * .7, s * .34, s * .8, 0, 0, TAU); g.fill(); g.restore(); }
  g.fillStyle = '#f8d24a'; g.beginPath(); g.arc(0, -s * .25, s * .26, 0, TAU); g.fill(); g.restore();
}
/** glowing crack network (lava seams) */
function glowCracks(g, R, n, len, keep, cols = ['#ff5a10', '#ffd26a']) {
  const segs = [];
  for (let i = 0; i < n; i++) { let x = (R() - .5) * GW, y = (R() - .5) * GH; if (keep && !keep(x, y)) continue; const pts = [[x, y]]; let a = R() * TAU; for (let k = 0; k < len; k++) { a += (R() - .5) * 1.2; x += Math.cos(a) * (14 + R() * 18); y += Math.sin(a) * (14 + R() * 18) * SQ; pts.push([x, y]); } segs.push(pts); }
  g.save(); g.lineCap = g.lineJoin = 'round';
  const stroke = (w, c) => { g.lineWidth = w; g.strokeStyle = c; for (const p of segs) { g.beginPath(); p.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); } };
  stroke(9, 'rgba(255,80,10,.18)'); stroke(4, cols[0]); stroke(1.6, cols[1]); g.restore();
}
function lavaPool(g, R, shapes) {
  const path = () => { g.beginPath(); for (const p of shapes) addPts(g, p); }, B = bboxOf(shapes);
  g.save(); g.lineJoin = 'round'; path(); g.strokeStyle = 'rgba(255,90,20,.25)'; g.lineWidth = 60; g.stroke(); g.strokeStyle = '#2a1410'; g.lineWidth = 22; g.stroke(); g.restore();
  g.save(); path(); g.clip();
  const gr = g.createLinearGradient(0, B[1], 0, B[3]); gr.addColorStop(0, '#ff6a14'); gr.addColorStop(.5, '#ffb030'); gr.addColorStop(1, '#ff7a1a'); g.fillStyle = gr; g.fillRect(B[0], B[1], B[2] - B[0], B[3] - B[1]);
  for (let i = 0; i < 260; i++) { const x = B[0] + R() * (B[2] - B[0]), y = B[1] + R() * (B[3] - B[1]), r = 10 + R() * 40; g.fillStyle = R() < .5 ? 'rgba(255,240,150,.35)' : 'rgba(170,30,0,.35)'; g.beginPath(); g.ellipse(x, y, r, r * SQ, 0, 0, TAU); g.fill(); }
  // drifting crust plates
  for (let i = 0; i < 70; i++) { const x = B[0] + R() * (B[2] - B[0]), y = B[1] + R() * (B[3] - B[1]), r = 12 + R() * 26; const p = blobPts(R, x, y, r, r * SQ, .3, 9); g.fillStyle = hsl(10, 25, 10 + R() * 8); g.beginPath(); addPts(g, p); g.fill(); g.strokeStyle = 'rgba(255,200,90,.6)'; g.lineWidth = 2; g.stroke(); }
  path(); g.strokeStyle = 'rgba(255,250,200,.55)'; g.lineWidth = 5; g.stroke();
  g.restore();
}
/** cloud floor (heaven arenas): sky gradient + layered puffs */
function cloudSea(g, R, keep, tint = [230, 30]) {
  const gr = g.createLinearGradient(0, -GOY, 0, GOY); gr.addColorStop(0, '#efd6a2'); gr.addColorStop(.45, '#c9c4e2'); gr.addColorStop(1, '#93acdc'); g.fillStyle = gr; g.fillRect(-GOX, -GOY, GW, GH);
  for (let pass = 0; pass < 3; pass++) for (let i = 0; i < 520; i++) {
    const x = (R() - .5) * GW, y = (R() - .5) * GH; if (keep && !keep(x, y)) continue; const r = 40 + R() * 90;
    const c = pass === 0 ? `hsla(${tint[0]},${tint[1]}%,64%,.6)` : pass === 1 ? 'rgba(252,246,240,.5)' : 'rgba(255,255,255,.62)'; if (pass === 2 && R() < .45) continue;
    const gg = g.createRadialGradient(x, y - r * .2, 0, x, y, r); gg.addColorStop(0, c); gg.addColorStop(1, c.replace(/[\d.]+\)$/, '0)')); g.fillStyle = gg; g.beginPath(); g.ellipse(x, y + (2 - pass) * 10, r, r * .62, 0, 0, TAU); g.fill();
  }
}
/** soft drift of snow: blue-shadowed underlayer + layered white puffs */
function snowPatch(g, R, x, y, r, a = 1) {
  const n = 5 + (R() * 5) | 0, P = Array.from({ length: n }, () => [x + (R() - .5) * r * 1.4, y + (R() - .5) * r * .5, r * (.3 + R() * .4)]);
  for (const [px, py, pr] of P) { const gr = g.createRadialGradient(px + 4, py + 6, 0, px + 4, py + 6, pr); gr.addColorStop(0, `rgba(150,176,214,${.55 * a})`); gr.addColorStop(1, 'rgba(150,176,214,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(px + 4, py + 6, pr, pr * SQ, 0, 0, TAU); g.fill(); }
  for (const [px, py, pr] of P) { const gr = g.createRadialGradient(px - pr * .2, py - pr * .15, 0, px, py, pr * .92); gr.addColorStop(0, `rgba(255,255,255,${.95 * a})`); gr.addColorStop(.7, `rgba(238,244,252,${.85 * a})`); gr.addColorStop(1, 'rgba(238,244,252,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(px, py, pr * .92, pr * .92 * SQ, 0, 0, TAU); g.fill(); }
}
/** vertical rock face painted on the far band of the ground plate (reads as a back wall) */
function backWall(g, R, y0, { top, bot, strata, vein = null, cap = null }) {
  const pts = [[-GOX, -GOY], [GOX, -GOY]]; for (let x = GOX; x >= -GOX; x -= 40) pts.push([x, y0 + (R() - .5) * 40 + Math.sin(x * .004) * 30]);
  g.save(); g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); addPts(g, pts.map(([x, y]) => [x, y + 26])); g.fill();
  g.beginPath(); addPts(g, pts); g.clip();
  const gr = g.createLinearGradient(0, -GOY, 0, y0 + 20); gr.addColorStop(0, top); gr.addColorStop(1, bot); g.fillStyle = gr; g.fillRect(-GOX, -GOY, GW, y0 + GOY + 40);
  for (let i = 0; i < 160; i++) { const x = (R() - .5) * GW, y = -GOY + R() * (y0 + GOY), w = 60 + R() * 220, h = 18 + R() * 60; g.fillStyle = R() < .5 ? 'rgba(255,240,220,.06)' : 'rgba(0,0,0,.14)'; g.beginPath(); addPts(g, blobPts(R, x, y, w, h, .3, 10)); g.fill(); }
  g.strokeStyle = strata; g.lineWidth = 2; for (let y = y0 - 18; y > -GOY; y -= 22 + R() * 30) { g.beginPath(); for (let x = -GOX; x <= GOX; x += 60) g.lineTo(x, y + Math.sin(x * .01 + y) * 6 + (R() - .5) * 6); g.stroke(); }
  g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 2.5; for (let i = 0; i < 60; i++) { let x = (R() - .5) * GW, y = y0; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (R() - .5) * 26; y -= 20 + R() * 30; g.lineTo(x, y); } g.stroke(); }
  if (vein) glowCracks(g, R, 60, 10, (x, y) => y < y0 - 20, vein);
  g.restore();
  if (cap) { g.strokeStyle = cap; g.lineWidth = 6; g.beginPath(); pts.slice(2).forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); }
}

// ---------- prop sprites (cached for the current location only) ----------
const PC = {};
function sprite(key, w, h, ax, ay, paint) { let p = PC[key]; if (!p) { const c = mk(w, h), g = c.getContext('2d'); g.translate(ax, ay); g.lineJoin = 'round'; g.lineCap = 'round'; p = PC[key] = { c, ax, ay }; p.m = paint(g); } return p; }
const put = (ctx, p, x, y, s = 1, flip = false) => { if (flip) { ctx.save(); ctx.translate(x, y); ctx.scale(-1, 1); ctx.drawImage(p.c, -p.ax * s, -p.ay * s, p.c.width * s, p.c.height * s); ctx.restore(); } else ctx.drawImage(p.c, x - p.ax * s, y - p.ay * s, p.c.width * s, p.c.height * s); };
function shadow(g, rx, a = .38, oy = 0) { g.save(); g.translate(0, oy); g.scale(1, .32); const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx); gr.addColorStop(0, `rgba(8,6,4,${a})`); gr.addColorStop(.6, `rgba(8,6,4,${a * .6})`); gr.addColorStop(1, 'rgba(8,6,4,0)'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx, 0, TAU); g.fill(); g.restore(); }
function canopy(g, R, cx, cy, rx, ry, [h, s, l], n = 1) {
  const pass = (k, sc, dl, ox, oy, rs) => { for (let i = 0; i < k * n; i++) { const a = R() * TAU, d = Math.sqrt(R()), x = cx + ox * rx + Math.cos(a) * d * rx * sc, y = cy + oy * ry + Math.sin(a) * d * ry * sc, r = (rx + ry) * rs * (.7 + R() * .6); g.fillStyle = hsl(h + (R() - .5) * 12, s + (R() - .5) * 8, l + dl + (R() - .5) * 5); g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); } };
  pass(16, 1, -13, 0, .08, .17); pass(16, .85, -4, -.04, -.04, .15); pass(13, .62, 6, -.12, -.16, .12); pass(9, .4, 15, -.22, -.3, .09);
}
function trunk(g, w, H, col, lean = 0, flare = 1.7) {
  g.fillStyle = col; g.beginPath(); g.moveTo(-w * flare * .5, 0); g.bezierCurveTo(-w * .5, -H * .15, -w * .4, -H * .55, lean - w * .3, -H); g.lineTo(lean + w * .3, -H); g.bezierCurveTo(w * .4, -H * .55, w * .5, -H * .15, w * flare * .5, 0); g.closePath(); g.fill();
  const gr = g.createLinearGradient(-w * .6, 0, w * .6, 0); gr.addColorStop(0, 'rgba(255,236,200,.22)'); gr.addColorStop(.4, 'rgba(255,236,200,0)'); gr.addColorStop(1, 'rgba(0,0,0,.4)'); g.fillStyle = gr; g.fill();
}
function block(g, x, y, w, h, [hh, s, l]) { g.fillStyle = hsl(hh, s, l); g.fillRect(x, y, w, h); g.fillStyle = 'rgba(255,245,225,.22)'; g.fillRect(x, y, w, 3); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x, y + h - 3, w, 3); const gr = g.createLinearGradient(x, 0, x + w, 0); gr.addColorStop(0, 'rgba(255,240,220,.12)'); gr.addColorStop(1, 'rgba(0,0,0,.22)'); g.fillStyle = gr; g.fillRect(x, y, w, h); }
function boulder(g, R, cx, cy, r, [h, s, l], o) {
  const p = blobPts(R, cx, cy, r, r * .74, .16, 11);
  g.save(); g.beginPath(); addPts(g, p); const gr = g.createLinearGradient(cx - r, cy - r, cx + r, cy + r * .6); gr.addColorStop(0, hsl(h, s, l + 16)); gr.addColorStop(.55, hsl(h, s, l)); gr.addColorStop(1, hsl(h, s, l - 18)); g.fillStyle = gr; g.fill(); g.clip();
  g.strokeStyle = hsl(h, s, l - 22, .5); g.lineWidth = 2; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(cx + (R() - .5) * r, cy - r); g.lineTo(cx + (R() - .5) * r * .6, cy + (R() - .3) * r * .6); g.stroke(); }
  if (o.moss) { g.fillStyle = 'rgba(80,120,40,.75)'; g.beginPath(); addPts(g, blobPts(R, cx - r * .1, cy - r * .62, r * .9, r * .36, .3, 12)); g.fill(); }
  if (o.snow) { g.fillStyle = '#f4f8ff'; g.beginPath(); addPts(g, blobPts(R, cx - r * .05, cy - r * .7, r * .95, r * .34, .25, 12)); g.fill(); g.fillStyle = 'rgba(150,180,220,.35)'; g.fillRect(cx - r, cy - r * .42, r * 2, 4); }
  if (o.lava) { g.strokeStyle = '#ff7a20'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(cx - r * .5, cy + r * .5); g.lineTo(cx - r * .1, cy); g.lineTo(cx + r * .3, cy + r * .4); g.stroke(); }
  g.restore(); g.strokeStyle = hsl(h, s, l - 28, .8); g.lineWidth = 2; g.beginPath(); addPts(g, p); g.stroke();
}
function roofShape(g, x0, x1, base, rise, up, col, ridge, trim) {
  const w = x1 - x0;
  g.beginPath(); g.moveTo(x0 - 26, base - up); g.quadraticCurveTo(x0 + w * .08, base + 4, x0 + w * .2, base); g.lineTo(x1 - w * .2, base); g.quadraticCurveTo(x1 - w * .08, base + 4, x1 + 26, base - up);
  g.lineTo(x1 - w * .1, base - rise); g.lineTo(x0 + w * .1, base - rise); g.closePath(); g.fillStyle = col; g.fill();
  g.save(); g.clip(); g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 2; for (let x = x0 - 30; x < x1 + 30; x += 11) { g.beginPath(); g.moveTo(x, base + 4); g.lineTo(x + (x - (x0 + x1) / 2) * .06, base - rise); g.stroke(); } const gr = g.createLinearGradient(0, base - rise, 0, base); gr.addColorStop(0, 'rgba(255,255,255,.12)'); gr.addColorStop(1, 'rgba(0,0,0,.25)'); g.fillStyle = gr; g.fillRect(x0 - 40, base - rise, w + 80, rise + 6); g.restore();
  g.strokeStyle = trim; g.lineWidth = 4; g.beginPath(); g.moveTo(x0 - 26, base - up); g.quadraticCurveTo(x0 + w * .08, base + 4, x0 + w * .2, base); g.lineTo(x1 - w * .2, base); g.quadraticCurveTo(x1 - w * .08, base + 4, x1 + 26, base - up); g.stroke();
  g.fillStyle = ridge; g.fillRect(x0 + w * .1 - 8, base - rise - 9, w * .8 + 16, 11);
  g.fillStyle = trim; for (const x of [x0 + w * .1 - 10, x1 - w * .1 + 10]) { g.beginPath(); g.arc(x, base - rise - 10, 9, 0, TAU); g.fill(); }
}

const PROPS = {
  tree: (o, sd) => sprite('tree' + sd + (o.v || ''), 380, 460, 190, 440, g => { const R = mulberry(sd), bark = o.bark || '#5a4030'; shadow(g, 130); trunk(g, 32, 210, bark, (R() - .5) * 20); g.strokeStyle = bark; g.lineWidth = 9; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(0, -120 - i * 25); g.quadraticCurveTo((R() - .5) * 90, -190 - i * 20, (R() - .5) * 160, -235 - i * 15); g.stroke(); } canopy(g, R, 0, -262, 150, 128, o.leaf || [100, 42, 34]); if (o.bloom) for (let i = 0; i < 90; i++) { const a = R() * TAU, d = Math.sqrt(R()); g.fillStyle = pick(R, o.bloom); g.beginPath(); g.arc(Math.cos(a) * d * 140 - 10, -262 + Math.sin(a) * d * 115 - 10, 3 + R() * 3, 0, TAU); g.fill(); } }),
  bigtrunk: (o, sd) => sprite('big' + sd + (o.v || ''), 460, 1100, 230, 1060, g => {
    const R = mulberry(sd), w = o.w || 120, col = o.bark || '#4a3628'; shadow(g, 210, .5);
    for (let i = 0; i < 6; i++) { const side = i % 2 ? 1 : -1, ex = side * (100 + R() * 120), ey = (R() - .2) * 26; g.fillStyle = col; g.beginPath(); g.moveTo(side * w * .15, -80 - R() * 50); g.quadraticCurveTo(side * w * .62, -24, ex, ey); g.quadraticCurveTo(side * w * .5, -2, side * w * .05, 2); g.closePath(); g.fill(); g.fillStyle = 'rgba(0,0,0,.18)'; g.fill(); }
    g.beginPath(); g.moveTo(-w * .62, 0); g.bezierCurveTo(-w * .5, -150, -w * .45, -500, -w * .42, -1060); g.lineTo(w * .42, -1060); g.bezierCurveTo(w * .45, -500, w * .5, -150, w * .62, 0); g.closePath(); g.fillStyle = col; g.fill();
    const gr = g.createLinearGradient(-w * .6, 0, w * .6, 0); gr.addColorStop(0, 'rgba(255,236,200,.24)'); gr.addColorStop(.35, 'rgba(255,236,200,.04)'); gr.addColorStop(1, 'rgba(0,0,0,.48)'); g.fillStyle = gr; g.fill();
    g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 3; for (let i = 0; i < 9; i++) { let x = (R() - .5) * w * .8; g.beginPath(); g.moveTo(x, 0); for (let y = 0; y > -1060; y -= 40) { x += (R() - .5) * 8; g.lineTo(x, y); } g.stroke(); }
    if (o.moss) for (let i = 0; i < 40; i++) { const x = (R() - .7) * w, y = -R() * 260; g.fillStyle = `hsla(${85 + R() * 30},45%,${28 + R() * 14}%,.75)`; g.beginPath(); g.ellipse(x, y, 8 + R() * 18, 5 + R() * 9, 0, 0, TAU); g.fill(); }
    if (o.sash) { const y = -200; for (const [c, dy] of [['#e8508a', 0], ['#f4c430', 16], ['#48a860', 32]]) { g.fillStyle = c; g.beginPath(); g.moveTo(-w * .5, y + dy); g.quadraticCurveTo(0, y + dy + 14, w * .5, y + dy); g.lineTo(w * .5, y + dy + 14); g.quadraticCurveTo(0, y + dy + 28, -w * .5, y + dy + 14); g.closePath(); g.fill(); } g.fillStyle = '#e8508a'; g.beginPath(); g.moveTo(w * .1, y + 30); g.lineTo(w * .2, y + 120); g.lineTo(w * .32, y + 112); g.lineTo(w * .24, y + 30); g.fill(); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(w * .1, y, w * .4, 46); }
    if (o.top) canopy(g, R, 0, -980, 230, 110, o.top);
  }),
  pine: (o, sd) => sprite('pine' + sd + (o.snow ? 's' : ''), 300, 560, 150, 540, g => {
    const R = mulberry(sd), H = 430 + R() * 60; shadow(g, 100); g.fillStyle = '#4a3426'; g.fillRect(-9, -80, 18, 80);
    for (let i = 0; i < 6; i++) {
      const t = i / 6, y = -50 - t * (H - 80), w = 125 * (1 - t * .78), hh = 120 - t * 34, pts = [[0, y - hh]];
      for (let k = 0; k <= 6; k++) pts.push([w * k / 6 * (k % 2 ? .82 : 1), y - hh + hh * k / 6 + (k % 2 ? -6 : 0)]);
      for (let k = 6; k >= 0; k--) pts.push([-w * k / 6 * (k % 2 ? .82 : 1), y - hh + hh * k / 6 + (k % 2 ? -6 : 0)]);
      g.beginPath(); addPts(g, pts); const gr = g.createLinearGradient(-w, 0, w, 0); gr.addColorStop(0, hsl(150, 28, 30)); gr.addColorStop(.5, hsl(155, 30, 22)); gr.addColorStop(1, hsl(160, 32, 14)); g.fillStyle = gr; g.fill();
      if (o.snow) { g.save(); g.clip(); g.fillStyle = '#eef4fc'; g.beginPath(); g.moveTo(0, y - hh - 4); g.lineTo(-w * .75, y - hh * .25); g.quadraticCurveTo(-w * .3, y - hh * .38, 0, y - hh * .5); g.quadraticCurveTo(w * .25, y - hh * .32, w * .5, y - hh * .45); g.closePath(); g.fill(); g.restore(); }
    }
  }),
  willow: (o, sd) => sprite('wil' + sd, 400, 460, 200, 440, g => { const R = mulberry(sd); shadow(g, 140); trunk(g, 34, 200, '#4e3e2c', 10); canopy(g, R, 0, -250, 150, 100, [92, 40, 36]); g.lineWidth = 2; for (let i = 0; i < 90; i++) { const x = (R() - .5) * 290, y = -260 + R() * 80, l = 90 + R() * 120; g.strokeStyle = hsl(80 + R() * 25, 45, 34 + R() * 22, .85); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + (R() - .5) * 20, y + l * .5, x + (R() - .5) * 30, y + l); g.stroke(); } }),
  bamboo: (o, sd) => sprite('bam' + sd, 260, 660, 130, 640, g => {
    const R = mulberry(sd); shadow(g, 90);
    for (let i = 0; i < 8; i++) { const x0 = (R() - .5) * 120, H = 420 + R() * 200, lean = (R() - .5) * 60, w = 8 + R() * 5, L = 38 + R() * 16; g.strokeStyle = hsl(80 + R() * 20, 40, L); g.lineWidth = w; g.beginPath(); g.moveTo(x0, 0); g.quadraticCurveTo(x0 + lean * .3, -H * .5, x0 + lean, -H); g.stroke(); g.strokeStyle = hsl(70, 40, L - 18); g.lineWidth = 2; for (let y = -50; y > -H; y -= 55 + R() * 15) { const t = -y / H, x = x0 + lean * t * t; g.beginPath(); g.moveTo(x - w * .6, y); g.lineTo(x + w * .6, y); g.stroke(); if (t > .35) for (let k = 0; k < 3; k++) { const a = (R() < .5 ? -1 : 1) * (.4 + R() * .9); g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = hsl(95 + R() * 20, 45, 30 + R() * 16); g.beginPath(); g.ellipse(0, -26, 4, 26, 0, 0, TAU); g.fill(); g.restore(); } } }
  }),
  palm: (o, sd) => sprite('palm' + sd, 360, 660, 180, 640, g => {
    const R = mulberry(sd), lean = (R() - .5) * 50, H = 460 + R() * 40; shadow(g, 70);
    g.strokeStyle = '#5b4a3e'; g.lineWidth = 17; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(lean * .2, -H * .5, lean, -H); g.stroke(); g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 2; for (let y = -20; y > -H; y -= 14) { const t = -y / H, x = lean * t * t; g.beginPath(); g.moveTo(x - 8, y); g.lineTo(x + 8, y + 2); g.stroke(); }
    const cx = lean, cy = -H; for (let i = 0; i < 6; i++) { const a = Math.PI * .5 + (R() - .5) * 1.4; g.strokeStyle = hsl(30, 35, 30 + R() * 10); g.lineWidth = 4; g.beginPath(); g.moveTo(cx, cy); g.quadraticCurveTo(cx + Math.cos(a) * 30, cy + 20, cx + Math.cos(a) * 50, cy + 80 + R() * 30); g.stroke(); }
    for (let i = 0; i < 24; i++) { const a = -Math.PI + (i / 23) * Math.PI * 1.05 + (R() - .5) * .3 - .02, d = 55 + R() * 25, fx = cx + Math.cos(a) * d, fy = cy + Math.sin(a) * d * .8; g.strokeStyle = hsl(80, 30, 24); g.lineWidth = 3; g.beginPath(); g.moveTo(cx, cy); g.lineTo(fx, fy); g.stroke(); g.save(); g.translate(fx, fy); g.rotate(a); g.fillStyle = hsl(85 + R() * 30, 40, 26 + R() * 14); g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 58, -.75, .75); g.closePath(); g.fill(); g.strokeStyle = 'rgba(0,0,0,.22)'; g.lineWidth = 1.2; for (let k = -6; k <= 6; k++) { g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(k * .12) * 58, Math.sin(k * .12) * 58); g.stroke(); } g.restore(); }
  }),
  rock: (o, sd) => sprite('rock' + sd + (o.v || ''), 320, 240, 160, 220, g => { const R = mulberry(sd), n = o.n || 3; shadow(g, 130, .42); const idx = [...Array(n).keys()].sort((a, b) => Math.abs(b - (n - 1) / 2) - Math.abs(a - (n - 1) / 2)); for (const i of idx) { const c = i - (n - 1) / 2, r = 70 - Math.abs(c) * 22 + R() * 12; boulder(g, R, c * 70 + (R() - .5) * 16, -r * .6, r, o.col || [30, 8, 46], o); } }),
  scholar: (o, sd) => sprite('sch' + sd, 220, 380, 110, 360, g => { const R = mulberry(sd); shadow(g, 80); const p = blobPts(R, 0, -160, 70, 160, .28, 22); g.beginPath(); addPts(g, p); const gr = g.createLinearGradient(-70, 0, 70, 0); gr.addColorStop(0, '#c4ccd0'); gr.addColorStop(.5, '#9aa6ac'); gr.addColorStop(1, '#5e6a72'); g.fillStyle = gr; g.fill(); g.save(); g.clip(); for (let i = 0; i < 6; i++) { const x = (R() - .5) * 80, y = -60 - R() * 220, r = 8 + R() * 16; g.fillStyle = '#2a3438'; g.beginPath(); g.ellipse(x, y, r, r * 1.3, 0, 0, TAU); g.fill(); g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2; g.beginPath(); g.ellipse(x + 1, y + 2, r, r * 1.3, 0, .2, Math.PI - .2); g.stroke(); } g.restore(); g.strokeStyle = '#3e484e'; g.lineWidth = 2; g.beginPath(); addPts(g, p); g.stroke(); }),
  spire: (o, sd) => sprite('spi' + sd + (o.v || ''), 260, 600, 130, 580, g => {
    const R = mulberry(sd), H = 360 + R() * 160, w = 64 + R() * 30, tip = (R() - .5) * 30, [h, s, l] = o.col || [15, 12, 16]; shadow(g, 110, .5);
    const pts = [[-w, 0]]; for (let k = 1; k < 8; k++) pts.push([-w * (1 - k / 8) + tip * k / 8 + (R() - .5) * 16, -H * k / 8]); pts.push([tip, -H]); for (let k = 7; k >= 1; k--) pts.push([w * (1 - k / 8) + tip * k / 8 + (R() - .5) * 16, -H * k / 8]); pts.push([w, 0]);
    g.beginPath(); addPts(g, pts); const gr = g.createLinearGradient(-w, 0, w, 0); gr.addColorStop(0, hsl(h, s, l + 14)); gr.addColorStop(.45, hsl(h, s, l)); gr.addColorStop(1, hsl(h, s, l - 8)); g.fillStyle = gr; g.fill(); g.save(); g.clip();
    g.strokeStyle = hsl(h, s, l + 22, .5); g.lineWidth = 2; for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(tip + (R() - .5) * 10, -H); g.lineTo((R() - .5) * w * 1.4, 0); g.stroke(); }
    if (o.lava) { g.lineCap = 'round'; for (const [lw, c] of [[8, 'rgba(255,90,20,.35)'], [3, '#ff7a20'], [1.2, '#ffe08a']]) { g.lineWidth = lw; g.strokeStyle = c; const R2 = mulberry(sd + 7); for (let k = 0; k < 4; k++) { let x = (R2() - .5) * w, y = 0; g.beginPath(); g.moveTo(x, y); for (let j = 0; j < 6; j++) { x += (R2() - .5) * 24; y -= 16 + R2() * 26; g.lineTo(x, y); } g.stroke(); } } const gg = g.createLinearGradient(0, -120, 0, 0); gg.addColorStop(0, 'rgba(255,90,20,0)'); gg.addColorStop(1, 'rgba(255,110,30,.45)'); g.fillStyle = gg; g.fillRect(-w, -120, w * 2, 120); }
    if (o.snow) { g.fillStyle = '#f2f6fc'; g.beginPath(); g.moveTo(tip, -H - 4); g.lineTo(tip - w * .42, -H * .7); g.quadraticCurveTo(tip, -H * .76, tip + w * .4, -H * .72); g.closePath(); g.fill(); }
    g.restore();
  }),
  cliff: (o, sd) => sprite('clf' + sd + (o.v || ''), 940, 700, 470, 660, g => {
    const R = mulberry(sd), [h, s, l] = o.col || [210, 8, 44]; shadow(g, 440, .45);
    for (let layer = 0; layer < 3; layer++) {
      const W = 450 - layer * 70, base = layer * 6, top = [], hmax = 560 - layer * 120;
      for (let x = -W; x <= W; x += 30) { const t = 1 - Math.abs(x) / W; top.push([x, base - Math.max(40, hmax * (.35 + .65 * Math.sqrt(t)) * (.75 + R() * .3))]); }
      const pts = [[-W, base], ...top, [W, base]]; g.beginPath(); addPts(g, pts); const L = l + (2 - layer) * 8 - layer * 4; const gr = g.createLinearGradient(-W, -hmax, W, 0); gr.addColorStop(0, hsl(h, s, L + 12)); gr.addColorStop(.6, hsl(h, s, L)); gr.addColorStop(1, hsl(h, s, L - 14)); g.fillStyle = gr; g.fill();
      g.save(); g.clip(); g.strokeStyle = hsl(h, s, L - 20, .45); g.lineWidth = 2; for (let y = -30; y > -hmax; y -= 26 + R() * 20) { g.beginPath(); for (let x = -W; x <= W; x += 40) g.lineTo(x, y + (R() - .5) * 10); g.stroke(); } for (let k = 0; k < 14; k++) { let x = (R() - .5) * W * 2, y = base; g.beginPath(); g.moveTo(x, y); for (let j = 0; j < 7; j++) { x += (R() - .5) * 20; y -= 30 + R() * 40; g.lineTo(x, y); } g.stroke(); } g.restore();
      if (o.cap) { g.strokeStyle = o.cap; g.lineWidth = 10 - layer * 2; g.beginPath(); top.forEach(([x, y], i) => (i ? g.lineTo(x, y + 3) : g.moveTo(x, y + 3))); g.stroke(); }
    }
  }),
  pillar: (o, sd) => sprite('pil' + (o.v || ''), 130, 520, 65, 500, g => {
    const c = o.col || [2, 62, 40], H = o.H || 380, gold = o.gold || '#e2b04a'; shadow(g, 60, .45);
    block(g, -36, -30, 72, 30, o.base || [30, 8, 62]);
    const gr = g.createLinearGradient(-22, 0, 22, 0); gr.addColorStop(0, hsl(c[0], c[1], c[2] - 18)); gr.addColorStop(.3, hsl(c[0], c[1], c[2] + 10)); gr.addColorStop(.55, hsl(c[0], c[1], c[2])); gr.addColorStop(1, hsl(c[0], c[1], c[2] - 22)); g.fillStyle = gr; g.fillRect(-22, -H, 44, H - 30);
    for (const y of [-H + 18, -64]) { g.fillStyle = gold; g.fillRect(-23, y, 46, 12); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(-23, y, 46, 3); }
    g.fillStyle = o.cap || '#2f6a64'; g.fillRect(-34, -H - 18, 68, 20); g.fillStyle = gold; g.fillRect(-40, -H - 26, 80, 9); g.fillRect(-28, -H - 4, 56, 5);
  }),
  gate: (o, sd) => sprite('gate' + (o.v || ''), 1000, 760, 500, 720, g => {
    const P = o.pal || {}, pil = P.pillar || [2, 62, 40], roof = P.roof || '#2e5a58', trim = P.trim || '#e2b04a', beam = P.beam || '#7a1f22', stn = P.stone || [40, 6, 60];
    shadow(g, 440, .4);
    const col = (x, H) => { block(g, x - 34, -34, 68, 34, stn); const gr = g.createLinearGradient(x - 22, 0, x + 22, 0); gr.addColorStop(0, hsl(pil[0], pil[1], pil[2] - 18)); gr.addColorStop(.3, hsl(pil[0], pil[1], pil[2] + 10)); gr.addColorStop(1, hsl(pil[0], pil[1], pil[2] - 20)); g.fillStyle = gr; g.fillRect(x - 22, -H, 44, H - 34); g.fillStyle = trim; g.fillRect(x - 23, -80, 46, 10); };
    col(-360, 330); col(360, 330); col(-170, 470); col(170, 470);
    const beamB = (x0, x1, y, h) => { g.fillStyle = beam; g.fillRect(x0, y, x1 - x0, h); g.fillStyle = roof; g.fillRect(x0 + 6, y + 5, x1 - x0 - 12, h - 10); g.fillStyle = trim; for (let x = x0 + 18; x < x1 - 10; x += 30) { g.beginPath(); g.arc(x, y + h / 2, 3.5, 0, TAU); g.fill(); } };
    beamB(-420, -170, -322, 26); beamB(170, 420, -322, 26); beamB(-200, 200, -462, 28); beamB(-200, 200, -372, 24);
    g.fillStyle = trim; g.fillRect(-82, -432, 164, 58); g.fillStyle = beam; g.fillRect(-74, -426, 148, 46); g.strokeStyle = trim; g.lineWidth = 4; for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(-40 + k * 34 + 34, -418); g.lineTo(-40 + k * 34 + 34, -390); g.moveTo(-50 + k * 34 + 34, -404); g.lineTo(-30 + k * 34 + 34, -404); g.stroke(); }
    roofShape(g, -430, -150, -322, 64, 18, roof, P.ridge || '#1e3a38', trim); roofShape(g, 150, 430, -322, 64, 18, roof, P.ridge || '#1e3a38', trim); roofShape(g, -230, 230, -462, 96, 26, roof, P.ridge || '#1e3a38', trim);
    g.fillStyle = trim; g.beginPath(); g.arc(0, -572, 14, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.arc(-4, -576, 5, 0, TAU); g.fill();
  }),
  wall: (o, sd) => sprite('wall' + (o.v || ''), 840, 360, 420, 330, g => {
    const P = o.pal || {}, W = 400, H = o.H || 210, R = mulberry(sd);
    const gs = g.createLinearGradient(0, -20, 0, 20); gs.addColorStop(0, 'rgba(0,0,0,.35)'); gs.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gs; g.fillRect(-W - 10, -6, W * 2 + 20, 26);
    for (let x = -W; x < W; x += 50) block(g, x, -42, 50, 42, P.stone || [30, 8, 52]);
    const gr = g.createLinearGradient(0, -H, 0, -42); gr.addColorStop(0, P.wall2 || '#c8483a'); gr.addColorStop(1, P.wall || '#9c3028'); g.fillStyle = gr; g.fillRect(-W, -H, W * 2, H - 42);
    for (let i = 0; i < 40; i++) { g.fillStyle = R() < .5 ? 'rgba(255,240,220,.06)' : 'rgba(0,0,0,.07)'; g.beginPath(); g.ellipse((R() - .5) * W * 2, -H + R() * (H - 50), 20 + R() * 50, 8 + R() * 20, 0, 0, TAU); g.fill(); }
    if (o.windows) for (const x of [-260, 0, 260]) { g.fillStyle = '#2a1e18'; g.fillRect(x - 40, -H + 50, 80, 70); g.strokeStyle = P.trim || '#e2b04a'; g.lineWidth = 3; g.strokeRect(x - 40, -H + 50, 80, 70); g.lineWidth = 2; for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(x - 40 + k * 20, -H + 50); g.lineTo(x - 40 + k * 20, -H + 120); g.moveTo(x - 40, -H + 50 + k * 17.5); g.lineTo(x + 40, -H + 50 + k * 17.5); g.stroke(); } }
    g.fillStyle = P.eave || '#3a3a3e'; g.fillRect(-W - 14, -H - 10, W * 2 + 28, 14);
    g.fillStyle = P.roof || '#2e5a58'; g.beginPath(); g.moveTo(-W - 18, -H - 8); g.lineTo(-W + 10, -H - 52); g.lineTo(W - 10, -H - 52); g.lineTo(W + 18, -H - 8); g.closePath(); g.fill();
    g.save(); g.clip(); g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 2; for (let x = -W - 20; x < W + 20; x += 12) { g.beginPath(); g.moveTo(x, -H - 6); g.lineTo(x, -H - 54); g.stroke(); } g.restore();
    g.fillStyle = P.ridge || '#1e3a38'; g.fillRect(-W + 4, -H - 60, W * 2 - 8, 11);
  }),
  moongate: (o, sd) => sprite('moon' + sd, 960, 460, 480, 430, g => {
    const R = mulberry(sd), W = 460, H = 330, cy = -165, r = 132; shadow(g, 440, .3);
    g.save(); g.beginPath(); g.rect(-W, -H, W * 2, H); g.moveTo(r, cy); g.arc(0, cy, r, 0, TAU, true); g.clip('evenodd');
    const gr = g.createLinearGradient(0, -H, 0, 0); gr.addColorStop(0, '#f2f0ea'); gr.addColorStop(1, '#c8c8c4'); g.fillStyle = gr; g.fillRect(-W, -H, W * 2, H);
    for (let i = 0; i < 30; i++) { g.fillStyle = 'rgba(80,90,90,.06)'; g.beginPath(); g.ellipse((R() - .5) * W * 2, -R() * H, 30 + R() * 60, 10 + R() * 30, 0, 0, TAU); g.fill(); }
    g.fillStyle = 'rgba(90,100,96,.25)'; g.fillRect(-W, -40, W * 2, 40); g.restore();
    g.save(); g.beginPath(); g.arc(0, cy, r, 0, TAU); g.clip(); const ig = g.createLinearGradient(0, cy - r, 0, cy + r); ig.addColorStop(0, '#1c3a40'); ig.addColorStop(1, '#2c5040'); g.fillStyle = ig; g.fillRect(-r, cy - r, r * 2, r * 2);
    for (let i = 0; i < 14; i++) { const x = (R() - .5) * r * 2; g.strokeStyle = hsl(140, 30, 18 + R() * 12); g.lineWidth = 5; g.beginPath(); g.moveTo(x, cy + r); g.lineTo(x + (R() - .5) * 20, cy - r); g.stroke(); }
    g.fillStyle = 'rgba(210,225,255,.25)'; g.beginPath(); g.ellipse(0, cy + r * .7, r * .5, 14, 0, 0, TAU); g.fill(); g.restore();
    g.strokeStyle = '#8a8e8a'; g.lineWidth = 10; g.beginPath(); g.arc(0, cy, r + 4, 0, TAU); g.stroke(); g.strokeStyle = '#e8e6e0'; g.lineWidth = 3; g.beginPath(); g.arc(0, cy, r + 9, Math.PI, TAU); g.stroke();
    g.fillStyle = '#4a5052'; g.beginPath(); g.moveTo(-W - 16, -H); g.lineTo(-W + 6, -H - 34); g.lineTo(W - 6, -H - 34); g.lineTo(W + 16, -H); g.closePath(); g.fill(); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2; for (let x = -W; x < W; x += 12) { g.beginPath(); g.moveTo(x, -H); g.lineTo(x, -H - 34); g.stroke(); } g.fillStyle = '#383e40'; g.fillRect(-W + 2, -H - 42, W * 2 - 4, 10);
    for (const x of [-300, 300]) { g.strokeStyle = '#5a6060'; g.lineWidth = 3; g.strokeRect(x - 34, -250, 68, 68); g.beginPath(); g.moveTo(x - 34, -216); g.lineTo(x + 34, -216); g.moveTo(x, -250); g.lineTo(x, -182); g.stroke(); }
  }),
  prang: (o, sd) => sprite('prang' + sd + (o.v || ''), 330, 760, 165, 740, g => {
    const R = mulberry(sd), lat = o.lat || [16, 46, 38], sand = o.sand || [34, 32, 60]; shadow(g, 150, .45); let y = 0;
    for (const [w, hh] of [[140, 26], [122, 24], [106, 22]]) { block(g, -w, y - hh, 2 * w, hh, lat); y -= hh; }
    block(g, -92, y - 22, 184, 22, sand); y -= 22;
    block(g, -70, y - 160, 140, 160, lat); block(g, -86, y - 140, 16, 140, sand); block(g, 70, y - 140, 16, 140, sand);
    g.fillStyle = '#1a120c'; g.beginPath(); g.moveTo(-24, y); g.lineTo(-24, y - 92); g.quadraticCurveTo(0, y - 122, 24, y - 92); g.lineTo(24, y); g.fill(); g.strokeStyle = hsl(sand[0], sand[1], sand[2]); g.lineWidth = 6; g.stroke();
    g.fillStyle = hsl(sand[0], sand[1], sand[2]); g.beginPath(); g.moveTo(-40, y - 112); g.quadraticCurveTo(0, y - 160, 40, y - 112); g.lineTo(30, y - 112); g.quadraticCurveTo(0, y - 146, -30, y - 112); g.fill();
    y -= 160;
    for (let i = 0; i < 7; i++) { const t = i / 7, w = 76 * Math.cos(t * Math.PI * .5) ** .7 + 6, hh = 48 - i * 3.5; block(g, -w, y - hh, 2 * w, hh, i % 2 ? sand : lat); for (const px of [-w, -w * .5, 0, w * .5, w]) { g.fillStyle = hsl(sand[0], sand[1], sand[2] + 6); g.beginPath(); g.moveTo(px - 9, y - hh + 2); g.quadraticCurveTo(px, y - hh - 24 + i * 1.5, px + 9, y - hh + 2); g.fill(); g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1.2; g.stroke(); } y -= hh; }
    g.fillStyle = hsl(sand[0], sand[1], sand[2] + 4); g.beginPath(); g.moveTo(-12, y); g.quadraticCurveTo(-14, y - 30, 0, y - 46); g.quadraticCurveTo(14, y - 30, 12, y); g.fill(); g.strokeStyle = '#4a3420'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, y - 46); g.lineTo(0, y - 80); g.stroke();
    g.globalCompositeOperation = 'source-atop'; for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(${R() < .5 ? '20,30,10' : '0,0,0'},${.06 + R() * .1})`; g.fillRect((R() - .5) * 200, -R() * 700, 3 + R() * 10, 20 + R() * 80); } g.globalCompositeOperation = 'source-over';
  }),
  chedi: (o, sd) => sprite('chedi' + (o.v || ''), 240, 580, 120, 560, g => {
    const w = o.white || [40, 22, 88], gold = o.gold || '#e4b347'; shadow(g, 100, .4); let y = 0;
    for (const [bw, hh] of [[96, 20], [80, 18], [66, 16]]) { block(g, -bw, y - hh, 2 * bw, hh, w); y -= hh; }
    g.fillStyle = gold; g.fillRect(-60, y - 8, 120, 8); y -= 8;
    const gr = g.createLinearGradient(-64, 0, 64, 0); gr.addColorStop(0, hsl(w[0], w[1], w[2] - 2)); gr.addColorStop(.35, hsl(w[0], w[1], w[2] + 8)); gr.addColorStop(1, hsl(w[0], w[1], w[2] - 26)); g.fillStyle = gr; g.beginPath(); g.moveTo(-60, y); g.bezierCurveTo(-62, y - 70, -36, y - 120, 0, y - 122); g.bezierCurveTo(36, y - 120, 62, y - 70, 60, y); g.closePath(); g.fill();
    y -= 120; block(g, -20, y - 22, 40, 22, w); y -= 22;
    for (let i = 0; i < 11; i++) { const rw = 16 - i * 1.25; g.fillStyle = i % 2 ? gold : '#c8902a'; g.beginPath(); g.ellipse(0, y - 6, rw, 6, 0, 0, TAU); g.fill(); y -= 10; }
    g.strokeStyle = gold; g.lineWidth = 3; g.beginPath(); g.moveTo(0, y); g.lineTo(0, y - 60); g.stroke(); g.fillStyle = '#fff2b0'; g.beginPath(); g.arc(0, y - 30, 4, 0, TAU); g.fill();
  }),
  house: (o, sd) => sprite('house' + sd + (o.night ? 'n' : ''), 460, 460, 230, 440, g => {
    const R = mulberry(sd), dk = o.night ? -12 : 0, wood = l => hsl(26, 34, l + dk); shadow(g, 200, .45);
    for (const x of [-150, -75, 0, 75, 150]) { g.fillStyle = wood(20); g.fillRect(x - 6, -96, 12, 96); }
    g.fillStyle = wood(16); g.fillRect(-170, -108, 340, 16);
    g.fillStyle = wood(32); g.fillRect(-140, -222, 280, 114); g.strokeStyle = wood(20); g.lineWidth = 2; for (let x = -140; x <= 140; x += 20) { g.beginPath(); g.moveTo(x, -222); g.lineTo(x, -108); g.stroke(); } g.lineWidth = 6; g.strokeRect(-140, -222, 280, 114);
    g.fillStyle = o.night ? '#ffbe6a' : '#2a1e14'; g.fillRect(-90, -192, 56, 44); if (o.night) { const gg = g.createRadialGradient(-62, -170, 2, -62, -170, 40); gg.addColorStop(0, 'rgba(255,240,190,.9)'); gg.addColorStop(1, 'rgba(255,170,80,0)'); g.fillStyle = gg; g.fillRect(-90, -192, 56, 44); } g.strokeStyle = wood(14); g.lineWidth = 3; g.strokeRect(-90, -192, 56, 44); g.beginPath(); g.moveTo(-62, -192); g.lineTo(-62, -148); g.stroke();
    g.fillStyle = wood(14); g.fillRect(30, -204, 48, 96);
    const th = o.night ? [36, 30, 24] : [38, 44, 44]; g.fillStyle = hsl(th[0], th[1], th[2]); g.beginPath(); g.moveTo(-196, -212); g.lineTo(-120, -350); g.lineTo(120, -350); g.lineTo(196, -212); g.closePath(); g.fill();
    g.save(); g.clip(); for (let i = 0; i < 420; i++) { const x = (R() - .5) * 400, y = -350 + R() * 140; g.strokeStyle = hsl(th[0] + (R() - .5) * 10, th[1], th[2] + (R() - .5) * 18, .8); g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (x / 200) * 8, y + 16); g.stroke(); } const sg = g.createLinearGradient(0, -350, 0, -212); sg.addColorStop(0, 'rgba(255,255,255,.08)'); sg.addColorStop(1, 'rgba(0,0,0,.3)'); g.fillStyle = sg; g.fillRect(-200, -350, 400, 140); g.restore();
    g.strokeStyle = wood(12); g.lineWidth = 5; for (const x of [-120, 120]) { g.beginPath(); g.moveTo(x - 24, -330); g.quadraticCurveTo(x, -350, x + 20, -386); g.moveTo(x + 24, -330); g.quadraticCurveTo(x, -350, x - 20, -386); g.stroke(); }
    g.strokeStyle = wood(18); g.lineWidth = 5; g.beginPath(); g.moveTo(150, -100); g.lineTo(206, 0); g.moveTo(172, -100); g.lineTo(228, 0); g.stroke(); g.lineWidth = 3; for (let k = 1; k < 5; k++) { g.beginPath(); g.moveTo(150 + k * 11, -100 + k * 20); g.lineTo(172 + k * 11, -100 + k * 20); g.stroke(); }
  }),
  sala: (o, sd) => sprite('sala' + sd, 380, 380, 190, 360, g => { const R = mulberry(sd); shadow(g, 160, .4); g.fillStyle = '#5a4030'; g.fillRect(-150, -40, 300, 16); for (const x of [-130, -45, 45, 130]) { g.fillStyle = '#4a3424'; g.fillRect(x - 6, -170, 12, 170); } g.fillStyle = hsl(40, 45, 46); g.beginPath(); g.moveTo(-180, -160); g.lineTo(-100, -270); g.lineTo(100, -270); g.lineTo(180, -160); g.closePath(); g.fill(); g.save(); g.clip(); for (let i = 0; i < 320; i++) { const x = (R() - .5) * 380, y = -270 + R() * 112; g.strokeStyle = hsl(36 + (R() - .5) * 10, 45, 40 + (R() - .5) * 20, .85); g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + x / 30, y + 14); g.stroke(); } g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(-190, -180, 380, 22); g.restore(); }),
  hay: (o, sd) => sprite('hay' + sd, 240, 210, 120, 190, g => { const R = mulberry(sd); shadow(g, 110, .45); g.beginPath(); g.moveTo(-98, 0); g.bezierCurveTo(-104, -110, -40, -158, 0, -158); g.bezierCurveTo(40, -158, 104, -110, 98, 0); g.closePath(); const gr = g.createLinearGradient(-100, -150, 100, 0); gr.addColorStop(0, '#f2d27a'); gr.addColorStop(.6, '#c89a3a'); gr.addColorStop(1, '#7a5a22'); g.fillStyle = gr; g.fill(); g.save(); g.clip(); for (let i = 0; i < 380; i++) { const x = (R() - .5) * 200, y = -R() * 160, a = Math.atan2(y + 60, x) + (R() - .5) * .6; g.strokeStyle = hsl(40 + R() * 12, 55, 30 + R() * 40, .8); g.lineWidth = 1.4; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14); g.stroke(); } g.restore(); g.strokeStyle = '#6a4a1a'; g.lineWidth = 4; g.beginPath(); g.moveTo(0, -150); g.lineTo(4, -186); g.stroke(); }),
  reeds: (o, sd) => sprite('reed' + sd, 180, 240, 90, 225, g => { const R = mulberry(sd); shadow(g, 60, .3); for (let i = 0; i < 18; i++) { const x = (R() - .5) * 70, h = 90 + R() * 110, lean = (R() - .5) * 60; g.strokeStyle = hsl(75 + R() * 25, 40, 28 + R() * 18); g.lineWidth = 2.5; g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + lean * .2, -h * .5, x + lean, -h); g.stroke(); } for (let i = 0; i < 4; i++) { const x = (R() - .5) * 50, h = 150 + R() * 50; g.strokeStyle = '#5a6a2a'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 4, -h); g.stroke(); g.fillStyle = '#6a4024'; g.beginPath(); g.ellipse(x + 4, -h + 18, 6, 18, 0, 0, TAU); g.fill(); } }),
  fern: (o, sd) => sprite('fern' + sd + (o.v || ''), 280, 200, 140, 185, g => { const R = mulberry(sd), [h, s, l] = o.leaf || [110, 40, 30]; shadow(g, 100, .35); for (let i = 0; i < 11; i++) { const a = -Math.PI + .25 + (i / 10) * (Math.PI - .5), L = 90 + R() * 50; g.save(); g.rotate(a + Math.PI / 2); g.strokeStyle = hsl(h, s, l - 6); g.lineWidth = 2.5; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(10, -L * .6, 26, -L); g.stroke(); for (let k = 2; k < 13; k++) { const t = k / 13, px = 26 * t * t, py = -L * t, ll = 16 * (1 - t) + 4; g.strokeStyle = hsl(h + (R() - .5) * 14, s, l + R() * 14); g.lineWidth = 3; g.beginPath(); g.moveTo(px, py); g.lineTo(px - ll, py + ll * .4); g.moveTo(px, py); g.lineTo(px + ll, py + ll * .2); g.stroke(); } g.restore(); } }),
  banana: (o, sd) => sprite('ban' + sd, 320, 440, 160, 420, g => { const R = mulberry(sd), dk = o.night ? -10 : 0; shadow(g, 90, .4); g.fillStyle = hsl(70, 30, 30 + dk); g.beginPath(); g.moveTo(-16, 0); g.lineTo(-10, -190); g.lineTo(10, -190); g.lineTo(16, 0); g.fill(); for (let i = 0; i < 8; i++) { const a = -Math.PI / 2 + (i - 3.5) * .42 + (R() - .5) * .2, L = 150 + R() * 70, ex = Math.cos(a) * L, ey = -190 + Math.sin(a) * L * .9 + (Math.abs(a + Math.PI / 2) > .9 ? 60 : 0); const dry = R() < .15; g.fillStyle = dry ? hsl(35, 40, 36 + dk) : hsl(95 + R() * 15, 45, 32 + R() * 10 + dk); g.beginPath(); g.moveTo(0, -190); g.quadraticCurveTo(ex * .5 - 26, -190 + (ey + 190) * .3 - 30, ex, ey); g.quadraticCurveTo(ex * .5 + 26, -190 + (ey + 190) * .3 + 10, 0, -190); g.fill(); g.strokeStyle = 'rgba(255,255,220,.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -190); g.quadraticCurveTo(ex * .5, -190 + (ey + 190) * .3 - 10, ex, ey); g.stroke(); } }),
  jar: (o, sd) => sprite('jar', 130, 140, 65, 128, g => { shadow(g, 52, .45); const gr = g.createRadialGradient(-14, -70, 4, 0, -52, 56); gr.addColorStop(0, '#c98a52'); gr.addColorStop(.5, '#7a4424'); gr.addColorStop(1, '#3a1e10'); g.fillStyle = gr; g.beginPath(); g.ellipse(0, -52, 46, 52, 0, 0, TAU); g.fill(); g.fillStyle = '#5a321c'; g.fillRect(-22, -110, 44, 14); g.fillStyle = '#1a0e08'; g.beginPath(); g.ellipse(0, -110, 24, 7, 0, 0, TAU); g.fill(); g.strokeStyle = '#e2b04a'; g.lineWidth = 2; g.beginPath(); g.ellipse(0, -66, 40, 10, 0, .2, Math.PI - .2); g.stroke(); }),
  fence: (o, sd) => sprite('fen' + sd, 460, 150, 230, 132, g => { const R = mulberry(sd); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(-210, -4, 420, 10); g.strokeStyle = '#6a5034'; g.lineWidth = 6; for (const y of [-70, -36]) { g.beginPath(); g.moveTo(-210, y + (R() - .5) * 6); g.lineTo(210, y + (R() - .5) * 6); g.stroke(); } for (let x = -200; x <= 200; x += 66) { g.fillStyle = '#5a422c'; g.fillRect(x - 6, -96 - R() * 10, 12, 98); g.fillStyle = 'rgba(255,230,190,.2)'; g.fillRect(x - 6, -96, 3, 96); } }),
  cloud: (o, sd) => sprite('cld' + sd + (o.v || ''), 620, 320, 310, 280, g => { const R = mulberry(sd), puffs = []; for (let i = 0; i < 26; i++) { const a = R() * TAU, d = Math.sqrt(R()); puffs.push([Math.cos(a) * d * 220, -110 + Math.sin(a) * d * 70 - (1 - d) * 30, 42 + R() * 50]); } puffs.sort((a, b) => a[1] - b[1]); for (const [x, y, r] of puffs) { const gr = g.createRadialGradient(x, y + 16, 0, x, y + 16, r); gr.addColorStop(0, o.shade || 'rgba(190,180,215,.9)'); gr.addColorStop(1, 'rgba(190,180,215,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y + 16, r, 0, TAU); g.fill(); } for (const [x, y, r] of puffs) { const gr = g.createRadialGradient(x - r * .3, y - r * .3, 0, x, y, r * .95); gr.addColorStop(0, '#ffffff'); gr.addColorStop(.6, o.lit || 'rgba(255,248,236,.92)'); gr.addColorStop(1, 'rgba(255,248,236,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r * .95, 0, TAU); g.fill(); } }),
  ding: (o, sd) => sprite('ding', 200, 260, 100, 240, g => { shadow(g, 80, .45); g.strokeStyle = '#4a3a22'; g.lineWidth = 9; for (const x of [-46, 0, 46]) { g.beginPath(); g.moveTo(x * .7, -40); g.quadraticCurveTo(x * 1.1, -20, x, 0); g.stroke(); } const gr = g.createLinearGradient(-70, 0, 70, 0); gr.addColorStop(0, '#9a7a3a'); gr.addColorStop(.35, '#c8a050'); gr.addColorStop(1, '#4a3418'); g.fillStyle = gr; g.beginPath(); g.moveTo(-70, -110); g.bezierCurveTo(-72, -40, -40, -30, 0, -30); g.bezierCurveTo(40, -30, 72, -40, 70, -110); g.closePath(); g.fill(); g.fillStyle = 'rgba(60,140,110,.35)'; for (const [x, y] of [[-40, -70], [20, -50], [44, -90]]) { g.beginPath(); g.ellipse(x, y, 12, 7, 0, 0, TAU); g.fill(); } g.fillStyle = '#6a5228'; g.beginPath(); g.ellipse(0, -110, 72, 14, 0, 0, TAU); g.fill(); g.fillStyle = '#2a1e10'; g.beginPath(); g.ellipse(0, -110, 60, 10, 0, 0, TAU); g.fill(); g.strokeStyle = '#b08a40'; g.lineWidth = 7; for (const x of [-56, 56]) { g.beginPath(); g.moveTo(x - 10, -114); g.lineTo(x - 10, -146); g.lineTo(x + 10, -146); g.lineTo(x + 10, -114); g.stroke(); } g.strokeStyle = '#8a3a22'; g.lineWidth = 2.5; for (const x of [-12, 0, 12]) { g.beginPath(); g.moveTo(x, -112); g.lineTo(x + x * .3, -170); g.stroke(); g.fillStyle = '#ff7030'; g.beginPath(); g.arc(x + x * .3, -170, 2.5, 0, TAU); g.fill(); } }),
  rail: (o, sd) => sprite('rail' + (o.v || ''), 1000, 170, 500, 150, g => { const W = 480, c = o.col || '#b8322a', gold = '#e2b04a'; g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(-W - 10, -4, W * 2 + 20, 12); g.fillStyle = '#4a2a1e'; g.fillRect(-W - 8, -14, W * 2 + 16, 14); for (const [y, h] of [[-92, 10], [-50, 7]]) { g.fillStyle = c; g.fillRect(-W, y, W * 2, h); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(-W, y, W * 2, 2); } g.fillStyle = c; for (let x = -W + 15; x < W; x += 30) g.fillRect(x - 2, -50, 4, 36); for (let x = -W; x <= W; x += 120) { g.fillStyle = c; g.fillRect(x - 9, -110, 18, 100); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x + 4, -110, 5, 100); g.fillStyle = gold; g.beginPath(); g.arc(x, -116, 10, 0, TAU); g.fill(); g.fillStyle = '#fff2b0'; g.beginPath(); g.arc(x - 3, -119, 3, 0, TAU); g.fill(); } }),
  lotus: (o, sd) => sprite('lot' + sd, 220, 200, 110, 175, g => { const R = mulberry(sd); g.fillStyle = 'rgba(10,30,30,.25)'; g.beginPath(); g.ellipse(0, 0, 90, 22, 0, 0, TAU); g.fill(); for (let i = 0; i < 5; i++) { const x = (R() - .5) * 120, h = 30 + R() * 60, r = 22 + R() * 16; g.strokeStyle = '#4a7a3a'; g.lineWidth = 3; g.beginPath(); g.moveTo(x * .3, 0); g.quadraticCurveTo(x * .6, -h * .6, x, -h); g.stroke(); g.fillStyle = hsl(100 + R() * 20, 42, 30 + R() * 10); g.beginPath(); g.ellipse(x, -h, r, r * .45, (R() - .5) * .4, 0, TAU); g.fill(); g.strokeStyle = 'rgba(200,240,170,.4)'; g.lineWidth = 1.2; g.beginPath(); g.ellipse(x, -h, r * .6, r * .25, 0, 0, TAU); g.stroke(); } for (let i = 0; i < 3; i++) { const x = (R() - .5) * 90, h = 80 + R() * 70; g.strokeStyle = '#3e6a30'; g.lineWidth = 3; g.beginPath(); g.moveTo(x * .2, 0); g.lineTo(x, -h); g.stroke(); lotusFlower(g, R, x, -h + 6, 14 + R() * 6, pick(R, o.cols || ['#f49ab8', '#fbe4ee'])); } }),
  toad: (o, sd) => sprite('toad', 240, 230, 120, 210, g => { shadow(g, 100, .45); block(g, -86, -40, 172, 40, [30, 10, 40]); g.fillStyle = '#c03a2a'; g.fillRect(-90, -48, 180, 10); const gold = (x0, y0, x1, y1) => { const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, '#fff0a0'); gr.addColorStop(.4, '#e2b04a'); gr.addColorStop(1, '#8a5a18'); return gr; }; g.fillStyle = gold(-60, -150, 60, -50); g.beginPath(); g.ellipse(0, -94, 72, 50, 0, 0, TAU); g.fill(); for (const x of [-56, 56]) { g.beginPath(); g.ellipse(x, -56, 24, 14, 0, 0, TAU); g.fill(); } g.beginPath(); g.ellipse(0, -132, 50, 34, 0, 0, TAU); g.fill(); for (const x of [-28, 28]) { g.fillStyle = gold(x - 14, -180, x + 14, -150); g.beginPath(); g.arc(x, -160, 15, 0, TAU); g.fill(); g.fillStyle = '#c03a2a'; g.beginPath(); g.arc(x, -160, 7, 0, TAU); g.fill(); g.fillStyle = '#1a0e08'; g.beginPath(); g.arc(x, -160, 3.5, 0, TAU); g.fill(); } g.strokeStyle = '#7a4a10'; g.lineWidth = 3; g.beginPath(); g.arc(0, -126, 26, .3, Math.PI - .3); g.stroke(); g.fillStyle = '#e2b04a'; g.beginPath(); g.arc(0, -104, 16, 0, TAU); g.fill(); g.fillStyle = '#7a4a10'; g.fillRect(-5, -109, 10, 10); g.fillStyle = 'rgba(255,255,255,.3)'; for (let i = 0; i < 14; i++) { g.beginPath(); g.arc(-40 + (i * 37) % 80, -120 + (i * 23) % 50, 4, 0, TAU); g.fill(); } }),
  nagahead: (o, sd) => sprite('naga', 280, 400, 140, 380, g => { shadow(g, 110, .45); block(g, -90, -44, 180, 44, [34, 30, 58]); const scale = (x0, y0, x1, y1) => { const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, '#f6e08a'); gr.addColorStop(.45, '#c8a038'); gr.addColorStop(1, '#5a6a24'); return gr; }; g.fillStyle = scale(-40, -300, 40, -40); g.beginPath(); g.moveTo(-36, -44); g.quadraticCurveTo(-50, -150, -10, -210); g.lineTo(26, -210); g.quadraticCurveTo(-6, -150, 36, -44); g.fill(); for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + (i - 3) * .32, x = Math.cos(a) * 92, y = -214 + Math.sin(a) * 92 * .9; g.fillStyle = scale(x - 20, y - 30, x + 20, y + 30); g.beginPath(); g.moveTo(x * .3, -200); g.quadraticCurveTo(x * .7, y + 40, x, y); g.lineTo(x * .3 + 10, -196); g.fill(); g.save(); g.translate(x, y); g.rotate(a + Math.PI / 2); g.beginPath(); g.ellipse(0, 0, 17, 26, 0, 0, TAU); g.fill(); g.fillStyle = '#e8443a'; g.beginPath(); g.arc(-7, -2, 3, 0, TAU); g.arc(7, -2, 3, 0, TAU); g.fill(); g.fillStyle = '#f6e08a'; g.beginPath(); g.moveTo(-10, -20); g.lineTo(0, -40); g.lineTo(10, -20); g.fill(); g.restore(); } g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.ellipse(-30, -130, 10, 50, .2, 0, TAU); g.fill(); }),
  spirit: (o, sd) => sprite('sph', 160, 360, 80, 340, g => { shadow(g, 50, .4); g.fillStyle = '#d8ccb8'; g.fillRect(-10, -170, 20, 170); block(g, -46, -186, 92, 16, [40, 30, 70]); g.fillStyle = '#c03a2a'; g.fillRect(-40, -258, 80, 72); g.fillStyle = '#e2b04a'; g.fillRect(-40, -258, 80, 6); g.fillRect(-14, -240, 28, 54); g.fillStyle = '#4a1a10'; g.fillRect(-10, -232, 20, 46); g.fillStyle = '#e2b04a'; g.beginPath(); g.moveTo(-58, -256); g.lineTo(0, -320); g.lineTo(58, -256); g.closePath(); g.fill(); g.fillStyle = '#c03a2a'; g.beginPath(); g.moveTo(-40, -262); g.lineTo(0, -306); g.lineTo(40, -262); g.closePath(); g.fill(); g.strokeStyle = '#e2b04a'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, -320); g.lineTo(0, -340); g.stroke(); for (const c of ['#f4c430', '#e8508a', '#fff4e8']) { g.strokeStyle = c; g.lineWidth = 4; g.beginPath(); g.moveTo(-30 + Math.random() * 10, -186); g.quadraticCurveTo(0, -150 + Math.random() * 10, 30, -186); g.stroke(); } }),
};

// ---------- lights (animated every frame) ----------
const flick = (L, sp = 7) => .82 + .1 * Math.sin(E.time * sp + L.ph) + .06 * Math.sin(E.time * sp * 2.3 + L.ph * 3);
function glow(ctx, x, y, r, col, a) { if (a <= 0) return; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, a); ctx.drawImage(dot(col), x - r, y - r, 2 * r, 2 * r); ctx.restore(); }
function flame(ctx, x, y, w, h, cols, a, ph) {
  const s = 1 + .1 * Math.sin(E.time * 13 + ph) + .06 * Math.sin(E.time * 21 + ph * 2);
  if (IMG.fx_aura_flame) { fx(ctx, 'fx_aura_flame', cols[0], x, y - h * s * .45, w, h * s, a, Math.sin(E.time * 3 + ph) * .05); fx(ctx, 'fx_aura_flame', cols[1], x, y - h * .32 * s, w * .6, h * .66 * s, a, 0); return; }
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (const [k, c] of [[1, cols[0]], [.6, cols[1]]]) { ctx.fillStyle = c; ctx.globalAlpha = a * .8; ctx.beginPath(); ctx.moveTo(x - w * .3 * k, y); ctx.quadraticCurveTo(x - w * .35 * k, y - h * .5 * k, x, y - h * k * s); ctx.quadraticCurveTo(x + w * .35 * k, y - h * .5 * k, x + w * .3 * k, y); ctx.fill(); } ctx.restore();
}
const LIGHTS = {
  lantern(L) {
    const ctx = E.ctx, s = L.s || 1, f = flick(L, 4), [r, gg, b] = L.c || [226, 58, 40];
    put(ctx, sprite('lpost', 100, 214, 30, 200, g => { shadow(g, 28, .45); g.fillStyle = '#3b2b20'; g.fillRect(-5, -180, 10, 180); g.fillRect(-5, -180, 52, 8); g.fillStyle = 'rgba(255,230,190,.15)'; g.fillRect(-5, -180, 3, 180); g.fillStyle = '#2a1e16'; g.fillRect(-10, -14, 20, 14); }), L.x, L.y, s);
    const hx = L.x + 40 * s, hy = L.y - 172 * s; ctx.save(); ctx.translate(hx, hy); ctx.rotate(Math.sin(E.time * 1.4 + L.ph) * .07); ctx.scale(s, s);
    ctx.strokeStyle = '#2a1e16'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 12); ctx.stroke();
    const gr = ctx.createRadialGradient(-4, 30, 2, 0, 32, 22); gr.addColorStop(0, `rgb(255,${200 + 40 * f | 0},150)`); gr.addColorStop(.55, `rgb(${r},${gg},${b})`); gr.addColorStop(1, `rgb(${r * .45 | 0},${gg * .4 | 0},${b * .4 | 0})`);
    ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(0, 32, 17, 20, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(${r * .4 | 0},${gg * .3 | 0},${b * .3 | 0},.6)`; ctx.lineWidth = 1.2; for (const k of [.55, .2]) { ctx.beginPath(); ctx.ellipse(0, 32, 17 * k, 20, 0, 0, TAU); ctx.stroke(); }
    ctx.fillStyle = '#d8a43c'; ctx.fillRect(-8, 10, 16, 4); ctx.fillRect(-8, 51, 16, 4); ctx.strokeStyle = L.tassel || '#d23a2a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 55); ctx.lineTo(0, 72); ctx.stroke();
    ctx.restore(); glow(ctx, hx, hy + 32 * s, 80 * s, L.glow || '#ff7040', f);
  },
  brazier(L) {
    const ctx = E.ctx, s = L.s || 1, f = flick(L, 9);
    put(ctx, sprite('braz', 150, 170, 75, 158, g => { shadow(g, 56, .5); g.strokeStyle = '#2a201c'; g.lineWidth = 7; for (const x of [-34, 0, 34]) { g.beginPath(); g.moveTo(x * .6, -54); g.lineTo(x, 0); g.stroke(); } const gr = g.createLinearGradient(-50, 0, 50, 0); gr.addColorStop(0, '#5a4a3e'); gr.addColorStop(.35, '#8a7260'); gr.addColorStop(1, '#2a201a'); g.fillStyle = gr; g.beginPath(); g.ellipse(0, -60, 50, 28, 0, 0, Math.PI); g.fill(); g.fillStyle = '#3a2c22'; g.beginPath(); g.ellipse(0, -60, 50, 11, 0, 0, TAU); g.fill(); g.fillStyle = '#7a2a0a'; g.beginPath(); g.ellipse(0, -60, 42, 8, 0, 0, TAU); g.fill(); }), L.x, L.y, s);
    const by = L.y - 62 * s; glow(ctx, L.x, by, 40 * s, '#ff5a10', .9); flame(ctx, L.x, by, 90 * s, 120 * s, L.cols || ['#ff5a14', '#ffc040'], .95 * f, L.ph); glow(ctx, L.x, by - 30 * s, 130 * s, L.glow || '#ff7a24', .8 * f);
  },
  torch(L) { const ctx = E.ctx, s = L.s || 1, f = flick(L, 10); put(ctx, sprite('torch', 60, 220, 30, 208, g => { shadow(g, 20, .4); g.fillStyle = '#4a3424'; g.fillRect(-4, -180, 8, 180); g.fillStyle = '#2a1e16'; g.beginPath(); g.moveTo(-12, -186); g.lineTo(12, -186); g.lineTo(6, -166); g.lineTo(-6, -166); g.fill(); }), L.x, L.y, s); flame(ctx, L.x, L.y - 184 * s, 50 * s, 70 * s, ['#ff6a1a', '#ffd060'], f, L.ph); glow(ctx, L.x, L.y - 200 * s, 90 * s, '#ff8a30', .8 * f); },
  stonelamp(L) {
    const ctx = E.ctx, s = L.s || 1, f = flick(L, 5), st = L.st || [36, 10, 60];
    put(ctx, sprite('slamp' + st.join(), 130, 230, 65, 214, g => { shadow(g, 46, .45); block(g, -34, -24, 68, 24, st); block(g, -12, -100, 24, 76, st); block(g, -30, -112, 60, 14, st); block(g, -24, -168, 48, 56, st); g.fillStyle = '#1a120c'; g.fillRect(-13, -158, 26, 34); g.fillStyle = hsl(st[0], st[1], st[2] - 10); g.beginPath(); g.moveTo(-48, -164); g.quadraticCurveTo(-20, -172, 0, -198); g.quadraticCurveTo(20, -172, 48, -164); g.closePath(); g.fill(); g.fillStyle = hsl(st[0], st[1], st[2] + 8); g.beginPath(); g.arc(0, -202, 7, 0, TAU); g.fill(); }), L.x, L.y, s);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = f; ctx.fillStyle = L.win || '#ffb24a'; ctx.fillRect(L.x - 13 * s, L.y - 158 * s, 26 * s, 34 * s); ctx.restore(); glow(ctx, L.x, L.y - 142 * s, 70 * s, L.glow || '#ffa040', f * .9);
  },
  floatlamp(L) {
    const ctx = E.ctx, s = L.s || 1, f = flick(L, 6), x = L.x + Math.sin(E.time * .4 + L.ph) * 8, y = L.y + Math.sin(E.time * 1.6 + L.ph) * 2;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; const gr = ctx.createLinearGradient(x, y, x, y + 70 * s); gr.addColorStop(0, `rgba(255,190,110,${.4 * f})`); gr.addColorStop(1, 'rgba(255,190,110,0)'); ctx.fillStyle = gr; ctx.fillRect(x - 5 * s, y, 10 * s, 70 * s); ctx.restore();
    put(ctx, sprite('flamp', 90, 80, 45, 56, g => { g.fillStyle = 'rgba(10,30,30,.3)'; g.beginPath(); g.ellipse(0, 4, 34, 9, 0, 0, TAU); g.fill(); g.fillStyle = '#3e7a3a'; g.beginPath(); g.ellipse(0, 0, 32, 9, 0, 0, TAU); g.fill(); const R = mulberry(5); for (let k = 0; k < 8; k++) { const a = Math.PI + k / 7 * Math.PI; g.save(); g.translate(Math.cos(a) * 16, -6 + Math.sin(a) * 4); g.rotate(a + Math.PI / 2); g.fillStyle = k % 2 ? '#f49ab8' : '#fbd0de'; g.beginPath(); g.ellipse(0, -10, 7, 14, 0, 0, TAU); g.fill(); g.restore(); } g.fillStyle = '#f2e6c8'; g.fillRect(-5, -24, 10, 16); R(); }), x, y, s);
    flame(ctx, x, y - 22 * s, 20 * s, 26 * s, ['#ff8a30', '#fff0a0'], f, L.ph); glow(ctx, x, y - 30 * s, 60 * s, L.glow || '#ffb060', .9 * f);
  },
  shroom(L) {
    const ctx = E.ctx, s = L.s || 1, p = sprite('shr' + (L.v || ''), 200, 170, 100, 156, g => { const R = mulberry(31 + (L.v || 0)), caps = []; shadow(g, 70, .35); for (let i = 0; i < 5; i++) { const x = (i - 2) * 30 + (R() - .5) * 14, h = 40 + R() * 70, r = 16 + R() * 18; g.fillStyle = '#d8e4d0'; g.fillRect(x - 4, -h, 8, h); g.fillStyle = hsl(L.hue || 178, 70, 38); g.beginPath(); g.ellipse(x, -h, r, r * .6, 0, Math.PI, TAU); g.fill(); g.fillStyle = hsl(L.hue || 178, 80, 70); for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(x + (R() - .5) * r * 1.2, -h - R() * r * .4, 2 + R() * 2, 0, TAU); g.fill(); } caps.push([x, -h - r * .25, r]); } return caps; });
    put(ctx, p, L.x, L.y, s); const col = L.glow || '#5affe0', pu = .5 + .25 * Math.sin(E.time * 2 + L.ph); glow(ctx, L.x, L.y - 60 * s, 110 * s, col, pu * .8); for (const [cx, cy, r] of p.m) glow(ctx, L.x + cx * s, L.y + cy * s, r * 1.3 * s, col, pu);
  },
  crystal(L) {
    const ctx = E.ctx, s = L.s || 1, hue = L.hue || 150, p = sprite('cry' + hue, 160, 200, 80, 186, g => { const R = mulberry(17 + hue); shadow(g, 56, .35); for (let i = 0; i < 5; i++) { const x = (i - 2) * 18, h = 60 + R() * 90 - Math.abs(i - 2) * 20, w = 12 + R() * 6, a = (i - 2) * .14; g.save(); g.translate(x, 0); g.rotate(a); g.beginPath(); g.moveTo(-w, 0); g.lineTo(-w, -h); g.lineTo(0, -h - w * 1.4); g.lineTo(w, -h); g.lineTo(w, 0); g.closePath(); const gr = g.createLinearGradient(-w, 0, w, 0); gr.addColorStop(0, hsl(hue, 70, 72)); gr.addColorStop(.5, hsl(hue, 70, 48)); gr.addColorStop(1, hsl(hue, 70, 28)); g.fillStyle = gr; g.fill(); g.strokeStyle = hsl(hue, 80, 85, .7); g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, -h - w * 1.4); g.lineTo(0, 0); g.stroke(); g.restore(); } });
    put(ctx, p, L.x, L.y, s); const pu = .55 + .3 * Math.sin(E.time * 1.7 + L.ph); glow(ctx, L.x, L.y - 70 * s, 90 * s, L.glow || '#6affc8', pu); // dot() needs a hex colour
    if (Math.sin(E.time * 3.1 + L.ph * 2) > .97) glow(ctx, L.x + Math.sin(L.ph) * 20 * s, L.y - 120 * s, 20 * s, '#ffffff', 1);
  },
  foxfire(L) { const ctx = E.ctx, s = L.s || 1, t = E.time + L.ph, x = L.x + Math.sin(t * .7) * 16, z = (80 + Math.sin(t * 1.3) * 14) * s; glow(ctx, x, L.y, 50 * s, '#3a7aff', .25); if (!fx(ctx, 'fx_foxfire', L.col || '#7fc8ff', x, L.y - z, 56 * s, 84 * s, .9, Math.sin(t * 2) * .1)) glow(ctx, x, L.y - z, 30 * s, '#bfe4ff', 1); glow(ctx, x, L.y - z, 90 * s, L.glow || '#4a9aff', .55 + .15 * Math.sin(t * 4)); },
  wisp(L) { const ctx = E.ctx, s = L.s || 1, t = E.time + L.ph, x = L.x + Math.sin(t * .5) * 30, z = (110 + Math.sin(t * .9) * 30) * s; glow(ctx, x, L.y - z, 16 * s, '#ffffff', .9); glow(ctx, x, L.y - z, 70 * s, L.glow || '#ffd66a', .5 + .2 * Math.sin(t * 3)); },
  orb(L) {
    const ctx = E.ctx, s = L.s || 1, t = E.time + L.ph, z = (178 + Math.sin(t * 1.2) * 8) * s;
    put(ctx, sprite('orbp', 110, 200, 55, 186, g => { shadow(g, 40, .35); block(g, -30, -22, 60, 22, [42, 18, 86]); const gr = g.createLinearGradient(-14, 0, 14, 0); gr.addColorStop(0, '#d8d0c0'); gr.addColorStop(.4, '#fffaf0'); gr.addColorStop(1, '#a8a090'); g.fillStyle = gr; g.fillRect(-14, -130, 28, 108); g.fillStyle = '#e2b04a'; g.fillRect(-16, -136, 32, 8); for (let k = 0; k < 6; k++) { const a = Math.PI + k / 5 * Math.PI; g.save(); g.translate(Math.cos(a) * 20, -138 + Math.sin(a) * 6); g.rotate(a + Math.PI / 2); g.fillStyle = '#f2c84a'; g.beginPath(); g.ellipse(0, -8, 6, 12, 0, 0, TAU); g.fill(); g.restore(); } }), L.x, L.y, s);
    const x = L.x, y = L.y - z; glow(ctx, x, y, 110 * s, L.glow || '#ffcf5a', .55 + .15 * Math.sin(t * 2)); const gr = ctx.createRadialGradient(x - 5 * s, y - 6 * s, 1, x, y, 15 * s); gr.addColorStop(0, '#ffffff'); gr.addColorStop(.5, '#ffe9a0'); gr.addColorStop(1, '#e2a030'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, 15 * s, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,230,150,.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y, 26 * s, 8 * s, Math.sin(t) * .3, 0, TAU); ctx.stroke();
  },
  lavafall(L) {
    const ctx = E.ctx, w = L.w || 56, h = L.h || 280, x = L.x, y = L.y, t = E.time + L.ph;
    ctx.save(); const gr = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0); gr.addColorStop(0, 'rgba(140,24,0,.85)'); gr.addColorStop(.28, '#ff6a14'); gr.addColorStop(.5, '#ffd25a'); gr.addColorStop(.72, '#ff6a14'); gr.addColorStop(1, 'rgba(140,24,0,.85)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(x - w * .32, y - h); for (let k = 0; k <= 8; k++) ctx.lineTo(x - w * (.32 + k * .022) + Math.sin(t * 3 + k) * 3, y - h + h * k / 8); for (let k = 8; k >= 0; k--) ctx.lineTo(x + w * (.32 + k * .022) + Math.sin(t * 3.4 + k) * 3, y - h + h * k / 8); ctx.fill();
    ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,240,170,.55)'; ctx.lineWidth = 3; for (let i = 0; i < 9; i++) { const yy = y - h + ((t * 140 + i * h / 9) % h), xx = x + (((i * 37) % 9) / 9 - .5) * w * .5; ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx, Math.min(y, yy + 26)); ctx.stroke(); }
    ctx.restore(); glow(ctx, x, y - 6, w * 1.8, '#ff6a20', .85 + .1 * Math.sin(t * 5)); glow(ctx, x, y - h * .5, w * 2.2, '#ff5010', .35);
  },
  glow(L) { glow(E.ctx, L.x, L.y - (L.h || 0), L.r || 60, L.col || '#ffb060', (L.a || .7) * flick(L, 3)); },
};

// ---------- ambient life ----------
const AX = 1000, AY0 = -720, AY1 = 640;
let mistC = null;
function mistImg() { if (mistC) return mistC; const c = mk(256, 128), g = c.getContext('2d'); for (let i = 0; i < 9; i++) { const x = 40 + i * 22, y = 64 + Math.sin(i * 1.7) * 14, r = 34 + (i % 3) * 10, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 128); } return (mistC = c); }
function spawnIn(where, tries = 12) { for (let i = 0; i < tries; i++) { const x = rnd(-AX, AX), y = rnd(AY0, AY1); if (!where || where(x, y)) return [x, y]; } return [rnd(-AX, AX), rnd(AY0, AY1)]; }
const AMB = {
  init(s) {
    const n = s.n || 20; s.ps = Array.from({ length: n }, () => { const [x, y] = spawnIn(s.where); return { x, y, ph: rnd(0, 9), v: rnd(.6, 1.4), r: rnd(0, TAU), vr: rnd(-2.5, 2.5), sz: rnd(s.sz?.[0] ?? 5, s.sz?.[1] ?? 10), c: s.cols ? s.cols[(Math.random() * s.cols.length) | 0] : s.col, t: rnd(0, 3) }; });
  },
  fall(ctx, s, dt) {
    for (const p of s.ps) {
      p.y += (s.vy || 40) * p.v * dt; p.x += (Math.sin(E.time * 1.3 + p.ph) * (s.sway || 30) + (s.wind || 10)) * dt; p.r += p.vr * dt;
      if (p.y > AY1) { p.y = AY0; p.x = rnd(-AX, AX); } if (p.x > AX) p.x = -AX; else if (p.x < -AX) p.x = AX;
      ctx.save(); ctx.translate(p.x, p.y); ctx.globalAlpha = s.a || .9;
      if (s.shape === 'snow') { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, p.sz * .5, 0, TAU); ctx.fill(); }
      else { ctx.rotate(p.r); ctx.scale(Math.cos(E.time * 2.4 + p.ph), 1); ctx.fillStyle = p.c; ctx.beginPath(); if (s.shape === 'petal') { ctx.ellipse(0, 0, p.sz * .6, p.sz * .45, 0, 0, TAU); } else { ctx.moveTo(-p.sz, 0); ctx.quadraticCurveTo(0, -p.sz * .55, p.sz, 0); ctx.quadraticCurveTo(0, p.sz * .55, -p.sz, 0); } ctx.fill(); }
      ctx.restore();
    }
  },
  rise(ctx, s, dt) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const p of s.ps) { p.y -= (s.vy || 60) * p.v * dt; p.x += Math.sin(E.time * 2 + p.ph) * 20 * dt; if (p.y < AY0) { p.x = spawnIn(s.where)[0]; p.y = AY1 - Math.random() * 200; } ctx.globalAlpha = (s.a || .8) * (.5 + .5 * Math.sin(E.time * 6 + p.ph * 3)); ctx.drawImage(dot(p.c), p.x - p.sz, p.y - p.sz, p.sz * 2, p.sz * 2); }
    ctx.restore();
  },
  drift(ctx, s, dt) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const p of s.ps) { const x = p.x + Math.sin(E.time * .3 * p.v + p.ph) * 60, y = p.y + Math.cos(E.time * .25 * p.v + p.ph) * 30 - (E.time * 6 * p.v) % 80; ctx.globalAlpha = (s.a || .6) * (.35 + .65 * Math.max(0, Math.sin(E.time * 1.5 * p.v + p.ph * 2))); ctx.drawImage(dot(p.c), x - p.sz, y - p.sz, p.sz * 2, p.sz * 2); }
    ctx.restore();
  },
  mist(ctx, s, dt) {
    const im = mistImg(); ctx.save();
    for (const p of s.ps) { p.x += (s.vx || 14) * p.v * dt; if (p.x > AX + 300) p.x = -AX - 300; const w = 520 * p.v * (s.k || 1), h = w * .42; ctx.globalAlpha = (s.a || .18) * (.6 + .4 * Math.sin(E.time * .4 + p.ph)); ctx.drawImage(s.tint ? tintMist(s.tint) : im, p.x - w / 2, p.y - h / 2, w, h); }
    ctx.restore();
  },
  sparkle(ctx, s, dt) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const p of s.ps) { p.t += dt * p.v; const T = s.period || 2.2; if (p.t > T) { p.t = 0; const [x, y] = spawnIn(s.where); p.x = x; p.y = y; } const k = Math.sin(p.t / T * Math.PI), r = p.sz * k * 1.6; if (k <= 0) continue; ctx.globalAlpha = k * (s.a || .9); ctx.fillStyle = p.c; ctx.beginPath(); ctx.ellipse(p.x, p.y, r * .18, r, 0, 0, TAU); ctx.ellipse(p.x, p.y, r, r * .18, 0, 0, TAU); ctx.fill(); ctx.drawImage(dot(p.c), p.x - r * .8, p.y - r * .8, r * 1.6, r * 1.6); }
    ctx.restore();
  },
  ripple(ctx, s, dt) {
    ctx.save(); ctx.lineWidth = 2;
    for (const p of s.ps) { p.t += dt * p.v * .7; if (p.t > 1.6) { p.t = 0; const [x, y] = spawnIn(s.where); p.x = x; p.y = y; } const k = p.t / 1.6, r = 4 + k * 46; ctx.strokeStyle = `rgba(235,255,250,${.42 * (1 - k)})`; ctx.beginPath(); ctx.ellipse(p.x, p.y, r, r * SQ * .7, 0, 0, TAU); ctx.stroke(); if (k > .25) { const r2 = r * .55; ctx.beginPath(); ctx.ellipse(p.x, p.y, r2, r2 * SQ * .7, 0, 0, TAU); ctx.stroke(); } }
    ctx.restore();
  },
  smoke(ctx, s, dt) {
    const im = mistImg(); ctx.save();
    for (const p of s.ps) { p.t += dt * p.v * .35; if (p.t > 1) { p.t = 0; const src = s.src[(Math.random() * s.src.length) | 0]; p.x = src[0]; p.y = src[1]; p.ph = rnd(0, 9); } const k = p.t, w = (40 + k * 160) * (s.k || 1); ctx.globalAlpha = (s.a || .22) * Math.sin(k * Math.PI); ctx.drawImage(s.tint ? tintMist(s.tint) : im, p.x + Math.sin(k * 4 + p.ph) * 30 * k - w / 2, p.y - k * 260 - w * .21, w, w * .42); }
    ctx.restore();
  },
  flies(ctx, s) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const p of s.ps) { const x = p.x + Math.sin(E.time * p.v * .8 + p.ph) * 40, y = p.y + Math.cos(E.time * p.v * .6 + p.ph) * 24 - 40; ctx.globalAlpha = .3 + .35 * Math.sin(E.time * 2 + p.ph * 3); ctx.drawImage(dot(p.c), x - 7, y - 7, 14, 14); }
    ctx.restore();
  },
  shafts(ctx, s) {
    if (!s.img) { const c = mk(128, 512), g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 128, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, s.col); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(40, 0); g.lineTo(88, 0); g.lineTo(128, 512); g.lineTo(0, 512); g.fill(); const v = g.createLinearGradient(0, 0, 0, 512); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(.25, 'rgba(0,0,0,1)'); v.addColorStop(1, 'rgba(0,0,0,.2)'); g.globalCompositeOperation = 'destination-in'; g.fillStyle = v; g.fillRect(0, 0, 128, 512); s.img = c; }
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const [x, w, a0] of s.at) { ctx.save(); ctx.translate(x, -700); ctx.rotate(-.32); ctx.globalAlpha = a0 * (s.a || .16) * (.7 + .3 * Math.sin(E.time * .5 + x)); ctx.drawImage(s.img, -w, 0, w * 2, 1300); ctx.restore(); }
    ctx.restore();
  },
};
const TM = {};
function tintMist(c) { if (TM[c]) return TM[c]; const im = mistImg(), t = mk(im.width, im.height), g = t.getContext('2d'); g.drawImage(im, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = c; g.fillRect(0, 0, t.width, t.height); return (TM[c] = t); }
function ambient(list) { const sys = list.map(a => ({ ...a })); sys.forEach(s => AMB.init(s)); let last = E.time; return ctx => { const dt = Math.min(.05, Math.max(0, E.time - last)); last = E.time; for (const s of sys) AMB[s.k](ctx, s, dt); }; }

// ---------- screen colour grade ----------
/** grade layers are pre-composited per screen size: one opaque multiply layer, one source-over layer and one
 *  additive layer (the additive one flickers via globalAlpha), so a frame costs at most three blits */
function grade(G) {
  let key = '', L = null;
  const grad = (c, W, H, edge, rgb, a, frac) => { const v = edge === 't' || edge === 'b', len = (v ? H : W) * frac, g = edge === 't' ? c.createLinearGradient(0, 0, 0, len) : edge === 'b' ? c.createLinearGradient(0, H, 0, H - len) : edge === 'l' ? c.createLinearGradient(0, 0, len, 0) : c.createLinearGradient(W, 0, W - len, 0); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`); return g; };
  const build = (W, H) => {
    const layer = (mode, base) => { const c = mk(Math.max(1, W), Math.max(1, H)), x = c.getContext('2d'); if (base) { x.fillStyle = base; x.fillRect(0, 0, W, H); } let used = !!base; if (mode === 'multiply' && G.mul) { x.globalCompositeOperation = 'multiply'; x.fillStyle = G.mul; x.fillRect(0, 0, W, H); }
      for (const [edge, rgb, a, frac, m] of G.bands || []) if ((m || 'source-over') === mode) { x.globalCompositeOperation = mode; x.fillStyle = grad(x, W, H, edge, rgb, a, frac); x.fillRect(0, 0, W, H); used = true; }
      for (const [gx, gy, r, rgb, a, m] of G.glows || []) if ((m || 'lighter') === mode) { const R = Math.max(W, H) * r, g = x.createRadialGradient(W * gx, H * gy, 0, W * gx, H * gy, R); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`); x.globalCompositeOperation = mode; x.fillStyle = g; x.fillRect(0, 0, W, H); used = true; }
      return used || (mode === 'multiply' && G.mul) ? c : null; };
    L = { mul: G.mul || (G.bands || []).some(b => b[4] === 'multiply') ? layer('multiply', '#ffffff') : null, over: layer('source-over'), add: layer('lighter') };
  };
  return (ctx, W, H) => {
    const k = W + 'x' + H; if (k !== key) { build(W, H); key = k; }
    ctx.save();
    if (L.mul) { ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(L.mul, 0, 0, W, H); }
    if (L.over) { ctx.globalCompositeOperation = 'source-over'; ctx.drawImage(L.over, 0, 0, W, H); }
    if (L.add) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = G.flick ? Math.max(0, 1 + G.flick * Math.sin(E.time * 6.3) * Math.sin(E.time * 2.1 + 1)) : 1; ctx.drawImage(L.add, 0, 0, W, H); }
    ctx.restore();
  };
}

// ---------- the locations ----------
const P2 = THEMES['2'], P3 = THEMES['3'];
const pal = (base, o) => Object.assign({}, THEMES[base], o);
/** stream shared by the ground painter and the ripple/sparkle "where" tests */
let WATER = null;
const wet = (x, y) => !!WATER && WATER(x, y);

const LOCS = {
  // 1-2 ลำธารเปียกปอน — a clear stream runs right through the arena; everyone fights in the shallows
  stream: {
    pal: '1', seed: 12,
    ground(g, R) {
      fillBase(g, R, ['#5f8442', '#507436', '#3c5a2a'], [80, 30, 30, 32]); blades(g, R, 14000, [78, 34, 35, 26, 30], 11);
      flowers(g, R, 300, ['#f6f2e6', '#b3a6f4', '#f4d56e'], '#e9b23a', null, 1.1, 2.4);
      const river = riverPts(R, [[1700, -1150], [760, -560], [0, 0], [-760, 560], [-1700, 1150]], 330, .18), isle = orient(ellPts(PR + 30, (PR + 30) * SQ)), S = [river, isle];
      WATER = inShapes(S);
      water(g, R, S, { bank: ['#6a5a3e', '#8f8460'], bed: '#b8a27a', pebbles: [9000, ['#8a8478', '#a29a88', '#6e6a62', '#c4b494', '#7a6a58']], deep: 'rgba(30,110,140,.55)', shallow: 'rgba(80,175,185,.38)', caustic: 'rgba(255,255,240,.10)', glints: 2600 });
      useTheme('1'); for (const [x, y, r] of [[-150, -80, 30], [70, 40, 26], [-320, 120, 28], [270, -150, 30], [400, 70, 24], [-440, -60, 26], [150, 200, 28], [-80, -230, 24], [-200, 260, 22], [330, -260, 22]]) { stone(g, x, y * SQ, r, R); g.fillStyle = 'rgba(255,255,255,.16)'; g.beginPath(); g.ellipse(x - r * .3, y * SQ - r * .2, r * .5, r * .18, 0, 0, TAU); g.fill(); }
    },
    props: [['willow', -640, -390, 1.05], ['reeds', -400, -440, .9], ['rock', -800, -140, .8, { moss: 1 }], ['tree', -860, 180, 1, {}], ['reeds', -560, 330, .8], ['willow', 760, 370, 1], ['reeds', 470, 470, .9], ['rock', 820, 100, .85, { moss: 1 }], ['tree', 880, -260, 1.05, {}], ['rock', 560, -470, .5, { n: 2 }], ['rock', -600, 470, .55, { n: 2 }], ['reeds', 120, -520, .8], ['reeds', -150, 540, .8]],
    lights: [[null, -560, -230], [null, 600, 260], [null, -820, 40], [null, 820, -60]],
    amb: [{ k: 'ripple', n: 12, where: wet }, { k: 'sparkle', n: 18, cols: ['#ffffff', '#c8fff4'], sz: [5, 9], where: wet }, { k: 'flies', n: 14, col: '#fff0a8' }, { k: 'fall', n: 10, cols: ['#8ab84a', '#a8c860', '#6a9a3a'], sz: [5, 8], vy: 30 }],
    grade: { glows: [[.85, -.05, .6, '255,244,210', .16]] },
  },
  // 1-3 รังรากไม้ — the heart tree's nest: giant roots, deep shade, glowing mushrooms
  rootnest: {
    pal: pal('1', { stone: [30, 10, 8, 10, 40, 10] }), seed: 13,
    ground(g, R) {
      fillBase(g, R, ['#3e4a28', '#33401f', '#232c16'], [70, 40, 28, 24], 2600); blades(g, R, 9000, [80, 40, 30, 18, 24], 7);
      litter(g, R, 3200, ['#7a5a2a', '#8a6a30', '#5a4a22', '#6a3a1e', '#9a7a3a', '#4a5a22'], outside(-30));
      disc(g, '#5a4832'); clipPlaza(g, () => { wash(g, 'rgba(150,120,80,.35)', 'rgba(30,24,14,.35)'); specks(g, R, 2600, ['#6e5a40', '#4a3a28', '#7a6648', '#3a2e20'], 2, 6, null, [-PR, -PRY, PR, PRY]); cobbles(g, R, this.pal, .78); litter(g, R, 500, ['#7a5a2a', '#8a6a30', '#5a4a22'], null, [4, 7]); });
      rimTufts(g, R, [88, 30, 22, 18], 1000);
      const bark = [26, 30, 26]; for (const [x0, y0, x1, y1, w] of [[0, -560, -620, -150, 46], [0, -560, 640, -120, 44], [-60, -540, -330, -300, 30], [60, -540, 330, -290, 30], [-470, -520, -900, 40, 34], [500, -520, 940, 80, 34], [-1300, 200, -560, 300, 40], [1300, 260, 600, 330, 40], [-900, 900, -380, 420, 34], [900, 900, 420, 430, 34], [-560, -500, -200, -380, 22], [520, -500, 200, -390, 22]]) root(g, R, x0, y0, x1, y1, w, bark);
    },
    props: [['bigtrunk', 0, -470, 1.15, { moss: 1, w: 150, top: [100, 35, 22] }], ['bigtrunk', -470, -430, .9, { moss: 1, top: [96, 35, 24] }], ['bigtrunk', 500, -440, 1, { moss: 1, top: [104, 35, 22] }], ['bigtrunk', -880, -330, 1.05, { moss: 1, top: [100, 35, 22] }], ['bigtrunk', 900, -300, .95, { moss: 1, top: [100, 35, 22] }],
      ['fern', -680, -150, 1], ['fern', 700, -100, 1.05], ['fern', -260, -440, .75], ['fern', 270, -450, .75], ['rock', -780, 210, .8, { moss: 1, col: [80, 10, 34] }], ['rock', 790, 250, .8, { moss: 1, col: [80, 10, 34] }], ['fern', -700, 430, 1.1], ['fern', 730, 450, 1.1], ['fern', -200, 500, .7], ['fern', 220, 510, .7]],
    lights: [['shroom', -600, -250], ['shroom', 640, -230, { v: 1 }], ['shroom', -180, -420, { s: .75, v: 2 }], ['shroom', 170, -430, { s: .75, v: 3 }], ['shroom', -640, 330, { v: 4 }], ['shroom', 660, 330, { v: 5 }], ['shroom', 0, 500, { s: .8, v: 6, hue: 160 }]].map(l => (l[3] = { pool: [80, 255, 220], ...(l[3] || {}) }, l)),
    amb: [{ k: 'shafts', at: [[-500, 120, 1], [-40, 90, .8], [460, 140, 1.1]], col: 'rgb(220,255,170)', a: .2 }, { k: 'flies', n: 24, col: '#d8ff8a' }, { k: 'fall', n: 14, cols: ['#8a7a3a', '#6a5a2a', '#9a8a3a'], sz: [5, 8], vy: 26 }, { k: 'drift', n: 18, col: '#c8ffe0', sz: [4, 7], a: .5 }],
    grade: { mul: '#d8e4cc', bands: [['t', '16,34,14', .55, .5, 'multiply'], ['l', '10,24,10', .3, .25, 'multiply'], ['r', '10,24,10', .3, .25, 'multiply']] },
  },
  // 2-1 ป่าตะเคียนทอง — tall sacred takhian trunks wrapped in cloth sashes, golden leaf fall
  goldforest: {
    pal: pal('2', { stone: [28, 14, 26, 12, 50, 12] }), seed: 21,
    ground(g, R) {
      fillBase(g, R, ['#56602e', '#485426', '#2e3616'], [62, 24, 32, 26], 2400); blades(g, R, 9000, [70, 30, 34, 22, 24], 9);
      litter(g, R, 3600, ['#e8b830', '#d89a20', '#f0d060', '#c87a18', '#a86a18', '#8a7a2a'], outside(-20), [5, 9]);
      disc(g, '#7a6440'); clipPlaza(g, () => { wash(g, 'rgba(240,200,120,.28)', 'rgba(40,30,10,.3)'); cobbles(g, R, this.pal, .5); litter(g, R, 700, ['#e8b830', '#d89a20', '#f0d060', '#c87a18'], null, [4, 8]); });
      rimTufts(g, R, [56, 24, 34, 26], 900);
      const bark = [30, 18, 44]; for (const [x0, y0, x1, y1, w] of [[-120, -470, -520, -210, 26], [380, -460, 700, -160, 26], [-560, -440, -880, 60, 28], [-900, 200, -540, 320, 24], [900, 160, 560, 300, 24]]) root(g, R, x0, y0, x1, y1, w, bark);
    },
    props: [['bigtrunk', -120, -405, 1, { sash: 1, bark: '#8a7860', w: 104, top: [52, 60, 40] }], ['bigtrunk', 380, -400, .9, { bark: '#7e6c56', w: 96, top: [48, 60, 38] }], ['bigtrunk', -560, -380, 1, { sash: 1, bark: '#86735c', w: 100, top: [50, 60, 40] }], ['bigtrunk', 900, -330, 1, { bark: '#7a6a54', top: [48, 60, 40] }], ['bigtrunk', -920, -260, .95, { bark: '#7a6a54', top: [50, 60, 40] }],
      ['spirit', -720, 300, 1], ['fern', -700, -60, .9, { leaf: [70, 40, 34] }], ['fern', 720, -40, .95, { leaf: [70, 40, 34] }], ['rock', 760, 300, .75, { moss: 1, col: [36, 14, 44] }], ['fern', 700, 460, 1, { leaf: [66, 40, 34] }], ['fern', -260, -470, .7, { leaf: [66, 40, 34] }], ['fern', 160, -480, .7, { leaf: [66, 40, 34] }], ['fern', -40, 520, .7, { leaf: [66, 40, 34] }]],
    lights: [['wisp', -600, -200], ['wisp', 620, -180], ['wisp', -250, -400], ['wisp', 260, -420], ['wisp', -600, 260], ['wisp', 620, 300], ['wisp', 0, 480]].map(l => (l[3] = { noPool: 1 }, l)),
    amb: [{ k: 'shafts', at: [[-620, 140, 1], [-100, 110, .9], [420, 150, 1.1]], col: 'rgb(255,220,120)', a: .16 }, { k: 'fall', n: 24, cols: ['#e8b830', '#d89a20', '#f0d060', '#c87a18'], sz: [6, 10], vy: 34 }, { k: 'drift', n: 22, col: '#ffe08a', sz: [4, 7], a: .55 }],
    grade: { bands: [['t', '30,40,10', .4, .4, 'multiply'], ['b', '40,30,10', .25, .3, 'multiply']], glows: [[.2, -.05, .55, '255,214,120', .16]] },
  },
  // 2-2 ทุ่งควายธนู — golden rice paddies at sunset, threshing ground, sugar palms & haystacks
  ricefield: {
    pal: P2, seed: 22,
    ground(g, R) {
      fillBase(g, R, ['#5e7034', '#526430', '#3c4a22'], [80, 20, 34, 30], 1200); blades(g, R, 9000, [80, 30, 40, 24, 24], 9);
      const cw = 360, ch = 220, dk = 26, field = (ripe, sd) => { const c = mk(cw - dk, ch - dk), f = c.getContext('2d'), Q = mulberry(sd), w = c.width, h = c.height; const wg = f.createLinearGradient(0, 0, 0, h); wg.addColorStop(0, '#86aab0'); wg.addColorStop(1, '#5e8a90'); f.fillStyle = wg; f.fillRect(0, 0, w, h); f.lineCap = 'round';
        for (let ry = 18; ry < h; ry += 17) { f.fillStyle = 'rgba(20,40,40,.3)'; f.fillRect(0, ry + 1, w, 3); for (let rx = 4 + Q() * 4; rx < w - 2; rx += 11 + Q() * 4) { const L = ripe ? 50 + Q() * 18 : 34 + Q() * 14, hu = ripe ? 44 + Q() * 9 : 84 + Q() * 16, len = 15 + Q() * 8; for (let k = 0; k < 4; k++) { f.strokeStyle = hsl(hu + (Q() - .5) * 6, ripe ? 75 : 55, L + (k === 3 ? 12 : 0), .95); f.lineWidth = 1.7; f.beginPath(); f.moveTo(rx, ry); f.quadraticCurveTo(rx + (k - 1.5) * 3, ry - len * .5, rx + (k - 1.5) * 5 + (ripe ? 4 : 1), ry - len); f.stroke(); } } }
        f.fillStyle = 'rgba(255,250,230,.16)'; f.fillRect(0, 0, w, 3); f.fillStyle = 'rgba(0,0,0,.25)'; f.fillRect(0, h - 3, w, 3); return c; }, FV = [field(true, 1), field(true, 2), field(true, 3), field(false, 4)];
      for (let gy = -GOY - 40, row = 0; gy < GOY; gy += ch, row++) for (let gx = -GOX - (row % 2) * 140; gx < GOX; gx += cw) {
        g.fillStyle = 'rgba(20,30,10,.35)'; g.fillRect(gx + dk / 2 - 2, gy + dk / 2 + 2, cw - dk + 4, ch - dk + 4); g.drawImage(FV[R() < .8 ? (R() * 3) | 0 : 3], gx + dk / 2, gy + dk / 2);
      }
      g.fillStyle = 'rgba(20,16,8,.35)'; g.beginPath(); g.ellipse(0, 14, PR + 60, (PR + 60) * SQ, 0, 0, TAU); g.fill(); g.fillStyle = '#7a6638'; g.beginPath(); g.ellipse(0, 0, PR + 52, (PR + 52) * SQ, 0, 0, TAU); g.fill();
      rimTufts(g, R, [62, 26, 34, 24], 1100);
      disc(g, '#b89a68', 0, .2); clipPlaza(g, () => { wash(g, 'rgba(255,230,170,.3)', 'rgba(90,60,30,.3)'); specks(g, R, 1800, ['#a88a5a', '#c8aa78', '#8a7048'], 2, 5, null, [-PR, -PRY, PR, PRY]); g.lineCap = 'round'; for (let i = 0; i < 2200; i++) { const a = R() * TAU, d = Math.sqrt(R()) * PR, x = Math.cos(a) * d, y = Math.sin(a) * d * SQ, l = 6 + R() * 14, b = R() * TAU; g.strokeStyle = hsl(44 + R() * 10, 65, 50 + R() * 22, .8); g.lineWidth = 1.4; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(b) * l, y + Math.sin(b) * l * SQ); g.stroke(); } });
    },
    props: [['palm', -820, -340, 1.1], ['palm', -540, -440, .9], ['palm', 620, -420, 1.05], ['palm', 900, -260, .95], ['palm', 230, -480, .85], ['sala', -260, -470, .8], ['hay', -720, 150, 1], ['hay', 770, 210, 1.1], ['hay', -790, -60, .75], ['hay', 680, -120, .8], ['hay', 180, 500, .6], ['hay', -330, 520, .55], ['palm', -900, 380, 1], ['palm', 880, 440, .9]],
    lights: [],
    amb: [{ k: 'drift', n: 34, cols: ['#ffd88a', '#fff0c0'], sz: [3, 6], a: .55 }, { k: 'fall', n: 8, cols: ['#e8c060', '#d8a840'], sz: [3, 5], vy: 20, wind: 30 }],
    grade: { bands: [['t', '255,150,60', .16, .5, 'lighter'], ['b', '90,40,90', .24, .4, 'multiply']], glows: [[.88, -.08, .7, '255,180,90', .22]] },
  },
  // 2-3 หมู่บ้านหุ่นพยนต์ — a stilt-house village by night, lantern-lit, low mist
  village: {
    pal: pal('2', { stone: [30, 10, 10, 10, 34, 10] }), seed: 23,
    ground(g, R) {
      fillBase(g, R, ['#344038', '#2c3630', '#1e2622'], [150, 40, 18, 20], 2000); blades(g, R, 9000, [120, 40, 22, 16, 18], 9);
      g.save(); g.lineCap = 'round'; for (const [x0, y0, x1, y1] of [[0, 0, -520, -560], [0, 0, 60, -620], [0, 0, 640, -520], [0, 0, -1400, 300], [0, 0, 1400, 200]]) { g.strokeStyle = 'rgba(80,68,52,.75)'; g.lineWidth = 150; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2 + 80, (y0 + y1) / 2, x1, y1); g.stroke(); g.strokeStyle = 'rgba(100,86,66,.5)'; g.lineWidth = 90; g.stroke(); } g.restore();
      specks(g, R, 4000, ['#5a4c3a', '#3a3226', '#6a5a46'], 2, 5);
      disc(g, '#5c4e3c'); clipPlaza(g, () => { wash(g, 'rgba(160,130,90,.25)', 'rgba(20,16,10,.35)'); specks(g, R, 3000, ['#6e5e48', '#4a3e30', '#7a6a52'], 2, 6, null, [-PR, -PRY, PR, PRY]); g.strokeStyle = 'rgba(30,24,16,.35)'; g.lineWidth = 6; for (const dx of [-30, 30]) { g.beginPath(); g.moveTo(-PR, 120 + dx); g.quadraticCurveTo(0, 40 + dx, PR, -80 + dx); g.stroke(); } });
      useTheme(this.pal); for (let i = 0; i < 64; i++) { const a = i / 64 * TAU; stone(g, Math.cos(a) * (PR + 6), Math.sin(a) * (PR + 6) * SQ, 15 + R() * 6, R); }
    },
    props: [['house', -560, -390, 1, { night: 1 }], ['house', 40, -420, 1.05, { night: 1 }], ['house', 640, -380, .95, { night: 1 }], ['banana', -860, -230, 1, { night: 1 }], ['banana', 870, -170, 1, { night: 1 }], ['banana', -290, -470, .75, { night: 1 }], ['jar', -700, 120, 1], ['jar', -650, 160, .8], ['jar', 720, 190, 1], ['fence', -780, 360, 1], ['fence', 780, 410, 1], ['hay', 840, 20, .75], ['banana', -800, 470, 1, { night: 1 }], ['jar', 160, 520, .8], ['jar', -200, 530, .7]],
    lights: [['lantern', -400, -270, { c: [236, 150, 60], glow: '#ffa040', tassel: '#e8b030', pool: [255, 170, 90] }], ['lantern', 380, -290, { c: [236, 150, 60], glow: '#ffa040', tassel: '#e8b030', pool: [255, 170, 90] }], ['lantern', -620, 290, { c: [236, 150, 60], glow: '#ffa040', tassel: '#e8b030', pool: [255, 170, 90] }], ['lantern', 600, 300, { c: [236, 150, 60], glow: '#ffa040', tassel: '#e8b030', pool: [255, 170, 90] }],
      ['glow', -622, -388, { h: 172, r: 80, col: '#ffb060', noPool: 1 }], ['glow', -25, -418, { h: 181, r: 84, col: '#ffb060', noPool: 1 }], ['glow', 581, -378, { h: 164, r: 76, col: '#ffb060', noPool: 1 }]],
    amb: [{ k: 'mist', n: 7, a: .16, vx: 10, tint: '#b8c8e8' }, { k: 'flies', n: 26, col: '#ffd890' }],
    grade: { mul: '#a2aedc', bands: [['t', '8,12,40', .5, .45, 'multiply']], glows: [[.12, .02, .45, '170,190,255', .2]] },
  },
  // 2-4 วิมานกินรี — a teak dais floating on a lotus lake, lotus lamps drifting on the water
  kinnari: {
    pal: P2, seed: 24,
    ground(g, R) {
      fillBase(g, R, ['#5a8048', '#4a7040', '#36542e'], [100, 30, 30, 30]); blades(g, R, 8000, [90, 30, 36, 26, 26], 10);
      const lake = blobPts(R, 0, -20, PR * 1.95, PR * 1.95 * SQ, .08); WATER = (x, y) => pip(lake, x, y) && er(x, y) > PR + 30;
      water(g, R, [lake], { bank: ['#5a5034', '#7a7a4e'], bed: '#2e5a52', deep: 'rgba(30,90,100,.65)', shallow: 'rgba(80,160,150,.5)', glints: 2400 });
      pads(g, R, 900, WATER, { flower: .28 });
      disc(g, '#8a5a3a', 6, .45); clipPlaza(g, () => { const R2 = mulberry(7); for (let x = -PR; x < PR; x += 34) { const L = 36 + R2() * 8; g.fillStyle = hsl(24, 42, L); g.fillRect(x + 1, -PRY, 32, PRY * 2); g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(x + 32, -PRY, 2, PRY * 2); g.strokeStyle = 'rgba(40,20,8,.18)'; g.lineWidth = 1; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(x + 6 + k * 7, -PRY); g.lineTo(x + 6 + k * 7 + (R2() - .5) * 6, PRY); g.stroke(); } for (let y = -PRY + R2() * 120; y < PRY; y += 140 + R2() * 80) { g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x + 1, y, 32, 2); g.fillStyle = '#c8a050'; g.beginPath(); g.arc(x + 8, y + 6, 2, 0, TAU); g.arc(x + 26, y + 6, 2, 0, TAU); g.fill(); } } wash(g, 'rgba(255,220,170,.18)', 'rgba(40,20,8,.25)'); });
      inlay(g, { band: '#e2b04a', edge: '#7a3a18', rose: '#e2b04a', rose2: '#c8402a', r: .7, petals: 8, rr: 70 });
      curb(g, R, [40, 60, 52], { lip: 18, w: 16, band: '#c8402a' });
    },
    props: [['pillar', -500, -300, .95, { col: [2, 62, 40], v: 'k' }], ['pillar', 500, -300, .95, { col: [2, 62, 40], v: 'k' }], ['pillar', -580, 160, .95, { col: [2, 62, 40], v: 'k' }], ['pillar', 580, 160, .95, { col: [2, 62, 40], v: 'k' }],
      ['lotus', -740, -200, 1.1], ['lotus', 770, -120, 1.1], ['lotus', -250, -460, .9], ['lotus', 300, -470, .85], ['lotus', -720, 390, 1], ['lotus', 740, 420, 1.05], ['lotus', 30, 500, .7], ['lotus', -380, 480, .65], ['chedi', 0, -520, .7, { v: 'g', white: [44, 50, 70] }]],
    lights: [['floatlamp', -660, -30], ['floatlamp', 690, 40], ['floatlamp', -430, -430], ['floatlamp', 440, -420], ['floatlamp', -520, 410], ['floatlamp', 540, 430], ['floatlamp', 170, 470], ['floatlamp', -130, -470]].map(l => (l[3] = { pool: [255, 190, 120] }, l)),
    amb: [{ k: 'fall', n: 16, cols: ['#f7b3c8', '#fff0f4', '#f49ab8'], shape: 'petal', sz: [5, 8], vy: 26, wind: 14 }, { k: 'sparkle', n: 22, cols: ['#ffffff', '#ffe8a0'], sz: [5, 9], where: wet }, { k: 'ripple', n: 8, where: wet }],
    grade: { bands: [['t', '255,190,220', .14, .4, 'lighter']], glows: [[.5, -.1, .7, '255,210,225', .18]] },
  },
  // 2-5 ลานคชสีห์ — sandstone temple court under laterite prangs, incense haze
  temple: {
    pal: P2, seed: 25,
    ground(g, R) {
      fillBase(g, R, ['#8e8640', '#7c7232', '#58501f'], [44, 22, 32, 36]); blades(g, R, 12000, [46, 26, 40, 28, 26], 10);
      g.save(); g.beginPath(); g.ellipse(0, 0, PR * 1.5, PR * 1.5 * SQ, 0, 0, TAU); g.clip(); tiles(g, R, { col: [16, 40, 36], lv: 6, tw: 110, td: 110, grout: 'rgba(40,24,12,.9)', box: [-PR * 1.6, -PR * 1.6, PR * 1.6, PR * 1.6], moss: .2, crack: .14 }); g.restore();
      g.strokeStyle = 'rgba(30,20,10,.4)'; g.lineWidth = 8; g.beginPath(); g.ellipse(0, 0, PR * 1.5, PR * 1.5 * SQ, 0, 0, TAU); g.stroke();
      blades(g, R, 2400, [60, 30, 34, 22, 30], 9, (x, y) => Math.abs(er(x, y) - PR * 1.5) < 30);
      disc(g, '#b89a6a', 6, .45); clipPlaza(g, () => { tiles(g, R, { col: [36, 32, 58], lv: 5, tw: 92, td: 92, grout: 'rgba(80,60,36,.9)', crack: .12, moss: .06 }); wash(g, 'rgba(255,240,200,.12)', 'rgba(60,40,10,.22)'); });
      inlay(g, { band: '#9a4a2a', edge: '#5a2a14', rose: '#a8522e', rose2: '#c8743a', r: .66, petals: 8, rr: 82 });
      curb(g, R, [16, 46, 36], { lip: 20, w: 22 });
    },
    props: [['prang', 0, -420, .95], ['prang', -500, -390, .8, { v: 'b' }], ['prang', 500, -390, .8, { v: 'b' }], ['tree', -860, -200, 1.25, { leaf: [90, 40, 30], bark: '#6a5a48', v: 'b' }], ['tree', 880, -140, 1.15, { leaf: [86, 40, 32], bark: '#6a5a48', v: 'b' }], ['rock', -720, 200, .75, { col: [16, 40, 34], n: 3, v: 'l' }], ['rock', 730, 240, .75, { col: [16, 40, 34], n: 2, v: 'l' }], ['chedi', -840, 330, .8], ['chedi', 860, 360, .75], ['rock', -260, 520, .5, { col: [16, 40, 34], n: 2, v: 'l' }], ['rock', 300, 530, .5, { col: [16, 40, 34], n: 2, v: 'l' }]],
    lights: [['stonelamp', -580, -150, { st: [34, 28, 58] }], ['stonelamp', 580, -130, { st: [34, 28, 58] }], ['stonelamp', -560, 300, { st: [34, 28, 58] }], ['stonelamp', 580, 320, { st: [34, 28, 58] }]].map(l => (l[3] = { pool: [255, 200, 120], ...(l[3] || {}) }, l)),
    amb: [{ k: 'drift', n: 30, cols: ['#ffe2a0', '#fff4d0'], sz: [3, 6], a: .55 }, { k: 'smoke', n: 10, src: [[-580, -300], [580, -280], [-560, 150], [580, 170]], a: .2 }, { k: 'fall', n: 8, cols: ['#8ab04a', '#c8b040'], sz: [5, 8], vy: 24 }],
    grade: { glows: [[.12, -.1, .8, '255,210,140', .3]], bands: [['b', '70,40,10', .18, .35, 'multiply']] },
  },
  // 2-6 สระมณีนาคราช — the naga king's jewel pool at dusk: sandstone dais, naga guardians, sapphire lights
  nagapool: {
    pal: P2, seed: 26,
    ground(g, R) {
      fillBase(g, R, ['#3a5a4a', '#30503f', '#203a2e'], [150, 30, 22, 22]); blades(g, R, 8000, [140, 30, 26, 18, 22], 10);
      const lake = blobPts(R, 0, -10, PR * 2.05, PR * 2.05 * SQ, .07); WATER = (x, y) => pip(lake, x, y) && er(x, y) > PR + 30;
      water(g, R, [lake], { bank: ['#3a3a28', '#5a5a3e'], bed: '#0e2a3a', deep: 'rgba(16,50,96,.82)', shallow: 'rgba(30,110,130,.6)', glints: 2200, edge: 'rgba(80,200,220,.18)' });
      pads(g, R, 500, WATER, { flower: .22, cols: ['#fbe4ee', '#c8b8f4'] });
      disc(g, '#a88a5e', 8, .5); clipPlaza(g, () => { tiles(g, R, { col: [34, 26, 52], lv: 5, tw: 100, td: 100, grout: 'rgba(60,44,26,.9)', crack: .1, moss: .1 }); wash(g, 'rgba(160,200,255,.12)', 'rgba(10,20,40,.3)'); });
      g.save(); g.scale(1, SQ); g.lineCap = 'round'; for (const [w, c] of [[20, '#3a5a24'], [14, '#7a8a2a'], [6, '#d8b84a']]) { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); for (let a = 0; a < TAU * 2.2; a += .05) { const r = 12 + a * 8; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.stroke(); } g.restore();
      curb(g, R, [72, 40, 34], { lip: 20, w: 24, band: '#d8b84a' }); g.strokeStyle = 'rgba(240,220,120,.5)'; g.lineWidth = 2; for (let i = 0; i < 120; i++) { const a = i / 120 * TAU; g.beginPath(); g.arc(Math.cos(a) * PR, Math.sin(a) * PRY, 6, a, a + Math.PI); g.stroke(); }
    },
    props: [['nagahead', -340, -400, .9], ['nagahead', 340, -400, .9], ['chedi', 0, -520, .75, { v: 'g', white: [44, 50, 66] }], ['lotus', -760, -160, 1.1, { cols: ['#fbe4ee', '#c8b8f4'] }], ['lotus', 780, -80, 1.1, { cols: ['#fbe4ee', '#c8b8f4'] }], ['lotus', -700, 420, 1, { cols: ['#fbe4ee', '#c8b8f4'] }], ['lotus', 720, 440, 1, { cols: ['#fbe4ee', '#c8b8f4'] }], ['nagahead', -660, 150, .8], ['nagahead', 660, 160, .8], ['lotus', -60, 520, .7, { cols: ['#fbe4ee', '#c8b8f4'] }]],
    lights: [['crystal', -560, -170, { hue: 205, glow: '#4aa8ff' }], ['crystal', 580, -150, { hue: 205, glow: '#4aa8ff' }], ['crystal', -470, 340, { hue: 205, glow: '#4aa8ff' }], ['crystal', 480, 350, { hue: 205, glow: '#4aa8ff' }], ['floatlamp', -150, -470], ['floatlamp', 200, 480]].map(l => (l[3] = { pool: l[0] === 'crystal' ? [90, 170, 255] : [255, 190, 120], ...(l[3] || {}) }, l)),
    amb: [{ k: 'sparkle', n: 30, cols: ['#8ad8ff', '#ffffff', '#b8a8ff'], sz: [5, 10], where: wet }, { k: 'ripple', n: 8, where: wet }, { k: 'flies', n: 14, col: '#8ae8ff' }],
    grade: { mul: '#c4c0e8', bands: [['t', '40,20,90', .4, .45, 'multiply'], ['b', '255,130,90', .12, .3, 'lighter']] },
  },
  // 3-1 สวนหยกจันทรา — moonlit jade garden: moon gate, bamboo, scholar rocks, raked gravel
  jade: {
    pal: P3, seed: 31,
    ground(g, R) {
      fillBase(g, R, ['#2e4a46', '#28423e', '#1c302c'], [160, 30, 22, 22]); blades(g, R, 10000, [150, 30, 24, 18, 22], 9);
      g.fillStyle = '#9aa4a2'; g.beginPath(); g.ellipse(0, 0, PR * 1.42, PR * 1.42 * SQ, 0, 0, TAU); g.fill(); specks(g, R, 9000, ['#b8c0be', '#8a9492', '#c8d0ce', '#7a8482'], 1.5, 3.5, (x, y) => er(x, y) < PR * 1.42); g.strokeStyle = 'rgba(60,70,70,.35)'; g.lineWidth = 2; for (let r = PR + 30; r < PR * 1.4; r += 14) { g.beginPath(); g.ellipse(0, 0, r, r * SQ, 0, 0, TAU); g.stroke(); }
      for (let i = 0; i < 9; i++) { const a = i / 9 * TAU + .3; stone(g, Math.cos(a) * PR * 1.48, Math.sin(a) * PR * 1.48 * SQ, 16 + R() * 8, R); }
      disc(g, '#3e7064', 4, .45); clipPlaza(g, () => { tiles(g, R, { col: [158, 30, 36], lv: 5, tw: 90, td: 90, grout: 'rgba(20,40,34,.95)', crack: .06 }); wash(g, 'rgba(200,240,230,.14)', 'rgba(10,30,30,.3)'); });
      g.fillStyle = 'rgba(240,248,255,.2)'; g.beginPath(); g.ellipse(0, 0, 110, 110 * SQ, 0, 0, TAU); g.fill(); inlay(g, { band: '#e8f0f0', edge: '#4a6a64', r: .66 }); g.strokeStyle = '#e8f0f0'; g.lineWidth = 6; g.beginPath(); g.ellipse(0, 0, 110, 110 * SQ, 0, 0, TAU); g.stroke();
      curb(g, R, [40, 8, 80], { lip: 16, w: 18 });
    },
    props: [['moongate', 0, -400, .92], ['bamboo', -620, -360, 1], ['bamboo', 640, -350, 1], ['bamboo', -860, -60, 1.05], ['bamboo', 880, -20, 1], ['scholar', -720, 220, .9], ['scholar', 740, 260, .8], ['tree', -820, 400, .95, { leaf: [340, 40, 74], bark: '#3e2e2a', bloom: ['#ffffff', '#ffd6e4'], v: 'p' }], ['tree', 840, 440, .9, { leaf: [340, 40, 74], bark: '#3e2e2a', bloom: ['#ffffff', '#ffd6e4'], v: 'p' }], ['rock', -200, 530, .5, { col: [200, 8, 56], n: 2, v: 'j' }], ['rock', 260, 530, .45, { col: [200, 8, 56], n: 2, v: 'j' }]],
    lights: [['stonelamp', -580, -170, { st: [200, 6, 62], win: '#ffe0a0' }], ['stonelamp', 580, -150, { st: [200, 6, 62], win: '#ffe0a0' }], ['stonelamp', -540, 300, { st: [200, 6, 62], win: '#ffe0a0' }], ['stonelamp', 560, 310, { st: [200, 6, 62], win: '#ffe0a0' }], ['crystal', -280, -420, { s: .8, hue: 150 }], ['crystal', 280, -420, { s: .8, hue: 150 }]].map(l => (l[3] = { pool: l[0] === 'crystal' ? [120, 255, 200] : [255, 220, 150], ...(l[3] || {}) }, l)),
    amb: [{ k: 'flies', n: 22, col: '#c8ffe8' }, { k: 'fall', n: 12, cols: ['#ffffff', '#ffd6e4', '#f7b6c8'], shape: 'petal', sz: [4, 7], vy: 22 }, { k: 'mist', n: 5, a: .12, vx: 8, tint: '#c8e0ff' }],
    grade: { mul: '#a8b8e4', bands: [['t', '16,24,70', .4, .45, 'multiply']], glows: [[.86, .04, .38, '225,238,255', .42], [.86, .04, .08, '255,255,255', .5]] },
  },
  // 3-2 ตำหนักปี่เซียะ — palace courtyard: red walls & gate, marble dais, bronze censer, red lanterns
  palace: {
    pal: P3, seed: 32,
    ground(g, R) {
      g.fillStyle = '#6a6460'; g.fillRect(-GOX, -GOY, GW, GH); tiles(g, R, { col: [30, 6, 50], lv: 5, tw: 140, td: 140, grout: 'rgba(40,36,34,.9)', box: [-GOX, -GOY / SQ, GOX, GOY / SQ], crack: .08, moss: .05 });
      g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(-150, -GOY, 300, GOY);
      disc(g, '#e8e2d6', 10, .45); clipPlaza(g, () => { tiles(g, R, { col: [40, 14, 86], lv: 3, tw: 100, td: 100, grout: 'rgba(160,150,136,.9)', crack: .03 }); g.strokeStyle = 'rgba(120,110,100,.18)'; g.lineWidth = 1.5; for (let i = 0; i < 60; i++) { let x = (R() - .5) * PR * 2, y = (R() - .5) * PRY * 2; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (R() - .5) * 60; y += (R() - .5) * 20; g.lineTo(x, y); } g.stroke(); } const sh = g.createLinearGradient(-PR, -PRY, PR, PRY); sh.addColorStop(0, 'rgba(255,255,255,.18)'); sh.addColorStop(.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(60,40,30,.12)'); g.fillStyle = sh; g.fillRect(-PR, -PRY, PR * 2, PRY * 2); });
      inlay(g, { band: '#b8322a', edge: '#7a5a1a', rose: '#e2b04a', rose2: '#b8322a', r: .68, petals: 12, rr: 90 });
      curb(g, R, [40, 10, 80], { lip: 22, w: 22, band: '#b8322a' });
    },
    props: [['gate', 0, -395, .85, { v: 'p' }], ['wall', -640, -410, 1, { windows: 1, v: 'w' }], ['wall', 640, -410, 1, { windows: 1, v: 'w' }], ['pillar', -660, -180, 1, { v: 'p' }], ['pillar', 660, -170, 1, { v: 'p' }], ['pillar', -640, 220, 1, { v: 'p' }], ['pillar', 640, 230, 1, { v: 'p' }], ['ding', 0, -360, .8], ['rock', -860, 420, .6, { col: [200, 6, 60], n: 2, v: 'g' }], ['rock', 860, 440, .6, { col: [200, 6, 60], n: 2, v: 'g' }]],
    lights: [['lantern', -470, -250], ['lantern', 470, -260], ['lantern', -520, 300], ['lantern', 520, 320], ['lantern', -880, 40], ['lantern', 880, 60]].map(l => (l[3] = { pool: [255, 110, 80] }, l)),
    amb: [{ k: 'smoke', n: 10, src: [[0, -500]], a: .22 }, { k: 'sparkle', n: 18, cols: ['#ffe08a', '#ffffff'], sz: [4, 8], period: 2.6 }, { k: 'drift', n: 16, col: '#ffcf8a', sz: [3, 5], a: .4 }],
    grade: { glows: [[.5, -.12, .8, '255,200,120', .2]], bands: [['b', '80,10,10', .14, .3, 'multiply']] },
  },
  // 3-3 หุบเขาจิ้งจอกเก้าหาง — high mountain valley: cliffs, snowy pines, drifting snow, foxfire
  foxvalley: {
    pal: pal('3', { stone: [205, 10, 6, 8, 58, 12] }), seed: 33,
    ground(g, R) {
      fillBase(g, R, ['#5e6a62', '#4e5a54', '#36423e'], [190, 30, 10, 36], 2600);
      useTheme(this.pal); for (let i = 0; i < 260; i++) { const x = (R() - .5) * GW, y = (R() - .5) * GH; if (er(x, y) < PR + 40) continue; stone(g, x, y, 14 + R() * 30, R); }
      blades(g, R, 7000, [90, 40, 26, 22, 22], 8, (x, y) => Math.sin(x * .006) + Math.cos(y * .009) > .4);
      for (let i = 0; i < 60; i++) { const x = (R() - .5) * GW, y = (R() - .5) * GH; if (er(x, y) < PR + 80) continue; snowPatch(g, R, x, y, 80 + R() * 150); }
      disc(g, '#7a7e78', 6, .45); clipPlaza(g, () => { for (let i = 0; i < 46; i++) { const p = blobPts(R, (R() - .5) * PR * 2, (R() - .5) * PRY * 2, 60 + R() * 70, (60 + R() * 70) * SQ, .25, 9); g.fillStyle = hsl(200, 6, 44 + R() * 12); g.beginPath(); addPts(g, p); g.fill(); g.strokeStyle = 'rgba(30,36,40,.45)'; g.lineWidth = 2; g.stroke(); } wash(g, 'rgba(230,240,255,.18)', 'rgba(20,30,40,.25)'); for (let i = 0; i < 14; i++) { const a = R() * TAU, d = PR * (.88 + R() * .14); snowPatch(g, R, Math.cos(a) * d, Math.sin(a) * d * SQ, 40 + R() * 50, .7); } });
      backWall(g, R, -470, { top: '#4a525c', bot: '#6a7280', strata: 'rgba(30,36,44,.35)', cap: null });
    },
    props: [['cliff', -540, -390, .95, { cap: '#eef3fa' }], ['cliff', 560, -395, 1, { cap: '#eef3fa', v: 'b' }], ['pine', -250, -400, .85, { snow: 1 }], ['pine', 230, -410, .8, { snow: 1 }], ['pine', -40, -470, .7, { snow: 1 }], ['pine', -830, -220, 1.1, { snow: 1 }], ['pine', 850, -180, 1.05, { snow: 1 }], ['pine', -780, 270, 1, { snow: 1 }], ['pine', 820, 310, .95, { snow: 1 }], ['rock', -660, 40, .85, { snow: 1, col: [205, 8, 50] }], ['rock', 690, 80, .85, { snow: 1, col: [205, 8, 50] }], ['rock', -720, 460, .7, { snow: 1, col: [205, 8, 50], n: 2, v: 'b' }], ['rock', 740, 470, .7, { snow: 1, col: [205, 8, 50], n: 2, v: 'b' }], ['spire', -940, 100, .8, { snow: 1, col: [205, 8, 40] }], ['spire', 950, 130, .75, { snow: 1, col: [205, 8, 40] }]],
    lights: [['foxfire', -560, -170], ['foxfire', 560, -150], ['foxfire', -280, -400], ['foxfire', 270, -410], ['foxfire', -600, 320], ['foxfire', 620, 330], ['foxfire', 0, 480]].map(l => (l[3] = { pool: [90, 150, 255] }, l)),
    amb: [{ k: 'fall', n: 46, shape: 'snow', sz: [3, 7], vy: 46, sway: 26, wind: 18, a: .85 }, { k: 'mist', n: 7, a: .2, vx: 16, tint: '#e8f0ff' }],
    grade: { mul: '#dce6f4', bands: [['t', '235,244,255', .38, .4]] },
  },
  // 3-4 สะพานคางคกทอง — a red-railed bridge over a jade river; gold coins glint under the water
  toadbridge: {
    pal: P3, seed: 34,
    ground(g, R) {
      const S = [orient([[-GOX, -GOY], [GOX, -GOY], [GOX, GOY], [-GOX, GOY]])]; WATER = (x, y) => y < -410 || y > 392;
      water(g, R, S, { bed: '#1e4a40', deep: 'rgba(30,100,90,.7)', shallow: 'rgba(60,150,130,.55)', glints: 3200, foam: false });
      specks(g, R, 260, ['#f2c84a', '#e2a830', '#fff0a0'], 4, 7, WATER);
      pads(g, R, 500, WATER, { flower: .25 });
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(-GOX, -406, GW, 810);
      for (let x = -GOX; x < GOX; x += 46) { const L = 34 + R() * 8; g.fillStyle = hsl(24, 40, L); g.fillRect(x + 1, -394, 44, 776); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x + 44, -394, 2, 776); g.strokeStyle = 'rgba(40,20,8,.18)'; g.lineWidth = 1; for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(x + 6 + k * 8, -394); g.lineTo(x + 6 + k * 8 + (R() - .5) * 6, 382); g.stroke(); } g.fillStyle = '#c8a050'; for (const y of [-380, -20, 360]) { g.beginPath(); g.arc(x + 10, y, 2, 0, TAU); g.arc(x + 34, y, 2, 0, TAU); g.fill(); } }
      const sh = g.createLinearGradient(0, -394, 0, 382); sh.addColorStop(0, 'rgba(0,0,0,.25)'); sh.addColorStop(.1, 'rgba(0,0,0,0)'); sh.addColorStop(.9, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.3)'); g.fillStyle = sh; g.fillRect(-GOX, -394, GW, 776);
      g.save(); g.beginPath(); g.rect(-GOX, -74, GW, 132); g.clip(); tiles(g, R, { col: [160, 10, 56], lv: 5, tw: 80, td: 70, grout: 'rgba(30,40,36,.9)', box: [-GOX, -74 / SQ, GOX, 58 / SQ], crack: .08, moss: .1 }); g.restore(); g.fillStyle = '#5a2a1c'; g.fillRect(-GOX, -80, GW, 7); g.fillRect(-GOX, 58, GW, 7);
      g.save(); g.scale(1, SQ); g.fillStyle = '#7a4a18'; g.beginPath(); g.arc(0, -8 / SQ, 70, 0, TAU); g.fill(); const cg = g.createRadialGradient(-20, -8 / SQ - 20, 4, 0, -8 / SQ, 64); cg.addColorStop(0, '#fff0a0'); cg.addColorStop(.5, '#e2b04a'); cg.addColorStop(1, '#a8701e'); g.fillStyle = cg; g.beginPath(); g.arc(0, -8 / SQ, 62, 0, TAU); g.fill(); g.fillStyle = '#5a3a14'; g.fillRect(-18, -8 / SQ - 18, 36, 36); g.strokeStyle = '#7a4a18'; g.lineWidth = 3; g.beginPath(); g.arc(0, -8 / SQ, 46, 0, TAU); g.stroke(); g.restore();
      for (const y of [-404, 382]) { g.fillStyle = '#5a2a1c'; g.fillRect(-GOX, y, GW, 22); g.fillStyle = '#b8322a'; g.fillRect(-GOX, y, GW, 8); }
    },
    props: [['rail', -490, -404, 1], ['rail', 490, -404, 1], ['toad', 0, -420, .85], ['rail', -490, 402, 1, { v: 'f' }], ['rail', 490, 402, 1, { v: 'f' }], ['lotus', -760, -520, 1], ['lotus', 760, -540, 1], ['lotus', -420, 560, .9], ['lotus', 520, 570, .9]],
    lights: [['lantern', -830, -402, { s: .9 }], ['lantern', 830, -402, { s: .9 }], ['lantern', -240, -404, { s: .8 }], ['lantern', 240, -404, { s: .8 }], ['lantern', -830, 404, { s: .9 }], ['lantern', 830, 404, { s: .9 }]].map(l => (l[3] = { pool: [255, 120, 80], ...(l[3] || {}) }, l)),
    amb: [{ k: 'sparkle', n: 30, cols: ['#ffe08a', '#ffffff'], sz: [5, 9], where: wet }, { k: 'ripple', n: 8, where: wet }, { k: 'fall', n: 10, cols: ['#ffd6e0', '#f39ab4'], shape: 'petal', sz: [4, 7], vy: 24 }],
    grade: { glows: [[.5, -.1, .8, '255,220,150', .16]] },
  },
  // 3-5 ประตูสวรรค์ — the heaven gate above a sea of clouds, golden light
  heaven: {
    pal: P3, seed: 35,
    ground(g, R) {
      cloudSea(g, R, null, [240, 30]);
      g.save(); g.beginPath(); g.rect(-170, -GOY, 340, GOY); g.clip(); tiles(g, R, { col: [42, 18, 86], lv: 3, tw: 85, td: 85, grout: 'rgba(170,150,110,.9)', box: [-170, -GOY / SQ, 170, 0], crack: .02 }); g.restore();
      g.fillStyle = '#e2b04a'; g.fillRect(-176, -GOY, 8, GOY); g.fillRect(168, -GOY, 8, GOY);
      disc(g, '#f2ece0', 10, .3); clipPlaza(g, () => { tiles(g, R, { col: [42, 20, 88], lv: 3, tw: 100, td: 100, grout: 'rgba(190,170,130,.9)', crack: .02 }); const sh = g.createLinearGradient(-PR, -PRY, PR, PRY); sh.addColorStop(0, 'rgba(255,255,255,.25)'); sh.addColorStop(.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(120,100,60,.12)'); g.fillStyle = sh; g.fillRect(-PR, -PRY, PR * 2, PRY * 2); });
      inlay(g, { band: '#e2b04a', edge: '#a8782a', rose: '#f2c84a', rose2: '#fff2c0', r: .7, petals: 12, rr: 96 }); inlay(g, { band: '#f2c84a', edge: '#a8782a', r: .42 });
      curb(g, R, [44, 50, 72], { lip: 22, w: 20, band: '#e2b04a' });
      const R2 = mulberry(77); for (let i = 0; i < 160; i++) { const a = R2() * TAU, rr = PR * (1.02 + R2() * .2), x = Math.cos(a) * rr, y = Math.sin(a) * rr * SQ + 20, r = 30 + R2() * 50; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, r, r * .6, 0, 0, TAU); g.fill(); }
    },
    props: [['gate', 0, -405, 1.05, { v: 'h', pal: { pillar: [40, 20, 92], roof: '#d9a83a', trim: '#fff2c0', beam: '#c23a30', ridge: '#b8862a', stone: [42, 18, 86] } }], ['cloud', -780, -380, 1.2], ['cloud', 800, -360, 1.1, { v: 'b' }], ['cloud', -930, 80, 1], ['cloud', 940, 140, 1.05, { v: 'b' }], ['cloud', -700, 470, 1.1], ['cloud', 720, 490, 1.15, { v: 'b' }], ['cloud', -260, 580, .8], ['cloud', 300, 600, .75, { v: 'b' }]],
    lights: [['orb', -600, -200], ['orb', 600, -180], ['orb', -580, 280], ['orb', 600, 300]].map(l => (l[3] = { pool: [255, 210, 120] }, l)),
    amb: [{ k: 'sparkle', n: 30, cols: ['#ffe08a', '#ffffff'], sz: [5, 10] }, { k: 'mist', n: 6, a: .14, vx: 18 }, { k: 'rise', n: 18, cols: ['#ffd66a', '#fff0b0'], sz: [4, 8], vy: 30, a: .6 }],
    grade: { glows: [[.5, -.15, .8, '255,214,140', .16]], bands: [['b', '60,70,140', .16, .35, 'multiply']] },
  },
  // 3-6 ถ้ำเพลิงราชาอสูร — the demon bull king's fire cave: lava falls, basalt dais, rising embers
  firecave: {
    pal: pal('3', { stone: [12, 10, 10, 8, 16, 8] }), seed: 36,
    ground(g, R) {
      fillBase(g, R, ['#2a1e1a', '#241814', '#160e0c'], [14, 20, 20, 12], 2600); specks(g, R, 6000, ['#3a2a24', '#1a1210', '#4a342a', '#5a2a1a'], 2, 7);
      glowCracks(g, R, 70, 9, outside(120));
      const moat = [blobPts(R, -620, 120, 260, 130, .25, 30), blobPts(R, 660, -40, 240, 140, .25, 30), blobPts(R, 120, 560, 380, 110, .25, 30), blobPts(R, -1100, -300, 300, 160, .2, 30), blobPts(R, 1150, 420, 300, 160, .2, 30)]; WATER = inShapes(moat);
      lavaPool(g, R, moat);
      backWall(g, R, -440, { top: '#120a08', bot: '#3a2620', strata: 'rgba(0,0,0,.4)', vein: ['#ff5a10', '#ffb040'] });
      disc(g, '#ff6a1a', 6, .55); clipPlaza(g, () => { useTheme(this.pal); g.fillStyle = '#ff7a1a'; g.fillRect(-PR, -PRY, PR * 2, PRY * 2); const gr = g.createRadialGradient(0, 0, 0, 0, 0, PR); gr.addColorStop(0, 'rgba(255,220,120,.6)'); gr.addColorStop(1, 'rgba(200,40,0,.3)'); g.fillStyle = gr; g.fillRect(-PR, -PRY, PR * 2, PRY * 2); for (let gy = -PR; gy <= PR; gy += 64) { const row = Math.round(gy / 64); for (let gx = -PR; gx <= PR; gx += 72) { const x = gx + (row & 1 ? 36 : 0) + (R() - .5) * 10, y = (gy + (R() - .5) * 10) * SQ; const p = blobPts(R, x, y, 32 + R() * 4, (32 + R() * 4) * SQ * 1.1, .12, 7); g.beginPath(); addPts(g, p); const sg = g.createLinearGradient(x - 30, y - 20, x + 30, y + 20); sg.addColorStop(0, '#4a3a34'); sg.addColorStop(1, '#1e1614'); g.fillStyle = sg; g.fill(); g.strokeStyle = 'rgba(255,140,60,.35)'; g.lineWidth = 1.5; g.stroke(); } } });
      curb(g, R, [12, 14, 16], { lip: 18, w: 22, band: '#ff7a20' });
    },
    props: [['spire', -660, -300, 1.1, { lava: 1 }], ['spire', 680, -280, 1.2, { lava: 1, v: 'b' }], ['spire', -880, 60, 1, { lava: 1, v: 'c' }], ['spire', 900, 100, .9, { lava: 1, v: 'd' }], ['spire', -330, -440, .8, { lava: 1, v: 'e' }], ['spire', 360, -450, .9, { lava: 1, v: 'f' }], ['rock', -760, 420, .8, { lava: 1, col: [12, 10, 18] }], ['rock', 790, 440, .8, { lava: 1, col: [12, 10, 18], n: 2, v: 'b' }], ['rock', -100, -470, .55, { lava: 1, col: [12, 10, 18], n: 2, v: 'c' }]],
    lights: [['lavafall', -180, -440, { h: 320, w: 60 }], ['lavafall', 520, -450, { h: 300, w: 50 }], ['lavafall', -700, -450, { h: 300, w: 46 }], ['brazier', -500, -170, { s: 1.1 }], ['brazier', 500, -150, { s: 1.1 }], ['brazier', -520, 320], ['brazier', 540, 330]].map(l => (l[3] = { pool: [255, 110, 40], ...(l[3] || {}) }, l)),
    amb: [{ k: 'rise', n: 36, cols: ['#ff7a20', '#ffb040', '#ff4a10'], sz: [3, 7], vy: 70, a: .9 }, { k: 'mist', n: 3, a: .22, vx: 10, tint: '#2a1410' }],
    grade: { mul: '#ffe0cc', flick: .12, bands: [['b', '255,90,20', .28, .45, 'lighter'], ['t', '20,6,0', .55, .4, 'multiply']] },
  },
};
export const LOC_IDS = Object.keys(LOCS);

// ---------- painted plates (BATCH17) ----------
// Separate files bg/<loc>.webp published next to the page (build.mjs copies assets_bg/ → dist/bg/ and defines __BG__
// with the ids that have one). A plate replaces the code ground, props and lamps; ambient life stays (minus the
// systems tied to the code geometry: water ripples/sparkles and lamp smoke) and the grade becomes L.artGrade.
// Plates are drawn on a separate image, so the main canvas may become origin-tainted — nothing reads it back.
const ART = new Set((typeof __BG__ !== 'undefined' ? __BG__ : []).filter(id => !/^map\d/.test(id))); // battle plates only (map<N> = realm charts)
const PLATE = {};
/** world height a plate covers: its painted oval (~31% of the height, centre ~50%) then matches the plaza (PR·SQ) */
const PH = 1084;
function plate(id) {
  if (!ART.has(id)) return null;
  let im = PLATE[id];
  if (!im) { im = PLATE[id] = new Image(); im.decoding = 'async'; im.onerror = () => { ART.delete(id); delete PLATE[id]; }; im.src = 'bg/' + id + '.webp'; }
  return im.complete && im.naturalWidth ? im : null;
}
/** painted plates loaded / listed (settings shows it to check the live build) */
export const plateStat = () => ({ ok: Object.values(PLATE).filter((im: any) => im.complete && im.naturalWidth).length, total: ART.size });
/** warm the browser cache with every plate, one at a time, after the game has loaded */
export function prefetchPlates() {
  const ids = [...ART]; let i = 0;
  const next = () => { if (i >= ids.length) return; const id = ids[i++]; plate(id); const im = PLATE[id]; if (!im || im.complete) return next(); im.addEventListener('load', next, { once: true }); im.addEventListener('error', next, { once: true }); };
  next();
}
/** plate geometry in world units: [x, y, w, h] (per-plate fit: [centre offset as a fraction of h, scale]) */
function plateRect(L, im) { const [dy, k] = L.fit || [0, 1], h = PH * k, w = h * im.naturalWidth / im.naturalHeight; return [-w / 2, -h * (.5 + dy), w, h]; }
/** ground for a plate: the painting plus mirrored copies around it (covers wide screens / the wave walk-out), the
 *  copies dimmed so the eye stays on the arena; the painting itself is redrawn sharp every frame (E.loc.plate) */
function plateGround(L, im) {
  const c = mk(GW, GH), g = c.getContext('2d'), [x0, y0, w, h] = plateRect(L, im);
  g.translate(GOX, GOY);
  for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) { const x = x0 + i * w, y = y0 + j * h; if (x > GOX || y > GOY || x + w < -GOX || y + h < -GOY) continue; g.save(); g.translate(x + (i & 1 ? w : 0), y + (j & 1 ? h : 0)); g.scale(i & 1 ? -1 : 1, j & 1 ? -1 : 1); g.drawImage(im, 0, 0, w, h); g.restore(); }
  g.fillStyle = 'rgba(10,8,14,.35)'; g.beginPath(); g.rect(-GOX, -GOY, GW, GH); g.rect(x0, y0, w, h); g.fill('evenodd');
  return c;
}

// ---------- switching ----------
const DEF_L = LANTERNS.slice(), DEF_B = BUSHES.slice();
let curId = null, curGround = null, curArt = false, pending = null;
/** set the battle arena for a location id ('meadow' or unknown → the default realm-1 field) */
export function setLocation(id) {
  const L = LOCS[id];
  pending = null;
  if (!L) return clearLocation();
  if (!E.ctx) return;
  const im = plate(id);
  if (!im && PLATE[id]) pending = id, PLATE[id].addEventListener('load', () => { if (pending === id && E.loc?.id === id) setLocation(id); }, { once: true }); // swap in when it arrives
  useTheme(L.pal);
  if (curId !== id || curArt !== !!im) {
    for (const k in PC) delete PC[k]; WATER = null; curGround = null;
    if (im) curGround = plateGround(L, im);
    else { const c = mk(GW, GH), g = c.getContext('2d'); g.translate(GOX, GOY); L.ground.call(L, g, mulberry(L.seed)); curGround = c; L.water = WATER; }
    curId = id; curArt = !!im;
  }
  WATER = im ? null : L.water; useTheme(L.pal); E.ground = curGround;
  LANTERNS.length = 0; BUSHES.length = 0;
  if (im) {
    const r = plateRect(L, im), amb = L.amb.filter(a => !a.where && a.k !== 'smoke' && a.k !== 'ripple');
    E.loc = { id, art: true, prop: () => {}, light: () => {}, ambient: ambient(amb), grade: L.artGrade ? grade(L.artGrade) : null, plate: ctx => ctx.drawImage(im, r[0], r[1], r[2], r[3]) };
    return;
  }
  for (const [kind, x, y, o] of L.lights) LANTERNS.push(Object.assign({ kind: kind || undefined, x, y, ph: Math.random() * 9 }, o));
  for (const [kind, x, y, s, o] of L.props) BUSHES.push({ kind, x, y, s: s || 1, o: o || {}, seed: (x * 7 + y * 13 + kind.length * 101) | 0 });
  E.loc = { id, prop: b => put(E.ctx, PROPS[b.kind](b.o, b.seed), b.x, b.y, b.s, b.o.flip), light: Lt => LIGHTS[Lt.kind](Lt), ambient: ambient(L.amb), grade: grade(L.grade) };
}
/** back to the default meadow (home / hatch / idle scenes and stage 1-1) */
export function clearLocation() { pending = null; LANTERNS.splice(0, LANTERNS.length, ...DEF_L); BUSHES.splice(0, BUSHES.length, ...DEF_B); setTheme('1'); }
