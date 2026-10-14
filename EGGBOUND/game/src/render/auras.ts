// @ts-nocheck
// Buff / shield auras on battle units (drawn every frame while the status lasts): a hex energy dome for shields (gold for
// invincible), a flame halo for ATK up, a turning rune for DEF up, wind ribbons for SPD up, orbiting sparks for crit up,
// a mint halo for immunity, a golden tether for protect, and floating marks for the dark curses (bomb, brand, silence ...).
import { addP, ring, rnd } from './engine';
import { mk, tinted, boxOf, dot, TAU } from './assets';

const DOME = {};
/** a bubble of hexagon light: soft centre, bright fresnel rim, hex lattice that shows more towards the edge */
function dome(col) {
  if (DOME[col]) return DOME[col];
  const S = 256, R = 124, c = mk(S, S), g = c.getContext('2d'), cx = S / 2, cy = S / 2;
  const rg = g.createRadialGradient(cx, cy, 0, cx, cy, R);
  rg.addColorStop(0, col + '06'); rg.addColorStop(.62, col + '14'); rg.addColorStop(.86, col + '40'); rg.addColorStop(.96, col + 'b0'); rg.addColorStop(1, col + '00');
  g.fillStyle = rg; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
  g.save(); g.beginPath(); g.arc(cx, cy, R - 2, 0, TAU); g.clip();
  const hs = 15, hw = hs * Math.sqrt(3);
  for (let row = -10; row <= 10; row++) for (let q = -10; q <= 10; q++) {
    const x = cx + q * hw + (row & 1) * hw / 2, y = cy + row * hs * 1.5, d = Math.hypot(x - cx, y - cy) / R;
    if (d > 1.05) continue;
    g.strokeStyle = col; g.globalAlpha = .06 + Math.pow(Math.min(1, d), 2.4) * .5; g.lineWidth = 1.4;
    g.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * TAU / 6, px = x + Math.cos(a) * hs * .92, py = y + Math.sin(a) * hs * .92; i ? g.lineTo(px, py) : g.moveTo(px, py); } g.closePath(); g.stroke();
  }
  g.restore(); g.globalAlpha = 1;
  g.strokeStyle = '#ffffff'; g.globalAlpha = .5; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.arc(cx, cy, R - 12, Math.PI * 1.08, Math.PI * 1.38); g.stroke(); // specular glint
  g.globalAlpha = .25; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, R - 12, Math.PI * 1.45, Math.PI * 1.55); g.stroke();
  return (DOME[col] = c);
}
const SHIELD = '#8fd8ff', INVINC = '#ffd76a';
/** body box of a unit in world space: centre x, top y, half width */
function body(v) {
  const b = boxOf(v.sid, 'front_idle'), k = v.k * Math.max(v.sx, .6), w = (b[2] - b[0]) * k, h = (b[3] - b[1]) * k;
  return { cx: v.x, top: v.y - h, w: Math.max(70 * v.k / .4, w * .5), h: Math.max(110 * v.k / .4, h) };
}
const lit = (ctx, name, col, x, y, w, h, a, rot = 0) => { const im = tinted(name, col); if (!im || a <= 0) return; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, a); ctx.translate(x, y); if (rot) ctx.rotate(rot); ctx.drawImage(im, -w / 2, -h / 2, w, h); ctx.restore(); };

/** behind the sprite: ground runes and rising flames */
export function drawAurasBack(ctx, v, t) {
  if (v.dead || v.alpha < .3) return; const st = v.st, B = body(v);
  if (st.has('atk_up')) { const f = .62 + .14 * Math.sin(t * 9 + v.ph); lit(ctx, 'fx_aura_flame', '#ff3a1a', v.x, v.y - B.h * .56, B.w * 2.9, B.h * 1.4, f); lit(ctx, 'fx_aura_flame', '#ffb04a', v.x, v.y - B.h * .46, B.w * 2.1, B.h * 1.05, f * .6); }
  if (st.has('def_up')) { ctx.save(); ctx.translate(v.x, v.y); ctx.scale(1, .36); lit(ctx, 'fx_rune_circle', '#4aa8ff', 0, 0, B.w * 3.2, B.w * 3.2, .6, t * .6); ctx.restore(); }
  if (st.has('immunity')) { ctx.save(); ctx.translate(v.x, v.y); ctx.scale(1, .36); lit(ctx, 'fx_ring', '#9dffe0', 0, 0, B.w * 2.8, B.w * 2.8, .55 + .15 * Math.sin(t * 4)); ctx.restore(); }
  if (st.has('spd_up')) ribbons(ctx, v, B, t, false);
}
/** in front of the sprite: shield dome, wind front halves, sparks, curse marks, protect tether */
export function drawAurasFront(ctx, v, t, views, headY) {
  if (v.dead || v.alpha < .3) return; const st = v.st, B = body(v);
  if (st.has('spd_up')) ribbons(ctx, v, B, t, true);
  if (st.has('crit_up')) for (let i = 0; i < 4; i++) { const a = t * 2.2 + i * TAU / 4, x = v.x + Math.cos(a) * B.w * 1.15, y = v.y - B.h * .55 + Math.sin(a) * B.w * .32, s = 24 + 7 * Math.sin(t * 7 + i); if (Math.sin(a) < -.2) continue; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .85; ctx.drawImage(dot('#ffd24a'), x - s, y - s, s * 2, s * 2); ctx.restore(); lit(ctx, 'fx_sparkle', '#fff2b0', x, y, s * 1.6, s * 1.6, .8, t * 3 + i); }
  if (st.has('protect')) { const p = views && [...views].find(o => o.uid === v.protector && !o.dead); if (p) tether(ctx, p, v, t); }
  const inv = st.has('invincible'), shd = v.shieldAmt > 0;
  if (inv || shd || v.domeOut > 0) domeAt(ctx, v, B, t, inv ? INVINC : SHIELD);
  if (st.has('freeze')) iceBlock(ctx, v, B, t);
  if (st.has('confuse')) for (let i = 0; i < 3; i++) { const a = t * 3 + i * TAU / 3, x = v.x + Math.cos(a) * B.w * .55, y = (headY != null ? headY : v.y - B.h) - 18 + Math.sin(a) * 7;
    ctx.save(); ctx.globalAlpha = .85; ctx.fillStyle = i === 1 ? '#fff3a8' : '#ffb3f0'; ctx.font = '700 22px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(i === 1 ? '?' : '✦', x, y - 10); ctx.restore(); }
  // dark curses float above the head
  let mx = v.x - 22; const hy = (headY != null ? headY : v.y - B.h) - 46; // above the HP bar and status icons
  for (const id of ['bomb', 'brand', 'silence', 'provoke', 'unheal']) if (st.has(id)) { curse(ctx, id, mx, hy + Math.sin(t * 3 + mx) * 3, t); mx += 30; }
}
function domeAt(ctx, v, B, t, col) {
  const pop = v.domePop != null ? Math.min(1, v.domePop / .35) : 1, over = pop < 1 ? 1 + Math.sin(pop * Math.PI) * .12 - (1 - pop) * .35 : 1;
  const out = v.domeOut > 0 ? v.domeOut : 0; // fading out after it broke
  const rx = B.w * 1.45 * over * (1 + .012 * Math.sin(t * 3)), ry = B.h * .64 * over, cy = v.y - ry * .86;
  const a = (out ? out : 1) * (.85 + .15 * Math.sin(t * 2.4 + v.ph)) * v.alpha + (v.domeHit || 0) * .6;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, a);
  ctx.drawImage(dome(col), v.x - rx, cy - ry, rx * 2, ry * 2);
  // a shimmer band sweeping up the bubble
  const ph = (t * .45 + v.ph * .1) % 1, by = cy + ry - ph * ry * 2.2;
  ctx.beginPath(); ctx.ellipse(v.x, cy, rx * .97, ry * .97, 0, 0, TAU); ctx.clip();
  const gr = ctx.createLinearGradient(0, by - 26, 0, by + 26); gr.addColorStop(0, col + '00'); gr.addColorStop(.5, col + '55'); gr.addColorStop(1, col + '00');
  ctx.fillStyle = gr; ctx.fillRect(v.x - rx, by - 26, rx * 2, 52);
  ctx.restore();
  if (col === INVINC) { ctx.save(); ctx.translate(v.x, v.y); ctx.scale(1, .36); lit(ctx, 'fx_rune_circle', '#ffd76a', 0, 0, rx * 2.3, rx * 2.3, .55, -t * .8); ctx.restore(); }
}
function ribbons(ctx, v, B, t, front) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const y = v.y - B.h * (.25 + i * .25), rx = B.w * (1.25 - i * .12), ry = rx * .3, a0 = t * (3.2 + i * .5) + i * 2.1;
    for (let k = 0; k < 14; k++) { const a = a0 + k * .09, s = Math.sin(a); if ((s > 0) !== front) continue; ctx.strokeStyle = `rgba(150,255,180,${(k / 14) * .55})`; ctx.lineWidth = 1 + k * .22; ctx.beginPath(); ctx.moveTo(v.x + Math.cos(a) * rx, y + s * ry); ctx.lineTo(v.x + Math.cos(a + .09) * rx, y + Math.sin(a + .09) * ry); ctx.stroke(); }
  }
  ctx.restore();
}
function tether(ctx, p, v, t) {
  const x0 = p.x, y0 = p.y - 60 * p.k / .4, x1 = v.x, y1 = v.y - 60 * v.k / .4, mx = (x0 + x1) / 2, my = Math.min(y0, y1) - 60;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,215,120,.35)'; ctx.lineWidth = 3; ctx.setLineDash([10, 8]); ctx.lineDashOffset = -t * 40;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(mx, my, x1, y1); ctx.stroke(); ctx.restore();
}
const CURSE = { bomb: '#b48cff', brand: '#e070ff', silence: '#c8a8ff', provoke: '#ff6a5a', unheal: '#ff8ac8' };
function curse(ctx, id, x, y, t) {
  const c = CURSE[id]; ctx.save();
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .7 + .3 * Math.sin(t * (id === 'bomb' ? 9 : 4)); ctx.drawImage(dot(c), x - 18, y - 18, 36, 36);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.strokeStyle = '#1a0c24'; ctx.fillStyle = c; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.arc(x, y, 10, 0, TAU); ctx.fillStyle = '#241433'; ctx.fill(); ctx.strokeStyle = c; ctx.stroke(); ctx.strokeStyle = c; ctx.fillStyle = c; ctx.lineWidth = 2;
  if (id === 'bomb') { ctx.beginPath(); ctx.arc(x, y + 1, 5.5, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(x + 3, y - 4); ctx.quadraticCurveTo(x + 7, y - 9, x + 9, y - 8); ctx.stroke(); if (Math.sin(t * 18) > 0) { ctx.fillStyle = '#ffe28a'; ctx.beginPath(); ctx.arc(x + 9, y - 8, 2.2, 0, TAU); ctx.fill(); } }
  else if (id === 'brand') { ctx.beginPath(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * TAU * 2 / 5; i ? ctx.lineTo(x + Math.cos(a) * 6, y + Math.sin(a) * 6) : ctx.moveTo(x + Math.cos(a) * 6, y + Math.sin(a) * 6); } ctx.closePath(); ctx.stroke(); }
  else if (id === 'silence') { ctx.beginPath(); ctx.moveTo(x - 5, y - 5); ctx.lineTo(x + 5, y + 5); ctx.moveTo(x + 5, y - 5); ctx.lineTo(x - 5, y + 5); ctx.stroke(); }
  else if (id === 'provoke') { ctx.beginPath(); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { ctx.moveTo(x + a * 2, y + b * 6); ctx.lineTo(x + a * 2, y + b * 2); ctx.lineTo(x + a * 6, y + b * 2); } ctx.stroke(); }
  else if (id === 'unheal') { ctx.fillRect(x - 1.5, y - 6, 3, 12); ctx.fillRect(x - 6, y - 1.5, 12, 3); ctx.strokeStyle = '#241433'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 6, y + 5); ctx.lineTo(x + 6, y - 5); ctx.stroke(); }
  ctx.restore();
}
/** per-frame aura particles and timers (call from the battle view's update) */
export function tickAuras(v, dt) {
  if (v.domePop != null) v.domePop += dt;
  if (v.domeHit > 0) v.domeHit = Math.max(0, v.domeHit - dt * 3);
  if (v.domeOut > 0) v.domeOut = Math.max(0, v.domeOut - dt * 3);
  if (v.dead) return; const st = v.st;
  v.auraT = (v.auraT || 0) + dt; if (v.auraT < .14) return; v.auraT = 0;
  const B = body(v);
  if (st.has('atk_up') && Math.random() < .55) addP({ type: 'arrow', x: v.x + rnd(-B.w, B.w), y: v.y, z: rnd(10, B.h * .5), vz: rnd(90, 150), life: .8, size: 8, color: '#ff6a3a', add: false });
  if (st.has('regen') && Math.random() < .6) addP({ x: v.x + rnd(-B.w, B.w), y: v.y, z: rnd(0, 30), vz: rnd(50, 90), life: 1, size: rnd(6, 10), size2: 0, color: '#7dffb0' });
  if (st.has('immunity') && Math.random() < .4) addP({ type: 'twinkle', x: v.x + rnd(-B.w, B.w), y: v.y, z: rnd(20, B.h), life: .7, size: rnd(5, 8), color: '#d8fff0' });
}
/** the shield (or invincible) dome just appeared: pop it in */
export function domePop(v) { v.domePop = 0; v.domeOut = 0; }
/** a blow hit the dome */
export function domeHit(v) { v.domeHit = 1; }
/** the dome broke: shards fly and it fades */
export function domeBreak(v) {
  if (v.dead) return; const B = body(v); v.domeOut = 1;
  for (let i = 0; i < 18; i++) addP({ type: 'chip', add: true, x: v.x + rnd(-B.w * 1.2, B.w * 1.2), y: v.y + rnd(-6, 6), z: rnd(20, B.h), vz: rnd(80, 220), vx: rnd(-120, 120), grav: 500, life: rnd(.5, .8), size: rnd(6, 11), color: '#bfe8ff', rot: rnd(0, 6), vr: rnd(-8, 8) });
  ring(v.x, v.y, 20, B.w * 2.4, '#bfe8ff', .4, 4);
}

/** แช่แข็ง: a translucent ice block around the body with a few crystal spikes and a cold rim */
function iceBlock(ctx, v, B, t) {
  const w = B.w * 1.25, h = B.h * .95, x = v.x, y = v.y;
  ctx.save(); ctx.globalAlpha = .38 + .05 * Math.sin(t * 2);
  const g = ctx.createLinearGradient(x - w, y - h, x + w, y); g.addColorStop(0, '#e8fbff'); g.addColorStop(.5, '#8fd8ff'); g.addColorStop(1, '#4a9fd8');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(x - w * .9, y - h * .82); ctx.lineTo(x - w * .35, y - h); ctx.lineTo(x + w * .45, y - h * .94); ctx.lineTo(x + w, y - h * .7); ctx.lineTo(x + w * .92, y); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = .7; ctx.strokeStyle = '#e8fbff'; ctx.lineWidth = 2; ctx.stroke();
  ctx.globalAlpha = .55; ctx.beginPath(); ctx.moveTo(x - w * .6, y - h * .2); ctx.lineTo(x - w * .1, y - h * .75); ctx.moveTo(x + w * .2, y - h * .15); ctx.lineTo(x + w * .55, y - h * .6); ctx.stroke();
  ctx.restore();
}
