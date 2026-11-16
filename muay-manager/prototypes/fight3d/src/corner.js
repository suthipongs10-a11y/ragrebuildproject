// Between rounds: each fighter walks to his own corner (red at -x +z, blue at +x -z, where the pads are) and sits on
// a stool. Two cornermen look after him: one gives him a drink of water (once), then wipes the sweat off his face and
// chest with a towel; the other kneels in front and rubs boxing oil into his thighs. The camera goes up high and turns
// slowly over the ring and the crowd, then comes back down to a corner. Then he gets up and walks back out for the
// bell. Presentation only: main.js holds the fight at the pause and picks it up from there when this is over. Runs on
// its own clock, like the ceremony.
import { FLAT, NP, IDX } from './poses.js';
const THREE = globalThis.THREE;

const WALK = 2.1, SIT = .6, STAY = 6.5, UP = .6, BACK = 1.9; // seconds
const A = WALK + SIT, B = A + STAY; // seated from A; up at B unless the corner is held
const sm = (a, b, x) => { const k = Math.max(0, Math.min(1, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
const yawOf = (dx, dz) => Math.atan2(-dz, dx); // the yaw that faces along (dx, dz)
const turnTo = (a, b, k) => { let d = b - a; d -= Math.round(d / (Math.PI * 2)) * Math.PI * 2; return a + d * k; };
const blend = (out, P, Q, k) => { for (let j = 0; j < NP; j++) out[j] = P[j] + (Q[j] - P[j]) * k; };
const add3 = (P, i, x, y, z, k) => { P[i] += x * k; P[i + 1] += y * k; P[i + 2] += z * k; };
const mix3 = (P, i, v, k) => { P[i] += (v.x - P[i]) * k; P[i + 1] += (v.y - P[i + 1]) * k; P[i + 2] += (v.z - P[i + 2]) * k; };

export const CORNER_LEN = B + UP + BACK, CORNER_SEAT = A; // CORNER_SEAT: seconds in when they are on the stools

export function buildCorner(scene, camera, getFx) {
  const C = {on: false, t: 0, pin: false};
  const UPV = new THREE.Vector3(0, 1, 0), YV = new THREE.Vector3(0, 1, 0);
  const v = new THREE.Vector3(), w = new THREE.Vector3(), head = new THREE.Vector3(), tip = new THREE.Vector3(), dir = new THREE.Vector3(), a3 = new THREE.Vector3(), b3 = new THREE.Vector3();
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
    const stool = {x: sx * (R - .43), z: sz * (R - .43)}, at = (f, r) => ({x: stool.x + dx * f + rx * r, z: stool.z + dz * f + rz * r});
    const wait = at(.3, .4), kneel = at(.85, -.12); // the first waits out of his way while he comes in
    return {sx, sz, dx, dz, rx, rz, stool, wait, kneel, front: at(.5, .3),
      out: {x: wait.x, z: sz * (R + .32)}, out2: {x: sx * (R + .32), z: kneel.z}, // on the apron, behind the ropes either side
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
    return {x: a.x + dxw * k, z: a.z + dzw * k, d: L * k, ux: dxw / L, uz: dzw / L, yaw: yawOf(dxw, dzw)};
  }
  const toLocal = (p, x, z, yaw, out) => out.set(p.x - x, p.y, p.z - z).applyAxisAngle(UPV, -yaw);
  // one man climbing in through the ropes from `out` to `to` over [t0, t0 + .9] and back out over [t1, t1 + .9]
  function climber(Pm, from, to, t0, t1, s, face) {
    const k = sm(t0, t0 + .9, s) * (1 - sm(t1, t1 + .9, s)), x = from.x + (to.x - from.x) * k, z = from.z + (to.z - from.z) * k;
    const going = s < t1 ? yawOf(to.x - from.x, to.z - from.z) : yawOf(from.x - to.x, from.z - to.z);
    const yaw = k > .98 ? face : s < t1 ? turnTo(going, face, sm(t0 + .6, t0 + .9, s)) : going;
    Pm.set(FLAT.cerStand);
    if (k > .02 && k < .98) { gait(Pm, s * 1.1, 1, 0, .8); Pm[IDX.jump] = Math.sin(Math.PI * k) * .12; } // stepping through the ropes
    return {x, z, yaw, k};
  }

  // F: the two fighters; men: four cornermen (the water and towel man for red and blue, then the masseur for each) or
  // null; ring: half size at the ropes; place(i, P) fills P with fighter i's pose at the pause and returns {x, z, yaw}
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
    const U = C.upT != null ? C.upT : 1e6, ws = s - A; // ws: seconds seated
    const seated = s >= A && s < U, drink = seated ? sm(.1, .4, ws) * (1 - sm(1.6, 1.9, ws)) : 0, wipe = seated ? sm(1.9, 2.3, ws) : 0;
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
      else if (s < U) { // seated: breathing hard, head back to drink, eyes down while he is wiped
        P.set(FLAT.sit);
        const br = Math.sin(s * 3.6 + i * 1.3);
        P[IDX.hip + 1] += br * .006; P[IDX.lean] += br * .025;
        P[IDX.hdP] += -.55 * drink + .12 * wipe + Math.sin(s * 2.1 + i) * .04 * wipe;
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
      F[i].world('head', head);
      const fdx = Math.cos(sp.sit), fdz = -Math.sin(sp.sit), Pm = Q[i]; // the fighter's forward; Q[i] is free again
      // The water and towel man: climbs in, waits by the stool, steps in front once he is seated, gives him one drink,
      // then wipes his face and chest. Bottle in the right hand, towel in the left.
      const M = men[i], cl = climber(Pm, sp.out, sp.wait, 0, U + UP + .6, s, sp.face);
      const k1 = sm(A - .3, A + .3, s) * (1 - sm(U, U + .5, s)), bulge = Math.sin(Math.PI * k1) * .25;
      const mx = cl.x + (sp.front.x - sp.wait.x) * k1 + sp.dx * bulge, mz = cl.z + (sp.front.z - sp.wait.z) * k1 + sp.dz * bulge, myaw = cl.yaw;
      if (k1 > .02 && k1 < .98) gait(Pm, s * 1.1, 1, 0, .8);
      const near = k1 * (1 - sm(U, U + .3, s)), d1 = drink * near, w1 = wipe * near;
      Pm[IDX.lean] += .1 * k1 + .22 * d1 + .16 * w1; Pm[IDX.hdP] += .25 * near;
      v.set(head.x + fdx * .09, head.y - .06, head.z + fdz * .09); // his mouth
      dir.set(v.x - mx, -.55, v.z - mz).normalize();
      w.copy(v).addScaledVector(dir, -.2); toLocal(w, mx, mz, myaw, w); mix3(Pm, IDX.hR, w, d1); // the bottle comes down to it
      // the towel goes round over his face, then down over his chest and shoulders, and back
      const onFace = .5 + .5 * Math.cos((ws - 2) * Math.PI * 2 / 3.2), ang = s * 6.5;
      F[i].world('shL', a3); F[i].world('shR', b3); a3.add(b3).multiplyScalar(.5);
      w.set(head.x + fdx * .17, head.y + .07, head.z + fdz * .17).lerp(a3.set(a3.x + fdx * .2, a3.y + .06, a3.z + fdz * .2), 1 - onFace);
      w.x += sp.rx * Math.cos(ang) * .07; w.y += Math.sin(ang) * .05; w.z += sp.rz * Math.cos(ang) * .07;
      toLocal(w, mx, mz, myaw, w); mix3(Pm, IDX.hL, w, w1);
      M.update(Pm, 0, mx, mz, myaw);
      const bt = bottles[i]; M.world('haR', w); bt.position.copy(w);
      dir.set(0, 1, 0);
      if (d1 > 0) { tip.copy(v).sub(w).normalize(); dir.lerp(tip, d1); }
      bt.quaternion.setFromUnitVectors(YV, dir.normalize());
      const tw = towels[i]; M.world('haL', w); tw.position.copy(w);
      tw.rotation.set(0, myaw + Math.PI / 2, 0); tw.rotateX(-.5 * w1 + Math.sin(ang) * .15 * w1); tw.rotateZ(.25 * (1 - w1));
      // The masseur: waits on the apron, climbs in once the fighter is down on the stool, kneels in front and rubs
      // the oil into both thighs, hand over hand, until it is time to go.
      const M2 = men[2 + i], c2 = climber(Pm, sp.out2, sp.kneel, A - .4, U + .1, s, sp.face);
      const kn = sm(A + .5, A + 1.0, s) * (1 - sm(U - .2, U + .2, s)), rub = sm(A + .9, A + 1.2, s) * (1 - sm(U - .3, U, s));
      if (kn > 0) blend(Pm, Pm, FLAT.kneel, kn);
      for (const [hand, hip, knee, ph] of [[IDX.hL, 'hpR', 'knR', 0], [IDX.hR, 'hpL', 'knL', Math.PI]]) {
        if (rub <= 0) continue;
        F[i].world(hip, a3); F[i].world(knee, b3);
        const u = .45 + .25 * Math.sin(s * 4.2 + ph); // up and down the thigh
        w.copy(a3).lerp(b3, u); w.y += .07 + Math.max(0, Math.sin(s * 4.2 + ph + 1.2)) * .025;
        toLocal(w, c2.x, c2.z, c2.yaw, w); mix3(Pm, hand, w, rub);
      }
      Pm[IDX.hdP] += .2 * kn;
      M2.update(Pm, 0, c2.x, c2.z, c2.yaw);
    }
    shoot(s, U, ws);
    return s < U + UP + BACK;
  };

  // camera: high and wide as they walk to the corners; a close-up of the red corner for the drink; then up high over
  // the ring, turning slowly to take in the crowd and the hall; back down to the blue corner for the rub and the
  // towel (held longer: turns between the corners and the high shot); wide from the main side as they come back out
  function shoot(s, U, ws) {
    let px, py, pz, lx, ly, lz, fov, close = -1, into = 0;
    if (s < WALK + .3) { px = 6.2; py = 4.4; pz = 6.6; lx = -.2; ly = .6; lz = 0; fov = 27; }
    else if (s < U) {
      if (ws < 1.9) { close = 0; into = (ws + .3) / 2.2; }
      else if (ws >= 4.3) { const q = (ws - 4.3) / 2.4, k = Math.floor(q) % 4; into = q - Math.floor(q); close = k === 0 ? 1 : k === 2 ? 0 : -1; }
      if (close < 0) { const a = .35 + s * .09, r = 8.4; px = Math.sin(a) * r; py = 5.4; pz = Math.cos(a) * r; lx = 0; ly = .2; lz = 0; fov = 44; }
      else {
        const sp = S[close], a = -.85, cx = sp.dx * Math.cos(a) - sp.dz * Math.sin(a), cz = sp.dx * Math.sin(a) + sp.dz * Math.cos(a), D = 2.3 - .25 * sm(0, 1, into); // on his left, the cornermen on his right and in front
        px = sp.stool.x + cx * D; py = 1.45; pz = sp.stool.z + cz * D; lx = sp.stool.x + sp.dx * .3 + sp.rx * .1; ly = .82; lz = sp.stool.z + sp.dz * .3 + sp.rz * .1; fov = 38;
      }
    } else { px = -1.4; py = 2.5; pz = 7.2; lx = 0; ly = .8; lz = 0; fov = 33; }
    camera.position.set(px, py, pz); camera.lookAt(lx, ly, lz);
    if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
  }
  return C;
}
