// Monster showcase (คลังมอน): the selected monster stands full-body on its element pedestal (render/pedestal.ts), alive —
// it breathes and sways, and tapping it plays a pose. The aura grows with rarity (ตามลำดับความหายาก), in layers:
//   ธรรมดา    element light, a few motes
//   หายาก      + blue gems/inlay, a pulse ring spreading over the pedestal, glints
//   มหากาพย์    + violet rune circle turning under the feet, aura flames behind the body
//   ตำนาน      + gold runes/trim, gold god-rays, a second (gold) flame layer, light streaks rising from the rim
//   ร่างวิวัฒน์  (★5+ evolved look, any rarity) + a light pillar and three orbs circling the body, gold trim
//   ร่างหายาก   + everything prism (rainbow gems, flames, glints) and a halo ring behind the body
//   ตำนานร่างหายาก (mythic) + a star sky
// Every star adds a little strength; ★6 burns gold. Drawn into the DOM canvas #mshow every frame from main.ts; all state
// lives here so re-rendering the screen keeps it.
import { PAL, PIV, GP, TAU, IMG, spr, poseKey, warpDraw, glowOf, dot, fx, tinted, boxOf } from './assets';
import { LOOT_GRADES } from '../core/data';
import { drawPedestal } from './pedestal';

const PRISM = ['#ff6b6b', '#ffb84d', '#ffe66b', '#6bdc8a', '#5bb8ff', '#a98bff'];
const GOLD = '#ffd24a';
const RAR_TIER: Record<string, number> = { common: 0, rare: 1, epic: 2, legendary: 3 };
const TAP_POSES = ['joy', 'cast', 'attack', 'cast2'];
type Mote = { x: number; y: number; vy: number; life: number; t: number; s: number; c: string };
type Glint = { x: number; y: number; life: number; t: number; s: number; c: string; r: number };
const SH = { look: '', t: 0, enter: 0, act: 0, pose: 'idle', tapN: 0, bend: 0, bendV: 0, motes: [] as Mote[], glints: [] as Glint[], sky: [] as { x: number; y: number; s: number; ph: number }[] };

/** tap: the monster shows off (joy/cast/attack pose with a hop and a little burst of light) */
export function showcaseTap() {
  SH.pose = TAP_POSES[SH.tapN++ % TAP_POSES.length]; SH.act = 1; SH.bendV += 260;
  for (let i = 0; i < 14; i++) SH.motes.push({ x: (Math.random() - .5) * .5, y: .55 + Math.random() * .2, vy: .25 + Math.random() * .35, life: .6 + Math.random() * .5, t: 0, s: 3 + Math.random() * 4, c: '#ffffff' });
}

/** colour spec → [colour, next colour, blend]: a plain colour, or 'prism' = the rainbow cycling smoothly over time */
function pc(c: string, t: number, off = 0): [string, string, number] {
  if (c !== 'prism') return [c, c, 0];
  const u = ((t * .8 + off) % 6 + 6) % 6, i = Math.floor(u); return [PRISM[i], PRISM[(i + 1) % 6], u - i];
}
/** a light sprite (fx_*) in a colour spec, tinted only (no white core) so the colour survives stacking. k squashes it
 *  flat onto the pedestal top after turning; `paint` adds a normal-blend pass so it also reads on white marble. */
function lit(ctx: CanvasRenderingContext2D, name: string, c: string, t: number, x: number, y: number, w: number, h: number, a: number, o: { rot?: number; off?: number; k?: number; paint?: boolean } = {}) {
  const [c1, c2, f] = pc(c, t, o.off || 0);
  for (const [col, al] of [[c1, a * (1 - f)], [c2, a * f]] as [string, number][]) {
    const tn = al > .01 && tinted(name, col); if (!tn) continue;
    ctx.save(); ctx.translate(x, y); if (o.k) ctx.scale(1, o.k); if (o.rot) ctx.rotate(o.rot);
    if (o.paint) { ctx.globalAlpha = Math.min(1, al * .6); ctx.drawImage(tn, -w / 2, -h / 2, w, h); }
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, al * (o.paint ? .55 : 1)); ctx.drawImage(tn, -w / 2, -h / 2, w, h);
    ctx.restore();
  }
}
const pick = (c: string) => c === 'prism' ? PRISM[Math.floor(Math.random() * 6)] : c;

export function drawShowcase(dt: number) {
  const cv = document.getElementById('mshow') as HTMLCanvasElement | null; if (!cv) return;
  const W = cv.clientWidth, H = cv.clientHeight; if (!W || !H) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const look = cv.dataset.look || '', elem = cv.dataset.elem || 'fire', rare = cv.dataset.rare === '1', stars = +(cv.dataset.stars || 1);
  const rar = cv.dataset.rar || 'common', tier = RAR_TIER[rar] ?? 0, evo = (parseInt(look.split('~')[1] || '0') || 0) >= 5, mythic = rare && tier === 3;
  if (look !== SH.look) { SH.look = look; SH.enter = 0; SH.act = 0; SH.pose = 'idle'; SH.motes.length = 0; SH.glints.length = 0; }
  SH.t += dt; SH.enter = Math.min(1, SH.enter + dt * 3.2); SH.act = Math.max(0, SH.act - dt * 1.25); if (!SH.act) SH.pose = 'idle';
  SH.bendV += (-SH.bend * 90 - SH.bendV * 9) * dt; SH.bend += SH.bendV * dt; // spring for the tap recoil
  const ctx = cv.getContext('2d')!, t = SH.t, P = PAL[elem] || PAL.fire, pow = .75 + .05 * stars, S = Math.sin;
  const auraC = rare ? 'prism' : stars >= 6 ? GOLD : P.aura;                      // body glow, flames, pillar
  const accC = rare ? 'prism' : tier ? LOOT_GRADES[rar as keyof typeof LOOT_GRADES].col : P.aura; // rarity accents
  const runeC = rare ? 'prism' : tier === 3 || stars >= 6 ? GOLD : accC;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
  const cx = W / 2, feetY = H * .75, rx = Math.min(W * .35, H * .58), ry = rx * .26, u = H / 300;

  // backdrop: element spotlight (+ star sky for the mythic form) + slow rays (+ gold god-rays for legendaries)
  const g = ctx.createRadialGradient(cx, feetY - H * .3, 8, cx, feetY - H * .3, Math.max(W, H) * .72);
  g.addColorStop(0, P.aura + '66'); g.addColorStop(.55, P.aura + '18'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (mythic) starSky(ctx, W, H, t);
  lit(ctx, 'fx_rays', auraC, t, cx, feetY - H * .36, H * 1.5, H * 1.5, (.26 + .06 * S(t * 1.3)) * pow, { rot: t * .12 });
  if (tier === 3) lit(ctx, 'fx_rays', GOLD, t, cx, feetY - H * .42, H * 2.1, H * 2.1, (.42 + .1 * S(t * .9)) * pow, { rot: -t * .06 });

  // the monster's pose and screen box (flames, halo and orbs fit the body)
  const key = poseKey(look, 'front', SH.pose), img = spr(look, key); if (!img) return;
  const sc = Math.min((feetY - 10) / 400, W * .92 / 512) * (.86 + .14 * easeBack(SH.enter));
  const hop = SH.pose === 'joy' || SH.pose === 'attack' ? Math.sin(Math.min(1, (1 - SH.act) * 1.6) * Math.PI) * 26 * (SH.act > 0 ? 1 : 0) : 0;
  const [bx0, by0, bx1, by1] = boxOf(look, key), bw = (bx1 - bx0) * sc, bh = (by1 - by0) * sc;
  const bcx = cx + ((bx0 + bx1) / 2 - PIV[0]) * sc, btop = feetY - hop + (by0 - PIV[1]) * sc, bmid = btop + bh * .55;

  // evolved: a pillar of light rising from the pedestal
  if (evo) lit(ctx, 'fx_column', auraC, t, cx, feetY - H * .52, rx * 1.15, H * 1.08, (.42 + .12 * S(t * 1.7)) * pow);

  // pedestal (gems/inlay in the rarity colour; gold trim for legendary, evolved and ★6)
  drawPedestal(ctx, cx, feetY, rx, elem, { acc: rare ? PRISM : [accC], gold: tier === 3 || evo || stars >= 6, t, glow: (.45 + .15 * tier + (evo ? .1 : 0)) * pow });

  // on the pedestal top: pulse rings (rare+), turning rune circle (epic+), gold ground burst (legendary)
  const flat = ry / rx;
  if (tier >= 1 || rare || evo) { const n = tier >= 3 ? 3 : 2; for (let k = 0; k < n; k++) { const v = (t * .42 + k / n) % 1, r = rx * (.22 + .8 * v); lit(ctx, 'fx_ring', accC, t, cx, feetY, r * 2, r * 2, (1 - v) * (1 - v) * .9 * pow, { k: flat, off: k, paint: true }); } }
  if (tier >= 2 || evo || rare) lit(ctx, 'fx_rune_circle', runeC, t, cx, feetY, rx * 1.68, rx * 1.68, (.5 + .12 * tier + .12 * S(t * 2)) * pow, { k: flat, rot: t * .22, paint: true });
  if (tier === 3) lit(ctx, 'fx_aura_burst_ground', runeC, t, cx, feetY, rx * 1.4, rx * 1.4, (.2 + .08 * S(t * 2.6)) * pow, { k: flat, rot: -t * .1, off: 3 });
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + t * .6, c = pick(accC === 'prism' ? PRISM[i % 6] : accC); ctx.globalAlpha = .5 + .3 * S(t * 3 + i); ctx.drawImage(dot(c), cx + Math.cos(a) * rx * .72 - 6, feetY + Math.sin(a) * ry * .72 - 6, 12, 12); }
  ctx.restore();

  // behind the body: aura flames (epic+ / evolved / rare form), a second gold layer (legendary), prism halo (rare form)
  if (tier >= 2 || evo || rare) {
    const fa = (.36 + .08 * tier + (evo ? .08 : 0) + (rare ? .1 : 0)) * pow, fl = 1 + .035 * S(t * 7) + .02 * S(t * 11.3);
    if (tier === 3) lit(ctx, 'fx_aura_flame_b', rare ? 'prism' : GOLD, t, bcx, feetY - hop - bh * .66, bw * 2, bh * 1.8 * (2 - fl), fa * 1.1, { off: 3 });
    lit(ctx, 'fx_aura_flame', auraC, t, bcx, feetY - hop - bh * .58, bw * 1.7, bh * 1.55 * fl, tier === 3 ? fa * .6 : fa);
  }
  if (rare) { const s = Math.max(bw, bh * .85) * 1.05; lit(ctx, 'fx_ring', 'prism', t, bcx, btop + bh * .4, s, s, .8 * pow, { off: 2 }); lit(ctx, 'fx_ring', 'prism', t, bcx, btop + bh * .4, s * 1.12, s * 1.12, .4 * pow, { off: 4 }); }
  // legendary: light streaks rising from the rim
  if (tier === 3) for (let i = 0; i < 6; i++) {
    const v = (t * .32 + i / 6) % 1, a = (i / 6) * TAU + .4, x = cx + Math.cos(a) * rx * .9, y0 = feetY + Math.sin(a) * ry * .9;
    lit(ctx, 'fx_light_shaft', rare ? PRISM[i] : GOLD, t, x, y0 - v * H * .5 - 30 * u, 8 * u, 70 * u, Math.sin(v * Math.PI) * .9 * pow);
  }
  // evolved: orbs circling the body — the back half before the monster, the front half after
  const orbs = evo ? [0, 1, 2].map(i => { const a = t * 1.15 + i * TAU / 3; return { x: bcx + Math.cos(a) * Math.max(rx * .8, bw * .62), y: bmid + Math.sin(a) * ry * 1.25, z: Math.sin(a), c: auraC === 'prism' ? PRISM[i * 2] : auraC }; }) : [];
  const orb = (o: { x: number; y: number; z: number; c: string }) => { const s = (20 + 6 * o.z) * u; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .55 + .25 * o.z; ctx.drawImage(dot(o.c), o.x - s * 1.6, o.y - s * 1.6, s * 3.2, s * 3.2); ctx.restore(); fx(ctx, 'fx_orb', o.c, o.x, o.y, s, s, (.75 + .2 * o.z) * pow, t * 2); };
  for (const o of orbs) if (o.z < 0) orb(o);

  // the monster: contact shadow (shrinks while hopping), glow, living sprite
  ctx.save(); ctx.globalAlpha = .45 * (1 - hop / 60); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(cx, feetY + 2, 110 * sc * (1 - hop / 80), 22 * sc, 0, 0, TAU); ctx.fill(); ctx.restore();
  ctx.save(); ctx.translate(cx, feetY - hop); ctx.scale(sc, sc);
  const ga = (.3 + .05 * tier + (evo ? .06 : 0) + (rare || stars >= 6 ? .14 : 0)) * pow + .14 * S(t * 2.6), [g1, g2, gf] = pc(auraC, t);
  ctx.globalCompositeOperation = 'lighter';
  if (gf < .99) { ctx.globalAlpha = ga * (1 - gf); ctx.drawImage(glowOf(look, key, g1), -PIV[0] - GP, -PIV[1] - GP); }
  if (gf > .01) { ctx.globalAlpha = ga * gf; ctx.drawImage(glowOf(look, key, g2), -PIV[0] - GP, -PIV[1] - GP); }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = Math.min(1, SH.enter * 2);
  warpDraw(ctx, img, { breathe: .014 * Math.sin(t * 2.3), bend: SH.bend + 2.5 * Math.sin(t * 1.1), wave: SH.act ? 6 * SH.act : 0, wph: t * 9 });
  ctx.restore();
  for (const o of orbs) if (o.z >= 0) orb(o);

  // glints twinkling round the body (rare+, more for higher tiers)
  const gRate = [0, .8, 2, 3.2][tier] + (rare ? 2 : 0) + (evo ? 1 : 0);
  if (Math.random() < dt * gRate) SH.glints.push({ x: bcx + (Math.random() - .5) * bw * 1.15, y: btop + (Math.random() * 1.05 - .1) * bh, life: .5 + Math.random() * .45, t: 0, s: (14 + Math.random() * 16) * u, c: pick(Math.random() < .5 ? runeC : accC), r: Math.random() * TAU });
  for (const gl of SH.glints) { gl.t += dt; const v = gl.t / gl.life; fx(ctx, 'fx_sparkle', gl.c, gl.x, gl.y, gl.s * S(Math.min(1, v) * Math.PI), gl.s * S(Math.min(1, v) * Math.PI), .95, gl.r + v); }
  SH.glints = SH.glints.filter(gl => gl.t < gl.life);
  // drifting motes
  if (Math.random() < dt * (4 + tier * 2 + (rare ? 4 : 0) + (evo ? 2 : 0))) SH.motes.push({ x: (Math.random() - .5) * 1.4, y: .95, vy: .08 + Math.random() * .12, life: 2 + Math.random() * 2, t: 0, s: 2 + Math.random() * 3.5, c: rare ? PRISM[Math.floor(Math.random() * 6)] : Math.random() < .3 ? '#ffffff' : tier ? pick(accC) : P.aura });
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const m of SH.motes) { m.t += dt; m.y -= m.vy * dt; const v = m.t / m.life; ctx.globalAlpha = Math.sin(Math.min(1, v) * Math.PI) * .9; const s = m.s * 2.6; ctx.drawImage(dot(m.c), cx + m.x * rx - s, m.y * H - s, s * 2, s * 2); }
  ctx.restore();
  SH.motes = SH.motes.filter(m => m.t < m.life && m.y > -.05);
}

/** mythic backdrop: a slowly twinkling star sky */
function starSky(ctx: CanvasRenderingContext2D, W: number, H: number, t: number) {
  if (!SH.sky.length) for (let i = 0; i < 70; i++) SH.sky.push({ x: Math.random(), y: Math.random() * .8, s: .6 + Math.random() * 1.8, ph: Math.random() * TAU });
  const g = ctx.createRadialGradient(W / 2, H * .5, H * .15, W / 2, H * .5, Math.max(W, H) * .75); // deep night round the spotlight
  g.addColorStop(0, 'rgba(22,12,52,0)'); g.addColorStop(.45, 'rgba(18,10,46,.55)'); g.addColorStop(1, 'rgba(5,3,16,.92)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const s of SH.sky) { ctx.globalAlpha = .35 + .45 * Math.max(0, Math.sin(t * 1.6 + s.ph)); const r = s.s * 2.4; ctx.drawImage(dot(s.s > 1.9 ? '#ffe9a8' : '#cfd8ff'), s.x * W - r, s.y * H - r, r * 2, r * 2); }
  ctx.restore();
}

function easeBack(x: number) { const c = 1.70158; return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2; }
