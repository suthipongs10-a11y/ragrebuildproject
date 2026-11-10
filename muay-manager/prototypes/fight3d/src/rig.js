// Procedural fighter: pose vector -> joints (two-bone IK) -> primitive meshes.
// Placeholder mannequin so camera, timing and feel can be judged before real models exist.
import { IDX } from './poses.js';
const THREE = globalThis.THREE;

export const DIM = {thigh: .45, shin: .45, spine: .32, shY: .24, shW: .19, hipW: .10, neck: .28, head: .13, ua: .29, fa: .30, ankle: .07};
const JN = ['hip', 'chest', 'neck', 'head', 'shL', 'shR', 'elL', 'elR', 'haL', 'haR', 'hpL', 'hpR', 'knL', 'knR', 'anL', 'anR'];
export function makeJoints() {
  const J = {qp: new THREE.Quaternion(), qc: new THREE.Quaternion(), qh: new THREE.Quaternion()};
  JN.forEach(n => { J[n] = new THREE.Vector3(); });
  return J;
}

const AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0), AZ = new THREE.Vector3(0, 0, 1);
const q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), q3 = new THREE.Quaternion();
const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), v4 = new THREE.Vector3();

function ik(S, tx, ty, tz, a, b, px, py, pz, outJ, outE) {
  v1.set(tx - S.x, ty - S.y, tz - S.z);
  let d = v1.length();
  const mx = a + b - .004;
  if (d > mx) { v1.multiplyScalar(mx / d); d = mx; }
  if (d < .02) { v1.set(.02, 0, 0); d = .02; }
  v2.copy(v1).multiplyScalar(1 / d);                 // direction to target
  v3.set(px, py, pz); v3.addScaledVector(v2, -v3.dot(v2));
  if (v3.lengthSq() < 1e-6) v3.set(0, -1, 0).addScaledVector(v2, v2.y);
  v3.normalize();
  const along = (a * a + d * d - b * b) / (2 * d), h = Math.sqrt(Math.max(0, a * a - along * along));
  outJ.copy(S).addScaledVector(v2, along).addScaledVector(v3, h);
  outE.copy(S).add(v1);
}

// P: Float32Array holding a pose at offset o. J: joints in the fighter-local frame.
export function solve(P, o, J) {
  const I = IDX;
  q1.setFromAxisAngle(AZ, -P[o + I.lean]); q2.setFromAxisAngle(AX, P[o + I.side]); q3.setFromAxisAngle(AY, -P[o + I.turn]);
  J.qp.copy(q1).multiply(q2).multiply(q3);
  q3.setFromAxisAngle(AY, -P[o + I.twist]); J.qc.copy(J.qp).multiply(q3);
  q1.setFromAxisAngle(AZ, -(P[o + I.lean] * .6 + P[o + I.hdP])); q2.setFromAxisAngle(AX, P[o + I.side] * .5); q3.setFromAxisAngle(AY, -P[o + I.hdY]);
  J.qh.copy(q1).multiply(q2).multiply(q3);
  J.hip.set(P[o], P[o + 1], P[o + 2]);
  J.chest.set(0, DIM.spine, 0).applyQuaternion(J.qp).add(J.hip);
  J.neck.set(0, DIM.neck, 0).applyQuaternion(J.qc).add(J.chest);
  J.head.set(0, DIM.head, 0).applyQuaternion(J.qh).add(J.neck);
  J.shL.set(0, DIM.shY, -DIM.shW).applyQuaternion(J.qc).add(J.chest);
  J.shR.set(0, DIM.shY, DIM.shW).applyQuaternion(J.qc).add(J.chest);
  J.hpL.set(0, -.02, -DIM.hipW).applyQuaternion(J.qp).add(J.hip);
  J.hpR.set(0, -.02, DIM.hipW).applyQuaternion(J.qp).add(J.hip);
  ik(J.shL, P[o + I.hL], P[o + I.hL + 1], P[o + I.hL + 2], DIM.ua, DIM.fa, P[o + I.eL], P[o + I.eL + 1], P[o + I.eL + 2], J.elL, J.haL);
  ik(J.shR, P[o + I.hR], P[o + I.hR + 1], P[o + I.hR + 2], DIM.ua, DIM.fa, P[o + I.eR], P[o + I.eR + 1], P[o + I.eR + 2], J.elR, J.haR);
  ik(J.hpL, P[o + I.fL], P[o + I.fL + 1] + DIM.ankle, P[o + I.fL + 2], DIM.thigh, DIM.shin, P[o + I.kL], P[o + I.kL + 1], P[o + I.kL + 2], J.knL, J.anL);
  ik(J.hpR, P[o + I.fR], P[o + I.fR + 1] + DIM.ankle, P[o + I.fR + 2], DIM.thigh, DIM.shin, P[o + I.kR], P[o + I.kR + 1], P[o + I.kR + 2], J.knR, J.anR);
  return J;
}
export const EFF_JOINT = {handL: 'haL', handR: 'haR', footL: 'anL', footR: 'anR', elbowL: 'elL', elbowR: 'elR', kneeL: 'knL', kneeR: 'knR'};

// ---------- meshes ----------
const SKINS = [0xd9a06b, 0xc68a55, 0xb0723f, 0xe0b081];
const CORNER = [
  {shorts: 0xd9342b, dark: 0x9c231c, trim: 0xf2c14e, glove: 0xe03a30},
  {shorts: 0x2f6fe0, dark: 0x214fa5, trim: 0xf4f4f6, glove: 0x2f76ea}
];
let GRAD = null, OUTLINE = null, GEO = null;
function shared() {
  if (GEO) return;
  const g = new Uint8Array([70, 70, 70, 255, 150, 150, 150, 255, 255, 255, 255, 255]);
  GRAD = new THREE.DataTexture(g, 3, 1, THREE.RGBAFormat); GRAD.minFilter = GRAD.magFilter = THREE.NearestFilter; GRAD.needsUpdate = true;
  OUTLINE = new THREE.MeshBasicMaterial({color: 0x120c0a, side: THREE.BackSide});
  OUTLINE.onBeforeCompile = s => { s.vertexShader = s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed += normalize(normal) * 0.013;'); };
  const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 5, 12);
  GEO = {
    sphere: new THREE.SphereGeometry(1, 20, 14),
    ua: cap(.047, DIM.ua), fa: cap(.042, DIM.fa - .07), thigh: cap(.078, DIM.thigh), shin: cap(.055, DIM.shin),
    shortLeg: cap(.094, .2), hem: new THREE.CylinderGeometry(.097, .099, .035, 16), anklet: cap(.059, .08),
    neck: cap(.045, .1), yoke: cap(.066, DIM.shW * 2), foot: cap(.043, .13), cuff: new THREE.CylinderGeometry(.052, .056, .07, 14),
    band: new THREE.CylinderGeometry(1, 1, 1, 20), hair: new THREE.SphereGeometry(.119, 18, 10, 0, Math.PI * 2, 0, Math.PI * .52),
    mongkol: new THREE.TorusGeometry(.116, .013, 8, 24), tail: cap(.012, .1), prajiad: new THREE.TorusGeometry(.052, .011, 6, 16)
  };
}
function mats(color, rough) {
  return {
    real: new THREE.MeshStandardMaterial({color, roughness: rough == null ? .62 : rough, metalness: 0}),
    toon: new THREE.MeshToonMaterial({color, gradientMap: GRAD})
  };
}
const RED = new THREE.Color(0xc0392b);

export class Fighter {
  constructor(index, skinIdx) {
    shared();
    this.index = index; this.dir = index ? -1 : 1;
    this.root = new THREE.Group();
    this.J = makeJoints();
    this.meshes = []; this.style = 'real';
    const c = CORNER[index], skin = SKINS[skinIdx % SKINS.length];
    this.skinBase = new THREE.Color(skin);
    const M = this.M = {
      head: mats(skin), torso: mats(skin), arm: mats(skin), leg: mats(skin), legL: mats(skin),
      shorts: mats(c.shorts, .8), dark: mats(c.dark, .8), trim: mats(c.trim, .5), glove: mats(c.glove, .35),
      white: mats(0xeeeeee, .8), hair: mats(0x1b1512, .9)
    };
    const mk = (geo, m, outline) => {
      const mesh = new THREE.Mesh(geo, m.real); mesh.userData.mats = m; mesh.castShadow = true;
      if (outline !== false) { const ol = new THREE.Mesh(geo, OUTLINE); ol.visible = false; mesh.add(ol); mesh.userData.outline = ol; }
      this.root.add(mesh); this.meshes.push(mesh); return mesh;
    };
    const child = (parent, geo, m) => { const mesh = new THREE.Mesh(geo, m.real); mesh.userData.mats = m; mesh.castShadow = true; parent.add(mesh); this.meshes.push(mesh); return mesh; };
    const p = this.p = {};
    p.pelvis = mk(GEO.sphere, M.shorts); p.pelvis.scale.set(.125, .135, .172);
    p.waist = mk(GEO.band, M.trim, false); p.waist.scale.set(.118, .045, .16);
    p.abdomen = mk(GEO.sphere, M.torso); p.abdomen.scale.set(.105, .17, .15);
    p.chest = mk(GEO.sphere, M.torso); p.chest.scale.set(.118, .175, .185);
    p.yoke = mk(GEO.yoke, M.torso);
    p.shL = mk(GEO.sphere, M.arm); p.shR = mk(GEO.sphere, M.arm); p.shL.scale.setScalar(.068); p.shR.scale.setScalar(.068);
    p.neck = mk(GEO.neck, M.head, false);
    p.head = mk(GEO.sphere, M.head); p.head.scale.set(.112, .124, .106);
    this.headGroup = new THREE.Group(); this.root.add(this.headGroup);
    const hair = child(this.headGroup, GEO.hair, M.hair); hair.rotation.z = .32; hair.position.set(-.004, .012, 0);
    const mong = child(this.headGroup, GEO.mongkol, M.trim); mong.rotation.set(Math.PI / 2, 0, 0); mong.rotation.y = -.16; mong.position.set(0, .05, 0);
    const tail = child(this.headGroup, GEO.tail, M.trim); tail.position.set(-.135, .0, 0); tail.rotation.z = -.5;
    for (const s of [-1, 1]) { const eye = child(this.headGroup, GEO.sphere, M.hair); eye.scale.setScalar(.013); eye.position.set(.1, .014, s * .042); eye.castShadow = false; }
    const nose = child(this.headGroup, GEO.sphere, M.head); nose.scale.set(.017, .02, .016); nose.position.set(.112, -.016, 0);
    for (const s of ['L', 'R']) {
      p['ua' + s] = mk(GEO.ua, M.arm);
      const pr = child(p['ua' + s], GEO.prajiad, M.trim); pr.rotation.x = Math.PI / 2; pr.position.y = -.02;
      p['fa' + s] = mk(GEO.fa, M.arm);
      p['cuff' + s] = mk(GEO.cuff, M.white, false);
      p['glove' + s] = mk(GEO.sphere, M.glove);
      p['thigh' + s] = mk(GEO.thigh, s === 'L' ? M.legL : M.leg);
      const sl = child(p['thigh' + s], GEO.shortLeg, M.shorts); sl.position.y = -DIM.thigh / 2 + .13;
      const hem = child(p['thigh' + s], GEO.hem, M.trim); hem.position.y = -DIM.thigh / 2 + .26;
      p['shin' + s] = mk(GEO.shin, s === 'L' ? M.legL : M.leg);
      const an = child(p['shin' + s], GEO.anklet, M.white); an.position.y = DIM.shin / 2 - .08;
      p['foot' + s] = mk(GEO.foot, s === 'L' ? M.legL : M.leg);
    }
    this.root.rotation.order = 'YXZ';
  }
  setStyle(style) {
    this.style = style; const toon = style === 'toon';
    for (const m of this.meshes) { m.material = m.userData.mats[toon ? 'toon' : 'real']; if (m.userData.outline) m.userData.outline.visible = toon; }
  }
  setWear(h, b, l) {
    const tint = (m, k) => { const c = v4; m.real.color.copy(this.skinBase).lerp(RED, k); m.toon.color.copy(m.real.color); };
    tint(this.M.head, Math.min(.5, h / 260)); tint(this.M.torso, Math.min(.5, b / 220)); tint(this.M.legL, Math.min(.6, l / 150));
  }
  // P = pose array at offset o, x in metres along the ring axis.
  update(P, o, x) {
    const J = solve(P, o, this.J), p = this.p, toon = this.style === 'toon';
    this.root.position.set(x, P[o + IDX.jump], 0);
    this.root.rotation.y = (this.dir > 0 ? 0 : Math.PI) - P[o + IDX.spin];
    p.pelvis.position.copy(J.hip); p.pelvis.quaternion.copy(J.qp);
    p.waist.position.set(0, .1, 0).applyQuaternion(J.qp).add(J.hip); p.waist.quaternion.copy(J.qp);
    p.abdomen.position.set(0, .17, 0).applyQuaternion(J.qp).add(J.hip); p.abdomen.quaternion.copy(J.qp);
    p.chest.position.set(0, .07, 0).applyQuaternion(J.qc).add(J.chest); p.chest.quaternion.copy(J.qc);
    v1.copy(J.shL).lerp(J.chest, .08); v2.copy(J.shR).lerp(J.chest, .08); limb(p.yoke, v1, v2);
    p.shL.position.copy(J.shL); p.shR.position.copy(J.shR);
    v1.set(0, -.03, 0).applyQuaternion(J.qc).add(J.neck); limb(p.neck, v1, J.head);
    const hs = toon ? 1.2 : 1;
    p.head.position.copy(J.head); p.head.quaternion.copy(J.qh); p.head.scale.set(.112 * hs, .124 * hs, .106 * hs);
    this.headGroup.position.copy(J.head); this.headGroup.quaternion.copy(J.qh); this.headGroup.scale.setScalar(hs);
    for (const s of ['L', 'R']) {
      const sh = J['sh' + s], el = J['el' + s], ha = J['ha' + s], hp = J['hp' + s], kn = J['kn' + s], an = J['an' + s];
      limb(p['ua' + s], sh, el);
      v2.copy(ha).sub(el).normalize();
      v1.copy(ha).addScaledVector(v2, -.07); limb(p['fa' + s], el, v1);
      v1.copy(ha).addScaledVector(v2, -.085); v3.copy(ha).addScaledVector(v2, -.03); limb(p['cuff' + s], v1, v3);
      const gs = toon ? 1.32 : 1, g = p['glove' + s];
      g.position.copy(ha).addScaledVector(v2, .025); g.quaternion.setFromUnitVectors(AY, v2); g.scale.set(.076 * gs, .092 * gs, .08 * gs);
      limb(p['thigh' + s], hp, kn); limb(p['shin' + s], kn, an);
      v2.copy(an).sub(kn).normalize();
      const k = Math.max(0, Math.min(1, (an.y - .12) / .3)) * .8;
      v3.set(1 - k, 0, 0).addScaledVector(v2, k).normalize();
      const f = p['foot' + s]; f.position.copy(an).addScaledVector(v3, .075); f.position.y -= .032 * (1 - k);
      f.quaternion.setFromUnitVectors(AY, v3); f.scale.setScalar(toon ? 1.2 : 1);
    }
    this.root.updateMatrixWorld(true);
  }
  world(name, out) { return this.root.localToWorld(out.copy(this.J[name])); }
}
function limb(mesh, a, b) {
  mesh.position.copy(a).add(b).multiplyScalar(.5);
  v4.copy(b).sub(a);
  const l = v4.length(); if (l < 1e-5) return;
  mesh.quaternion.setFromUnitVectors(AY, v4.multiplyScalar(1 / l));
}
