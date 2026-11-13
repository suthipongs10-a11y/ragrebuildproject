// Turns a finished fight (sim output) into something that can be played at any time, forward or back:
// per-tick baked poses for both fighters. Because the whole fight is known up front, strikes are aimed
// at where the opponent will be and defenders start blocking before the blow lands.
import { FLAT, NP, IDX } from './poses.js';
import { MOVES, RULES } from './data.js';
import { solve, makeJoints, EFF_JOINT, DIM } from './rig.js';
import { TICK_FIELDS, STATE } from './sim.js';
const THREE = globalThis.THREE;

export const EFF_ID = {handL: 1, handR: 2, footL: 3, footR: 4, elbowL: 5, elbowR: 6, kneeL: 7, kneeR: 8};
export const EFF_NAME = Object.keys(EFF_ID).reduce((o, k) => { o[EFF_ID[k]] = k; return o; }, {});
const TWO_PI = Math.PI * 2;
const ease = k => k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;

// Moves a strike pose so its striking part lands on pt (fighter-local metres). Shifts the hips when the limb alone cannot reach.
const d3 = new THREE.Vector3();
export function aimEffector(target, en, pt3, J) {
  const side = en.endsWith('L') ? 'L' : 'R';
  solve(target, 0, J);
  if (en.startsWith('hand') || en.startsWith('foot')) {
    const isHand = en.startsWith('hand'), base = isHand ? IDX['h' + side] : IDX['f' + side];
    const root = isHand ? J['sh' + side] : J['hp' + side], max = (isHand ? DIM.ua + DIM.fa : DIM.thigh + DIM.shin) - .03;
    // the contact point is the glove centre or the shin just above the ankle
    const ty = isHand ? pt3.y : pt3.y - DIM.ankle;
    d3.set(pt3.x - root.x, pt3.y - root.y, pt3.z - root.z);
    const over = d3.length() - max;
    if (over > 0) { const h = Math.hypot(d3.x, d3.z) || 1, s = Math.min(.38, over * 1.1); target[IDX.hip] += d3.x / h * s; target[IDX.hip + 2] += d3.z / h * s; }
    target[base] = pt3.x; target[base + 1] = ty; target[base + 2] = pt3.z;
  } else {
    const jn = J[EFF_JOINT[en]];
    d3.copy(pt3).sub(jn);
    const h = Math.hypot(d3.x, d3.z), s = h > .42 ? .42 / h : 1;
    d3.x *= s; d3.z *= s; d3.y = Math.max(-.14, Math.min(.16, d3.y));
    target[IDX.hip] += d3.x; target[IDX.hip + 1] += d3.y * .6; target[IDX.hip + 2] += d3.z;
    const lb = en.startsWith('elbow') ? IDX['h' + side] : IDX['f' + side];
    target[lb] += d3.x; target[lb + 1] += d3.y; target[lb + 2] += d3.z;
  }
}

export function bake(fight) {
  const n = fight.nTicks, dt = fight.dt, TK = fight.ticks;
  const tick = (i, k, f) => TK[(Math.max(0, Math.min(n - 1, k)) * 2 + i) * TICK_FIELDS + f];

  // link each move to its outcome
  const pend = [null, null], hitsBy = [[], []];
  for (const e of fight.events) {
    if (e.type === 'move') pend[e.by] = e;
    else if (e.type === 'hit') { hitsBy[e.by].push(e); const m = pend[e.by]; if (m && m.move === e.move) { m.hit = e; e.moveEv = m; pend[e.by] = null; } }
  }
  // How a fighter gets out of the way depends on what is coming: duck under a swing, slip a straight punch, bend right
  // back from a kick (now and then he ducks a high kick instead), lean back from the rest.
  const DUCK = new Set(['hook', 'elbow', 'spinElbow', 'spCroc', 'spChop']), SLIP = new Set(['jab', 'cross']), LEAN = new Set(['high', 'spKick', 'body', 'teepFace']);
  const evade = e => {
    const h = Math.round(e.t / dt);
    if (LEAN.has(e.move)) return (e.move === 'high' || e.move === 'spKick') && h % 3 === 0 ? 'duck' : 'leanBack';
    if (MOVES[e.move].lvl !== 'head') return 'dodge';
    if (DUCK.has(e.move) || (e.move === 'cross' && h % 4 < 2)) return 'duck'; if (SLIP.has(e.move)) return h % 2 ? 'slipL' : 'slipR'; return 'dodge';
  };
  const evadeAt = new Map();
  for (const e of fight.events) if (e.type === 'hit' && e.res === 'dodge') evadeAt.set(e.on + ':' + Math.round(e.t / dt), evade(e));
  const kneeUp = new Set(); // a body kick that is blocked is met with the lifted knee
  for (const e of fight.events) if (e.type === 'hit' && e.res === 'block' && e.move === 'body') kneeUp.add(e.on + ':' + Math.round(e.t / dt));
  // cues per fighter, plus early defence
  const cues = [[], []];
  for (const c of fight.poses) { const key = c.f + ':' + Math.round(c.t / dt), v = c.pose === 'dodge' ? evadeAt.get(key) : c.pose === 'blockBody' && kneeUp.has(key) ? 'checkBody' : null; cues[c.f].push(v ? Object.assign({}, c, {pose: v}) : c); }
  for (const e of fight.events) {
    if (e.type !== 'hit' || (e.res !== 'block' && e.res !== 'dodge')) continue;
    const pose = e.res === 'dodge' ? evade(e) : null, lb = pose === 'leanBack'; // bending back from a kick starts earlier and takes longer
    const tA = e.t - (lb ? .2 : .13), st = tick(e.on, Math.round(tA / dt), 4);
    // a fighter already covering up has the pose from the sim, unless he is about to get out of the way instead
    if (st !== STATE.idle && st !== STATE.block && !(pose && st === STATE.cover)) continue;
    const mv = MOVES[e.move];
    cues[e.on].push({t: tA, f: e.on, pose: pose || (mv.lvl === 'leg' ? 'check' : e.move === 'body' ? 'checkBody' : mv.lvl === 'body' ? 'blockBody' : 'block'), d: lb ? .17 : .11, early: true});
  }
  cues.forEach(c => c.sort((a, b) => a.t - b.t));

  const baked = [new Float32Array(n * NP), new Float32Array(n * NP)];
  const eff = [new Uint8Array(n), new Uint8Array(n)];
  const J = makeJoints(), J2 = makeJoints(), pt3 = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);

  function aimPose(i, cue, target) {
    // find the outcome of this strike
    const tH = cue.t + cue.d, list = hitsBy[i];
    let ev = null;
    for (const e of list) if (Math.abs(e.t - tH) < .05) { ev = e; break; }
    cue.ev = ev;
    if (!ev || (ev.res !== 'hit' && ev.res !== 'block')) return;
    const mv = MOVES[cue.strike], kh = Math.round(tH / dt), o = 1 - i;
    const dist = Math.abs(tick(o, kh, 0) - tick(i, kh, 0)) * .01;
    const ob = baked[o], oo = Math.min(n - 1, kh + (ev.res === 'block' ? 1 : 0)) * NP;
    solve(ob, oo, J2);
    if (ev.res === 'hit') {
      if (mv.lvl === 'head') pt3.copy(J2.head);
      else if (mv.lvl === 'body') { pt3.copy(J2.chest); pt3.y += -.06 + (mv.aimY || 0); }
      else pt3.copy(J2.hpL).add(J2.knL).multiplyScalar(.5);
    } else {
      if (mv.lvl === 'head') pt3.copy(J2.haL).add(J2.haR).multiplyScalar(.5);
      else if (mv.lvl === 'body') pt3.copy(J2.elL).add(J2.haL).multiplyScalar(.5);
      else pt3.copy(J2.knL).add(J2.anL).multiplyScalar(.5);
    }
    // defender-local -> attacker-local (they face each other), then into the attacker's spun frame
    pt3.applyAxisAngle(UP, -ob[oo + IDX.spin]); pt3.y += ob[oo + IDX.jump];
    pt3.set(dist - pt3.x, pt3.y - target[IDX.jump], -pt3.z);
    pt3.applyAxisAngle(UP, target[IDX.spin]);
    aimEffector(target, mv.eff, pt3, J);
  }

  const ONE_HAND = new Set(['clinchElbowW', 'clinchElbow', 'clinchCover']);
  // clinch and catch: place a fighter's hands or foot on the opponent's body as it will be a moment later
  function attach(i, c, target) {
    const o = 1 - i, k = Math.min(n - 1, Math.round((c.t + Math.max(c.d, .12)) / dt)), ob = baked[o], oo = k * NP;
    const dist = Math.abs(tick(o, k, 0) - tick(i, k, 0)) * .01;
    solve(ob, oo, J2);
    const toMine = v => { v.applyAxisAngle(UP, -ob[oo + IDX.spin]); v.y += ob[oo + IDX.jump]; v.set(dist - v.x, v.y - target[IDX.jump], -v.z); return v; };
    if (c.grab === 'neck') {
      toMine(pt3.copy(J2.neck).lerp(J2.head, .25));
      // both gloves behind the neck, or only the lead one while the other arm throws or stops an elbow
      const hands = ONE_HAND.has(c.pose) ? [[IDX.hL, -.04]] : [[IDX.hL, -.07], [IDX.hR, .07]];
      for (const [b, z] of hands) { target[b] = pt3.x + .06; target[b + 1] = pt3.y; target[b + 2] = pt3.z + z; }
    }
    if (c.hold === 'leg') { // the ankle sits in the catcher's lead hand
      toMine(pt3.copy(J2.haL));
      target[IDX.fR] = pt3.x; target[IDX.fR + 1] = pt3.y - DIM.ankle; target[IDX.fR + 2] = pt3.z;
    }
  }

  function pass(i, aim) {
    const out = baked[i], list = cues[i];
    const cur = new Float32Array(FLAT.guard), from = new Float32Array(FLAT.guard);
    let to = FLAT.guard, pt = 0, pd = .001, ci = 0, effUntil = -1, effId = 0;
    for (let k = 0; k < n; k++) {
      const time = k * dt;
      pt += dt;
      while (ci < list.length && list[ci].t <= time + 1e-6) {
        const c = list[ci++];
        let target = FLAT[c.pose] || FLAT.guard;
        if (c.amp != null && c.amp < 1) { const t2 = new Float32Array(NP); for (let j = 0; j < NP; j++) t2[j] = FLAT.guard[j] + (target[j] - FLAT.guard[j]) * c.amp; target = t2; }
        if (c.strike) {
          const mv = MOVES[c.strike];
          effId = EFF_ID[mv.eff]; effUntil = c.t + c.d + .06;
          if (aim) { target = new Float32Array(target); aimPose(i, c, target); }
        }
        if (aim && (c.grab || c.hold)) { if (target === FLAT[c.pose]) target = new Float32Array(target); attach(i, c, target); }
        from.set(cur);
        // take the short way round for whole-body spins
        const ds = target[IDX.spin] - from[IDX.spin];
        if (ds > Math.PI * 1.2) from[IDX.spin] += TWO_PI; else if (ds < -Math.PI * 1.2) from[IDX.spin] -= TWO_PI;
        to = target; pt = 0; pd = c.d;
      }
      const e = ease(Math.min(1, pt / pd));
      for (let j = 0; j < NP; j++) cur[j] = from[j] + (to[j] - from[j]) * e;
      out.set(cur, k * NP);
      eff[i][k] = time <= effUntil ? effId : 0;
    }
  }
  pass(0, false); pass(1, false);
  // second pass aims strikes using the opponent's first-pass motion
  const first = [baked[0].slice(), baked[1].slice()];
  const b0 = baked[0], b1 = baked[1];
  baked[1] = first[1]; pass(0, true); const aimed0 = b0;
  baked[0] = first[0]; baked[1] = b1; pass(1, true);
  baked[0] = aimed0;

  // how much a fighter is free to move on his own (bounce, weave): 1 while idle, eased in and out around everything else
  const idleW = [new Float32Array(n), new Float32Array(n)];
  for (let i = 0; i < 2; i++) { let w = 0; for (let k = 0; k < n; k++) { w = tick(i, k, 4) === STATE.idle ? Math.min(1, w + dt / .16) : Math.max(0, w - dt / .07); idleW[i][k] = w; } }
  // A blow is aimed at where the defender's baked pose puts him. His own bobbing and swaying therefore eases out
  // over the quarter second before anything lands on him or on his guard, or the glove would meet thin air.
  for (const e of fight.events) {
    if (e.type !== 'hit' || (e.res !== 'hit' && e.res !== 'block' && e.res !== 'catch')) continue;
    const k1 = Math.min(n - 1, Math.round(e.t / dt)), span = Math.round(.26 / dt), W = idleW[e.on];
    for (let k = Math.max(0, k1 - span); k <= k1; k++) { const r = (k1 - k) / span; W[k] = Math.min(W[k], r * r * (3 - 2 * r)); }
  }
  const hash = x => { const s = Math.sin(x * 127.1 + 31.7) * 43758.5453; return s - Math.floor(s); };
  // How a fighter carries himself between exchanges follows what his corner asked for this round:
  // 0 feeling out (on his toes, with pauses), 1 walking forward (no bounce), 2 waiting (planted, guard up, slow sway).
  const MODE = {balanced: 0, attack: 1, counter: 2}, mode = [new Uint8Array(n), new Uint8Array(n)];
  for (const e of fight.events) if (e.type === 'plan') mode[e.by].fill(MODE[e.ag] || 0, Math.min(n, Math.round(e.t / dt)));
  const smooth = (a, b, x) => { const k = Math.max(0, Math.min(1, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
  // The pace of the fight (as in the simulation): low while the two are still reading each other in the first round.
  // A low pace means more of the planted Muay Thai rhythm, rocking with the lead knee coming up, and less bouncing.
  const PC = RULES.pace, pace = new Float32Array(n);
  for (let k = 0; k < n; k++) { const r = Math.min(Math.max(1, fight.clock[k * 2]), PC.start.length) - 1, e = Math.max(0, Math.min(1, 1 - fight.clock[k * 2 + 1] / RULES.roundTime)); pace[k] = PC.start[r] + (PC.end[r] - PC.start[r]) * Math.pow(e, PC.ramp); }
  const paceAt = t => pace[Math.max(0, Math.min(n - 1, Math.round(t / dt)))];
  const HOP_PACE = .1; // share of the usual bouncing left at pace 0
  // Muay Thai rhythm between exchanges, as in the stadium clip the owner sent: no bounce, gloves high by the brow and
  // close to the face, elbows in, standing tall with the weight on the rear leg and the lead foot light. The body rocks
  // slowly and the lead knee comes up on the beat while he looks for an opening.
  const RHYTHM = 2 * Math.PI * .75; // rocking beat, rad/s: a little under one a second
  const GUARD_L = [.21, -.025], GUARD_R = [.12, -.045]; // planted guard: each glove forward of and above the head centre, metres
  // feeling out: bounce for about three seconds, then stand and sway for one, then bounce again
  const GATE = .25, gateP = (i, t) => { const g = t * GATE + i * .43; return g - Math.floor(g); }; // a four-second cycle
  // share of each cycle spent on the toes: most of it when feeling out, a short burst for the man walking forward or waiting
  const HOP_ON = [.5, .28, .18];
  // Rhythm guard: how high the lead foot comes up on the beat while standing (per attitude), and while bouncing
  const KNEE_STILL = [.14, .1, .15], KNEE_HOP = [.1, .05, .06];
  const hopGate = (i, t, md) => { const p = gateP(i, t), on = HOP_ON[md] * (HOP_PACE + (1 - HOP_PACE) * paceAt(t)); return smooth(0, .04, p) * (1 - smooth(on, on + .05, p)); };
  // waiting: now and then the feet change over, slowly, one step at a time
  const slowSwitch = (i, t) => { const g = t * .19 + i * .47, c = Math.floor(g); return g - c < .26 && hash(c * 5 + i) < .6; };
  // the bounce: a little over two light hops a second, in the air slightly longer than on the canvas
  // and quicker while he is travelling, so each hop stays short
  const HOP = 14, hopUp = ph => Math.max(0, Math.sin(ph) + .25) / 1.25, hopPh = [new Float32Array(n), new Float32Array(n)];
  for (let i = 0; i < 2; i++) { let ph = i * 1.7, v = 0; for (let k = 0; k < n; k++) { v += (Math.abs(tick(i, k + 1, 0) - tick(i, k, 0)) * .01 / dt - v) * .15; ph += HOP * (1 + Math.min(.9, v * .8)) * dt; hopPh[i][k] = ph; } }

  // Footwork. The simulation slides a fighter along the ring; here the feet are pinned to the canvas.
  // A fighter on his toes moves by bouncing: both feet shift together while he is in the air, and now and then
  // he switches his feet for one bounce. Out of the bounce (mid-strike, hurt) a late foot steps across on its own.
  const GROUNDED = new Set([STATE.intro, STATE.idle, STATE.move, STATE.hit, STATE.block, STATE.stun, STATE.rest, STATE.cover, STATE.win]);
  function footwork(i) {
    const B = baked[i], dir = i ? -1 : 1, TH = .08, LIFT = .05, IW = idleW[i];
    const root = k => tick(i, k, 0) * .01 * dir;                 // position along the fighter's own forward axis
    const feet = [IDX.fL, IDX.fR].map((base, j) => ({base, j, w: 0, at: root(0) + B[base], step: null}));
    let wasUp = false;
    for (let k = 0; k < n; k++) {
      const o = k * NP, t = k * dt, a = root(k), st = tick(i, k, 4);
      const ok = GROUNDED.has(st) && Math.abs(B[o + IDX.spin]) < .05 && B[o + IDX.jump] < .02;
      for (const f of feet) {
        f.lx = B[o + f.base]; f.ly = B[o + f.base + 1]; f.can = ok && f.ly < .035; f.des = a + f.lx;
        if (!f.can) { f.w = Math.max(0, f.w - dt / .07); f.step = null; f.at = f.des; continue; }
        f.w = Math.min(1, f.w + dt / .1);
        if (f.step && t >= f.step.t0 + f.step.dur) { f.at = f.step.to; f.step = null; }
        if (!f.step) f.at = Math.max(f.des - .4, Math.min(f.des + .4, f.at)); // shoved a long way: the foot drags rather than stretches
      }
      const md = mode[i][k], ph = hopPh[i][k], up = hopUp(ph) > 0, bouncing = IW[k] > .5 && hopGate(i, t, md) > .5;
      if (md === 2 && !bouncing && IW[k] === 1 && slowSwitch(i, t)) { feet[0].des -= .26; feet[1].des += .26; }
      if (bouncing && up && !wasUp) { // leaving the canvas: both feet go to where they will be wanted on landing
        let k2 = k + 1; while (k2 < n - 1 && hopUp(hopPh[i][k2]) > 0) k2++;
        const sw = IW[k] === 1 && IW[k2] === 1 && hash(Math.floor(ph / (Math.PI * 2)) * 7 + i * 3) < .15; // a quick switch of the feet
        for (const f of feet) {
          if (!f.can) continue;
          const to = root(k2) + B[k2 * NP + f.base] + (sw ? (f.j ? .3 : -.3) : 0);
          if (Math.abs(to - f.at) > .012) f.step = {t0: t, dur: (k2 - k) * dt, from: f.at, to, lift: 0};
        }
      } else if (!feet[0].step && !feet[1].step) { // off the bounce, or left too far behind to wait for the next hop
        const late = feet.filter(f => f.can && Math.abs(f.des - f.at) > (bouncing ? .24 : TH));
        if (late.length) {
          const fwd = late[0].des - late[0].at > 0, f = late.length > 1 ? feet[fwd ? 0 : 1] : late[0];
          const speed = Math.abs(root(Math.min(n - 1, k + 4)) - a) / (4 * dt), dur = Math.max(.1, Math.min(.16, .16 - speed * .06)) * (md === 2 ? 1.6 : md === 1 ? 1.25 : 1);
          const k2 = Math.min(n - 1, k + Math.round(dur / dt)), ahead = Math.min(.07, speed * .06) * (fwd ? 1 : -1);
          f.step = {t0: t, dur, from: f.at, to: root(k2) + B[k2 * NP + f.base] + (f.des - a - f.lx) + ahead, lift: LIFT};
        }
      }
      wasUp = up;
      for (const f of feet) {
        let at = f.at, lift = 0;
        if (f.step) { const p = Math.min(1, (t - f.step.t0) / f.step.dur); at = f.step.from + (f.step.to - f.step.from) * ease(p); lift = Math.sin(p * Math.PI) * f.step.lift; }
        B[o + f.base] = f.lx + (at - a - f.lx) * f.w; B[o + f.base + 1] = f.ly + lift * f.w;
      }
    }
  }
  footwork(0); footwork(1);

  const TL = {
    fight, n, dt, duration: (n - 1) * dt, baked, eff,
    val(i, t, f) {
      const x = Math.max(0, Math.min(n - 1.001, t / dt)), k = Math.floor(x), fr = x - k;
      const a = TK[(k * 2 + i) * TICK_FIELDS + f], b = TK[((k + 1) * 2 + i) * TICK_FIELDS + f];
      return f === 4 ? a : a + (b - a) * fr;
    },
    clock(t) { const k = Math.max(0, Math.min(n - 1, Math.floor(t / dt))); return {round: fight.clock[k * 2], clock: fight.clock[k * 2 + 1]}; },
    effAt(i, t) { return eff[i][Math.max(0, Math.min(n - 1, Math.round(t / dt)))]; },
    pace: paceAt, // how hard the fight is going at time t (0..1), for the music
    // pose at time t into out, with small living-body motion layered on top
    sample(i, t, out) {
      const x = Math.max(0, Math.min(n - 1.001, t / dt)), k = Math.floor(x), fr = x - k, B = baked[i], o = k * NP;
      for (let j = 0; j < NP; j++) out[j] = B[o + j] + (B[o + NP + j] - B[o + j]) * fr;
      const st = TK[(k * 2 + i) * TICK_FIELDS + 4];
      const iw = idleW[i][k] + (idleW[i][k + 1] - idleW[i][k]) * fr;
      if (iw > 0) {
        const amp = iw * (TK[(k * 2 + i) * TICK_FIELDS + 2] < 25 ? .7 : 1); // a tired fighter moves less
        solve(out, 0, J); let sx = (J.shL.x + J.shR.x) / 2, sy = (J.shL.y + J.shR.y) / 2, sz = (J.shL.z + J.shR.z) / 2; // shoulders before he moves on his own
        const md = mode[i][k], ph = hopPh[i][k] + (hopPh[i][k + 1] - hopPh[i][k]) * fr;
        // slow drift every fighter has while he waits: side to side, front to back, sinking and rising
        const lr = Math.sin(t * 1.7 + i * 2.1) * amp, fb = Math.sin(t * 1.15 + i * .7) * amp, sink = Math.sin(t * 2.4 + i * 1.3);
        // Bounce on the toes, guard up: every attitude has it, for as long as its gate is open.
        const g = hopGate(i, t, md), up = hopUp(ph) * g, still = 1 - g, rph = t * RHYTHM + i * 1.9;
        const rock = g * Math.sin(ph * .5) + still * Math.sin(rph), rockC = g * Math.cos(ph * .5) + still * Math.cos(rph); // on the bounce, or on the slower beat
        out[IDX.jump] += up * .05 * amp; out[IDX.hip + 1] -= (g - up) * .028 * amp;
        out[IDX.hL + 1] += up * .014 * amp; out[IDX.hR + 1] += up * .014 * amp;
        // The Muay Thai rhythm guard, on a beat of about one a second. The weight rocks back onto the rear leg and the
        // lead knee comes up; at the same time the lead glove reaches out and the rear glove draws in, then they change
        // over. The elbows swing forward and back with the hands.
        const lo = 1 - paceAt(t), s = rock * amp * (1 + .35 * lo), c = rockC * amp, kn = Math.max(0, rock) * amp * (1 + .3 * lo); // bigger while reading him
        // planted: the tight high guard, standing tall, chin down, weight back and the lead foot light
        const hg = still * amp;
        out[IDX.eL + 2] += .25 * hg; out[IDX.eR + 2] -= .25 * hg;
        out[IDX.lean] += .03 * hg; out[IDX.hip + 1] += .04 * hg; out[IDX.hip] -= .025 * hg; out[IDX.hdP] += .16 * hg; // shoulders round, chin down behind the gloves out[IDX.fL + 1] += .015 * hg;
        out[IDX.hip] -= .026 * s; out[IDX.lean] -= .03 * s;
        out[IDX.hL] += .05 * s; out[IDX.hL + 1] += .022 * c; out[IDX.hR] -= .045 * s; out[IDX.hR + 1] -= .02 * c;
        out[IDX.eL] += .32 * s; out[IDX.eR] -= .32 * s;
        out[IDX.fL + 1] += (KNEE_STILL[md] * still + KNEE_HOP[md] * g) * kn; out[IDX.fL] -= .03 * kn * still; out[IDX.kL + 1] += .55 * kn * still;
        if (md === 0) {
          // feeling out: between bursts of bouncing he stops and sways to read the other man
          const sway = Math.sin(Math.max(0, gateP(i, t) - .82) / .18 * Math.PI * 2) * still * amp;
          out[IDX.hip + 1] -= still * .04 * amp; out[IDX.hip] += fb * .025; out[IDX.lean] += fb * .06; out[IDX.hR + 1] += Math.cos(ph * .5) * .012 * amp;
          out[IDX.side] += sway * .2 + lr * .11; out[IDX.hip + 2] += sway * .06 + lr * .035; out[IDX.twist] -= sway * .1 + lr * .06; out[IDX.hdY] += sway * .15;
        } else if (md === 1) {
          // walking forward: when he is not bouncing the weight rolls from leg to leg as the lead knee pumps;
          // the head keeps moving behind a tight high guard.
          const beat = Math.sin(ph * .5), tap = Math.max(0, beat) * amp * still;
          out[IDX.hip + 1] -= (.032 * amp - tap * .02) * still;
          out[IDX.lean] += .07 * amp + fb * .05; out[IDX.hdP] += .06 * amp;
          out[IDX.side] += lr * .12; out[IDX.hip + 2] += lr * .035; out[IDX.twist] += beat * .1 * amp * still - lr * .05; out[IDX.hdY] += lr * .08;
          out[IDX.hL] -= .06 * amp; out[IDX.hL + 1] += .04 * amp + tap * .012; out[IDX.hR + 1] += .035 * amp; out[IDX.hR] += .03 * amp;
        } else {
          // waiting: guard up and long; when he is not bouncing the feet stay planted and the body sinks and rises,
          // swaying side to side and rocking front to back
          out[IDX.hip + 1] -= (.05 + .055 * sink) * amp * (1 - .6 * g); out[IDX.lean] += (.03 + .035 * sink) * amp + fb * .1; out[IDX.hip] += fb * .04;
          out[IDX.side] += lr * .15; out[IDX.hip + 2] += lr * .045; out[IDX.twist] -= lr * .08; out[IDX.hdY] += lr * .1;
          out[IDX.hL] += .07 * amp + fb * .03; out[IDX.hL + 1] += .03 * amp; out[IDX.hR + 1] += .03 * amp;
        }
        if (hg > .01) {
          // Planted, the guard settles where the stadium fighters keep it, whatever the attitude: gloves by the brow and in
          // close (lead about a forearm in front of the face, rear by the temple), still reaching and drawing on the beat.
          solve(out, 0, J); const k = hg * .8, hx = J.head.x, hy = J.head.y;
          out[IDX.hL] += (hx + GUARD_L[0] + .035 * s - out[IDX.hL]) * k; out[IDX.hL + 1] += (hy + GUARD_L[1] + .012 * c - out[IDX.hL + 1]) * k;
          out[IDX.hR] += (hx + GUARD_R[0] - .025 * s - out[IDX.hR]) * k; out[IDX.hR + 1] += (hy + GUARD_R[1] - .012 * c - out[IDX.hR + 1]) * k;
          solve(out, 0, J); sx = (J.shL.x + J.shR.x) / 2; sy = (J.shL.y + J.shR.y) / 2; sz = (J.shL.z + J.shR.z) / 2; // the gloves follow the shoulders from here
        }
        // Head movement: every second and a quarter, more often than not, one of four moves.
        const cyc = t / 1.25 + i * .37, c0 = Math.floor(cyc), p = (cyc - c0) * 1.25 / .62, h = hash(c0 * 2 + i);
        if (p < 1 && h < (md === 0 ? .8 : md === 1 ? .7 : .85) * (.55 + .45 * paceAt(t))) { // fewer while the two are still reading each other
          let kind = Math.floor(hash(c0 * 7 + i * 3 + .5) * 4); if (md === 1 && kind === 1) kind = 0; // the man coming forward does not lean away
          const dir = h * 31 % 1 < .5 ? 1 : -1, e = Math.sin(p * Math.PI) * amp, s2 = Math.sin(p * Math.PI * 2) * amp * dir;
          if (kind === 0) { // weave: dip and roll under, from one side to the other
            out[IDX.hip + 1] -= .1 * e; out[IDX.lean] += .26 * e; out[IDX.hdP] += .12 * e; out[IDX.side] += .22 * s2; out[IDX.hip + 2] += .05 * s2; out[IDX.twist] -= .12 * s2;
          } else if (kind === 1) { // pull back out of range, standing tall, then return
            out[IDX.lean] -= .24 * e; out[IDX.hip] -= .07 * e; out[IDX.hip + 1] += .015 * e; out[IDX.hdP] -= .08 * e;
          } else if (kind === 2) { // duck low, then come up taller than before
            const dn = Math.sin(Math.min(1, p / .6) * Math.PI) * amp, upk = Math.sin(Math.max(0, (p - .6) / .4) * Math.PI) * amp;
            out[IDX.hip + 1] += -.15 * dn + .03 * upk; out[IDX.lean] += .22 * dn - .05 * upk; out[IDX.hdP] += .1 * dn;
          } else { // slip one way, then the other, without dropping
            out[IDX.side] += .26 * s2; out[IDX.hip + 2] += .06 * s2; out[IDX.twist] -= .15 * s2; out[IDX.hip + 1] -= .04 * Math.abs(s2); out[IDX.hdY] += .12 * s2;
          }
        }
        // Feints: now and then the lead hand paws, the lead knee comes up as if to check or teep, or a shoulder twitches.
        const fc = t / 2.6 + i * .61 + .33, f0 = Math.floor(fc), q = (fc - f0) * 2.6 / .38, hf = hash(f0 * 11 + i * 5 + .25);
        if (q < 1 && hf < (md === 2 ? .45 : .58)) {
          const kind = Math.floor(hf * 97 % 3), e = Math.sin(q * Math.PI) * amp;
          if (kind === 0) { const pw = Math.abs(Math.sin(q * Math.PI * 2)) * amp; out[IDX.hL] += .13 * pw; out[IDX.hL + 1] -= .03 * pw; out[IDX.twist] += .06 * pw; }
          else if (kind === 1) { out[IDX.fL + 1] += .28 * e; out[IDX.fL] += .03 * e; out[IDX.kL + 1] += .5 * e; out[IDX.hip] -= .03 * e; out[IDX.lean] -= .05 * e; }
          else { const tw = Math.sin(q * Math.PI * 2) * amp; out[IDX.twist] += .22 * tw; out[IDX.hR] += .05 * Math.max(0, tw); out[IDX.hip] += .02 * Math.max(0, tw); }
        }
        // The guard rides with the body: wherever the dips, leans and sways have carried the shoulders, the gloves go too.
        solve(out, 0, J); const fx = ((J.shL.x + J.shR.x) / 2 - sx) * .9, fy = ((J.shL.y + J.shR.y) / 2 - sy) * .9, fz = ((J.shL.z + J.shR.z) / 2 - sz) * .9;
        out[IDX.hL] += fx; out[IDX.hL + 1] += fy; out[IDX.hL + 2] += fz; out[IDX.hR] += fx; out[IDX.hR + 1] += fy; out[IDX.hR + 2] += fz;
      }
      if (st === STATE.clinch || st === STATE.clinched) { // wrestling for position: both sway and twist against each other
        const w = t * 6.3, sgn = i ? -1 : 1;
        out[IDX.hip + 2] += Math.sin(w) * .035 * sgn; out[IDX.turn] += Math.sin(w * .8 + 1) * .1; out[IDX.side] += Math.sin(w) * .07 * sgn; out[IDX.hip] += Math.sin(w * .55) * .02;
      }
      if (st === STATE.idle || st === STATE.rest || st === STATE.intro) {
        const ph = t * 7 + i * 2.3, tired = TK[(k * 2 + i) * TICK_FIELDS + 2] < 25 && st === STATE.idle ? 1 : 0;
        out[IDX.hip + 1] += Math.sin(ph) * .012 - tired * .02;
        out[IDX.hL + 1] += Math.sin(ph + 1) * .008 - tired * .09; out[IDX.hR + 1] += Math.sin(ph + 1.4) * .008 - tired * .11;
        out[IDX.lean] += tired * .1;
      }
      return out;
    }
  };
  return TL;
}
