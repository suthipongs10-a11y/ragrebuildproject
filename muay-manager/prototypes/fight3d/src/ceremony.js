// After the last bell: the referee calls both fighters to the middle of the ring. They touch gloves, stand either side
// of him while he holds a wrist of each, then he raises the winner's arm. The camera circles the three of them.
// When a title or a tournament was at stake and the player's man won it, the scene goes on: the referee brings the belt
// and puts it round his waist, or hands him the cup and he lifts it over his head (h.prize, an object from prize.js).
// Presentation only: the winner comes from the fight result.
import { FLAT, NP, IDX } from './poses.js';
const THREE = globalThis.THREE;

export const CER_LEN = 9.6, PRIZE_LEN = 6.6; // seconds; the prize adds PRIZE_LEN
// the prize: it appears in the referee's hands, he turns to the winner, hands it over, steps back, and the winner shows it off
const TP = {show: [8.7, 9.2], turn: [8.9, 9.8], give: [10.0, 11.1], back: [11.4, 12.3], take: [9.9, 10.7], lift: [10.9, 11.8], cheer: [11.9, 15.6], done: 11.25};
const T = {touch: [.3, 1.0], untouch: [1.7, 2.3], walk: [2.1, 3.0], grab: [2.9, 3.4], raise: [4.9, 5.35], release: [5.0, 5.5], both: [6.3, 6.8], hop: [6.8, 8.6]};
const sm = (r, x) => { const k = Math.max(0, Math.min(1, (x - r[0]) / (r[1] - r[0]))); return k * k * (3 - 2 * k); };
const FRONT = -Math.PI / 2; // facing the main camera side of the ring (+z)

export function buildCeremony(camera) {
  const C = {on: false, t: 0, raised: false, len: CER_LEN, prized: false};
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
    W = win; L = lose; R = ref; hooks = h || {}; C.on = true; C.t = 0; C.raised = false; C.prized = false;
    C.len = CER_LEN + (hooks.prize ? PRIZE_LEN : 0);
    R.root.visible = true;
  };
  C.stop = function () { C.on = false; if (R) R.root.visible = false; if (hooks.prize) hooks.prize.obj.visible = false; };

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
      mix3(Q, hi, .14, Q[IDX.hip + 1] + .16, side * .3, grab * (k === 1 ? 1 - rel : 1)); // the near arm offered to the referee, wrist at belly height
      if (k === 0) { // the winner: his arm goes up with the referee's, then the other one too, then a couple of little jumps
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
    W.update(P[0], 0, pw.x, pw.z, pw.yaw); L.update(P[1], 0, pl.x, pl.z, pl.yaw);
    // the referee holds the near wrist of each, looks from one to the other, and lifts the winner's
    const Q = P[2]; Q.set(FLAT.cerStand); breathe(Q, 3.1);
    const wrist = (F, n, out) => { F.world('ha' + n, a); F.world('el' + n, b); return out.copy(a).lerp(b, .22); };
    const hold = grab * refIn;
    wrist(W, 'L', a); toLocal(a, pr, b); mix3(Q, IDX.hR, b.x, b.y, b.z, hold);
    wrist(L, 'R', a); toLocal(a, pr, b); mix3(Q, IDX.hL, b.x, b.y, b.z, hold * (1 - rel));
    mix3(Q, IDX.eR, 0, -.4, 1, raise);
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
    camera.position.copy(camA); camera.lookAt(lookA);
    if (camera.fov !== 34) { camera.fov = 34; camera.updateProjectionMatrix(); }
    return C.t < C.len;
  };
  return C;
}
