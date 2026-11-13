// Procedural fighter: pose vector -> joints (two-bone IK) -> primitive meshes.
// Placeholder mannequin so camera, timing and feel can be judged before real models exist.
import { IDX } from './poses.js';
const THREE = globalThis.THREE;

export const DIM = {thigh: .45, shin: .45, spine: .32, shY: .24, shW: .19, hipW: .10, hipY: .02, neck: .28, head: .13, ua: .29, fa: .30, ankle: .07};
export const DIM_DEFAULT = Object.assign({}, DIM);
export function setDims(d) { Object.assign(DIM, DIM_DEFAULT, d || {}); } // a loaded model brings its own proportions
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
  // keep planted feet on the floor: if a standing leg cannot reach its foot, the pelvis sinks until it can
  let drop = 0;
  for (const s of [-1, 1]) {
    const fb = s < 0 ? I.fL : I.fR;
    if (P[o + fb + 1] > .08) continue;
    v1.set(0, -DIM.hipY, s * DIM.hipW).applyQuaternion(J.qp).add(J.hip);
    const dh = Math.hypot(P[o + fb] - v1.x, P[o + fb + 2] - v1.z), L = DIM.thigh + DIM.shin - .012;
    if (dh < L) drop = Math.max(drop, v1.y - (P[o + fb + 1] + DIM.ankle + Math.sqrt(L * L - dh * dh)));
  }
  if (drop > 0) J.hip.y -= drop;
  J.chest.set(0, DIM.spine, 0).applyQuaternion(J.qp).add(J.hip);
  J.neck.set(0, DIM.neck, 0).applyQuaternion(J.qc).add(J.chest);
  J.head.set(0, DIM.head, 0).applyQuaternion(J.qh).add(J.neck);
  J.shL.set(0, DIM.shY, -DIM.shW).applyQuaternion(J.qc).add(J.chest);
  J.shR.set(0, DIM.shY, DIM.shW).applyQuaternion(J.qc).add(J.chest);
  J.hpL.set(0, -DIM.hipY, -DIM.hipW).applyQuaternion(J.qp).add(J.hip);
  J.hpR.set(0, -DIM.hipY, DIM.hipW).applyQuaternion(J.qp).add(J.hip);
  ik(J.shL, P[o + I.hL], P[o + I.hL + 1], P[o + I.hL + 2], DIM.ua, DIM.fa, P[o + I.eL], P[o + I.eL + 1], P[o + I.eL + 2], J.elL, J.haL);
  ik(J.shR, P[o + I.hR], P[o + I.hR + 1], P[o + I.hR + 2], DIM.ua, DIM.fa, P[o + I.eR], P[o + I.eR + 1], P[o + I.eR + 2], J.elR, J.haR);
  ik(J.hpL, P[o + I.fL], P[o + I.fL + 1] + DIM.ankle, P[o + I.fL + 2], DIM.thigh, DIM.shin, P[o + I.kL], P[o + I.kL + 1], P[o + I.kL + 2], J.knL, J.anL);
  ik(J.hpR, P[o + I.fR], P[o + I.fR + 1] + DIM.ankle, P[o + I.fR + 2], DIM.thigh, DIM.shin, P[o + I.kR], P[o + I.kR + 1], P[o + I.kR + 2], J.knR, J.anR);
  return J;
}
export const EFF_JOINT = {handL: 'haL', handR: 'haR', footL: 'anL', footR: 'anR', elbowL: 'elL', elbowR: 'elR', kneeL: 'knL', kneeR: 'knR'};

// ---------- meshes ----------
// Muscular fighter built from shaped parts: a lofted torso that bends and twists between pelvis and chest,
// lathe-profiled limbs, a sculpted head, real glove and foot shapes, and painted muscle definition.
const SKINS = [0xc68e62, 0xb57a4e, 0xa2683f, 0xd09a6e];
const CORNER = [
  {shorts: 0xc9281f, trim: 0xf2c14e, glove: 0xd12f25, css: '#c9281f', trimCss: '#f2c14e', textCss: '#ffe08a'},
  {shorts: 0x1f55c4, trim: 0xf1f1f4, glove: 0x2563d6, css: '#1f55c4', trimCss: '#f1f1f4', textCss: '#ffffff'}
];
export const BUILDS = {heavy: 1.2, athletic: 1.08, lean: .96};
export const STYLE_BUILD = {puncher: 'heavy', clinch: 'heavy', kicker: 'lean', tech: 'athletic'};

// torso cross-sections: [height above hip, chest weight, half width, front depth, back depth]
const RINGS = [
  [-.11, 0, .105, .085, .095], [-.03, 0, .160, .108, .122], [.07, 0, .150, .104, .104], [.15, .3, .140, .100, .096],
  [.23, .7, .160, .112, .108], [.33, 1, .188, .134, .120], [.44, 1, .202, .128, .128], [.52, 1, .196, .100, .112],
  [.575, 1, .105, .068, .080], [.615, 1, .060, .056, .060]
];
const SHORT_RINGS = [[.118, 0, .160, .114, .114], [.07, 0, .166, .119, .121], [-.02, 0, .184, .128, .141], [-.10, 0, .192, .132, .138], [-.16, 0, .176, .112, .122]];
const SEG = 20, Y0 = -.11, YSPAN = .725;

function loft(rings, bulk, y0, span) {
  if (y0 == null) { y0 = Y0; span = YSPAN; }
  const n = rings.length, vn = n * (SEG + 1), tpl = new Float32Array(vn * 4), uv = new Float32Array(vn * 2), idx = [];
  const wide = 1 + (bulk - 1) * .7, ex = .8;
  rings.forEach((r, ri) => {
    for (let k = 0; k <= SEG; k++) {
      const th = k / SEG * Math.PI * 2 + Math.PI / 2, c = Math.cos(th), sn = Math.sin(th), o = (ri * (SEG + 1) + k) * 4;
      tpl[o] = (c >= 0 ? r[3] : r[4]) * Math.sign(c) * Math.pow(Math.abs(c), ex) * bulk;
      tpl[o + 1] = r[0]; tpl[o + 2] = r[2] * Math.sign(sn) * Math.pow(Math.abs(sn), ex) * wide; tpl[o + 3] = r[1];
      uv[(ri * (SEG + 1) + k) * 2] = 1 - k / SEG; uv[(ri * (SEG + 1) + k) * 2 + 1] = (r[0] - y0) / span;
    }
  });
  for (let r = 0; r < n - 1; r++) for (let k = 0; k < SEG; k++) { const a = r * (SEG + 1) + k, b = a + 1, c = a + SEG + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vn * 3), 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
  return {g, tpl, vn};
}
function lathe(profile, len, bulk) {
  const pts = [], r0 = profile[0][1] * bulk, r1 = profile[profile.length - 1][1] * bulk;
  for (const a of [0, .45, .9, 1.3]) pts.push(new THREE.Vector2(Math.max(.0001, r0 * Math.sin(a)), -len / 2 - r0 * Math.cos(a)));
  for (const q of profile) pts.push(new THREE.Vector2(q[1] * bulk, -len / 2 + q[0] * len));
  for (const a of [1.3, .9, .45, 0]) pts.push(new THREE.Vector2(Math.max(.0001, r1 * Math.sin(a)), len / 2 + r1 * Math.cos(a)));
  return new THREE.LatheGeometry(pts, 14);
}
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.wrapS = THREE.RepeatWrapping; return t;
}
// Painted muscle definition. u: 0 right side, .25 front, .5 left side, .75 back. v follows height.
function torsoTexture(tattoo) {
  return canvasTex(512, 512, (g, W, H) => {
    const Y = yp => (1 - (yp - Y0) / YSPAN) * H, F = 128, B = 384;
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.lineCap = 'round'; g.lineJoin = 'round';
    const soft = (path, w, col) => { for (let k = 3; k >= 1; k--) { g.strokeStyle = col || 'rgba(70,28,12,.11)'; g.lineWidth = w * k; g.beginPath(); path(); g.stroke(); } };
    const glow = (x, y, rx, ry, col) => { const gr = g.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry)); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.save(); g.translate(x, y); g.scale(rx / Math.max(rx, ry), ry / Math.max(rx, ry)); g.translate(-x, -y); g.fillStyle = gr; g.beginPath(); g.arc(x, y, Math.max(rx, ry), 0, 7); g.fill(); g.restore(); };
    // form shading down the flanks
    for (const x of [0, 256, 512]) { const gr = g.createLinearGradient(x - 60, 0, x + 60, 0); gr.addColorStop(0, 'rgba(60,24,10,0)'); gr.addColorStop(.5, 'rgba(60,24,10,.2)'); gr.addColorStop(1, 'rgba(60,24,10,0)'); g.fillStyle = gr; g.fillRect(x - 60, 0, 120, H); }
    for (const s of [-1, 1]) {
      glow(F + s * 40, Y(.42), 44, 34, 'rgba(255,236,214,.5)');                                        // pec highlight
      soft(() => { g.moveTo(F + s * 5, Y(.365)); g.quadraticCurveTo(F + s * 42, Y(.31), F + s * 78, Y(.375)); }, 4, 'rgba(70,28,12,.16)'); // pec crease
      soft(() => { g.moveTo(F + s * 8, Y(.545)); g.lineTo(F + s * 72, Y(.56)); }, 2.5);                 // collarbone
      soft(() => { g.moveTo(F + s * 31, Y(.31)); g.quadraticCurveTo(F + s * 36, Y(.18), F + s * 27, Y(.05)); }, 3); // rectus edge
      soft(() => { g.moveTo(F + s * 66, Y(.07)); g.lineTo(F + s * 22, Y(-.07)); }, 3.5);                // hip line
      for (const y of [.26, .2, .14]) soft(() => { g.moveTo(F + s * 54, Y(y + .03)); g.lineTo(F + s * 78, Y(y)); }, 2, 'rgba(70,28,12,.08)'); // serratus
      for (const y of [.27, .2, .13]) { glow(F + s * 15, Y(y - .033), 14, 13, 'rgba(255,236,214,.38)'); }
      g.fillStyle = 'rgba(120,58,40,.55)'; g.beginPath(); g.arc(F + s * 44, Y(.375), 4.5, 0, 7); g.fill(); // nipple
      // back
      glow(B + s * 44, Y(.43), 40, 44, 'rgba(255,236,214,.4)');
      soft(() => { g.moveTo(B + s * 13, Y(.51)); g.quadraticCurveTo(B + s * 56, Y(.5), B + s * 50, Y(.35)); }, 3.5); // shoulder blade
      soft(() => { g.moveTo(B + s * 76, Y(.42)); g.quadraticCurveTo(B + s * 60, Y(.25), B + s * 26, Y(.1)); }, 3.5); // lat
      g.fillStyle = 'rgba(70,28,12,.25)'; g.beginPath(); g.arc(B + s * 16, Y(.07), 5, 0, 7); g.fill();
    }
    soft(() => { g.moveTo(F, Y(.5)); g.lineTo(F, Y(.34)); }, 3);                                         // sternum
    soft(() => { g.moveTo(F, Y(.33)); g.lineTo(F, Y(.04)); }, 3, 'rgba(70,28,12,.14)');                  // linea alba
    for (const y of [.27, .2, .13]) soft(() => { g.moveTo(F - 29, Y(y)); g.quadraticCurveTo(F, Y(y - .012), F + 29, Y(y)); }, 2.5);
    g.fillStyle = 'rgba(60,22,10,.6)'; g.beginPath(); g.ellipse(F, Y(.1), 3, 5, 0, 0, 7); g.fill();     // navel
    soft(() => { g.moveTo(B, Y(.57)); g.lineTo(B, Y(.0)); }, 4, 'rgba(70,28,12,.15)');                  // spine
    if (tattoo) { // abstract sak yant: nine spires and five rows of script
      g.strokeStyle = 'rgba(22,30,58,.8)'; g.lineWidth = 1.6;
      for (let i = -4; i <= 4; i++) { const x = B + i * 8, h = 30 - Math.abs(i) * 5, y = Y(.47); g.beginPath(); g.moveTo(x - 3.5, y); g.lineTo(x, y - h); g.lineTo(x + 3.5, y); g.closePath(); g.stroke(); g.beginPath(); g.arc(x, y - h - 3, 1.6, 0, 7); g.stroke(); }
      g.beginPath(); g.moveTo(B - 40, Y(.465)); g.lineTo(B + 40, Y(.465)); g.stroke();
      for (let r = 0; r < 5; r++) { g.beginPath(); const y = Y(.44) + r * 7; for (let x = -34; x <= 34; x += 4) g.lineTo(B - 60 + x * .0 + x + 60, y + Math.sin(x * 1.9 + r) * 2); g.stroke(); }
    }
  });
}
// Satin Muay Thai shorts: striped waistband, lettering front and back, side stripes.
function shortsTexture(c) {
  return canvasTex(512, 256, (g, W, H) => {
    g.fillStyle = c.css; g.fillRect(0, 0, W, H);
    for (let x = 0; x < W; x += 32) { const gr = g.createLinearGradient(x, 0, x + 32, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, 'rgba(255,255,255,.1)'); gr.addColorStop(1, 'rgba(0,0,0,.08)'); g.fillStyle = gr; g.fillRect(x, 0, 32, H); }
    g.fillStyle = c.trimCss; g.fillRect(0, 0, W, H * .2); g.fillRect(0, H - 9, W, 9);
    g.fillStyle = 'rgba(0,0,0,.28)'; for (const y of [.05, .1, .15]) g.fillRect(0, H * y, W, 2.5);
    for (const x of [0, 256, 512]) { g.fillStyle = c.trimCss; g.fillRect(x - 9, H * .2, 18, H); g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(x - 3, H * .2, 6, H); }
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    g.font = '700 58px Kanit, "IBM Plex Sans Thai", sans-serif'; g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,.45)'; g.strokeText('มวยไทย', 128, H * .43); g.fillStyle = c.textCss; g.fillText('มวยไทย', 128, H * .43);
    g.font = 'italic 800 38px Kanit, sans-serif'; g.lineWidth = 5; g.strokeText('MUAY THAI', 384, H * .43); g.fillText('MUAY THAI', 384, H * .43);
  });
}
let GRAD = null, OUTLINE = null, GEO = null;
function shared() {
  if (GEO) return;
  const gd = new Uint8Array([70, 70, 70, 255, 150, 150, 150, 255, 255, 255, 255, 255]);
  GRAD = new THREE.DataTexture(gd, 3, 1, THREE.RGBAFormat); GRAD.minFilter = GRAD.magFilter = THREE.NearestFilter; GRAD.needsUpdate = true;
  OUTLINE = new THREE.MeshBasicMaterial({color: 0x120c0a, side: THREE.BackSide});
  OUTLINE.onBeforeCompile = s => { s.vertexShader = s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed += normalize(normal) * 0.012;'); };
  GEO = {
    sphere: new THREE.SphereGeometry(1, 22, 16),
    hair: new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI * .5),
    mongkol: new THREE.TorusGeometry(.108, .012, 8, 24), tail: new THREE.CapsuleGeometry(.011, .1, 3, 6),
    prajiad: new THREE.TorusGeometry(1, .16, 6, 18), cuff: new THREE.CylinderGeometry(.05, .055, .085, 16),
    foot: lathe([[0, .04], [.3, .046], [.7, .044], [1, .028]], .15, 1)
  };
}
function mats(color, rough, map) {
  return {
    real: new THREE.MeshStandardMaterial({color, roughness: rough == null ? .5 : rough, metalness: 0, map: map || null}),
    toon: new THREE.MeshToonMaterial({color, gradientMap: GRAD, map: map || null})
  };
}
const RED = new THREE.Color(0xb03020);

export class Fighter {
  // look: {skin, build: 'heavy'|'athletic'|'lean', hair: 0..2, tattoo: bool}
  constructor(index, look) {
    shared();
    look = look || {};
    this.index = index; this.dir = index ? -1 : 1;
    this.root = new THREE.Group(); this.root.rotation.order = 'YXZ';
    this.J = makeJoints(); this.meshes = []; this.style = 'real';
    const bulk = this.bulk = BUILDS[look.build] || BUILDS.athletic;
    const c = CORNER[index], skin = SKINS[(look.skin || 0) % SKINS.length];
    this.skinBase = new THREE.Color(skin);
    const M = this.M = {
      head: mats(skin, .55), torso: mats(skin, .46, torsoTexture(!!look.tattoo)), arm: mats(skin, .48), leg: mats(skin, .5), legL: mats(skin, .5),
      shorts: mats(0xffffff, .36, shortsTexture(c)), shortsPlain: mats(c.shorts, .36), trim: mats(c.trim, .45), glove: mats(c.glove, .3), white: mats(0xe9e6df, .85), hair: mats(0x14100e, .8), dark: mats(0x2a1a14, .7)
    };
    M.shorts.real.side = M.shorts.toon.side = M.shortsPlain.real.side = M.shortsPlain.toon.side = THREE.DoubleSide;
    const mk = (geo, m, outline) => {
      const mesh = new THREE.Mesh(geo, m.real); mesh.userData.mats = m; mesh.castShadow = true;
      if (outline !== false) { const ol = new THREE.Mesh(geo, OUTLINE); ol.visible = false; mesh.add(ol); mesh.userData.outline = ol; }
      this.root.add(mesh); this.meshes.push(mesh); return mesh;
    };
    const child = (parent, geo, m, sx, sy, sz, px, py, pz) => {
      const mesh = new THREE.Mesh(geo, m.real); mesh.userData.mats = m; mesh.castShadow = true;
      if (sx != null) mesh.scale.set(sx, sy, sz); if (px != null) mesh.position.set(px, py, pz);
      parent.add(mesh); this.meshes.push(mesh); return mesh;
    };
    const p = this.p = {};
    // torso and shorts shell
    this.torso = loft(RINGS, bulk); p.torso = mk(this.torso.g, M.torso); p.torso.frustumCulled = false;
    this.shell = loft(SHORT_RINGS, bulk, -.16, .278); p.shell = mk(this.shell.g, M.shorts); p.shell.frustumCulled = false;
    // neck bridge and head
    p.neck = mk(lathe([[0, .062], [.5, .054], [1, .05]], .12, bulk), M.head, false);
    const hg = this.headGroup = new THREE.Group(); this.root.add(hg);
    const S = GEO.sphere;
    child(hg, S, M.head, .100, .112, .088, -.005, .022, 0);                 // cranium
    child(hg, S, M.head, .086, .086, .077, .020, -.045, 0);                 // face and jaw
    child(hg, S, M.head, .036, .030, .042, .060, -.103, 0);                 // chin
    child(hg, S, M.head, .022, .030, .017, .108, -.020, 0);                 // nose
    child(hg, S, M.head, .020, .012, .062, .092, .030, 0);                  // brow ridge
    child(hg, S, M.dark, .010, .005, .030, .097, -.068, 0).castShadow = false; // mouth
    for (const s of [-1, 1]) {
      child(hg, S, M.head, .018, .030, .012, -.005, -.008, s * .089);       // ear
      child(hg, S, M.hair, .011, .011, .011, .095, .008, s * .034).castShadow = false; // eye
      const br = child(hg, S, M.hair, .013, .006, .025, .101, .034, s * .036); br.rotation.x = -s * .28; br.castShadow = false;
    }
    const hairKind = (look.hair || 0) % 3;
    const hair = child(hg, GEO.hair, hairKind === 1 ? M.dark : M.hair, .107, hairKind === 1 ? .116 : .122, .095, -.012, .028, 0); hair.rotation.z = .36;
    if (hairKind === 2) child(hg, S, M.hair, .075, .03, .028, -.02, .135, 0);  // ridge of longer hair on top
    this.mongkol = new THREE.Group(); hg.add(this.mongkol);
    const mg = child(this.mongkol, GEO.mongkol, M.trim); mg.rotation.x = Math.PI / 2; mg.position.set(-.004, .062, 0);
    const tl = child(this.mongkol, GEO.tail, M.trim); tl.position.set(-.14, .03, 0); tl.rotation.z = -.6;
    // limbs
    for (const s of ['L', 'R']) {
      p['sh' + s] = mk(S, M.arm); p['sh' + s].scale.set(.076 * bulk, .08 * bulk, .074 * bulk);
      p['ua' + s] = mk(lathe([[0, .058], [.16, .064], [.46, .061], [.82, .049], [1, .046]], DIM.ua, bulk), M.arm);
      const pr = child(p['ua' + s], GEO.prajiad, M.trim, .062 * bulk, .062 * bulk, .062 * bulk, 0, -.02, 0); pr.rotation.x = Math.PI / 2;
      p['fa' + s] = mk(lathe([[0, .046], [.2, .054], [.6, .043], [1, .034]], DIM.fa - .07, bulk), M.arm);
      p['cuff' + s] = mk(GEO.cuff, M.white, false);
      const g = p['glove' + s] = mk(S, M.glove);
      child(g, S, M.glove, .46, .40, .46, .62, -.12, 0);                    // thumb
      p['thigh' + s] = mk(lathe([[0, .090], [.25, .098], [.6, .084], [.9, .065], [1, .060]], DIM.thigh, bulk), s === 'L' ? M.legL : M.leg);
      const lg = child(p['thigh' + s], new THREE.CylinderGeometry(.128 * bulk, .104 * bulk, .27, 18, 1, true), M.shortsPlain); lg.position.y = -DIM.thigh / 2 + .12;
      const hem = child(p['thigh' + s], new THREE.TorusGeometry(.128 * bulk, .008, 6, 24), M.trim); hem.rotation.x = Math.PI / 2; hem.position.y = -DIM.thigh / 2 + .255;
      p['shin' + s] = mk(lathe([[0, .060], [.12, .064], [.3, .076], [.55, .064], [.85, .047], [1, .044]], DIM.shin, bulk), s === 'L' ? M.legL : M.leg);
      const an = child(p['shin' + s], new THREE.CylinderGeometry(.05 * bulk, .047 * bulk, .11, 14), M.white); an.position.y = DIM.shin / 2 - .05;
      p['foot' + s] = mk(GEO.foot, s === 'L' ? M.legL : M.leg);
    }
    this.gloveSize = [.082, .104, .088];
  }
  setStyle(style) {
    this.style = style; const toon = style === 'toon';
    for (const m of this.meshes) { m.material = m.userData.mats[toon ? 'toon' : 'real']; if (m.userData.outline) m.userData.outline.visible = toon; }
  }
  setMongkol(on) { this.mongkol.visible = on; }
  setWear(h, b, l) {
    const tint = (m, k) => { m.real.color.copy(this.skinBase).lerp(RED, k); m.toon.color.copy(m.real.color); };
    tint(this.M.head, Math.min(.45, h / 280)); tint(this.M.torso, Math.min(.4, b / 240)); tint(this.M.legL, Math.min(.55, l / 150));
  }
  skin(L, J) {
    const pos = L.g.attributes.position.array, t = L.tpl, hip = J.hip, ch = J.chest;
    for (let i = 0; i < L.vn; i++) {
      const o = i * 4, w = t[o + 3];
      v1.set(t[o], t[o + 1], t[o + 2]).applyQuaternion(J.qp).add(hip);
      if (w > 0) { v2.set(t[o], t[o + 1] - DIM.spine, t[o + 2]).applyQuaternion(J.qc).add(ch); v1.lerp(v2, w); }
      pos[i * 3] = v1.x; pos[i * 3 + 1] = v1.y; pos[i * 3 + 2] = v1.z;
    }
    L.g.attributes.position.needsUpdate = true; L.g.computeVertexNormals();
  }
  // P = pose array at offset o, x in metres along the ring axis.
  update(P, o, x, z, yaw) { // z, yaw: optional, to stand somewhere off the fight line facing any way (the ceremony)
    const J = solve(P, o, this.J), p = this.p, toon = this.style === 'toon';
    this.root.position.set(x, P[o + IDX.jump], z || 0);
    this.root.rotation.y = yaw != null ? yaw : (this.dir > 0 ? 0 : Math.PI) - P[o + IDX.spin];
    this.skin(this.torso, J); this.skin(this.shell, J);
    v1.set(0, .0, 0).applyQuaternion(J.qc).add(J.neck); v2.set(0, -.07, 0).applyQuaternion(J.qh).add(J.head); limb(p.neck, v1, v2);
    const hs = toon ? 1.15 : 1;
    this.headGroup.position.copy(J.head); this.headGroup.quaternion.copy(J.qh); this.headGroup.scale.setScalar(hs);
    for (const s of ['L', 'R']) {
      const sh = J['sh' + s], el = J['el' + s], ha = J['ha' + s], hp = J['hp' + s], kn = J['kn' + s], an = J['an' + s];
      p['sh' + s].position.copy(sh); p['sh' + s].quaternion.copy(J.qc);
      limb(p['ua' + s], sh, el);
      v2.copy(ha).sub(el).normalize();
      v1.copy(ha).addScaledVector(v2, -.07); limb(p['fa' + s], el, v1);
      v1.copy(ha).addScaledVector(v2, -.1); v3.copy(ha).addScaledVector(v2, -.03); limb(p['cuff' + s], v1, v3);
      const gs = toon ? 1.25 : 1, g = p['glove' + s], G = this.gloveSize;
      g.position.copy(ha).addScaledVector(v2, .03); g.quaternion.setFromUnitVectors(AY, v2); g.scale.set(G[0] * gs, G[1] * gs, G[2] * gs);
      limb(p['thigh' + s], hp, kn); limb(p['shin' + s], kn, an);
      v2.copy(an).sub(kn).normalize();
      const k = Math.max(0, Math.min(1, (an.y - .12) / .3)) * .8;
      v3.set(1 - k, 0, 0).addScaledVector(v2, k).normalize();
      const f = p['foot' + s]; f.position.copy(an).addScaledVector(v3, .065); f.position.y -= .03 * (1 - k);
      f.quaternion.setFromUnitVectors(AY, v3); f.scale.set(1.05, 1, .8 + .0 * k);
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
