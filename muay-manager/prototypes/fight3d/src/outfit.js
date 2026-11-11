// Outfits for generated fighters: one base model, many looks.
// The model's shorts and gloves come in a plain key colour. Here that colour is replaced per fighter,
// shorts patterns are painted from where each texel sits on the body, and headgear is added as separate meshes.
const THREE = globalThis.THREE;

export const COLORS = {
  red: ['แดง', 0xc9281f], blue: ['น้ำเงิน', 0x1f55c4], black: ['ดำ', 0x1c1c22], white: ['ขาว', 0xf0f0f2], gold: ['ทอง', 0xe0a52a],
  green: ['เขียว', 0x1f8a4c], purple: ['ม่วง', 0x6b2fb5], pink: ['ชมพู', 0xe0559a], orange: ['ส้ม', 0xe8742a]
};
export const PATTERNS = {plain: 'สีพื้น', stripe: 'แถบข้าง', hem: 'ขอบล่าง', zigzag: 'ลายฟันปลา', split: 'สองสี'};
export const HEADGEAR = {none: 'ไม่มี', mongkol: 'มงคล'}; // worn for the wai kru, taken off before the bell
export const HAIR = {
  natural: ['สีเดิม', 0], brown: ['น้ำตาล', 0x8a5a2c], blond: ['ทอง', 0xe0bf5a], red: ['แดง', 0xc2301f], silver: ['เงิน', 0xd6d9de],
  blue: ['น้ำเงิน', 0x3f6fe0], green: ['เขียว', 0x35a35a], pink: ['ชมพู', 0xe86aa6], purple: ['ม่วง', 0x8a4fd0]
};

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

// Which texels are hair: on the head, above a hairline that sits high on the forehead and drops behind the ears to the nape.
// Positions come from the skinned bind pose, so this works whatever space the raw geometry is in.
function hairMap(mesh) {
  const g = mesh.geometry, uv = g.attributes.uv, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, idx = g.index, n = g.attributes.position.count;
  const bones = mesh.skeleton.bones, names = bones.map(b => b.name), isHead = names.map(x => x === 'Head' || x === 'head_end' || x === 'headfront');
  const at = name => { const b = bones[names.indexOf(name)]; return b ? new THREE.Vector3().setFromMatrixPosition(b.matrixWorld) : null; };
  const H = at('Head'), T = at('head_end'), out = new Uint8Array(MAP * MAP); if (!H) return out;
  const span = T ? Math.max(.12, T.y - H.y) : .23, v = new THREE.Vector3(), hh = new Float32Array(n).fill(-9), zz = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let w = 0; for (let k = 0; k < 4; k++) if (isHead[si.getComponent(i, k)]) w += sw.getComponent(i, k);
    if (w < .5) continue;
    mesh.getVertexPosition(i, v); v.applyMatrix4(mesh.matrixWorld); hh[i] = (v.y - H.y) / span; zz[i] = v.z - H.z; // model space: +z is the face
  }
  const line = z => z >= .07 ? .86 : z >= .02 ? .72 + (z - .02) / .05 * .14 : z >= -.03 ? .5 + (z + .03) / .05 * .22 : z >= -.07 ? .28 + (z + .07) / .04 * .22 : .28;
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

const cache = new Map();
// A texture for this model in this outfit. look: {shorts, trim, gloves, pattern}
export function outfitTexture(model, look) {
  const key = model.id + '|' + look.shorts + look.trim + look.gloves + look.pattern + (look.hair || '');
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
    const HM = model.hair = hairMap(model.mesh), crown = [], face = [];
    for (let y = 0; y < MAP; y += 2) for (let x = 0; x < MAP; x += 2) {
      const z = HM[y * MAP + x]; if (z !== 2 && z !== 3) continue;
      const p = (Math.floor(y * sy) * W + Math.floor(x * sx)) * 4; (z === 2 ? crown : face).push(lum(d[p], d[p + 1], d[p + 2]));
    }
    const med = a => { a.sort((p, q) => p - q); return a.length ? a[a.length >> 1] : 0; };
    model.hairV = med(crown); model.skinV = med(face); model.hasHair = crown.length > 20 && Math.abs(model.hairV - model.skinV) > .07;
  }
  const src = model.pixels.data, out = new ImageData(new Uint8ClampedArray(src), W, H), d = out.data, B = model.body;
  const col = k => { const c = COLORS[k] ? COLORS[k][1] : COLORS.red[1]; return [(c >> 16) & 255, (c >> 8) & 255, c & 255]; };
  const cS = col(look.shorts), cT = col(look.trim), cG = col(look.gloves), [lo, hi] = model.shortsY, span = Math.max(1, hi - lo);
  const fx = MAP / W, fy = MAP / H, pat = look.pattern, rope = look.gloves === 'rope';
  const dye = model.hasHair && HAIR[look.hair] && HAIR[look.hair][1] ? HAIR[look.hair][1] : 0, cH = [(dye >> 16) & 255, (dye >> 8) & 255, dye & 255], HM = model.hair, hv = Math.max(.04, model.hairV), sv = model.skinV;
  for (let y = 0; y < H; y++) {
    const my = Math.floor(y * fy) * MAP;
    for (let x = 0; x < W; x++) {
      const o = my + Math.floor(x * fx), reg = B.region[o];
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
      }
      // keep the cloth's shading and sheen: brightness from the original, highlights stay light
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = (mx - mn) / mx, v = mx / 255;
      const shade = matte ? .55 + v * .6 : Math.min(1.25, .25 + v * 1.25), gloss = matte ? 0 : Math.max(0, 1 - sat * 1.6) * v;
      const nr = c[0] * shade * (1 - gloss) + 255 * gloss, ng = c[1] * shade * (1 - gloss) + 255 * gloss, nb = c[2] * shade * (1 - gloss) + 255 * gloss;
      d[p] = r + (nr - r) * k; d[p + 1] = g + (ng - g) * k; d[p + 2] = b + (nb - b) * k;
    }
  }
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; cv.getContext('2d').putImageData(out, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (cache.size >= 6) { const first = cache.keys().next().value; cache.get(first).dispose(); cache.delete(first); }
  cache.set(key, t); return t;
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
