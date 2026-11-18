// After the last bell: the referee calls both fighters to the middle of the ring. They touch gloves, stand either side
// of him while he holds a wrist of each, then he raises the winner's arm. The camera circles the three of them.
// When a title or a tournament was at stake and the player's man won it, the scene goes on: the referee brings the belt
// and puts it round his waist, or hands him the cup and he lifts it over his head (h.prize, an object from prize.js).
// Once the scene proper is over (the result is on screen by then) the ring goes on behind it: the two show each other
// respect (a wai and a bow after a decision; down on their knees, forehead to the canvas, after a knockout), then the
// winner celebrates in one of several ways (h.style) and stays in it: 'ropes' he runs to the corner, jumps up on the ropes
// and throws his arms up to the crowd; 'roar' fists down and a roar, then both arms flexed; 'slide' a run and a slide on
// the knees with the arms wide; 'bow' he kneels to the crowd and bows three times.
// A draw (h.draw): the referee lifts an arm of each, then the two embrace and wai each other; nobody celebrates.
// Presentation only: the winner comes from the fight result.
import { FLAT, NP, IDX } from './poses.js';
const THREE = globalThis.THREE;

export const CER_LEN = 9.6, PRIZE_LEN = 6.6; // seconds; the prize adds PRIZE_LEN
export const CELEBRATIONS = ['ropes', 'roar', 'slide', 'bow'];
// the prize: it appears in the referee's hands, he turns to the winner, hands it over, steps back, and the winner shows it off
const TP = {show: [8.7, 9.2], turn: [8.9, 9.8], give: [10.0, 11.1], back: [11.4, 12.3], take: [9.9, 10.7], lift: [10.9, 11.8], cheer: [11.9, 15.6], done: 11.25};
const T = {touch: [.3, 1.0], untouch: [1.7, 2.3], walk: [2.1, 3.0], grab: [2.9, 3.4], raise: [4.9, 5.35], release: [5.0, 5.5], both: [6.3, 6.8], hop: [6.8, 8.6]};
const sm = (r, x) => { const k = Math.max(0, Math.min(1, (x - r[0]) / (r[1] - r[0]))); return k * k * (3 - 2 * k); };
const FRONT = -Math.PI / 2; // facing the main camera side of the ring (+z)

export function buildCeremony(camera) {
  const C = {on: false, t: 0, raised: false, len: CER_LEN, prized: false, respected: false, cheered: false};
  const P = [new Float32Array(NP), new Float32Array(NP), new Float32Array(NP)], UP = new THREE.Vector3(0, 1, 0);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), tmp = new THREE.Vector3(), c = new THREE.Vector3(), camA = new THREE.Vector3(), lookA = new THREE.Vector3();
  let W = null, L = null, R = null, hooks = {};
  const set3 = (P, i, x, y, z) => { P[i] = x; P[i + 1] = y; P[i + 2] = z; };
  const mix3 = (P, i, x, y, z, k) => { P[i] += (x - P[i]) * k; P[i + 1] += (y - P[i + 1]) * k; P[i + 2] += (z - P[i + 2]) * k; };
  const blend = (out, A, B, k) => { for (let j = 0; j < NP; j++) out[j] = A[j] + (B[j] - A[j]) * k; };
  // a point in the world, in an actor's own frame (x ahead, y up, z to his right)
  const toLocal = (p, at, out) => out.copy(p).sub(tmp.set(at.x, 0, at.z)).applyAxisAngle(UP, -at.yaw);

  // win, lose: the fighters (winner first); ref: the referee. h: {onRaise()}
  C.start = function (win, lose, ref, h) {
    W = win; L = lose; R = ref; hooks = h || {}; C.on = true; C.t = 0; C.raised = false; C.prized = false; C.respected = false; C.cheered = false;
    C.len = CER_LEN + (hooks.prize ? PRIZE_LEN : 0);
    R.root.visible = true;
  };
  C.stop = function () { C.on = false; if (R) R.root.visible = false; if (hooks.prize) hooks.prize.obj.visible = false; };

  // ---- after the scene proper: respect, then the winner's celebration (see the top of the file)
  const Q0 = new Float32Array(NP), Q1 = new Float32Array(NP), Qc = new Float32Array(NP), camB = new THREE.Vector3(), lookB = new THREE.Vector3();
  const yawTo = (dx, dz) => Math.atan2(-dz, dx), near = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k; // turning the short way round
  const lerp = (a, b, k) => a + (b - a) * k, pulse = (r0, r1, x) => sm(r0, x) * (1 - sm(r1, x));
  // a running body after d metres: the feet reach and lift in turn, the arms pump against them
  function runPose(Q, d) {
    const ph = d / 1.3 * Math.PI * 2, sn = Math.sin(ph), cs = Math.cos(ph);
    Q.set(FLAT.cerStand); Q[IDX.lean] = .3; Q[IDX.hdP] = -.12; Q[IDX.hip + 1] += -.03 + Math.abs(cs) * .035;
    set3(Q, IDX.fL, .34 * sn, Math.max(0, cs) * .2, -.11); set3(Q, IDX.fR, -.34 * sn, Math.max(0, -cs) * .2, .11);
    set3(Q, IDX.hL, .16 - .24 * sn, 1.2 + .06 * cs, -.27); set3(Q, IDX.hR, .16 + .24 * sn, 1.2 - .06 * cs, .27);
    set3(Q, IDX.eL, -1, -.4, -.3); set3(Q, IDX.eR, -1, -.4, .3);
  }
  // both arms up and pumping in turn, the head back, looking round at the crowd: what a celebration settles into
  function cheerPose(Q, t, bob) {
    Q.set(FLAT.win); const w = Math.sin(t * 5.2);
    Q[IDX.hL + 1] += .1 * w; Q[IDX.hR + 1] -= .1 * w; Q[IDX.hdY] = Math.sin(t * 1.1) * .4; Q[IDX.hdP] = -.28 + .06 * Math.sin(t * 2.3);
    Q[IDX.jump] = Math.abs(Math.sin(t * 5.2)) * bob;
  }
  const EP = {cam: 0}; // the camera the celebration asks for (camB, lookB) and how much of it
  // A draw ends with the two of them: they step in and embrace, a pat on the back, then step apart and wai each other.
  function afterDraw(e, pw, pl, pr) {
    const TD = {in: [.2, 1.1], hug: [.95, 1.5], out: [3.1, 3.7], wai: [4.0, 4.6], up: [5.7, 6.4]}, z0 = .3, face = sm([.15, .95], e);
    const hug = sm(TD.hug, e) * (1 - sm(TD.out, e)), g = lerp(.5, .21, sm(TD.in, e) * (1 - sm(TD.out, e)));
    pr.z -= 1.45 * sm([0, 1.0], e);                                    // the referee stands back out of it
    pw.x = lerp(pw.x, -g, face); pw.z = lerp(pw.z, z0, face); pw.yaw = near(pw.yaw, 0, face);
    pl.x = lerp(pl.x, g, face); pl.z = lerp(pl.z, z0, face); pl.yaw = near(pl.yaw, Math.PI, face);
    for (const [k, Q] of [[0, Q0], [1, Q1]]) {
      blend(Q, FLAT.cerStand, FLAT.wai, pulse(TD.wai, TD.up, e - k * .12));
      // one arm over the other man's shoulder, one round his ribs, the head past his: the same for both, so they fit
      mix3(Q, IDX.hL, .46, 1.47, -.1, hug); mix3(Q, IDX.hR, .44, 1.2, .15, hug); mix3(Q, IDX.eL, 0, .1, -1, hug); mix3(Q, IDX.eR, 0, -.3, 1, hug);
      Q[IDX.lean] += .12 * hug; Q[IDX.hdY] += .45 * hug; Q[IDX.hdP] += .1 * hug;
      if (e > 1.7 && e < 2.8) Q[IDX.hR] -= Math.max(0, Math.sin((e - 1.7) * 11)) * .05 * hug; // a pat or two on the back
    }
    const kin = sm([0, .7], e); blend(P[0], P[0], Q0, kin); blend(P[1], P[1], Q1, kin);
    if (!C.respected && e >= TD.wai[0] + .25) { C.respected = true; if (hooks.onRespect) hooks.onRespect(); }
    camB.set(.8, 1.3, 3.4); lookB.set(0, 1.15, z0); EP.cam = sm([0, 1.1], e);
  }
  function after(e, pw, pl, pr) {
    if (hooks.draw) return afterDraw(e, pw, pl, pr);
    const H = hooks, kneel = !!H.ko && !H.prize, style = H.style || 'ropes', ring = H.ring || {R: 3.05, ropeY: [.42, .72, 1.02, 1.32]}, cup = H.prize && H.prize.kind !== 'belt';
    const T2 = kneel ? {down: [.9, 1.8], bow: [2.2, 2.9], up: [3.6, 4.3], rise: [4.4, 5.3], go: 5.5} : {down: [.9, 1.6], bow: [.9, 1.6], up: [2.9, 3.6], rise: [2.9, 3.6], go: 4.0};
    const gap = kneel ? .84 : .47, face = sm([.15, .95], e), c = e - T2.go, z0 = .3;
    pr.z -= 1.45 * sm([0, 1.0], e);                                    // the referee stands back out of it
    pw.x = lerp(pw.x, -gap, face); pw.z = lerp(pw.z, z0, face); pw.yaw = near(pw.yaw, 0, face);            // the two turn to each other
    pl.x = lerp(pl.x, gap, face); pl.z = lerp(pl.z, z0, face); pl.yaw = near(pl.yaw, Math.PI, face);
    const resp = (Q, t) => {
      if (kneel) { blend(Q, FLAT.cerStand, FLAT.kneelUp, pulse(T2.down, T2.rise, t)); const kb = pulse(T2.bow, T2.up, t); if (kb > 0) blend(Q, Q, FLAT.krab, kb); }
      else blend(Q, FLAT.cerStand, FLAT.wai, pulse(T2.down, T2.up, t));
    };
    resp(Q0, e); resp(Q1, e - .14); // the loser a beat behind
    const kin = sm([0, .7], e); blend(P[0], P[0], Q0, kin); blend(P[1], P[1], Q1, kin);
    if (cup) { const dn = pulse(T2.down, T2.up, e); for (const [i, zz] of [[IDX.hL, -.13], [IDX.hR, .13]]) { mix3(P[0], i, .12, 2.0, zz, kin); mix3(P[0], i, .34, 1.22, zz, dn); } } // the cup comes down to his chest for the bow, then goes up again
    if (!C.respected && e >= T2.bow[0] + .25) { C.respected = true; if (H.onRespect) H.onRespect(); }
    // the camera for the respect: from the front and a little to one side, low when they kneel
    camB.set(.9, kneel ? 1.0 : 1.3, 3.5); lookB.set(0, kneel ? .68 : 1.12, z0); EP.cam = sm([0, 1.1], e);
    if (c <= 0) return;
    // ---- the celebration
    const sx0 = -gap, kc = sm([0, .4], c); let x = sx0, z = z0, yaw = 0, cheerAt = 9e9, cx2 = 0, cy2 = 1.2, cz2 = 3, lx = 0, ly = 1.2, lz = 0;
    if (style === 'ropes') {
      const sx = W.index ? 1 : -1, cx = sx * ring.R, cz = ring.R, ox = sx * Math.SQRT1_2, oz = Math.SQRT1_2; // the corner on the camera's side of the ring nearest his own, and the way out of it
      const ry = ring.ropeY.length > 2 ? ring.ropeY[1] : ring.ropeY[0];                                       // the rope he stands on
      const gx = cx - ox * 1.0, gz = cz - oz * 1.0, tx = cx - ox * .212, tz = cz - oz * .212, D = Math.hypot(gx - sx0, gz - z0);
      const kr = sm([.1, 1.5], c), j = Math.max(0, Math.min(1, (c - 1.5) / .45)), up = sm([0, 1], j);
      x = lerp(lerp(sx0, gx, kr), tx, up); z = lerp(lerp(z0, gz, kr), tz, up); yaw = near(0, yawTo(ox, oz), sm([0, .5], c));
      if (j <= 0) { runPose(Q0, kr * D); Q0[IDX.hip + 1] -= .15 * sm([1.3, 1.5], c); Q0[IDX.lean] += .1 * sm([1.3, 1.5], c); } // the run, and the dip before the jump
      else {
        cheerPose(Q0, Math.max(0, c - 1.95), .028); const bob = Q0[IDX.jump];
        if (j < 1) { blend(Q0, FLAT.cerStand, Q0, up); Q0[IDX.fL + 1] += .2 * Math.sin(Math.PI * j); Q0[IDX.fR + 1] += .2 * Math.sin(Math.PI * j); } // in the air: knees tucked, arms on their way up
        mix3(Q0, IDX.fL, 0, Q0[IDX.fL + 1], -.212, up); mix3(Q0, IDX.fR, 0, Q0[IDX.fR + 1], .212, up);            // a foot on the rope either side of the post
        set3(Q0, IDX.kL, 1, 0, -.25); set3(Q0, IDX.kR, 1, 0, .25); Q0[IDX.hip] -= .1 * up; Q0[IDX.hip + 1] -= .03 * up; Q0[IDX.lean] = .2 * up; // hips back and the body over the top rope, so the shins rest on the ropes above his feet
        Q0[IDX.jump] = ry * up + .34 * Math.sin(Math.PI * j) + (j >= 1 ? bob : 0);
      }
      cheerAt = 1.95;
      // from outside the corner, a little round to the front so the post is not in the way, looking up at him
      const ca = Math.atan2(oz, ox) + sx * .6; cx2 = cx + Math.cos(ca) * 2.8; cy2 = 1.15; cz2 = cz + Math.sin(ca) * 2.8; lx = x; ly = 1.22 + Q0[IDX.jump] * .9 + (cup ? .12 : 0); lz = z;
    } else if (style === 'roar') {
      z = lerp(z0, z0 + .75, sm([.1, .7], c)); yaw = near(0, FRONT, sm([0, .5], c));
      const a = sm([.55, .95], c), b = sm([2.5, 3.0], c), d = sm([4.3, 4.8], c);
      blend(Q0, FLAT.cerStand, FLAT.roar, a); if (b > 0) blend(Q0, Q0, FLAT.flex, b);
      if (a > .9 && b < .1) { const sh = Math.sin(c * 34) * .012; Q0[IDX.hL + 1] += sh; Q0[IDX.hR + 1] += sh; Q0[IDX.hdP] += Math.sin(c * 29) * .03; } // shaking with it
      if (b > .9 && d < .1) { const fl = Math.sin(c * 7) * .03; Q0[IDX.hL + 1] += fl; Q0[IDX.hR + 1] += fl; }
      if (d > 0) { cheerPose(Qc, c - 4.8, .045 * (1 - sm([7.5, 8.5], c))); blend(Q0, Q0, Qc, d); }
      cheerAt = .8; cx2 = x + .55; cy2 = 1.15; cz2 = Math.min(z + 2.75, 3.5); lx = x; ly = 1.3; lz = z;
    } else if (style === 'slide') {
      const ax = sx0 - .1, az = .7, bz = az + .65, D = Math.hypot(ax - sx0, az - z0), kr = sm([.1, 1.05], c), q = Math.max(0, Math.min(1, (c - 1.05) / 1.25)), ks = 1 - (1 - q) * (1 - q);
      x = lerp(sx0, ax, kr); z = lerp(z0, az, kr) + (bz - az) * ks; yaw = near(0, FRONT, sm([0, .4], c));
      const dn = sm([1.0, 1.3], c), upk = sm([3.8, 4.6], c);
      runPose(Q0, kr * D); if (dn > 0) blend(Q0, Q0, FLAT.slide, dn);
      if (upk > 0) { cheerPose(Qc, c - 4.6, .04 * (1 - sm([7.5, 8.5], c))); blend(Q0, Q0, Qc, upk); }
      cheerAt = 1.15; cx2 = x + .9; cy2 = .8 + .5 * upk; cz2 = Math.min(z + 2.5 + .3 * upk, 3.5); lx = x; ly = .85 + .65 * upk; lz = z; // no further out than the ropes fade for (arena.fadeRopes) // the camera stays close outside the ropes (they fade there)
    } else { // 'bow': to the crowd, three times
      z = lerp(z0, z0 + .6, sm([.1, .7], c)); yaw = near(0, FRONT, sm([0, .5], c));
      const kd = pulse([.7, 1.5], [5.7, 6.5], c); let kb = 0;
      for (let n = 0; n < 3; n++) { const t0 = 2.0 + n * 1.2; kb = Math.max(kb, pulse([t0, t0 + .42], [t0 + .62, t0 + 1.1], c)); }
      blend(Q0, FLAT.cerStand, FLAT.kneelUp, kd);
      const hi = kd * (1 - kb) * sm([1.5, 1.9], c); mix3(Q0, IDX.hL, .2, 1.5, -.035, hi); mix3(Q0, IDX.hR, .2, 1.5, .035, hi); Q0[IDX.hdP] -= .2 * hi; // between bows the gloves go up over the head
      if (kb > 0) blend(Q0, Q0, FLAT.krab, kb);
      const w2 = pulse([6.6, 7.2], [8.4, 9.1], c), arm = sm([9.1, 9.8], c);
      if (w2 > 0) blend(Q0, Q0, FLAT.wai, w2 * .8);                       // on his feet again: a wai to the crowd
      mix3(Q0, IDX.hR, .06, 1.96, .3, arm); mix3(Q0, IDX.eR, 0, -.3, 1, arm); Q0[IDX.hdP] -= .18 * arm; Q0[IDX.hdY] = Math.sin(c * 1.1) * .35 * arm; // then one arm up to them
      cheerAt = 2.2; cx2 = x + 1.0; cy2 = .85 + .35 * (1 - kd); cz2 = z + 2.6; lx = x; ly = .7 + .45 * (1 - kd); lz = z;
    }
    blend(P[0], P[0], Q0, kc); pw.x = lerp(pw.x, x, kc); pw.z = lerp(pw.z, z, kc); pw.yaw = yaw;
    if (cup) { mix3(P[0], IDX.hL, .12, 2.0, -.13, 1); mix3(P[0], IDX.hR, .12, 2.0, .13, 1); } // the cup stays over his head through all of it
    // the loser turns to watch, and claps
    Q1.set(FLAT.cerStand); const clap = sm([1.6, 2.4], c), cl = .04 + .09 * Math.abs(Math.sin(c * 6.2));
    mix3(Q1, IDX.hL, .3, 1.22, -cl, clap); mix3(Q1, IDX.hR, .3, 1.22, cl, clap);
    blend(P[1], P[1], Q1, kc); pl.yaw = near(Math.PI, yawTo(pw.x - pl.x, pw.z - pl.z), .85 * sm([.3, 1.5], c));
    if (!C.cheered && c >= cheerAt) { C.cheered = true; if (H.onCheer) H.onCheer(new THREE.Vector3(pw.x, 1.4 + P[0][IDX.jump], pw.z), style); }
    const k2 = sm([.1, 1.15], c); C.keepRopes = style === 'ropes' && k2 > .85; camB.lerp(tmp.set(cx2, cy2, cz2), k2); lookB.lerp(tmp.set(lx, ly, lz), k2);
  }

  // advance by dt (or jump to time t) and pose everyone; returns false once the scene is over
  C.update = function (dt, t) {
    if (!C.on) return false;
    C.t = t != null ? t : C.t + dt; const s = C.t;
    // where each one stands: facing each other to touch gloves, then in a line facing the front, the referee between
    const walk = sm(T.walk, s), refIn = sm([2.3, 3.1], s);
    const pw = {x: -.36 - .2 * walk, z: 0, yaw: FRONT * walk};
    const pl = {x: .36 + .2 * walk, z: 0, yaw: Math.PI + Math.PI / 2 * walk};
    const pr = {x: 0, z: -.8 + .88 * refIn, yaw: FRONT}; // ends a little in front, so his arms read against theirs
    const Z = hooks.prize, belt = Z && Z.kind === 'belt', turn = Z ? sm(TP.turn, s) * (1 - sm(TP.back, s)) : 0, away = Z ? sm(TP.turn, s) : 0, give = Z ? sm(TP.give, s) : 0, show = Z ? sm(TP.show, s) : 0;
    if (Z) { pr.yaw = FRONT - Math.PI / 2 * turn; pr.x = -.05 * turn + .42 * sm(TP.back, s); pr.z += .1 * turn; pl.x += .6 * away; } // the referee turns to the winner, then stands clear; the loser makes room
    const breathe = (P, ph) => { P[IDX.hip + 1] += Math.sin(s * 2.6 + ph) * .006; P[IDX.hL + 1] += Math.sin(s * 2.6 + ph) * .004; P[IDX.hR + 1] += Math.sin(s * 2.6 + ph) * .004; };
    // the fighters: touch gloves with a small bow, then stand tall with the near arm out for the referee
    const touch = sm(T.touch, s) * (1 - sm(T.untouch, s)), grab = sm(T.grab, s), raise = sm(T.raise, s), both = sm(T.both, s), rel = sm(T.release, s);
    for (const [k, A, near] of [[0, W, 'L'], [1, L, 'R']]) {
      const Q = P[k]; blend(Q, FLAT.cerStand, FLAT.cerTouch, touch);
      const side = near === 'L' ? -1 : 1, hi = IDX['h' + near];
      mix3(Q, hi, .14, Q[IDX.hip + 1] + .16, side * .3, grab * (k === 1 && !hooks.draw ? 1 - rel : 1)); // the near arm offered to the referee, wrist at belly height
      if (hooks.draw) { // a draw: each has his near arm lifted, and looks across at the other
        mix3(Q, hi, .08, 1.92, side * .36, raise); mix3(Q, IDX['e' + near], 0, -.3, side, raise); Q[IDX.hdP] += -.1 * raise; Q[IDX.hdY] += -side * .3 * sm([5.6, 6.4], s);
      }
      else if (k === 0) { // the winner: his arm goes up with the referee's, then the other one too, then a couple of little jumps
        mix3(Q, hi, .08, 1.92, side * .36, raise); mix3(Q, IDX.eL, 0, -.3, -1, raise); // up, and in over the referee
        mix3(Q, IDX.hR, .04, 1.93, .3, both); mix3(Q, IDX.eR, 0, -.3, 1, both);
        Q[IDX.hdP] += -.2 * raise; Q[IDX.lean] -= .04 * raise;
        if (s > T.hop[0] && s < T.hop[1]) Q[IDX.jump] = Math.max(0, Math.sin((s - T.hop[0]) * 7.5)) * .045;
        if (Z && !belt) { // the cup: both hands down in front to take it, then up over the head with it
          const take = sm(TP.take, s) * (1 - sm(TP.lift, s)), lift = sm(TP.lift, s);
          mix3(Q, IDX.hL, .3, Q[IDX.hip + 1] + .32, -.12, take); mix3(Q, IDX.hR, .3, Q[IDX.hip + 1] + .32, .12, take);
          mix3(Q, IDX.hL, .12, 2.0, -.13, lift); mix3(Q, IDX.hR, .12, 2.0, .13, lift); Q[IDX.hdP] += .25 * take;
        }
        if (Z && s > TP.cheer[0] && s < TP.cheer[1] - .6) Q[IDX.jump] = Math.max(0, Math.sin((s - TP.cheer[0]) * 6.5)) * .05; // the champion's little jumps
      } else { Q[IDX.hdP] += .35 * rel; Q[IDX.lean] += .05 * rel; } // the loser takes it with his head down
      breathe(Q, k * 1.7);
    }
    const e = s - C.len; EP.cam = 0; C.keepRopes = false;
    if (e > 0) after(e, pw, pl, pr); else { C.respected = false; C.cheered = false; } // (a jump back in time, for checks, starts it over)
    W.update(P[0], 0, pw.x, pw.z, pw.yaw); L.update(P[1], 0, pl.x, pl.z, pl.yaw);
    // the referee holds the near wrist of each, looks from one to the other, and lifts the winner's
    const Q = P[2]; Q.set(FLAT.cerStand); breathe(Q, 3.1);
    const wrist = (F, n, out) => { F.world('ha' + n, a); F.world('el' + n, b); return out.copy(a).lerp(b, .22); };
    const free = e > 0 ? 1 - sm([0, .5], e) : 1, hold = grab * refIn * free; // he lets go once the scene proper is over
    wrist(W, 'L', a); toLocal(a, pr, b); mix3(Q, IDX.hR, b.x, b.y, b.z, hold);
    wrist(L, 'R', a); toLocal(a, pr, b); mix3(Q, IDX.hL, b.x, b.y, b.z, hold * (hooks.draw ? 1 : 1 - rel));
    mix3(Q, IDX.eR, 0, -.4, 1, raise * free); if (hooks.draw) mix3(Q, IDX.eL, 0, -.4, -1, raise * free);
    if (s > 3.4 && s < 4.9) Q[IDX.hdY] = Math.sin((s - 3.4) / 1.5 * Math.PI * 2) * .45 * sm([3.4, 3.7], s); // a look at each of them
    if (Z) { // both hands carry the prize in front of him, then reach to the winner with it, then let go
      const hold = show * (1 - sm([TP.give[1] - .1, TP.give[1] + .5], s)), hy = belt ? 1.0 : 1.12, reach = give * hold;
      mix3(Q, IDX.hL, .3, hy, -.15, hold); mix3(Q, IDX.hR, .3, hy, .15, hold);
      W.world('hip', a); toLocal(a, pr, b); // where the winner's waist is, for him
      mix3(Q, IDX.hL, b.x - .02, belt ? b.y + .06 : b.y + .34, b.z - .17, reach); mix3(Q, IDX.hR, b.x - .02, belt ? b.y + .06 : b.y + .34, b.z + .17, reach);
      Q[IDX.hdP] += .2 * hold;
    }
    R.update(Q, 0, pr.x, pr.z, pr.yaw);
    if (Z) { // the prize itself: in the referee's hands, then across to the winner, then his
      const o = Z.obj; o.visible = show > 0.02;
      R.world('haL', a).add(R.world('haR', b)).multiplyScalar(.5); // between the referee's hands
      if (belt) { // round his own waist: as deep and as wide as he is there, set forward by as much as his front is ahead of his back
        const w = (W.model && W.model.dims.waist) || [.14, .12, .17], sx = (w[0] + w[1]) / 2 + .012, sz = w[2] + .012, yaw = pr.yaw + (pw.yaw - pr.yaw) * give, k = show * (.75 + .25 * give) / Z.r;
        W.world('hip', b); b.y += .075; tmp.set((w[0] - w[1]) / 2, 0, 0).applyAxisAngle(UP, pw.yaw); b.add(tmp);
        o.position.copy(a).lerp(b, give); o.rotation.set(0, yaw, 0); o.scale.set(sx * k, show * (.75 + .25 * give), sz * k);
      }
      else { W.world('haL', b).add(W.world('haR', c)).multiplyScalar(.5); b.y -= .2; const g = sm([TP.take[0] + .3, TP.take[1]], s); a.y -= .12; o.position.copy(a).lerp(b, g); o.rotation.set(0, pw.yaw, 0); o.scale.setScalar(show); }
      if (!C.prized && s >= TP.done) { C.prized = true; if (hooks.onPrize) hooks.onPrize(o.position.clone()); }
    }
    if (!C.raised && s >= T.raise[0] + .25) { C.raised = true; if (hooks.onRaise) hooks.onRaise(W.world('haL', new THREE.Vector3())); }
    // camera: a slow circle round the three, low and closing in for the raised hand
    const az = -.85 + s * .18, D = 3.4 - .55 * sm([4.6, 5.6], s), h = 1.05 + .22 * sm([0, 3], s);
    camA.set(Math.sin(az) * D, h, Math.cos(az) * D); lookA.set(0, 1.22 + .18 * sm([4.6, 5.6], s), 0);
    if (Z) { // the prize: in close on the winner from his front while it is handed over, then back out and slowly round him
      const k = sm([8.5, 9.6], s), out = sm([11.3, 12.6], s), az2 = -.42 + .5 * out + Math.max(0, s - 12.6) * .12, D2 = 2.15 + .9 * out;
      camA.lerp(tmp.set(pw.x + Math.sin(az2) * D2, 1.02 + .2 * out, Math.cos(az2) * D2), k); lookA.lerp(tmp.set(pw.x + .14 * (1 - out), (belt ? 1.02 : 1.25) + (belt ? .2 : .25) * out, 0), k);
    }
    if (EP.cam > 0) { camA.lerp(camB, EP.cam); lookA.lerp(lookB, EP.cam); } // the respect and the celebration have their own
    camera.position.copy(camA); camera.lookAt(lookA);
    if (camera.fov !== 34) { camera.fov = 34; camera.updateProjectionMatrix(); }
    return C.t < C.len;
  };
  return C;
}
