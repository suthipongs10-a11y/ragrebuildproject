// Outfits for generated fighters: one base model, many looks.
// The model's shorts and gloves come in a plain key colour. Here that colour is replaced per fighter,
// shorts patterns are painted from where each texel sits on the body, and headgear is added as separate meshes.
const THREE = globalThis.THREE;

export const COLORS = {
  red: ['แดง', 0xc9281f], blue: ['น้ำเงิน', 0x1f55c4], black: ['ดำ', 0x1c1c22], white: ['ขาว', 0xf0f0f2], gold: ['ทอง', 0xe0a52a],
  green: ['เขียว', 0x1f8a4c], purple: ['ม่วง', 0x6b2fb5], pink: ['ชมพู', 0xe0559a], orange: ['ส้ม', 0xe8742a]
};
// the last four are the dear ones (prices in game.js PRICE): not offered when a fighter is made
export const PATTERNS = {plain: 'สีพื้น', stripe: 'แถบข้าง', hem: 'ขอบล่าง', zigzag: 'ลายฟันปลา', split: 'สองสี', check: 'ตาหมากรุก', tiger: 'ลายเสือ', flame: 'เปลวไฟ', spark: 'ประกายทอง'};
export const HEADGEAR = {none: 'ไม่มี', mongkol: 'มงคล'}; // worn for the wai kru, taken off before the bell
export const HAIR = {
  natural: ['สีเดิม', 0], brown: ['น้ำตาล', 0x8a5a2c], blond: ['ทอง', 0xe0bf5a], red: ['แดง', 0xc2301f], silver: ['เงิน', 0xd6d9de],
  blue: ['น้ำเงิน', 0x3f6fe0], green: ['เขียว', 0x35a35a], pink: ['ชมพู', 0xe86aa6], purple: ['ม่วง', 0x8a4fd0]
};

// Skin tones: the body's own, or its skin brought to one of these (outfitTexture). Bodies start from different tones, so
// each is moved by the ratio between this colour and its own typical skin colour.
export const SKINS = {natural: ['ผิวเดิม', 0], fair: ['ขาว', 0xecc7ac], light: ['ขาวเหลือง', 0xd9a987], tan: ['แทน', 0xbb875f], brown: ['คล้ำ', 0x93643f], dark: ['เข้ม', 0x664330]};
// Prajioud, the cloth band tied round each upper arm: none, or one of the colours
export const BANDS = Object.assign({none: ['ไม่ใส่', 0]}, COLORS);

// Facial hair, painted on the face where the style grows (beardPaint): none, or one of these
export const BEARDS = {none: 'ไม่มี', stubble: 'ตอหนวด', mustache: 'หนวด', chin: 'เคราคาง', goatee: 'เคราแพะ', full: 'เคราเต็ม'};

const MAP = 1024;
// Which body part each texel belongs to, and where it sits in the bind pose (height, sideways offset).
function bodyMap(mesh) {
  const g = mesh.geometry, pos = g.attributes.position, uv = g.attributes.uv, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, idx = g.index;
  const names = mesh.skeleton.bones.map(b => b.name);
  const kind = names.map(n => /Hand|ForeArm/.test(n) ? 1 : /Hips|UpLeg|Spine02/.test(n) ? 2 : 0);
  const vr = new Uint8Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const w = [0, 0, 0];
    for (let k = 0; k < 4; k++) w[kind[si.getComponent(i, k)]] += sw.getComponent(i, k);
    vr[i] = w[1] > .5 ? 1 : w[2] > .5 ? 2 : 0;
  }
  const region = new Uint8Array(MAP * MAP), hq = new Uint8Array(MAP * MAP), sq = new Int8Array(MAP * MAP), aq = new Uint8Array(MAP * MAP);
  const n = idx ? idx.count : pos.count;
  for (let t = 0; t < n; t += 3) {
    const a = idx ? idx.getX(t) : t, b = idx ? idx.getX(t + 1) : t + 1, c = idx ? idx.getX(t + 2) : t + 2;
    const r = vr[a] === vr[b] || vr[a] === vr[c] ? vr[a] : vr[b] === vr[c] ? vr[b] : 0;
    if (!r) continue;
    const ax = uv.getX(a) * MAP, ay = uv.getY(a) * MAP, bx = uv.getX(b) * MAP, by = uv.getY(b) * MAP, cx = uv.getX(c) * MAP, cy = uv.getY(c) * MAP;
    const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy); if (Math.abs(den) < 1e-9) continue;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx)) - 1), x1 = Math.min(MAP - 1, Math.ceil(Math.max(ax, bx, cx)) + 1);
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy)) - 1), y1 = Math.min(MAP - 1, Math.ceil(Math.max(ay, by, cy)) + 1);
    const ya = pos.getY(a), yb = pos.getY(b), yc = pos.getY(c), xa = pos.getX(a), xb = pos.getX(b), xc = pos.getX(c);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + .5, py = y + .5;
      const l1 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / den, l2 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / den, l3 = 1 - l1 - l2;
      if (l1 < -.35 || l2 < -.35 || l3 < -.35) continue; // a little spill over the edges hides seams
      const o = y * MAP + x; if (region[o] && (l1 < 0 || l2 < 0 || l3 < 0)) continue;
      region[o] = r; hq[o] = Math.max(0, Math.min(255, (l1 * ya + l2 * yb + l3 * yc) / 1.8 * 255));
      sq[o] = Math.max(-127, Math.min(127, (l1 * xa + l2 * xb + l3 * xc) * 300));
      if (r === 1) aq[o] = Math.max(0, Math.min(255, (Math.abs(l1 * xa + l2 * xb + l3 * xc) - .3) * 400)); // distance out along the arm
    }
  }
  return {region, hq, sq, aq};
}
// Is this texel the garment's key colour? Returns 0..1.
function keyed(rule, r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b); if (mx < 28) return 0;
  const sat = (mx - mn) / mx;
  if (rule === 'red') { if (r !== mx || sat < .66 || g - b > (mx - mn) * .2 || b - g > (mx - mn) * .25) return 0; return Math.min(1, (sat - .66) / .1); }
  if (b !== mx || sat < .32 || r > g + (mx - mn) * .45) return 0;
  return Math.min(1, (sat - .32) / .14);
}

// Does this texel look like skin? Red highest, then green, then blue; neither grey (wraps, teeth, the whites of the eyes)
// nor a strong colour (cloth). Returns 0..1.
function skinLike(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b); if (mx < 40 || r !== mx || b > g * 1.06) return 0;
  const sat = (mx - mn) / mx; if (sat < .12 || sat > .72) return 0;
  return Math.min(1, (sat - .12) / .08, (.72 - sat) / .08);
}

// Which texels are hair: on the head, above a hairline that sits high on the forehead and drops behind the ears to the nape.
// Positions come from the skinned bind pose, so this works whatever space the raw geometry is in.
const BACK = -.085; // metres behind the skull centre: further back than this there is no neck skin, only hair hanging down
function hairMap(mesh) {
  const g = mesh.geometry, uv = g.attributes.uv, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, idx = g.index, n = g.attributes.position.count;
  const bones = mesh.skeleton.bones, names = bones.map(b => b.name), isHead = names.map(x => x === 'Head' || x === 'head_end' || x === 'headfront'), isNeck = names.map(x => x === 'neck');
  const at = name => { const b = bones[names.indexOf(name)]; return b ? new THREE.Vector3().setFromMatrixPosition(b.matrixWorld) : null; };
  const H = at('Head'), out = new Uint8Array(MAP * MAP); if (!H) return out;
  const zc = mesh.userData.headZ != null ? mesh.userData.headZ : H.z; // front-to-back reference from the skull itself (set when the model loads)
  const span = mesh.userData.headH || .23, v = new THREE.Vector3() /* head height as measured when the model loaded */, hh = new Float32Array(n).fill(-9), zz = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let w = 0, wn = 0; for (let k = 0; k < 4; k++) { const j = si.getComponent(i, k); if (isHead[j]) w += sw.getComponent(i, k); else if (isNeck[j]) wn += sw.getComponent(i, k); }
    if (w + wn < .5) continue;
    mesh.getVertexPosition(i, v); v.applyMatrix4(mesh.matrixWorld); const z = v.z - zc; // model space: +z is the face
    if (w < .5 && z > BACK) continue; // the neck counts only behind the skull, where long hair hangs
    hh[i] = (v.y - H.y) / span; zz[i] = z;
  }
  const line = z => z >= .07 ? .86 : z >= .02 ? .72 + (z - .02) / .05 * .14 : z >= -.03 ? .5 + (z + .03) / .05 * .22 : z >= -.07 ? .28 + (z + .07) / .04 * .22 : z >= BACK ? .28 : -1;
  const cnt = idx ? idx.count : n;
  for (let t = 0; t < cnt; t += 3) {
    const a = idx ? idx.getX(t) : t, b = idx ? idx.getX(t + 1) : t + 1, c = idx ? idx.getX(t + 2) : t + 2;
    if (hh[a] < -8 || hh[b] < -8 || hh[c] < -8) continue;
    const ax = uv.getX(a) * MAP, ay = uv.getY(a) * MAP, bx = uv.getX(b) * MAP, by = uv.getY(b) * MAP, cx = uv.getX(c) * MAP, cy = uv.getY(c) * MAP;
    const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy); if (Math.abs(den) < 1e-9) continue;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx)) - 1), x1 = Math.min(MAP - 1, Math.ceil(Math.max(ax, bx, cx)) + 1);
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy)) - 1), y1 = Math.min(MAP - 1, Math.ceil(Math.max(ay, by, cy)) + 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + .5, py = y + .5;
      const l1 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / den, l2 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / den, l3 = 1 - l1 - l2;
      if (l1 < -.3 || l2 < -.3 || l3 < -.3) continue;
      const h = l1 * hh[a] + l2 * hh[b] + l3 * hh[c], z = l1 * zz[a] + l2 * zz[b] + l3 * zz[c];
      out[y * MAP + x] = h > line(z) ? (h > .93 ? 2 : 1) : out[y * MAP + x] === 0 ? 3 : out[y * MAP + x]; // 2 = crown, 1 = hair zone, 3 = face and neck
    }
  }
  return out;
}
const lum = (r, g, b) => (r * .3 + g * .59 + b * .11) / 255;

// The front and sides of the head, texel by texel: where each sits on the skull. h: head heights above the head bone,
// x: metres to one side of the middle, z: metres in front of the skull centre. Kept as a short list (the face is a
// small part of the texture), in the same MAP grid as the hair mask.
function faceTexels(mesh) {
  const g = mesh.geometry, uv = g.attributes.uv, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, idx = g.index, n = g.attributes.position.count;
  const bones = mesh.skeleton.bones, names = bones.map(b => b.name), isHead = names.map(x => x === 'Head' || x === 'head_end' || x === 'headfront'), isNeck = names.map(x => x === 'neck');
  const hb = bones[names.indexOf('Head')]; if (!hb) return {n: 0};
  const H = new THREE.Vector3().setFromMatrixPosition(hb.matrixWorld), zc = mesh.userData.headZ != null ? mesh.userData.headZ : H.z, span = mesh.userData.headH || .23, v = new THREE.Vector3();
  const hh = new Float32Array(n).fill(-9), zz = new Float32Array(n), xx = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let w = 0; for (let k = 0; k < 4; k++) { const j = si.getComponent(i, k); if (isHead[j] || isNeck[j]) w += sw.getComponent(i, k); }
    if (w < .5) continue;
    mesh.getVertexPosition(i, v); v.applyMatrix4(mesh.matrixWorld);
    hh[i] = (v.y - H.y) / span; zz[i] = v.z - zc; xx[i] = v.x - H.x;
  }
  const slot = new Int32Array(MAP * MAP), inside = [], O = [], Hs = [], Xs = [], Zs = [], cnt = idx ? idx.count : n; // slot: 1 + where the texel is in the list
  for (let t = 0; t < cnt; t += 3) {
    const a = idx ? idx.getX(t) : t, b = idx ? idx.getX(t + 1) : t + 1, c = idx ? idx.getX(t + 2) : t + 2;
    if (hh[a] < -8 || hh[b] < -8 || hh[c] < -8) continue;
    if (Math.max(zz[a], zz[b], zz[c]) < -.035 || Math.min(hh[a], hh[b], hh[c]) > .8) continue; // the back of the head and the top of it grow no beard
    const ax = uv.getX(a) * MAP, ay = uv.getY(a) * MAP, bx = uv.getX(b) * MAP, by = uv.getY(b) * MAP, cx = uv.getX(c) * MAP, cy = uv.getY(c) * MAP;
    const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy); if (Math.abs(den) < 1e-9) continue;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx)) - 1), x1 = Math.min(MAP - 1, Math.ceil(Math.max(ax, bx, cx)) + 1);
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy)) - 1), y1 = Math.min(MAP - 1, Math.ceil(Math.max(ay, by, cy)) + 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + .5, py = y + .5;
      const l1 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / den, l2 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / den, l3 = 1 - l1 - l2;
      const edge = l1 < 0 || l2 < 0 || l3 < 0; if (l1 < -.3 || l2 < -.3 || l3 < -.3) continue;
      const o = y * MAP + x, had = slot[o]; if (had && (inside[had - 1] || edge)) continue; // a texel inside a triangle wins over one just outside its edge
      const rec = had ? had - 1 : O.length;
      slot[o] = rec + 1; inside[rec] = !edge; O[rec] = o; Hs[rec] = l1 * hh[a] + l2 * hh[b] + l3 * hh[c]; Xs[rec] = l1 * xx[a] + l2 * xx[b] + l3 * xx[c]; Zs[rec] = l1 * zz[a] + l2 * zz[b] + l3 * zz[c];
    }
  }
  return {n: O.length, o: Uint32Array.from(O), h: Float32Array.from(Hs), x: Float32Array.from(Xs), z: Float32Array.from(Zs)};
}
// Where the mouth is. From the shape of the face down its middle: the chin is the lowest point that is still near the
// front, the tip of the nose the point furthest forward above it, and the mouth sits six tenths of the way up from one
// to the other (measured on the bodies here: .59 to .62). The lips, redder than the skin on most faces, then set it
// more exactly. Returns the mouth's height (h as in faceTexels) and how far forward the lips are.
function mouthAt(F, model) {
  const d = model.pixels.data, W = model.pixels.width, Hh = model.pixels.height, sx = W / MAP, sy = Hh / MAP, bins = 100, lo = -.3, hi = .8, step = (hi - lo) / bins;
  const red = new Float32Array(bins), cnt = new Float32Array(bins), zf = new Float32Array(bins).fill(-9);
  for (let i = 0; i < F.n; i++) {
    if (Math.abs(F.x[i]) > .02 || F.z[i] < .03) continue;
    const b = Math.floor((F.h[i] - lo) / step); if (b < 0 || b >= bins) continue;
    if (F.z[i] > zf[b]) zf[b] = F.z[i];
    const o = F.o[i], p = (Math.floor(Math.floor(o / MAP) * sy) * W + Math.floor((o % MAP) * sx)) * 4, r = d[p], g = d[p + 1], bl = d[p + 2], mx = Math.max(r, g, bl);
    if (mx < 50) continue; // nostrils, the line between the lips, a dark moustache
    red[b] += (r - (g + bl) / 2) / mx; cnt[b]++;
  }
  const hAt = b => lo + (b + .5) * step;
  let front = -9; for (let b = 0; b < bins; b++) if (zf[b] > front) front = zf[b];
  if (front < 0) return {h: .2, z: .085, found: false};
  let chin = 0; while (chin < bins && zf[chin] < front - .042) chin++;
  let nose = -1; for (let b = chin; b < bins; b++) { const up = hAt(b) - hAt(chin); if (up < .25 || up > .55) continue; if (nose < 0 || zf[b] > zf[nose]) nose = b; }
  if (nose < 0) return {h: hAt(chin) + .23, z: front - .01, found: false};
  let h = hAt(chin) + (hAt(nose) - hAt(chin)) * .61;
  // the lips: the reddest stretch within a centimetre of that
  const val = b => (cnt[b] > 3 ? red[b] / cnt[b] : 0), all = []; for (let b = chin; b <= nose; b++) if (cnt[b] > 3) all.push(val(b));
  all.sort((p, q) => p - q); const base = all.length ? all[all.length >> 1] : 0;
  let best = -1, bv = .035; for (let b = 1; b < bins - 1; b++) { if (Math.abs(hAt(b) - h) > .045) continue; const v = (val(b - 1) + 2 * val(b) + val(b + 1)) / 4 - base; if (v > bv) { bv = v; best = b; } }
  if (best >= 0) h = hAt(best);
  const mb = Math.max(0, Math.min(bins - 1, Math.floor((h - lo) / step))); let z = -9; for (let b = Math.max(0, mb - 1); b <= Math.min(bins - 1, mb + 1); b++) z = Math.max(z, zf[b]);
  // a face that does not measure like one (a thick beard already hides the chin) is left as it is
  return {h, z: z > 0 ? z : front - .01, found: best >= 0, chin: +hAt(chin).toFixed(3), nose: +hAt(nose).toFixed(3), ok: hAt(nose) - hAt(chin) >= .3 && hAt(nose) - hAt(chin) <= .5};
}
// How strongly each style grows at a point of the face. dh: head heights above the mouth, ax: metres from the middle,
// dz: metres behind the lips (0 at the front of the mouth, about .09 at the ears).
const ramp = (v, a, b) => Math.max(0, Math.min(1, (v - a) / (b - a)));
const BEARD_AT = {
  mustache(dh, ax) { return ramp(dh, .026, .044) * ramp(-dh, -.118, -.094) * ramp(-ax, -(.036 + Math.max(0, .07 - dh) * .12), -.024); },
  // the chin and the strip under the lip
  chin(dh, ax) { return ramp(-dh, .04, .075) * ramp(dh, -.34, -.26) * ramp(-ax, -.04, -.024); },
  // moustache and chin, joined round the corners of the mouth
  goatee(dh, ax) {
    const sides = ramp(-dh, -.07, -.03) * ramp(dh, -.11, -.05) * ramp(ax, .02, .03) * ramp(-ax, -.046, -.034);
    return Math.max(BEARD_AT.mustache(dh, ax), BEARD_AT.chin(dh, ax), sides);
  },
  // the whole lower face: under a line from the ear down to the corner of the mouth, round the jaw and a little way
  // under it; thinner toward the cheek, thickest along the jaw
  full(dh, ax, dz) {
    if (Math.abs(dh) < .03 && ax < .026) return 0; // the lips
    const top = -.03 + ramp(dz, .015, .09) * .36, edge = ramp(-dh, -top - .07, -top + .01);
    const jaw = edge * (.72 + .28 * ramp(-dh, -top + .01, -top + .14)) * ramp(dh, -.44, -.3) * ramp(-dz, -.12, -.09);
    return Math.max(jaw, BEARD_AT.goatee(dh, ax));
  },
  stubble(dh, ax, dz) { return BEARD_AT.full(dh, ax, dz) * .5; }
};
// Paints the style onto the face in d (the texture being built). Grows only on skin (and on hair already there); keeps
// the light and shade of what is under it; breaks up toward the edges so it reads as hair, not paint.
function beardPaint(d, model, style, rgb) {
  const at = BEARD_AT[style], F = model.face, M = model.mouth; if (!at || !F || !F.n || !M || !M.ok) return;
  const src = model.pixels.data, W = model.pixels.width, H = model.pixels.height, kx = W / MAP, ky = H / MAP, sv = Math.max(.08, model.skinV), thin = style === 'stubble';
  for (let i = 0; i < F.n; i++) {
    const w = at(F.h[i] - M.h, Math.abs(F.x[i]), M.z - F.z[i]); if (w <= .02) continue;
    const o = F.o[i], mx = o % MAP, my = (o - mx) / MAP;
    for (let y = Math.floor(my * ky); y < Math.floor((my + 1) * ky) || y === Math.floor(my * ky); y++) for (let x = Math.floor(mx * kx); x < Math.floor((mx + 1) * kx) || x === Math.floor(mx * kx); x++) {
      const p = (y * W + x) * 4, r = src[p], g = src[p + 1], b = src[p + 2], v = lum(r, g, b);
      if (skinLike(r, g, b) < .2 && v > sv * .55) continue; // teeth, the whites of the eyes, cloth: nothing grows there
      const n1 = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453, n = n1 - Math.floor(n1); // one fixed speck per texel
      let a = thin ? w * (n < .55 ? 1.5 : .35) : w > .75 ? Math.min(1, w) * (.84 + n * .16) : w * (n < w * 1.25 ? 1 : .3); // solid in the middle, single hairs toward the edge
      a = Math.min(.94, a); const sh = Math.max(.55, Math.min(1.35, .62 + v / sv * .5)) * (.9 + n * .2);
      d[p] = r + (Math.min(255, rgb[0] * sh) - r) * a; d[p + 1] = g + (Math.min(255, rgb[1] * sh) - g) * a; d[p + 2] = b + (Math.min(255, rgb[2] * sh) - b) * a;
    }
  }
}

const cache = new Map();
// A texture for this model in this outfit. look: {shorts, trim, gloves, pattern}
// The referee: one of the bodies dressed in a dark short-sleeved shirt, black trousers and shoes, and white gloves.
// Each texel takes its part from the bone that moves it most; the cloth keeps a little of the light and shade under it.
const REF = {shirt: [0x1c, 0x24, 0x3a, .55], trousers: [0x17, 0x17, 0x1b, .12], shoes: [0x0e, 0x0e, 0x10, .2], gloves: [0xe6, 0xe8, 0xec, .25]};
// the cornermen between rounds: the same cut in each corner's colour, bare hands
const KITS = {ref: REF, c0: Object.assign({}, REF, {shirt: [0xb4, 0x24, 0x22, .5], gloves: [0x9c, 0x6c, 0x4c, .3]}), c1: Object.assign({}, REF, {shirt: [0x23, 0x4f, 0xb0, .5], gloves: [0x9c, 0x6c, 0x4c, .3]})};
function refereeTexture(model, kit) {
  const K = KITS[kit] || REF, key = model.id + '|' + kit; if (cache.has(key)) return cache.get(key);
  const mesh = model.mesh, g = mesh.geometry, pos = g.attributes.position, uv = g.attributes.uv, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, idx = g.index;
  const names = mesh.skeleton.bones.map(b => b.name), P0 = model.pos, v = new THREE.Vector3();
  const sleeve = (side, p) => { const a = P0[side + 'Arm'], b = P0[side + 'ForeArm']; if (!a || !b) return true; const d = b.clone().sub(a); return p.clone().sub(a).dot(d) / d.lengthSq() < .55; };
  const part = new Uint8Array(pos.count); // 0 skin, 1 shirt, 2 trousers, 3 shoes, 4 gloves
  for (let i = 0; i < pos.count; i++) {
    let best = 0, bw = -1; for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; best = si.getComponent(i, k); } }
    const n = names[best] || '';
    mesh.getVertexPosition(i, v); v.applyMatrix4(mesh.matrixWorld);
    part[i] = /Hand/.test(n) ? 4 : /ForeArm/.test(n) ? 0 : /^(Left|Right)Arm$/.test(n) ? (sleeve(n.startsWith('Left') ? 'Left' : 'Right', v) ? 1 : 0)
      : /Shoulder|Spine/.test(n) ? 1 : /Foot|Toe/.test(n) ? 3 : /Hips|UpLeg|Leg/.test(n) ? 2 : 0;
  }
  const map = new Uint8Array(MAP * MAP), n = idx ? idx.count : pos.count;
  for (let t = 0; t < n; t += 3) {
    const a = idx ? idx.getX(t) : t, b = idx ? idx.getX(t + 1) : t + 1, c = idx ? idx.getX(t + 2) : t + 2;
    const r = part[a] === part[b] || part[a] === part[c] ? part[a] : part[b] === part[c] ? part[b] : part[a]; if (!r) continue;
    const ax = uv.getX(a) * MAP, ay = uv.getY(a) * MAP, bx = uv.getX(b) * MAP, by = uv.getY(b) * MAP, cx = uv.getX(c) * MAP, cy = uv.getY(c) * MAP;
    const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy); if (Math.abs(den) < 1e-9) continue;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx)) - 1), x1 = Math.min(MAP - 1, Math.ceil(Math.max(ax, bx, cx)) + 1);
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy)) - 1), y1 = Math.min(MAP - 1, Math.ceil(Math.max(ay, by, cy)) + 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + .5, py = y + .5, l1 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / den, l2 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / den;
      if (l1 < -.05 || l2 < -.05 || 1 - l1 - l2 < -.05) continue;
      map[y * MAP + x] = r;
    }
  }
  for (let pass = 0; pass < 2; pass++) { const m2 = map.slice(); for (let y = 1; y < MAP - 1; y++) for (let x = 1; x < MAP - 1; x++) { const o = y * MAP + x; if (map[o]) continue; const nb = map[o - 1] || map[o + 1] || map[o - MAP] || map[o + MAP]; if (nb) m2[o] = nb; } map.set(m2); } // cover the seams
  const img = model.image, W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const cx2 = cv.getContext('2d', {willReadFrequently: true}); cx2.drawImage(img, 0, 0);
  const id = cx2.getImageData(0, 0, W, H), d = id.data, fx = MAP / W, fy = MAP / H, cols = [null, K.shirt, K.trousers, K.shoes, K.gloves];
  const med = [0, 0, 0, 0, 0].map((_, r) => { if (!r) return 0; const a = []; for (let y = 0; y < H; y += 4) for (let x = 0; x < W; x += 4) if (map[Math.floor(y * fy) * MAP + Math.floor(x * fx)] === r) { const p = (y * W + x) * 4; a.push(lum(d[p], d[p + 1], d[p + 2])); } a.sort((p, q) => p - q); return a.length ? a[a.length >> 1] : .5; });
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const r = map[Math.floor(y * fy) * MAP + Math.floor(x * fx)]; if (!r) continue;
    const p = (y * W + x) * 4, c = cols[r], k = Math.max(.7, Math.min(1.3, 1 + (lum(d[p], d[p + 1], d[p + 2]) - med[r]) * c[3]));
    d[p] = Math.min(255, c[0] * k); d[p + 1] = Math.min(255, c[1] * k); d[p + 2] = Math.min(255, c[2] * k);
  }
  cx2.putImageData(id, 0, 0);
  const tex = new THREE.CanvasTexture(cv); tex.flipY = false; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; // glTF texture layout, as the outfits
  cache.set(key, tex); return tex;
}

export function outfitTexture(model, look) {
  if (look.referee) return refereeTexture(model, 'ref');
  if (look.corner != null) return refereeTexture(model, 'c' + look.corner);
  const beard = BEARDS[look.beard] && look.beard !== 'none' ? look.beard : '';
  const key = model.id + '|' + look.shorts + look.trim + look.gloves + look.pattern + (look.hair || '') + '|' + (look.skin || '') + '|' + beard;
  if (cache.has(key)) return cache.get(key);
  const img = model.image, W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
  if (!model.pixels) {
    const c0 = document.createElement('canvas'); c0.width = W; c0.height = H;
    const g0 = c0.getContext('2d', {willReadFrequently: true}); g0.drawImage(img, 0, 0); model.pixels = g0.getImageData(0, 0, W, H);
    model.body = bodyMap(model.mesh);
    // height range of the shorts, for hem patterns
    let lo = 255, hi = 0; const B = model.body, d = model.pixels.data, sx = W / MAP, sy = H / MAP;
    for (let y = 0; y < MAP; y += 2) for (let x = 0; x < MAP; x += 2) {
      const o = y * MAP + x; if (B.region[o] !== 2) continue;
      const p = (Math.floor(y * sy) * W + Math.floor(x * sx)) * 4;
      if (keyed(model.key, d[p], d[p + 1], d[p + 2]) > .5) { if (B.hq[o] < lo) lo = B.hq[o]; if (B.hq[o] > hi) hi = B.hq[o]; }
    }
    model.shortsY = [lo, hi];
    // hair: typical brightness of the crown against the face tells hair from skin; a shaved head has nothing to dye
    const HM = model.hair = hairMap(model.mesh), crown = [], face = [], fr = [], fg = [], fb = [], hr = [], hg = [], hb = [];
    for (let y = 0; y < MAP; y += 2) for (let x = 0; x < MAP; x += 2) {
      const z = HM[y * MAP + x]; if (z !== 2 && z !== 3) continue;
      const p = (Math.floor(y * sy) * W + Math.floor(x * sx)) * 4; (z === 2 ? crown : face).push(lum(d[p], d[p + 1], d[p + 2]));
      if (z === 2) { hr.push(d[p]); hg.push(d[p + 1]); hb.push(d[p + 2]); }
      if (z === 3 && skinLike(d[p], d[p + 1], d[p + 2]) > .5) { fr.push(d[p]); fg.push(d[p + 1]); fb.push(d[p + 2]); }
    }
    const med = a => { a.sort((p, q) => p - q); return a.length ? a[a.length >> 1] : 0; };
    model.skinRGB = fr.length > 20 ? [med(fr), med(fg), med(fb)] : null; // the face's typical skin colour: what a chosen tone is measured against
    model.hairV = med(crown); model.skinV = med(face); model.hasHair = crown.length > 20 && model.skinV - model.hairV > .07; // every body here has dark natural hair; a brighter crown is a bare scalp over a beard
    // for facial hair: a colour to grow it in (the face itself is measured when a style is first asked for)
    model.hairRGB = model.hasHair && model.hairV > .3 ? [96, 68, 44] : [36, 28, 25]; // fair hair grows a brown beard, the rest a near-black one (the crown of a cropped head is half scalp: its own colour is no guide)

  }
  const src = model.pixels.data, out = new ImageData(new Uint8ClampedArray(src), W, H), d = out.data, B = model.body;
  const col = k => { const c = COLORS[k] ? COLORS[k][1] : COLORS.red[1]; return [(c >> 16) & 255, (c >> 8) & 255, c & 255]; };
  const cS = col(look.shorts), cT = col(look.trim), cG = col(look.gloves), cGold = col('gold'), [lo, hi] = model.shortsY, span = Math.max(1, hi - lo);
  const fx = MAP / W, fy = MAP / H, pat = look.pattern, rope = look.gloves === 'rope';
  const dye = model.hasHair && HAIR[look.hair] && HAIR[look.hair][1] ? HAIR[look.hair][1] : 0, cH = [(dye >> 16) & 255, (dye >> 8) & 255, dye & 255], HM = model.hair, hv = Math.max(.04, model.hairV), sv = model.skinV;
  const tc = SKINS[look.skin] && SKINS[look.skin][1], S0 = model.skinRGB, lim = (v, a, b2) => Math.max(a, Math.min(b2, v));
  // one channel moved by gain k: darker is a plain multiply; lighter multiplies the dark end and eases the bright end toward
  // white, so lit skin does not burn out
  const shift = (c, k, w) => { const t = c / 255, n = k <= 1 ? c * k : c * k * (1 - t) + (255 - (255 - c) / k) * t; return c + (n - c) * w; };
  const tone = tc && S0 ? [lim(((tc >> 16) & 255) / S0[0], .42, 1.7), lim(((tc >> 8) & 255) / S0[1], .42, 1.7), lim((tc & 255) / S0[2], .42, 1.7)] : null;
  for (let y = 0; y < H; y++) {
    const my = Math.floor(y * fy) * MAP;
    for (let x = 0; x < W; x++) {
      const o = my + Math.floor(x * fx), reg = B.region[o];
      if (tone) { // skin anywhere on the body goes to the chosen tone, its own light and shade kept; cloth, hair, brows, beard and ink stay
        const p = (y * W + x) * 4, r = src[p], g = src[p + 1], b = src[p + 2]; let s = skinLike(r, g, b);
        if (s > 0 && keyed(model.key, r, g, b) <= 0) {
          const v = lum(r, g, b), hz = HM[o]; s *= lim((v / sv - .2) / .18, 0, 1); // the very dark (brows, beard, the deepest shade) is left alone
          if ((hz === 1 || hz === 2) && Math.abs(v - hv) < Math.abs(v - sv)) s = 0;
          if (s > 0) { d[p] = shift(r, tone[0], s); d[p + 1] = shift(g, tone[1], s); d[p + 2] = shift(b, tone[2], s); }
        }
      }
      if (dye && (HM[o] === 1 || HM[o] === 2)) { // closer in brightness to the hair than to the skin: dye it, keeping the strands' own light and dark
        const p = (y * W + x) * 4, v = lum(src[p], src[p + 1], src[p + 2]);
        if (Math.abs(v - hv) < Math.abs(v - sv)) { const sh = Math.max(.45, Math.min(1.5, .55 + v / hv * .45)); d[p] = Math.min(255, cH[0] * sh); d[p + 1] = Math.min(255, cH[1] * sh); d[p + 2] = Math.min(255, cH[2] * sh); }
        continue;
      }
      if (!reg) continue;
      const p = (y * W + x) * 4, r = src[p], g = src[p + 1], b = src[p + 2], k = keyed(model.key, r, g, b); if (k <= 0) continue;
      let c = cG, matte = false;
      if (reg === 1 && rope) { // hemp cord wound round the fist: light turns with dark grooves between them
        const ph = (B.aq[o] / 400 * 46) % 1, gv = ph < .22 ? .58 : ph > .82 ? .82 : 1; c = [212 * gv, 192 * gv, 150 * gv]; matte = true;
      }
      if (reg === 2) {
        c = cS;
        const h = (B.hq[o] - lo) / span, s = B.sq[o] / 300; // 0 at the hem, 1 at the waist; metres to the fighter's left
        if (pat === 'stripe' && Math.abs(s) > .125) c = cT;
        else if (pat === 'hem' && h < .2) c = cT;
        else if (pat === 'zigzag' && h < .2 + .16 * Math.abs(((s * 9) % 1 + 1) % 1 - .5) * 2) c = cT;
        else if (pat === 'split' && s < 0) c = cT;
        else if (pat === 'check' && (Math.floor(s * 12 + 100) + Math.floor(h * 6)) % 2 === 0) c = cT;
        else if (pat === 'tiger') { const t = s * 9 + h * 2.2 + .35 * Math.sin(h * 11 + s * 4); if (((t % 1) + 1) % 1 < .26) c = cT; } // wavy slanting stripes
        else if (pat === 'flame') { const f = (.12 + .5 * Math.pow(Math.abs(Math.sin(s * 26 + h * 5)), 1.4)) * (1 - h * .3); if (h < f * .55) c = cGold; else if (h < f) c = cT; } // tongues of the trim colour up from the hem, gold at the heart
        else if (pat === 'spark') { const q = Math.sin(o * 12.9898) * 43758.5453; if (h < .12 || q - Math.floor(q) < .07) c = cGold; } // a gold hem and gold flecks all over
      }
      // keep the cloth's shading and sheen: brightness from the original, highlights stay light
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = (mx - mn) / mx, v = mx / 255;
      const shade = matte ? .55 + v * .6 : Math.min(1.25, .25 + v * 1.25), gloss = matte ? 0 : Math.max(0, 1 - sat * 1.6) * v;
      const nr = c[0] * shade * (1 - gloss) + 255 * gloss, ng = c[1] * shade * (1 - gloss) + 255 * gloss, nb = c[2] * shade * (1 - gloss) + 255 * gloss;
      d[p] = r + (nr - r) * k; d[p + 1] = g + (ng - g) * k; d[p + 2] = b + (nb - b) * k;
    }
  }
  if (beard) { // dyed hair: the beard goes with it, a shade darker
    if (!model.face) { model.face = faceTexels(model.mesh); model.mouth = mouthAt(model.face, model); }
    beardPaint(d, model, beard, dye ? cH.map(c => c * .78) : model.hairRGB);
  }
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; cv.getContext('2d').putImageData(out, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (cache.size >= 6) { const first = cache.keys().next().value; cache.get(first).dispose(); cache.delete(first); }
  cache.set(key, t); return t;
}

// Prajioud for one arm, built round the y axis with its knot and tails on +z. r: how thick the arm is where it is tied.
export function armband(colorKey, r) {
  const g = new THREE.Group(); if (!COLORS[colorKey]) return g;
  const mat = new THREE.MeshStandardMaterial({color: COLORS[colorKey][1], roughness: .85, side: THREE.DoubleSide}), R = r * 1.04;
  const put = (geo, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  put(new THREE.CylinderGeometry(R, R, .036, 20, 1, true), 0, 0, 0);
  put(new THREE.SphereGeometry(.015, 8, 6), 0, 0, R).scale.set(1.25, .9, .8);
  for (const s of [-1, 1]) put(new THREE.BoxGeometry(.012, .075, .004), s * .011, -.04, R + .005).rotation.z = s * .28; // the two ends hanging from the knot
  return g;
}

// Mongkol or cloth headband, sized to the head. Sits in a group the fighter moves with the head each frame.
export function headgear(kind, colorKey, radius) {
  const g = new THREE.Group(); if (!kind || kind === 'none') return g;
  const c = COLORS[colorKey] ? COLORS[colorKey][1] : COLORS.white[1];
  const mat = new THREE.MeshStandardMaterial({color: c, roughness: kind === 'mongkol' ? .55 : .85});
  const inner = new THREE.Group(); inner.rotation.z = .1; g.add(inner); // forehead in front, lower at the back of the skull
  const add = (geo, x, y, z, rx, rz) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx || 0, 0, rz || 0); m.castShadow = true; inner.add(m); return m; };
  if (kind === 'mongkol') {
    add(new THREE.TorusGeometry(radius * 1.04, .011, 8, 28), 0, .012, 0, Math.PI / 2);
    add(new THREE.CapsuleGeometry(.01, .11, 3, 6), -radius * 1.2, .0, 0, 0, -.7);
  }
  return g;
}
