// Turns a finished fight (sim output) into something that can be played at any time, forward or back:
// per-tick baked poses for both fighters. Because the whole fight is known up front, strikes are aimed
// at where the opponent will be and defenders start blocking before the blow lands.
import { FLAT, NP, IDX } from './poses.js';
import { MOVES } from './data.js';
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
  // cues per fighter, plus early defence
  const cues = [[], []];
  for (const c of fight.poses) cues[c.f].push(c);
  for (const e of fight.events) {
    if (e.type !== 'hit' || (e.res !== 'block' && e.res !== 'dodge')) continue;
    const tA = e.t - .13, st = tick(e.on, Math.round(tA / dt), 4);
    if (st !== STATE.idle && st !== STATE.block) continue; // a fighter already covering up has the pose from the sim
    const mv = MOVES[e.move];
    const pose = e.res === 'dodge' ? 'dodge' : mv.lvl === 'leg' ? 'check' : mv.lvl === 'body' ? 'blockBody' : 'block';
    cues[e.on].push({t: tA, f: e.on, pose, d: .11, early: true});
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

  // clinch and catch: place a fighter's hands or foot on the opponent's body as it will be a moment later
  function attach(i, c, target) {
    const o = 1 - i, k = Math.min(n - 1, Math.round((c.t + Math.max(c.d, .12)) / dt)), ob = baked[o], oo = k * NP;
    const dist = Math.abs(tick(o, k, 0) - tick(i, k, 0)) * .01;
    solve(ob, oo, J2);
    const toMine = v => { v.applyAxisAngle(UP, -ob[oo + IDX.spin]); v.y += ob[oo + IDX.jump]; v.set(dist - v.x, v.y - target[IDX.jump], -v.z); return v; };
    if (c.grab === 'neck') {
      toMine(pt3.copy(J2.neck).lerp(J2.head, .25));
      for (const [b, z] of [[IDX.hL, -.07], [IDX.hR, .07]]) { target[b] = pt3.x + .06; target[b + 1] = pt3.y; target[b + 2] = pt3.z + z; }
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

  const TL = {
    fight, n, dt, duration: (n - 1) * dt, baked, eff,
    val(i, t, f) {
      const x = Math.max(0, Math.min(n - 1.001, t / dt)), k = Math.floor(x), fr = x - k;
      const a = TK[(k * 2 + i) * TICK_FIELDS + f], b = TK[((k + 1) * 2 + i) * TICK_FIELDS + f];
      return f === 4 ? a : a + (b - a) * fr;
    },
    clock(t) { const k = Math.max(0, Math.min(n - 1, Math.floor(t / dt))); return {round: fight.clock[k * 2], clock: fight.clock[k * 2 + 1]}; },
    effAt(i, t) { return eff[i][Math.max(0, Math.min(n - 1, Math.round(t / dt)))]; },
    // pose at time t into out, with small living-body motion layered on top
    sample(i, t, out) {
      const x = Math.max(0, Math.min(n - 1.001, t / dt)), k = Math.floor(x), fr = x - k, B = baked[i], o = k * NP;
      for (let j = 0; j < NP; j++) out[j] = B[o + j] + (B[o + NP + j] - B[o + j]) * fr;
      const st = TK[(k * 2 + i) * TICK_FIELDS + 4];
      if (st === STATE.idle) { // Muay Thai rhythm: the lead foot taps and the hands roll
        const beat = t * 5.2 + i * 1.7;
        out[IDX.fL + 1] += Math.max(0, Math.sin(beat)) * .04; out[IDX.hip] += Math.sin(beat * .5) * .012;
        out[IDX.hL] += Math.sin(beat * .5) * .02; out[IDX.hR + 1] += Math.cos(beat * .5) * .012;
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
