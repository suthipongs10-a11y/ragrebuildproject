// Between rounds: each fighter walks to his own corner (red at -x +z, blue at +x -z, where the pads are) and sits on
// a stool. His cornerman climbs in, pours water over his head, gives him a drink and fans him with a towel; then he
// gets up and walks back out for the bell. Presentation only: main.js holds the fight at the pause and picks it up
// from there when this is over. Runs on its own clock, like the ceremony.
import { FLAT, NP, IDX } from './poses.js';
const THREE = globalThis.THREE;

const WALK = 2.1, SIT = .6, STAY = 5.2, UP = .6, BACK = 1.9; // seconds
const A = WALK + SIT, B = A + STAY; // seated from A; up at B unless the corner is held
const CYC = 4.8; // seated loop: splash .2-1.0, drink 1.2-2.6, fan 2.8-4.8 (blue runs half a loop behind red)
const sm = (a, b, x) => { const k = Math.max(0, Math.min(1, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
const yawOf = (dx, dz) => Math.atan2(-dz, dx); // the yaw that faces along (dx, dz)
const turnTo = (a, b, k) => { let d = b - a; d -= Math.round(d / (Math.PI * 2)) * Math.PI * 2; return a + d * k; };
const blend = (out, P, Q, k) => { for (let j = 0; j < NP; j++) out[j] = P[j] + (Q[j] - P[j]) * k; };
const add3 = (P, i, x, y, z, k) => { P[i] += x * k; P[i + 1] += y * k; P[i + 2] += z * k; };
const mix3 = (P, i, v, k) => { P[i] += (v.x - P[i]) * k; P[i + 1] += (v.y - P[i + 1]) * k; P[i + 2] += (v.z - P[i + 2]) * k; };

export const CORNER_LEN = B + UP + BACK;

export function buildCorner(scene, camera, getFx) {
  const C = {on: false, t: 0, pin: false};
  const UPV = new THREE.Vector3(0, 1, 0), YV = new THREE.Vector3(0, 1, 0);
  const v = new THREE.Vector3(), w = new THREE.Vector3(), head = new THREE.Vector3(), tip = new THREE.Vector3(), dir = new THREE.Vector3();
  const Q = [0, 1, 2, 3].map(() => new Float32Array(NP));
  // props: a stool per corner, and the cornerman's water bottle and towel
  const prop = (geo, color, extra) => { const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial(Object.assign({color, roughness: .55}, extra))); m.visible = false; m.castShadow = true; scene.add(m); return m; };
  const stoolGeo = new THREE.CylinderGeometry(.15, .19, 1, 14); stoolGeo.translate(0, .5, 0);
  const stools = [prop(stoolGeo, 0xc8322b), prop(stoolGeo, 0x2c62c9)];
  const bottleGeo = new THREE.CylinderGeometry(.032, .032, .2, 10); bottleGeo.translate(0, .07, 0); // held near the bottom
  const bottles = [0, 1].map(() => prop(bottleGeo, 0xd6ecff, {roughness: .15, transparent: true, opacity: .85}));
  const towelGeo = new THREE.PlaneGeometry(.22, .34, 1, 3); towelGeo.translate(0, -.15, 0); // hangs from the hand
  const towels = [0, 1].map(i => prop(towelGeo, i ? 0xdfe8f6 : 0xf6e3df, {side: THREE.DoubleSide, roughness: .9}));
  let F = null, men = null, R = 3.05, place = null, S = [];

  // where things are in each corner
  function spots(i, from) {
    const sx = i ? 1 : -1, sz = i ? -1 : 1, dx = -sx * Math.SQRT1_2, dz = -sz * Math.SQRT1_2; // d: out of the corner
    const rx = -dz, rz = dx; // the seated fighter's right
    const stool = {x: sx * (R - .43), z: sz * (R - .43)};
    const wait = {x: stool.x + rx * .4 + dx * .3, z: stool.z + rz * .4 + dz * .3}; // out of his way while he comes in
    return {sx, sz, dx, dz, rx, rz, stool, wait, out: {x: wait.x, z: sz * (R + .32)},
      front: {x: stool.x + dx * .5 + rx * .3, z: stool.z + dz * .5 + rz * .3}, // in front, on the side away from the close-up
      sit: yawOf(dx, dz), face: yawOf(-dx, -dz), from, P0: new Float32Array(from.P)};
  }
  // feet stepping along the local direction (mx, mz) after d metres walked; k: how much
  function gait(P, d, mx, mz, k) {
    const STEP = .8, AMP = STEP * .35, p = d / STEP;
    for (const [j, base, hand] of [[0, IDX.fL, IDX.hR], [1, IDX.fR, IDX.hL]]) {
      const q = ((p + j * .5) % 1 + 1) % 1;
      let o, lift = 0;
      if (q < .7) o = AMP * (1 - 2 * q / .7); else { const u = (q - .7) / .3; o = -AMP + 2 * AMP * u; lift = Math.sin(Math.PI * u) * .08; }
      add3(P, base, o * mx, lift, o * mz, k); add3(P, hand, o * mx * .4, 0, o * mz * .4, k); // the other arm swings with it
    }
    P[IDX.hip + 1] -= (1 - Math.abs(Math.sin(2 * Math.PI * p))) * .02 * k;
  }
  // walk from a to b over [t0, t0 + len]: position, the distance gone, and the direction in the world
  function walk(a, b, t0, len, s) {
    const k = sm(t0, t0 + len, s), dxw = b.x - a.x, dzw = b.z - a.z, L = Math.hypot(dxw, dzw) || 1;
    return {x: a.x + dxw * k, z: a.z + dzw * k, d: L * k, ux: dxw / L, uz: dzw / L, yaw: yawOf(dxw, dzw), moving: k > 0 && k < 1};
  }
  const toLocal = (p, x, z, yaw, out) => out.set(p.x - x, p.y, p.z - z).applyAxisAngle(UPV, -yaw);
  // the activity weights at time c of the seated loop
  const acts = c => ({splash: sm(0, .25, c) * (1 - sm(.95, 1.15, c)), drink: sm(1.0, 1.3, c) * (1 - sm(2.5, 2.75, c)), fan: sm(2.7, 2.95, c) * (1 - sm(4.55, 4.8, c))});

  // F: the two fighters; men: two cornermen or null; ring: half size at the ropes; place(i, P) fills P with fighter
  // i's pose at the pause and returns {x, z, yaw}
  C.start = function (fighters, cornermen, ring, placeAt) {
    F = fighters; men = cornermen; R = ring; place = placeAt; C.on = true; C.t = 0; C.upAfter = null; C.upT = null; C.pin = false;
    S = [0, 1].map(i => { const P = Q[i]; const at = place(i, P); return spots(i, {x: at.x, z: at.z, yaw: at.yaw, P}); });
    // the stool's top sits under the seated pelvis
    const h = Math.max(.3, FLAT.sit[IDX.hip + 1] - .11);
    stools.forEach(m => { m.scale.set(1, h, 1); m.visible = true; });
    if (men) men.forEach(m => { m.root.visible = true; m.setMongkol(false); });
    bottles.forEach(b => { b.visible = !!men; }); towels.forEach(b => { b.visible = !!men; });
  };
  // let the round start: right away if asked at the start, else once the fighters have sat for a moment
  C.release = function () { if (C.upAfter == null) C.upAfter = C.t < .05 ? B : Math.max(A + .8, C.t); };
  C.stop = function () {
    C.on = false; stools.forEach(m => { m.visible = false; }); bottles.forEach(m => { m.visible = false; }); towels.forEach(m => { m.visible = false; });
    if (men) men.forEach(m => { m.root.visible = false; });
  };

  C.update = function (dt, tJump) {
    if (!C.on) return false;
    if (tJump != null) { C.t = tJump; C.upT = C.upAfter != null && C.t >= C.upAfter ? C.upAfter : null; } else if (!C.pin) C.t += dt;
    const s = C.t;
    if (C.upT == null && C.upAfter != null && s >= C.upAfter) C.upT = C.upAfter;
    const U = C.upT != null ? C.upT : 1e6, wSeat = s - A, fx = getFx();
    for (let i = 0; i < 2; i++) {
      const sp = S[i], P = Q[2 + i], stool = sp.stool;
      let x = stool.x, z = stool.z, yaw = sp.sit;
      // the fighter
      if (s < WALK) { // to his corner: turns to walk, and turns round at the end to sit
        const m = walk(sp.from, stool, 0, WALK, s);
        x = m.x; z = m.z; yaw = turnTo(turnTo(sp.from.yaw, m.yaw, sm(0, .45, s)), sp.sit, sm(WALK - .55, WALK + .1, s));
        blend(P, sp.P0, FLAT.cerStand, sm(0, .4, s));
        const ca = Math.cos(yaw), sa = Math.sin(yaw); // the walk in his own frame
        gait(P, m.d, m.ux * ca - m.uz * sa, m.ux * sa + m.uz * ca, sm(0, .2, s) * (1 - sm(WALK - .2, WALK, s)));
      } else if (s < A) blend(P, FLAT.cerStand, FLAT.sit, sm(WALK, A, s)); // sits down
      else if (s < U) { // seated: breathing hard, head back to drink, down for the water
        P.set(FLAT.sit);
        const a = acts(((wSeat - i * 2.4) % CYC + CYC) % CYC), br = Math.sin(s * 3.6 + i * 1.3);
        P[IDX.hip + 1] += br * .006; P[IDX.lean] += br * .025 - .05 * a.fan;
        P[IDX.hdP] += -.55 * a.drink + .35 * a.splash + Math.sin(s * 9) * .06 * a.splash - .12 * a.fan;
      } else if (s < U + UP) blend(P, FLAT.sit, FLAT.cerStand, sm(U, U + UP, s)); // up
      else { // back out to where the round starts
        const to = place(i, Q[i]), m = walk(stool, to, U + UP, BACK, s), k = sm(U + UP + BACK - .45, U + UP + BACK, s);
        x = m.x; z = m.z; yaw = turnTo(turnTo(sp.sit, m.yaw, sm(U + UP, U + UP + .4, s)), to.yaw, sm(U + UP + BACK - .6, U + UP + BACK, s));
        P.set(FLAT.cerStand);
        const ca = Math.cos(yaw), sa = Math.sin(yaw);
        gait(P, m.d, m.ux * ca - m.uz * sa, m.ux * sa + m.uz * ca, sm(U + UP, U + UP + .2, s) * (1 - k));
        blend(P, P, Q[i], k);
      }
      F[i].update(P, 0, x, z, yaw);
      // the stool comes in over the ropes, and goes out the same way
      const st = stools[i], gone = U + UP + 1.2, inK = sm(.3, 1.1, s) * (1 - sm(gone, gone + .7, s));
      st.position.set(sp.sx * (R + .35) + (stool.x - sp.sx * (R + .35)) * inK, Math.sin(Math.PI * inK) * .5, sp.sz * (R + .35) + (stool.z - sp.sz * (R + .35)) * inK);
      if (!men) continue;
      // the cornerman: climbs in, waits by the stool, steps in front once he is seated, and back and out at the end
      const M = men[i], Pm = Q[i]; // Q[i] is free here: the walk back has used it already this frame
      let mx, mz, myaw = sp.face, k1 = sm(A - .3, A + .3, s) * (1 - sm(U, U + .5, s));
      const climb = sm(0, .9, s) * (1 - sm(U + UP + .6, U + UP + 1.5, s));
      mx = sp.out.x + (sp.wait.x - sp.out.x) * climb; mz = sp.out.z + (sp.wait.z - sp.out.z) * climb;
      const bulge = Math.sin(Math.PI * k1) * .25;
      mx += (sp.front.x - sp.wait.x) * k1 + sp.dx * bulge; mz += (sp.front.z - sp.wait.z) * k1 + sp.dz * bulge;
      if (climb < 1) myaw = s < 1 ? turnTo(yawOf(sp.wait.x - sp.out.x, sp.wait.z - sp.out.z), sp.face, sm(.6, .95, s)) : yawOf(sp.out.x - sp.wait.x, sp.out.z - sp.wait.z); // facing the way he goes
      Pm.set(FLAT.cerStand); Pm[IDX.lean] += .1 * k1;
      const moving = (s < .9) || (k1 > .02 && k1 < .98) || (s > U + UP + .6 && s < U + UP + 1.5);
      if (moving) gait(Pm, s * 1.1, 1, 0, .8);
      Pm[IDX.jump] = Math.sin(Math.PI * climb) * (climb < 1 ? .12 : 0); // stepping through the ropes
      // what his hands do while the fighter is seated: water over the head, a drink, the towel
      const a = s >= A && s < U ? acts(((wSeat - i * 2.4) % CYC + CYC) % CYC) : {splash: 0, drink: 0, fan: 0}, c = ((wSeat - i * 2.4) % CYC + CYC) % CYC;
      const near = k1 * (1 - sm(U, U + .3, s));
      F[i].world('head', head);
      const fdx = Math.cos(sp.sit), fdz = -Math.sin(sp.sit); // the fighter's forward
      Pm[IDX.lean] += .22 * (a.splash + a.drink) * near; Pm[IDX.hdP] += .25 * near;
      // drink: the bottle comes down into his mouth
      v.set(head.x + fdx * .09, head.y - .06, head.z + fdz * .09); // mouth
      dir.set(v.x - mx, -.55, v.z - mz).normalize();
      w.copy(v).addScaledVector(dir, -.2); toLocal(w, mx, mz, myaw, w); mix3(Pm, IDX.hR, w, a.drink * near);
      // splash: held up over his head, pouring
      w.set(head.x, head.y + .32, head.z).addScaledVector(dir.set(mx - head.x, 0, mz - head.z).normalize(), .06); toLocal(w, mx, mz, myaw, w); mix3(Pm, IDX.hR, w, a.splash * near);
      // fan: the towel waves in front of his face
      w.set(head.x + fdx * .36 - sp.rx * Math.sin(s * 8) * .16, head.y - .05 + Math.cos(s * 16) * .03, head.z + fdz * .36 - sp.rz * Math.sin(s * 8) * .16); toLocal(w, mx, mz, myaw, w); mix3(Pm, IDX.hL, w, a.fan * near);
      M.update(Pm, 0, mx, mz, myaw);
      // bottle in his right hand: upright, pointing at the mouth, or tipped over the head
      const bt = bottles[i]; M.world('haR', w); bt.position.copy(w);
      dir.set(0, 1, 0);
      if (a.drink * near > 0) { tip.set(head.x + fdx * .09, head.y - .06, head.z + fdz * .09).sub(w).normalize(); dir.lerp(tip, a.drink * near); }
      if (a.splash * near > 0) { tip.set(head.x - w.x, -.6, head.z - w.z).normalize(); dir.lerp(tip, a.splash * near); }
      bt.quaternion.setFromUnitVectors(YV, dir.normalize());
      if (a.splash * near > .6 && c > .3 && c < .95 && fx && !C.pin) { // the water: a stream from the bottle and drops off his head
        tip.copy(w).addScaledVector(dir, .17);
        fx.water(tip, Math.max(2, Math.round(130 * dt)), dir.x * 1.4, dir.y * 1.4, dir.z * 1.4, .3);
        fx.water(head, Math.max(1, Math.round(70 * dt)), 0, .8, 0, 1.8);
      }
      // towel in his left hand, flapping while he fans
      const tw = towels[i]; M.world('haL', w); tw.position.copy(w);
      tw.rotation.set(0, myaw + Math.PI / 2, 0); tw.rotateX(Math.sin(s * 8) * .9 * a.fan * near); tw.rotateZ(.25 + .5 * a.fan * near);
    }
    shoot(s, U, wSeat);
    return s < U + UP + BACK;
  };

  // camera: a high wide shot as they walk to the corners, close-ups taking turns on each corner while they sit, and a
  // wide shot from the main side as they come back out
  function shoot(s, U, wSeat) {
    let px, py, pz, lx, ly, lz, fov;
    if (s < WALK + .3) { px = 6.2; py = 4.4; pz = 6.6; lx = -.2; ly = .6; lz = 0; fov = 27; }
    else if (s < U) {
      const k = Math.max(0, Math.floor((wSeat + .3) / 2.4)), i = k % 2, sp = S[i], into = (wSeat + .3) / 2.4 - k;
      const a = -.85, cx = sp.dx * Math.cos(a) - sp.dz * Math.sin(a), cz = sp.dx * Math.sin(a) + sp.dz * Math.cos(a), D = 2.3 - .3 * into; // on his left, the cornerman on his right
      px = sp.stool.x + cx * D; py = 1.2; pz = sp.stool.z + cz * D; lx = sp.stool.x + sp.dx * .25 + sp.rx * .14; ly = .95; lz = sp.stool.z + sp.dz * .25 + sp.rz * .14; fov = 36;
    } else { px = -1.4; py = 2.5; pz = 7.2; lx = 0; ly = .8; lz = 0; fov = 33; }
    camera.position.set(px, py, pz); camera.lookAt(lx, ly, lz);
    if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
  }
  return C;
}
