// Monster showcase (คลังมอน): the selected monster stands full-body on a little stage, alive — it breathes and sways,
// its aura pulses (element colour · prism for the rare form · gold at ★6), motes drift up, and tapping it plays a pose.
// Drawn into the DOM canvas #mshow every frame from main.ts; all state lives here so re-rendering the screen keeps it.
import { PAL, PIV, GP, TAU, IMG, spr, poseKey, warpDraw, glowOf, dot, fx } from './assets';

const PRISM = ['#ff6b6b', '#ffb84d', '#ffe66b', '#6bdc8a', '#5bb8ff', '#a98bff'];
const TAP_POSES = ['joy', 'cast', 'attack', 'cast2'];
const SH = { look: '', t: 0, enter: 0, act: 0, pose: 'idle', tapN: 0, bend: 0, bendV: 0, motes: [] as { x: number; y: number; vy: number; life: number; t: number; s: number; c: string }[] };

/** tap: the monster shows off (joy/cast/attack pose with a hop and a little burst of light) */
export function showcaseTap() {
  SH.pose = TAP_POSES[SH.tapN++ % TAP_POSES.length]; SH.act = 1; SH.bendV += 260;
  for (let i = 0; i < 14; i++) SH.motes.push({ x: (Math.random() - .5) * .5, y: .55 + Math.random() * .2, vy: .25 + Math.random() * .35, life: .6 + Math.random() * .5, t: 0, s: 3 + Math.random() * 4, c: '#ffffff' });
}

export function drawShowcase(dt: number) {
  const cv = document.getElementById('mshow') as HTMLCanvasElement | null; if (!cv) return;
  const W = cv.clientWidth, H = cv.clientHeight; if (!W || !H) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const look = cv.dataset.look || '', elem = cv.dataset.elem || 'fire', rare = cv.dataset.rare === '1', stars = +(cv.dataset.stars || 1);
  if (look !== SH.look) { SH.look = look; SH.enter = 0; SH.act = 0; SH.pose = 'idle'; SH.motes.length = 0; }
  SH.t += dt; SH.enter = Math.min(1, SH.enter + dt * 3.2); SH.act = Math.max(0, SH.act - dt * 1.25); if (!SH.act) SH.pose = 'idle';
  SH.bendV += (-SH.bend * 90 - SH.bendV * 9) * dt; SH.bend += SH.bendV * dt; // spring for the tap recoil
  const ctx = cv.getContext('2d')!, t = SH.t, P = PAL[elem] || PAL.fire;
  const aura = rare ? PRISM[Math.floor(t * 3) % PRISM.length] : stars >= 6 ? '#ffd24a' : P.aura;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
  const cx = W / 2, feetY = H * .86;

  // backdrop: element spotlight + slow rays
  const g = ctx.createRadialGradient(cx, feetY - H * .3, 8, cx, feetY - H * .3, Math.max(W, H) * .72);
  g.addColorStop(0, P.aura + '66'); g.addColorStop(.55, P.aura + '18'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (IMG.fx_rays) fx(ctx, 'fx_rays', aura, cx, feetY - H * .36, H * 1.5, H * 1.5, .22 + .05 * Math.sin(t * 1.3), t * .12);

  // stage: dark disc with a gold rim and a glowing inner ring
  const rx = Math.min(W * .36, H * .62), ry = rx * .26;
  ctx.save(); ctx.translate(cx, feetY);
  const pg = ctx.createRadialGradient(0, 0, 4, 0, 0, rx); pg.addColorStop(0, 'rgba(60,45,30,.95)'); pg.addColorStop(1, 'rgba(20,16,12,.9)');
  ctx.fillStyle = pg; ctx.beginPath(); ctx.ellipse(0, 6, rx, ry, 0, 0, TAU); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = '#c99434'; ctx.beginPath(); ctx.ellipse(0, 6, rx, ry, 0, 0, TAU); ctx.stroke();
  ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(255,230,160,.7)'; ctx.beginPath(); ctx.ellipse(0, 3, rx * .97, ry * .9, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .55 + .2 * Math.sin(t * 2);
  ctx.lineWidth = 2; ctx.strokeStyle = aura; ctx.beginPath(); ctx.ellipse(0, 6, rx * .72, ry * .72, 0, 0, TAU); ctx.stroke();
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + t * .6; ctx.globalAlpha = .5 + .3 * Math.sin(t * 3 + i); ctx.drawImage(dot(aura), Math.cos(a) * rx * .72 - 6, 6 + Math.sin(a) * ry * .72 - 6, 12, 12); }
  ctx.restore();

  // the monster
  const key = poseKey(look, 'front', SH.pose), img = spr(look, key); if (!img) return;
  const sc = Math.min((feetY - 10) / 400, W * .92 / 512) * (.86 + .14 * easeBack(SH.enter));
  const hop = SH.pose === 'joy' || SH.pose === 'attack' ? Math.sin(Math.min(1, (1 - SH.act) * 1.6) * Math.PI) * 26 * (SH.act > 0 ? 1 : 0) : 0;
  // contact shadow (shrinks while hopping)
  ctx.save(); ctx.globalAlpha = .45 * (1 - hop / 60); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(cx, feetY + 2, 110 * sc * (1 - hop / 80), 22 * sc, 0, 0, TAU); ctx.fill(); ctx.restore();
  ctx.save(); ctx.translate(cx, feetY - hop); ctx.scale(sc, sc);
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (rare || stars >= 6 ? .55 : .32) + .14 * Math.sin(t * 2.6);
  ctx.drawImage(glowOf(look, key, aura), -PIV[0] - GP, -PIV[1] - GP);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = Math.min(1, SH.enter * 2);
  warpDraw(ctx, img, { breathe: .014 * Math.sin(t * 2.3), bend: SH.bend + 2.5 * Math.sin(t * 1.1), wave: SH.act ? 6 * SH.act : 0, wph: t * 9 });
  ctx.restore();

  // drifting motes
  if (Math.random() < dt * (rare || stars >= 6 ? 9 : 5)) SH.motes.push({ x: (Math.random() - .5) * 1.4, y: .95, vy: .08 + Math.random() * .12, life: 2 + Math.random() * 2, t: 0, s: 2 + Math.random() * 3.5, c: rare ? PRISM[Math.floor(Math.random() * 6)] : Math.random() < .3 ? '#ffffff' : aura });
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const m of SH.motes) { m.t += dt; m.y -= m.vy * dt; const u = m.t / m.life; ctx.globalAlpha = Math.sin(Math.min(1, u) * Math.PI) * .9; const s = m.s * 2.6; ctx.drawImage(dot(m.c), cx + m.x * rx - s, m.y * H - s, s * 2, s * 2); }
  ctx.restore();
  SH.motes = SH.motes.filter(m => m.t < m.life && m.y > -.05);
}

function easeBack(x: number) { const c = 1.70158; return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2; }
