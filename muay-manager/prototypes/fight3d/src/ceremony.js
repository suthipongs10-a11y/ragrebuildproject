// After the last bell: the referee calls both fighters to the middle of the ring. They touch gloves, stand either side
// of him while he holds a wrist of each, then he raises the winner's arm. The camera circles the three of them.
// Presentation only: the winner comes from the fight result.
import { FLAT, NP, IDX } from './poses.js';
const THREE = globalThis.THREE;

export const CER_LEN = 9.6; // seconds
const T = {touch: [.3, 1.0], untouch: [1.7, 2.3], walk: [2.1, 3.0], grab: [2.9, 3.4], raise: [4.9, 5.35], release: [5.0, 5.5], both: [6.3, 6.8], hop: [6.8, 8.6]};
const sm = (r, x) => { const k = Math.max(0, Math.min(1, (x - r[0]) / (r[1] - r[0]))); return k * k * (3 - 2 * k); };
const FRONT = -Math.PI / 2; // facing the main camera side of the ring (+z)

export function buildCeremony(camera) {
  const C = {on: false, t: 0, raised: false};
  const P = [new Float32Array(NP), new Float32Array(NP), new Float32Array(NP)], UP = new THREE.Vector3(0, 1, 0);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), tmp = new THREE.Vector3();
  let W = null, L = null, R = null, hooks = {};
  const set3 = (P, i, x, y, z) => { P[i] = x; P[i + 1] = y; P[i + 2] = z; };
  const mix3 = (P, i, x, y, z, k) => { P[i] += (x - P[i]) * k; P[i + 1] += (y - P[i + 1]) * k; P[i + 2] += (z - P[i + 2]) * k; };
  const blend = (out, A, B, k) => { for (let j = 0; j < NP; j++) out[j] = A[j] + (B[j] - A[j]) * k; };
  // a point in the world, in an actor's own frame (x ahead, y up, z to his right)
  const toLocal = (p, at, out) => out.copy(p).sub(tmp.set(at.x, 0, at.z)).applyAxisAngle(UP, -at.yaw);

  // win, lose: the fighters (winner first); ref: the referee. h: {onRaise()}
  C.start = function (win, lose, ref, h) {
    W = win; L = lose; R = ref; hooks = h || {}; C.on = true; C.t = 0; C.raised = false;
    R.root.visible = true;
  };
  C.stop = function () { C.on = false; if (R) R.root.visible = false; };

  // advance by dt (or jump to time t) and pose everyone; returns false once the scene is over
  C.update = function (dt, t) {
    if (!C.on) return false;
    C.t = t != null ? t : C.t + dt; const s = C.t;
    // where each one stands: facing each other to touch gloves, then in a line facing the front, the referee between
    const walk = sm(T.walk, s), refIn = sm([2.3, 3.1], s);
    const pw = {x: -.36 - .2 * walk, z: 0, yaw: FRONT * walk};
    const pl = {x: .36 + .2 * walk, z: 0, yaw: Math.PI + Math.PI / 2 * walk};
    const pr = {x: 0, z: -.8 + .88 * refIn, yaw: FRONT}; // ends a little in front, so his arms read against theirs
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
    R.update(Q, 0, pr.x, pr.z, pr.yaw);
    if (!C.raised && s >= T.raise[0] + .25) { C.raised = true; if (hooks.onRaise) hooks.onRaise(W.world('haL', new THREE.Vector3())); }
    // camera: a slow circle round the three, low and closing in for the raised hand
    const az = -.85 + s * .18, D = 3.4 - .55 * sm([4.6, 5.6], s), h = 1.05 + .22 * sm([0, 3], s);
    camera.position.set(Math.sin(az) * D, h, Math.cos(az) * D); camera.lookAt(0, 1.22 + .18 * sm([4.6, 5.6], s), 0);
    if (camera.fov !== 34) { camera.fov = 34; camera.updateProjectionMatrix(); }
    return C.t < CER_LEN;
  };
  return C;
}
