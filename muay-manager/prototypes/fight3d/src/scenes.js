// Activity scenes for the training screen (run, leisure, rest): a painted picture (assets/acts, made with ChatGPT,
// see docs/ACTIVITY_ART_BRIEF.md) that moves slowly, with light, steam or sparkles drawn over it, and a few things to
// tap. Presentation only: the game layer decides what the activity gives. Website only: the pictures are not in the
// claude.ai page, which has no room left.
export function sceneArt() {
  const el = document.getElementById('act-art');
  try { return el ? JSON.parse(el.textContent) : null; } catch (e) { return null; }
}
// per picture: the slow camera move [scale, x, y] from -> to (x, y as a share of the frame), and what is drawn over it,
// in picture coordinates (0..1): mote (light specks in an area), steam (rising puffs at a point), spark (twinkles in an
// area), flicker (a screen's light), and the spots to press (rest) or where the float bobs (fishing)
const LOOK = {
  run_1: {kb: [[1.04, 0, 0], [1.3, .01, -.05]], fx: [['mote', 0, 0, 1, .75, 26]], cap: 'วิ่งเช้าผ่านทุ่งนา'},
  run_2: {kb: [[1.04, 0, .05], [1.32, 0, -.08]], fx: [['mote', .1, 0, .9, .6, 30]], cap: 'วิ่งขึ้นบันไดนาค'},
  fun_1: {kb: [[1.1, -.04, 0], [1.18, .03, .02]], fx: [['spark', .16, .5, .98, .62, 22]], float: [.6, .55], cap: 'ตกปลาริมคลอง'},
  fun_2: {kb: [[1.06, 0, .03], [1.14, 0, -.02]], fx: [['steam', .4, .52, .7], ['steam', .55, .54, .7], ['steam', .66, .52, .6]], cap: 'กินข้าวกับที่บ้าน'},
  fun_3: {kb: [[1.06, 0, .05], [1.15, 0, -.02]], fx: [['spark', .1, 0, .9, .28, 34], ['flicker', .58, .2, .18, .14]], cap: 'หนังกลางแปลงงานวัด'},
  rest_1: {kb: [[1.06, .03, 0], [1.15, -.02, .02]], fx: [['mote', .2, 0, .95, .55, 18]], spots: [[.38, .52], [.47, .55], [.58, .6], [.68, .64], [.8, .66]], cap: 'นวดแผนไทย'},
  rest_2: {kb: [[1.06, -.02, 0], [1.15, .03, .02]], fx: [['steam', .82, .5, 1.5], ['steam', .46, .3, .7], ['mote', .1, 0, .9, .5, 14]], spots: [[.44, .28], [.5, .34], [.56, .4], [.52, .47], [.47, .52]], cap: 'ประคบสมุนไพร'}
};
export const SCENE_KEYS = {run: ['run_1', 'run_2'], fun: ['fun_1', 'fun_2', 'fun_3'], rest: ['rest_1', 'rest_2']};

// play one picture in the stage for `len` seconds; returns controls the game uses while it plays
export function playScene(stage, key, src, len, hooks) {
  const L = LOOK[key] || {kb: [[1.05, 0, 0], [1.12, 0, 0]], fx: []};
  const ui = document.createElement('div'); ui.className = 'scene';
  ui.innerHTML = '<div class="scv"><img alt=""><canvas></canvas><div class="spots"></div></div><div class="scap"></div><div class="sbig"></div>';
  stage.appendChild(ui);
  const view = ui.querySelector('.scv'), img = ui.querySelector('img'), cv = ui.querySelector('canvas'), g = cv.getContext('2d'), spots = ui.querySelector('.spots');
  img.src = src; ui.querySelector('.scap').textContent = L.cap || '';
  const t0 = performance.now() / 1000, parts = [], dpr = Math.min(2, window.devicePixelRatio || 1);
  let W = 0, H = 0, iw = 0, ox = 0, raf = 0, bob = 0, live = true, ripple = -9;
  function size() { // the picture covers the frame: crop the sides of a 3:2 picture in a 4:3 frame
    W = view.clientWidth; H = view.clientHeight; iw = Math.max(W, H * 1.5); ox = (iw - W) / 2;
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
  }
  const at = (u, v) => [u * iw - ox, v * (iw / 1.5) - ((iw / 1.5) - H) / 2]; // picture -> frame
  size();
  // the spots to press, placed on the picture so they move with it
  (L.spots || []).forEach((p, i) => {
    const b = document.createElement('button'); b.className = 'spot'; b.setAttribute('aria-label', 'จุดนวด ' + (i + 1));
    const [x, y] = at(p[0], p[1]); b.style.left = x + 'px'; b.style.top = y + 'px'; b.hidden = true; b.dataset.i = i;
    b.addEventListener('pointerdown', e => { e.preventDefault(); if (b.hidden) return; b.hidden = true; puff(p[0], p[1]); if (hooks.spot) hooks.spot(i); });
    spots.appendChild(b);
  });
  function puff(u, v) { for (let k = 0; k < 10; k++) parts.push({k: 'steam', u, v, a: Math.random() * 6.28, life: 0, max: .9 + Math.random() * .5, s: .5 + Math.random()}); }
  let lastT = 0;
  function frame() {
    if (!live) return;
    const t = performance.now() / 1000 - t0, fdt = Math.min(.1, t - lastT || .016);
    lastT = t;
    const p = Math.min(1, t / len), e = p * p * (3 - 2 * p), A = L.kb[0], B = L.kb[1];
    const sc = A[0] + (B[0] - A[0]) * e, tx = (A[1] + (B[1] - A[1]) * e) * 100, ty = (A[2] + (B[2] - A[2]) * e) * 100;
    bob *= .86; view.style.transform = 'translate(' + tx + '%,' + (ty + bob) + '%) scale(' + sc + ')';
    // light, steam and sparkles
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    for (const f of L.fx) {
      if (f[0] === 'steam' && Math.random() < 21 * fdt * (f[3] || 1)) parts.push({k: 'steam', u: f[1] + (Math.random() - .5) * .03, v: f[2], a: 0, life: 0, max: 1.6 + Math.random(), s: f[3] || 1});
      if (f[0] === 'mote' && parts.filter(x => x.k === 'mote').length < f[5]) parts.push({k: 'mote', u: f[1] + Math.random() * (f[3] - f[1]), v: f[2] + Math.random() * (f[4] - f[2]), a: Math.random() * 6.28, life: 0, max: 3 + Math.random() * 3, s: 1});
      if (f[0] === 'spark' && Math.random() < f[5] * fdt) parts.push({k: 'spark', u: f[1] + Math.random() * (f[3] - f[1]), v: f[2] + Math.random() * (f[4] - f[2]), a: 0, life: 0, max: .5 + Math.random() * .5, s: 1});
      if (f[0] === 'flicker') { const [x, y] = at(f[1], f[2]); g.fillStyle = 'rgba(255,250,230,' + (.05 + .07 * Math.abs(Math.sin(t * 7.3) * Math.sin(t * 2.1))) + ')'; g.fillRect(x - f[3] * iw / 2, y - f[4] * H / 2, f[3] * iw, f[4] * H); }
    }
    for (let i = parts.length - 1; i >= 0; i--) {
      const q = parts[i]; q.life += fdt; if (q.life > q.max) { parts.splice(i, 1); continue; }
      const k = q.life / q.max, fade = Math.sin(Math.PI * k);
      let [x, y] = at(q.u, q.v);
      if (q.k === 'steam') { y -= k * 60 * q.s; x += Math.sin(q.life * 2 + q.a) * 8 + Math.cos(q.a) * k * 14; const r = 6 + k * 18 * q.s; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,' + .22 * fade + ')'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
      else if (q.k === 'mote') { y -= k * 14; x += Math.sin(q.life * .9 + q.a) * 6; g.fillStyle = 'rgba(255,240,200,' + .55 * fade + ')'; g.beginPath(); g.arc(x, y, 1.6, 0, 7); g.fill(); }
      else { g.fillStyle = 'rgba(255,250,220,' + .9 * fade + ')'; g.fillRect(x - 1, y - 6 * fade, 2, 12 * fade); g.fillRect(x - 6 * fade, y - 1, 12 * fade, 2); }
    }
    if (L.float) { // the float on the water, rings when a fish takes it
      const [x, y] = at(L.float[0], L.float[1]), r = t - ripple;
      g.fillStyle = '#e8402c'; g.beginPath(); g.arc(x, y + Math.sin(t * 2) * 1.5 + (r < .7 ? Math.sin(r * 30) * 3 : 0), 3.2, 0, 7); g.fill();
      if (r < 1.2) for (let j = 0; j < 3; j++) { const rr = (r * 40 + j * 10); g.strokeStyle = 'rgba(255,255,255,' + Math.max(0, .6 - r * .5) + ')'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(x, y + 2, rr, rr * .35, 0, 0, 7); g.stroke(); }
    }
    if (hooks.tick) hooks.tick(t);
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  const C = {
    step() { bob = -1.2; }, // a stride: the view dips
    bite() { ripple = performance.now() / 1000 - t0; },
    showSpot(i) { const b = spots.children[i]; if (b) b.hidden = false; },
    big(text, cls) { const el = ui.querySelector('.sbig'); el.textContent = text; el.className = 'sbig ' + (cls || ''); el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; },
    end() { live = false; cancelAnimationFrame(raf); ui.remove(); }
  };
  return C;
}
