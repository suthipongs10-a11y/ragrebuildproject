// @ts-nocheck
// Stage-end treasure chest: drops in → tap → shakes while light leaks from the seam, stepping up through the loot
// colours until it reaches the real grade → bursts open → items fly out one by one (best last) → "ต่อไป".
// Self-contained overlay (own canvas + rAF + particles) so it sits on top of the battle scene without touching it.
import { LOOT_GRADES, LOOT_ORDER } from '../core/data';
import { sfx } from './audio';
import { RM } from './engine';

const TAU = Math.PI * 2, PRISM = ['#ff6b6b', '#ffb84d', '#ffe66b', '#6bdc8a', '#5bb8ff', '#a98bff'];
const rnd = (a, b) => a + Math.random() * (b - a), clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** items: [{ icon, label, sub?, grade }] worst → best · grade: chest grade · boss: golden chest */
export function showChest({ items, grade, boss, stars, onDone }) {
  const root = document.createElement('div'); root.className = 'chestfx'; root.innerHTML =
    `<canvas></canvas><div class="ctop"><h2>ชนะ!</h2><div class="bigstars">${[0, 1, 2].map(i => `<span class="${i < stars ? '' : 'off'}" style="animation-delay:${.15 + i * .2}s">★</span>`).join('')}</div></div>
     <p class="chint">แตะหีบเพื่อเปิด</p><div class="loots"></div><div class="cnext"><button class="go" type="button">ต่อไป</button></div>`;
  document.body.appendChild(root);
  const cv = root.querySelector('canvas'), ctx = cv.getContext('2d'), hint = root.querySelector('.chint'), row = root.querySelector('.loots'), next = root.querySelector('.cnext');
  let W = 0, H = 0, DPR = 1, S = 100, cx = 0, cy = 0;
  const fit = () => { DPR = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * DPR; cv.height = H * DPR; S = clamp(Math.min(W * .42, H * .26), 110, 230); cx = W / 2; cy = H * .42; };
  fit(); addEventListener('resize', fit);

  const gi = LOOT_ORDER.indexOf(grade), colOf = g => LOOT_GRADES[g].col;
  const st = { phase: 'drop', t: 0, y: -1, vy: 0, lid: 0, shake: 0, glow: 0, step: 0, col: colOf('common'), rays: 0, flash: 0, flashC: '#fff', shown: 0, nextAt: 0 };
  const parts = [];
  const P = (o) => parts.push(Object.assign({ x: cx, y: cy, vx: 0, vy: 0, g: 0, life: 1, max: 1, size: 6, color: '#fff', add: true }, o));
  const burst = (n, color, spd, size, life, o = {}) => { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, s = spd * rnd(.3, 1); P(Object.assign({ x: cx, y: cy - S * .05, vx: Math.cos(a) * s, vy: Math.sin(a) * s - spd * .25, g: 380, life, max: life, size: size * rnd(.5, 1.2), color }, o)); } };
  const legend = () => grade === 'legendary';
  const curCol = () => legend() && st.phase !== 'charge' && st.phase !== 'drop' && st.phase !== 'idle' ? PRISM[Math.floor(st.t * 6) % PRISM.length] : st.col;

  // ---------- input ----------
  const onTap = () => {
    if (st.phase === 'drop') { st.y = 0; st.vy = 0; st.phase = 'idle'; }
    if (st.phase === 'idle') { st.phase = 'charge'; st.t = 0; hint.classList.add('off'); sfx.charge(); }
    else if (st.phase === 'items') { while (st.shown < items.length) popItem(st.shown++, true); }
  };
  cv.addEventListener('pointerdown', onTap);
  next.querySelector('button').addEventListener('click', () => { close(); onDone && onDone(); });
  let alive = true;
  function close() { alive = false; removeEventListener('resize', fit); root.remove(); }

  // ---------- items (DOM cards that fly out of the chest into the row) ----------
  function popItem(i, fast) {
    const it = items[i], el = document.createElement('div');
    el.className = 'loot g-' + it.grade; el.style.setProperty('--g', colOf(it.grade));
    el.innerHTML = `<span class="li"><img src="${it.icon}" alt=""></span><b>${esc(it.label)}</b>${it.sub ? `<small>${esc(it.sub)}</small>` : ''}`;
    row.appendChild(el);
    const r = el.getBoundingClientRect(), dx = cx - (r.left + r.width / 2), dy = cy - S * .1 - (r.top + r.height / 2);
    el.style.transform = `translate(${dx}px,${dy}px) scale(.2)`; el.style.opacity = '0';
    requestAnimationFrame(() => { el.style.transition = fast ? 'transform .25s ease-out, opacity .2s' : 'transform .55s cubic-bezier(.2,1.5,.4,1), opacity .2s'; el.style.transform = ''; el.style.opacity = '1'; });
    if (fast) return;
    const gr = LOOT_ORDER.indexOf(it.grade);
    burst(10 + gr * 8, colOf(it.grade), 260 + gr * 60, 7, .8);
    if (gr >= 2) { st.flash = .35; st.flashC = colOf(it.grade); sfx.chime(); } else if (it.grade === 'rare') sfx.perfect(); else sfx.coin();
  }

  // ---------- update ----------
  function update(dt) {
    st.t += dt; const T = st.t;
    if (st.phase === 'drop') {
      st.vy += 2600 * dt; st.y += st.vy * dt / H;
      if (st.y >= 0) { st.y = 0; if (st.vy > 300) { st.vy *= -.32; sfx.step(); for (let i = 0; i < 14; i++) P({ x: cx + rnd(-S * .5, S * .5), y: cy + S * .52, vx: rnd(-90, 90), vy: rnd(-90, -20), g: 120, life: .6, max: .6, size: rnd(6, 12), color: 'rgba(230,210,170,.7)', add: false }); } else { st.vy = 0; st.phase = 'idle'; st.t = 0; hint.classList.add('show'); } }
    } else if (st.phase === 'idle') {
      st.glow = .15 + .1 * Math.sin(T * 3);
      if (Math.random() < dt * 3) P({ x: cx + rnd(-S * .5, S * .5), y: cy + rnd(-S * .3, S * .4), vy: -30, life: 1, max: 1, size: rnd(3, 6), color: colOf('common') });
    } else if (st.phase === 'charge') {
      // step up through the colours: common → … → real grade, one beat each
      const beat = RM ? .25 : .55, k = Math.min(gi, Math.floor(T / beat));
      if (k > st.step) { st.step = k; st.flash = .25; st.flashC = colOf(LOOT_ORDER[k]); sfx.perfect(); burst(12, colOf(LOOT_ORDER[k]), 200, 6, .6); }
      st.col = colOf(LOOT_ORDER[st.step]); st.shake = (4 + T * 10) * (1 + st.step * .4); st.glow = .4 + st.step * .2 + Math.sin(T * 30) * .1;
      if (Math.random() < dt * (20 + st.step * 15)) P({ x: cx + rnd(-S * .45, S * .45), y: cy - S * .1, vx: rnd(-40, 40), vy: rnd(-260, -120), g: 0, life: .6, max: .6, size: rnd(3, 7), color: st.col });
      if (T > beat * (gi + 1) + .25) open();
    } else if (st.phase === 'open') {
      st.lid = Math.min(1, st.lid + dt * 4.5); st.rays = Math.min(1, st.rays + dt * 2.5); st.shake *= .85; st.glow = 1;
      if (T > (RM ? .3 : .7) && st.shown === 0) { st.phase = 'items'; st.nextAt = T; }
    }
    if (st.phase === 'items') {
      st.shake *= .85; st.lid = 1;
      if (st.shown < items.length && T >= st.nextAt) { popItem(st.shown++, false); st.nextAt = T + (RM ? .15 : .42); }
      if (st.shown >= items.length && !next.classList.contains('show')) { next.classList.add('show'); st.phase = 'done'; }
    }
    if (st.phase === 'done') st.shake = 0;
    st.flash = Math.max(0, st.flash - dt * 1.6);
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.life -= dt; if (p.life <= 0) { parts.splice(i, 1); continue; } p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .985; }
  }
  function open() {
    st.phase = 'open'; st.t = 0; st.col = colOf(grade); st.flash = legend() ? 1 : .8; st.flashC = st.col; st.shake = 16 + gi * 6;
    sfx.boom(); if (legend()) { sfx.starup(); setTimeout(() => sfx.win(), 250); } else if (gi === 2) sfx.react(); else sfx.chime();
    const cols = legend() ? PRISM : [st.col, '#ffffff'];
    cols.forEach((c, i) => burst(Math.round((30 + gi * 25) / cols.length), c, 420 + gi * 120, 9, 1.3));
    for (let i = 0; i < 18 + gi * 8; i++) P({ x: cx + rnd(-S * .3, S * .3), y: cy - S * .1, vx: rnd(-60, 60), vy: rnd(-520, -260), g: 520, life: 1.4, max: 1.4, size: rnd(5, 10), color: '#ffd76a', coin: true, add: false });
  }

  // ---------- draw ----------
  function rays() {
    const a = st.rays; if (a <= 0) return; const R = Math.max(W, H);
    ctx.save(); ctx.translate(cx, cy - S * .1); ctx.globalCompositeOperation = 'lighter';
    const n = 18;
    for (let i = 0; i < n; i++) {
      const ang = i / n * TAU + st.t * (.25 + gi * .08), w = .07 + (i % 3) * .025, c = legend() ? PRISM[i % PRISM.length] : st.col;
      const g = ctx.createLinearGradient(0, 0, Math.cos(ang) * R * .6, Math.sin(ang) * R * .6); g.addColorStop(0, c + 'cc'); g.addColorStop(1, c + '00');
      ctx.globalAlpha = a * (.35 + .25 * Math.sin(st.t * 3 + i)); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(ang - w) * R, Math.sin(ang - w) * R); ctx.lineTo(Math.cos(ang + w) * R, Math.sin(ang + w) * R); ctx.closePath(); ctx.fill();
    }
    // light pillar
    const pc = curCol(), g = ctx.createLinearGradient(0, -H, 0, 0); g.addColorStop(0, pc + '00'); g.addColorStop(1, pc + 'aa');
    ctx.globalAlpha = a * (.7 + .2 * Math.sin(st.t * 5)); ctx.fillStyle = g; ctx.fillRect(-S * .32, -H, S * .64, H);
    ctx.restore();
  }
  function glowDot(x, y, r, c, a) { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, c); g.addColorStop(.35, c + '88'); g.addColorStop(1, c + '00'); ctx.globalAlpha = a; ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); }
  function chest() {
    const sh = st.shake && !RM ? st.shake : 0, ox = rnd(-sh, sh) * .4, rot = Math.sin(st.t * 40) * sh * .002;
    const y0 = (st.y * H) + cy, w = S, bh = S * .56, lh = S * .36, top = y0 - S * .06, L = -w / 2, R = w / 2;
    const wood = boss ? ['#c23040', '#8e1f2a', '#5a1018'] : ['#b47a42', '#8a5a2e', '#5a3818'], metal = boss ? ['#fff0b8', '#ffd27a', '#a8781e'] : ['#f2d48a', '#d0a24a', '#7d5a20'];
    const mg = (y1, y2) => { const g = ctx.createLinearGradient(0, y1, 0, y2); g.addColorStop(0, metal[0]); g.addColorStop(.45, metal[1]); g.addColorStop(1, metal[2]); return g; };
    const col = curCol(), open = st.lid;
    ctx.save(); ctx.translate(cx + ox, 0); ctx.rotate(rot);
    ctx.globalAlpha = .5 * clamp(1 + st.y * 3, 0, 1); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(0, top + bh + S * .03, w * .62, S * .09, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'lighter'; glowDot(0, top, S * (.9 + st.glow * .7), col, .18 + st.glow * .35); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    // ---- open lid (behind the body): inner face swung back on the rear hinge ----
    const th = open * 1.9, fh = lh * Math.max(0, Math.cos(th)), ih = lh * 1.05 * Math.sin(Math.min(th, Math.PI / 2));
    if (open > 0) {
      let g = ctx.createLinearGradient(0, top - ih, 0, top); g.addColorStop(0, wood[1]); g.addColorStop(1, wood[2]);
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(L + 2, top); ctx.lineTo(L + 2, top - ih * .78); ctx.quadraticCurveTo(0, top - ih * 1.12, R - 2, top - ih * .78); ctx.lineTo(R - 2, top); ctx.closePath(); ctx.fill();
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = open * .55; g = ctx.createLinearGradient(0, top, 0, top - ih); g.addColorStop(0, col); g.addColorStop(1, col + '00'); ctx.fillStyle = g; ctx.fill(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = mg(top - ih, top); ctx.lineWidth = S * .035; ctx.beginPath(); ctx.moveTo(L + 2, top - ih * .78); ctx.quadraticCurveTo(0, top - ih * 1.12, R - 2, top - ih * .78); ctx.stroke();
    }
    // ---- body ----
    let g = ctx.createLinearGradient(0, top, 0, top + bh); g.addColorStop(0, wood[0]); g.addColorStop(1, wood[2]);
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(L, top, w, bh, S * .05); ctx.fill();
    g = ctx.createLinearGradient(L, 0, R, 0); g.addColorStop(0, 'rgba(0,0,0,.28)'); g.addColorStop(.25, 'rgba(0,0,0,0)'); g.addColorStop(.75, 'rgba(255,230,190,.08)'); g.addColorStop(1, 'rgba(0,0,0,.32)'); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(40,18,6,.4)'; ctx.lineWidth = 1.5; for (let i = 1; i < 6; i++) { const x = L + w * i / 6; ctx.beginPath(); ctx.moveTo(x, top + 3); ctx.lineTo(x, top + bh - 3); ctx.stroke(); }
    // interior light (open) — a glowing mouth on the top edge
    if (open > 0) { ctx.fillStyle = '#1a0c04'; ctx.beginPath(); ctx.ellipse(0, top + 2, w * .46, S * .07 * open, 0, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'lighter'; g = ctx.createRadialGradient(0, top, 0, 0, top, w * .5); g.addColorStop(0, '#ffffff'); g.addColorStop(.3, col); g.addColorStop(1, col + '00'); ctx.globalAlpha = open; ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, top + 2, w * .46, S * .07 * open, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    // metal: bottom trim, two straps, corner caps, studs
    ctx.fillStyle = mg(top + bh - S * .08, top + bh); ctx.fillRect(L, top + bh - S * .07, w, S * .07);
    ctx.fillStyle = mg(top, top + bh); for (const bx of [-w * .33, w * .33]) ctx.fillRect(bx - S * .045, top, S * .09, bh);
    ctx.fillStyle = mg(top, top + S * .2); for (const [x, y] of [[L, top], [R - S * .12, top], [L, top + bh - S * .14], [R - S * .12, top + bh - S * .14]]) { ctx.beginPath(); ctx.roundRect(x, y, S * .12, S * .14, S * .025); ctx.fill(); }
    ctx.fillStyle = metal[2]; for (const bx of [-w * .33, w * .33]) for (const by of [.25, .55, .8]) { ctx.beginPath(); ctx.arc(bx, top + bh * by, S * .014, 0, TAU); ctx.fill(); }
    if (boss) { for (const bx of [-w * .33, w * .33]) { g = ctx.createRadialGradient(bx - S * .01, top + bh * .4 - S * .01, 1, bx, top + bh * .4, S * .035); g.addColorStop(0, '#ffd0dc'); g.addColorStop(1, '#d01c48'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx, top + bh * .4, S * .032, 0, TAU); ctx.fill(); } }
    // ---- closed / swinging lid: dome front face ----
    if (fh > 1) {
      const ly = top - fh;
      g = ctx.createLinearGradient(0, ly - fh * .3, 0, top); g.addColorStop(0, wood[0]); g.addColorStop(1, wood[1]);
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(L, top); ctx.lineTo(L, ly + fh * .3); ctx.quadraticCurveTo(0, ly - fh * .42, R, ly + fh * .3); ctx.lineTo(R, top); ctx.closePath(); ctx.fill();
      g = ctx.createLinearGradient(L, 0, R, 0); g.addColorStop(0, 'rgba(0,0,0,.25)'); g.addColorStop(.35, 'rgba(255,240,210,.14)'); g.addColorStop(1, 'rgba(0,0,0,.3)'); ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = mg(ly, top); ctx.lineWidth = S * .05; ctx.beginPath(); ctx.moveTo(L + S * .02, ly + fh * .3); ctx.quadraticCurveTo(0, ly - fh * .42, R - S * .02, ly + fh * .3); ctx.stroke();
      ctx.fillStyle = mg(ly, top); for (const bx of [-w * .33, w * .33]) { ctx.beginPath(); ctx.moveTo(bx - S * .045, top); ctx.lineTo(bx - S * .045, ly + fh * .12); ctx.lineTo(bx + S * .045, ly + fh * .1); ctx.lineTo(bx + S * .045, top); ctx.closePath(); ctx.fill(); }
      ctx.fillStyle = mg(top - S * .05, top + S * .02); ctx.fillRect(L, top - S * .045, w, S * .055);
    }
    // lock plate
    if (open < .25) { const ly = top - S * .03; ctx.fillStyle = mg(ly - S * .08, ly + S * .14); ctx.beginPath(); ctx.roundRect(-S * .08, ly - S * .07, S * .16, S * .19, S * .035); ctx.fill(); ctx.fillStyle = boss ? '#5fd0ff' : '#3a2410'; ctx.beginPath(); ctx.arc(0, ly + S * .01, S * .028, 0, TAU); ctx.fill(); ctx.fillRect(-S * .01, ly + S * .02, S * .02, S * .05); }
    // seam light while charging
    if (st.phase === 'charge') { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = clamp(st.glow, 0, 1); ctx.fillStyle = st.col; ctx.fillRect(L + 4, top - 2, w - 8, 5); glowDot(0, top, S * .75, st.col, st.glow * .55); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
    ctx.restore();
  }
  function draw() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, H);
    const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * .7); bg.addColorStop(0, 'rgba(22,18,12,.78)'); bg.addColorStop(1, 'rgba(4,4,6,.94)'); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    rays(); chest();
    for (const p of parts) {
      const a = clamp(p.life / p.max, 0, 1); ctx.globalAlpha = a; ctx.globalCompositeOperation = p.add ? 'lighter' : 'source-over';
      if (p.coin) { ctx.fillStyle = p.color; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.size, p.size * Math.abs(Math.sin(p.life * 12)) + 1, 0, 0, TAU); ctx.fill(); }
      else { const r = p.size * (p.add ? 2.2 : 1); if (p.add) { const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r); g.addColorStop(0, '#fff'); g.addColorStop(.3, p.color); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2); } else { ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill(); } }
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    if (st.flash > 0) { ctx.globalAlpha = Math.min(1, st.flash) * .8; ctx.fillStyle = st.flashC; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  }
  let last = performance.now();
  function frame(now) { if (!alive) return; const dt = Math.min(.05, (now - last) / 1000); last = now; update(dt); draw(); requestAnimationFrame(frame); }
  requestAnimationFrame(frame);
  return { close, tap: onTap, get phase() { return st.phase; } };
}
