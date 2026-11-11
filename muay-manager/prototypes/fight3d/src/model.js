// A generated, rigged character (Meshy GLB) driven by the same pose system as the code-built fighter.
// The pose solver gives joint positions and torso orientations; here each bone gets a world matrix that
// carries its bind-pose shape to where the solver says that body part is now.
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { IDX } from './poses.js';
import { DIM, solve, makeJoints } from './rig.js';
import { outfitTexture, headgear } from './outfit.js';
const THREE = globalThis.THREE;

const V = () => new THREE.Vector3(), Q = () => new THREE.Quaternion();
const FWD = new THREE.Vector3(1, 0, 0), UP = new THREE.Vector3(0, 1, 0);
const m1 = new THREE.Matrix4(), mB = new THREE.Matrix4(), v1 = V(), v2 = V(), v3 = V(), v4 = V(), q1 = Q(), q2 = Q(), ONE = new THREE.Vector3(1, 1, 1);
// model space (+Z forward, +X to the model's left) -> fighter space (+X forward, +Z to the right)
const TO_LOCAL = new THREE.Matrix4().makeRotationY(Math.PI / 2);

// orientation whose first axis is d and whose second axis is n made perpendicular to d
function frame(d, n, out) {
  v3.copy(n).addScaledVector(d, -n.dot(d));
  if (v3.lengthSq() < 1e-8) v3.set(0, 0, 1).addScaledVector(d, -d.z);
  v3.normalize(); v4.crossVectors(d, v3);
  mB.makeBasis(d, v3, v4); return out.setFromRotationMatrix(mB);
}

// Rebuilds a binary glTF in memory from the embedded data, so parsing needs no network requests.
function toGlb(gltf, bin) {
  const binLen = bin.length, binPad = (4 - (binLen % 4)) % 4;
  const json = new TextEncoder().encode(JSON.stringify(gltf)), jsonPad = (4 - (json.length % 4)) % 4;
  const total = 12 + 8 + json.length + jsonPad + 8 + binLen + binPad, out = new Uint8Array(total), dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546C67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true);
  dv.setUint32(12, json.length + jsonPad, true); dv.setUint32(16, 0x4E4F534A, true); out.set(json, 20); out.fill(0x20, 20 + json.length, 20 + json.length + jsonPad);
  const o = 20 + json.length + jsonPad;
  dv.setUint32(o, binLen + binPad, true); dv.setUint32(o + 4, 0x004E4942, true); out.set(bin, o + 8);
  return out.buffer;
}
async function gunzip(b64) {
  if (typeof DecompressionStream === 'undefined') throw new Error('this browser cannot unpack the model (needs iOS 16.4 or newer)');
  const raw = atob(b64), bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
}
const loadImage = src => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('texture ' + src + ' did not load')); im.src = src; });

// On a well-placed rig the middle of the skull is this far behind the head bone (measured on the bodies that looked right).
const SKULL_BEHIND_BONE = .037;
// Models are embedded in the page as <script type="application/json" id="model-x"> blocks.
export async function loadModel(id, key) {
  const el = document.getElementById('model-' + id);
  if (!el) throw new Error('model ' + id + ' is not in this page');
  const file = JSON.parse(el.textContent);
  const gltf = await new GLTFLoader().parseAsync(toGlb(file.gltf, await gunzip(file.gz)), '');
  const image = await loadImage(file.texture), tex = new THREE.Texture(image);
  tex.flipY = false; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; tex.needsUpdate = true;
  gltf.scene.traverse(o => { if (o.isSkinnedMesh) { o.material.map = tex; o.material.needsUpdate = true; } });
  const scene = gltf.scene; scene.updateMatrixWorld(true);
  let mesh = null; scene.traverse(o => { if (o.isSkinnedMesh) mesh = o; });
  if (!mesh) throw new Error('model has no skinned mesh');
  const pos = {}; // bind joint positions in fighter space
  mesh.skeleton.bones.forEach(b => { pos[b.name] = V().setFromMatrixPosition(b.matrixWorld).applyMatrix4(TO_LOCAL); });
  const need = ['Hips', 'Spine', 'neck', 'Head', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'RightForeArm', 'RightHand', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot'];
  for (const n of need) if (!pos[n]) throw new Error('model is missing bone ' + n);
  const avg = (a, b) => (a + b) / 2, d = (a, b) => pos[a].distanceTo(pos[b]);
  const dims = {
    thigh: avg(d('LeftUpLeg', 'LeftLeg'), d('RightUpLeg', 'RightLeg')), shin: avg(d('LeftLeg', 'LeftFoot'), d('RightLeg', 'RightFoot')),
    ankle: avg(pos.LeftFoot.y, pos.RightFoot.y), hipW: avg(Math.abs(pos.LeftUpLeg.z), Math.abs(pos.RightUpLeg.z)), hipY: pos.Hips.y - avg(pos.LeftUpLeg.y, pos.RightUpLeg.y),
    spine: pos.Spine.y - pos.Hips.y, shY: avg(pos.LeftArm.y, pos.RightArm.y) - pos.Spine.y, shW: avg(Math.abs(pos.LeftArm.z), Math.abs(pos.RightArm.z)),
    neck: pos.Head.y - pos.Spine.y, head: .11,
    ua: avg(d('LeftArm', 'LeftForeArm'), d('RightArm', 'RightForeArm')), fa: avg(d('LeftForeArm', 'LeftHand'), d('RightForeArm', 'RightHand')) + .07
  };
  const headH = pos.head_end ? pos.head_end.distanceTo(pos.Head) : .23;
  // Where the skull really is. The auto-rig does not always put the head bone in the middle of the head, so headgear
  // and the hair mask take their centre from the geometry: the middle of the skull, front to back, in model space.
  const names = mesh.skeleton.bones.map(b => b.name), isHead = names.map(x => x === 'Head' || x === 'head_end' || x === 'headfront');
  const SI = mesh.geometry.attributes.skinIndex, SW = mesh.geometry.attributes.skinWeight, hb = mesh.skeleton.bones[names.indexOf('Head')], hy = V().setFromMatrixPosition(hb.matrixWorld), p = V();
  let z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < SI.count; i++) {
    let w = 0; for (let k = 0; k < 4; k++) if (isHead[SI.getComponent(i, k)]) w += SW.getComponent(i, k);
    if (w < .5) continue;
    mesh.getVertexPosition(i, p); p.applyMatrix4(mesh.matrixWorld);
    if (p.y < hy.y + headH * .6 || p.y > hy.y + headH) continue;
    if (p.z < z0) z0 = p.z; if (p.z > z1) z1 = p.z;
  }
  const skullZ = isFinite(z0) ? (z0 + z1) / 2 : hy.z - SKULL_BEHIND_BONE;
  const headZ = mesh.userData.headZ = skullZ + SKULL_BEHIND_BONE; // where a well-placed head bone would be, front to back (the hair mask uses it too)
  const headF = headZ - hy.z;                                    // how far forward of the actual head bone the headgear's centre sits
  return {id, key: key || 'blue', scene, mesh, image, pos, dims, standHips: pos.Hips.y, headR: headH * .4, headC: headH * .74, headF}; // headgear sits on the forehead, above the eyes
}

const LIMB = [
  // [upper bone, lower bone, end bone, root joint, mid joint, end joint, pole index, kind]
  ['LeftArm', 'LeftForeArm', 'LeftHand', 'shL', 'elL', 'haL', 'eL', 'arm'], ['RightArm', 'RightForeArm', 'RightHand', 'shR', 'elR', 'haR', 'eR', 'arm'],
  ['LeftUpLeg', 'LeftLeg', 'LeftFoot', 'hpL', 'knL', 'anL', 'kL', 'leg'], ['RightUpLeg', 'RightLeg', 'RightFoot', 'hpR', 'knR', 'anR', 'kR', 'leg']
];

export class ModelFighter {
  constructor(index, model, look) {
    this.index = index; this.dir = index ? -1 : 1; this.model = model; this.isModel = true;
    this.root = new THREE.Group(); this.root.rotation.order = 'YXZ';
    this.J = makeJoints(); this.meshes = [];
    const clone = SkeletonUtils.clone(model.scene); clone.updateMatrixWorld(true);
    let mesh = null; clone.traverse(o => { if (o.isSkinnedMesh) mesh = o; });
    this.mesh = mesh; mesh.frustumCulled = false; mesh.castShadow = true; mesh.receiveShadow = false;
    const mat = mesh.material = mesh.material.clone(); mat.roughness = .62; mat.metalness = 0; mat.side = THREE.FrontSide;
    if (look) { try { mat.map = outfitTexture(model, look); } catch (e) { console.warn('outfit not applied:', e.message); } }
    this.gear = headgear(look && look.head, look && look.trim, model.headR); this.root.add(this.gear);
    this.mat = mat;
    this.handK = look && look.gloves === 'rope' ? .8 : 1; // a wrapped fist is smaller than a glove
    // bones leave the scene graph: their world matrices are written directly every frame
    this.bones = {}; this.bind = {};
    mesh.skeleton.bones.forEach(b => { this.bones[b.name] = b; this.bind[b.name] = new THREE.Matrix4().multiplyMatrices(TO_LOCAL, b.matrixWorld); b.matrixAutoUpdate = false; b.matrixWorldAutoUpdate = false; });
    mesh.removeFromParent(); mesh.position.set(0, 0, 0); mesh.quaternion.identity(); mesh.scale.set(1, 1, 1); this.root.add(mesh);
    // bind-pose limb frames
    const P0 = model.pos;
    this.limbs = LIMB.filter(l => this.bones[l[0]]).map(l => {
      const d0 = V().subVectors(P0[l[1]], P0[l[0]]).normalize(), e0 = V().subVectors(P0[l[2]], P0[l[1]]).normalize();
      const flex = l[7] === 'arm' ? FWD : v1.copy(FWD).negate(); // elbows fold forward, knees fold back
      const n0 = V().crossVectors(d0, flex).normalize();
      return {l, upInv: frame(d0, n0, Q()).invert(), loInv: frame(e0, n0, Q()).invert(), n: n0.clone(), up0: P0[l[0]].distanceTo(P0[l[1]]), lo0: P0[l[1]].distanceTo(P0[l[2]])};
    });
    this.qUp = Q(); this.qLo = Q(); this.qFoot = Q(); this.qNeck = Q(); this.d = V(); this.e = V(); this.n = V(); this.a = V();
  }
  setStyle() {}
  setMongkol(on) { this.gear.visible = !!on; } // the headpiece comes off before the fight
  setWear(h, b) { const k = Math.min(.28, (h + b) / 900); this.mat.color.setRGB(1, 1 - k * .75, 1 - k * .85); }
  // world matrix for a bone: rotate by q about its bind point a0 and move that point to a
  put(name, q, a, a0, k) {
    const b = this.bones[name]; if (!b) return;
    k = k || 1; // uniform stretch, so a model with other limb lengths still meets the shared skeleton's joints
    v1.copy(a0).multiplyScalar(k).applyQuaternion(q); v2.copy(a).sub(v1);
    m1.compose(v2, q, v3.set(k, k, k));
    b.matrixWorld.multiplyMatrices(this.root.matrixWorld, m1).multiply(this.bind[name]);
  }
  update(P, o, x) {
    const J = solve(P, o, this.J), P0 = this.model.pos;
    this.root.position.set(x, P[o + IDX.jump], 0);
    this.root.rotation.y = (this.dir > 0 ? 0 : Math.PI) - P[o + IDX.spin];
    this.root.updateMatrixWorld(true);
    // torso: the pelvis leads, the spine takes up the shoulder twist step by step
    const tw = P[o + IDX.twist];
    this.put('Hips', J.qp, J.hip, P0.Hips);
    for (const [name, w] of [['Spine02', .3], ['Spine01', .65], ['Spine', 1], ['LeftShoulder', 1], ['RightShoulder', 1]]) {
      q1.setFromAxisAngle(UP, -tw * w); q2.copy(J.qp).multiply(q1); this.put(name, q2, J.hip, P0.Hips);
    }
    // neck and head hang off the chest
    v3.copy(P0.neck).sub(P0.Hips).applyQuaternion(J.qc).add(J.hip); this.a.copy(v3);
    this.qNeck.copy(J.qc).slerp(J.qh, .5); this.put('neck', this.qNeck, this.a, P0.neck);
    v3.copy(P0.Head).sub(P0.neck).applyQuaternion(this.qNeck).add(this.a); this.a.copy(v3);
    for (const name of ['Head', 'head_end', 'headfront']) this.put(name, J.qh, this.a, P0.Head);
    this.gear.position.set(this.model.headF, this.model.headC, 0).applyQuaternion(J.qh).add(this.a); this.gear.quaternion.copy(J.qh);
    // limbs
    for (const L of this.limbs) {
      const l = L.l, A = J[l[3]], B = J[l[4]], C = J[l[5]];
      this.d.subVectors(B, A).normalize(); this.e.subVectors(C, B).normalize();
      this.n.crossVectors(this.d, this.e);
      if (this.n.lengthSq() < .02) { // nearly straight: take the bend plane from the pose's pole instead
        const pi = IDX[l[6]]; v4.set(P[o + pi], P[o + pi + 1], P[o + pi + 2]); this.n.crossVectors(v4, this.d);
        if (this.n.lengthSq() < 1e-6) this.n.copy(L.n);
      }
      this.n.normalize();
      const arm = l[7] === 'arm', kUp = (arm ? DIM.ua : DIM.thigh) / L.up0, kLo = (arm ? DIM.fa - .07 : DIM.shin) / L.lo0;
      frame(this.d, this.n, this.qUp).multiply(L.upInv); this.put(l[0], this.qUp, A, P0[l[0]], kUp);
      frame(this.e, this.n, this.qLo).multiply(L.loInv); this.put(l[1], this.qLo, B, P0[l[1]], kLo);
      if (arm) { this.a.copy(P0[l[2]]).sub(P0[l[1]]).multiplyScalar(kLo).applyQuaternion(this.qLo).add(B); this.put(l[2], this.qLo, this.a, P0[l[2]], this.handK); }
      else {
        // planted foot stays flat and points where the knee points; a foot in the air follows the shin
        v4.crossVectors(this.n, UP); v4.y = 0;
        if (v4.lengthSq() < 1e-6) v4.copy(FWD);
        v4.normalize(); this.qFoot.setFromUnitVectors(FWD, v4);
        const k = Math.max(0, Math.min(1, (C.y - DIM.ankle - .05) / .28));
        this.qFoot.slerp(this.qLo, k);
        this.put(l[2], this.qFoot, C, P0[l[2]]);
        this.put(l[2] === 'LeftFoot' ? 'LeftToeBase' : 'RightToeBase', this.qFoot, C, P0[l[2]]);
      }
    }
  }
  world(name, out) { return this.root.localToWorld(out.copy(this.J[name])); }
}
