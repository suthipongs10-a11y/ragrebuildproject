// Venues: the ring and everything around it. All generated in code; no asset files.
// One venue is visible at a time. Each is built the first time it is asked for and kept.
const THREE = globalThis.THREE;

const R = 3.05, S = R * 2 + .9;   // ring half size at the ropes, platform width
const rng = (() => { let a = 12345; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; })();
export const VENUES = {stadium: 'เวทีมาตรฐาน', champ: 'เวทีใหญ่ชิงแชมป์', province: 'เวทีจังหวัด', temple: 'เวทีมวยวัด', chuek: 'ลานมวยคาดเชือก', camp: 'ค่ายมวย'};

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
const css = c => '#' + c.toString(16).padStart(6, '0');
const std = o => new THREE.MeshStandardMaterial(Object.assign({roughness: .9}, o));
const basic = o => new THREE.MeshBasicMaterial(o);
function put(g, geo, mat, x, y, z, rx, ry, rz) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, rz || 0); g.add(m); return m; }
function speckle(g, w, h, n, a, b, alpha, size) { for (let i = 0; i < n; i++) { g.fillStyle = 'rgba(' + (rng() < .5 ? a : b) + ',' + (rng() * alpha) + ')'; g.fillRect(rng() * w, rng() * h, 2 + rng() * size, 2 + rng() * size); } }
let glowTex = null;
const glow = () => glowTex || (glowTex = canvasTex(64, 64, (g, w) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.3, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); }));

// ---------- shared parts ----------
function matTex(c) {
  return canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = c.base; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 2600, '255,255,255', c.dark || '40,60,80', c.noise || .05, 5);
    if (c.ring) { g.strokeStyle = c.ring; g.lineWidth = 10; g.beginPath(); g.arc(w / 2, h / 2, 210, 0, 7); g.stroke(); }
    if (c.fill) { g.fillStyle = c.fill; g.beginPath(); g.arc(w / 2, h / 2, 205, 0, 7); g.fill(); }
    g.fillStyle = c.ink; g.font = 'italic 800 ' + (c.size || 78) + 'px Kanit, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(c.t1, w / 2, h / 2 - 42); g.fillText(c.t2, w / 2, h / 2 + 46);
    if (c.border) { g.strokeStyle = c.border; g.lineWidth = 14; g.strokeRect(70, 70, w - 140, h - 140); }
  });
}
function apronTex(c) {
  return canvasTex(1024, 128, (g, w, h) => {
    g.fillStyle = c.bg; g.fillRect(0, 0, w, h);
    if (c.planks) { for (let x = 0; x < w; x += 46) { g.fillStyle = 'rgba(0,0,0,' + (.08 + rng() * .22) + ')'; g.fillRect(x, 0, 3, h); g.fillStyle = 'rgba(255,220,170,' + rng() * .06 + ')'; g.fillRect(x + 3, 0, 43, h); } }
    if (c.bunting) { const cols = c.bunting; for (let x = 0, i = 0; x < w; x += 64, i++) { g.fillStyle = cols[i % cols.length]; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 64, 0); g.lineTo(x + 32, 44); g.fill(); } }
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, 0, w, 10);
    g.fillStyle = c.fg; g.font = 'italic 800 ' + (c.size || 46) + 'px Kanit, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 0; i < 3; i++) g.fillText(c.text, w / 6 + i * w / 3, h / 2 + (c.bunting ? 22 : 4));
  });
}
// Corner pad cover. A plain pale pad behind a fighter reads as part of his body under warm light,
// so every pad carries dark straps and an emblem that make it plainly ring furniture.
function padTex(color, neutral) {
  return canvasTex(64, 256, (g, w, h) => {
    g.fillStyle = css(color); g.fillRect(0, 0, w, h);
    g.fillStyle = '#16171c'; g.fillRect(0, 18, w, 20); g.fillRect(0, h - 38, w, 20);                  // straps
    g.fillStyle = neutral ? '#1f55c4' : 'rgba(255,255,255,.92)'; g.beginPath(); g.moveTo(w / 2, 78); g.lineTo(w - 9, 128); g.lineTo(w / 2, 178); g.lineTo(9, 128); g.fill();
    g.fillStyle = neutral ? '#c9281f' : css(color); g.beginPath(); g.moveTo(w / 2, 100); g.lineTo(w - 22, 128); g.lineTo(w / 2, 156); g.lineTo(22, 128); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2; g.strokeRect(1, 1, w - 2, h - 2);
  });
}
// floor, apron, posts and ropes. c: {mat, apron, ground, posts: {col, r, h, metal}, pads, ropeY, ropeCols, ropeR}
function ringParts(V, c) {
  const g = V.group;
  const floor = put(g, new THREE.PlaneGeometry(S, S), std({map: c.mat, roughness: .92}), 0, c.ground < 0 ? 0 : .004, 0, -Math.PI / 2); floor.receiveShadow = true;
  if (c.apron) for (let i = 0; i < 4; i++) put(g, new THREE.PlaneGeometry(S, -c.ground), std({map: c.apron, roughness: .8}), Math.sin(i * Math.PI / 2) * S / 2, c.ground / 2, Math.cos(i * Math.PI / 2) * S / 2, 0, i * Math.PI / 2);
  const corners = [[-R, R], [R, R], [R, -R], [-R, -R]], P = c.posts;
  corners.forEach((p, i) => {
    const post = put(g, new THREE.CylinderGeometry(P.r, P.r * (P.taper || 1), P.h, 12), std({color: P.col, roughness: P.metal ? .5 : .95, metalness: P.metal ? .4 : 0}), p[0] * 1.03, P.h / 2, p[1] * 1.03); post.castShadow = true;
    let pad = post;
    if (c.pads) { pad = put(g, new THREE.BoxGeometry(.24, 1.05, .24), std({map: padTex(c.pads[i], i % 2 === 1), roughness: .6}), p[0] * .985, .85, p[1] * .985, 0, Math.PI / 4); pad.castShadow = true; }
    V.corners.push({x: p[0], z: p[1], post, pad});
  });
  c.ropeY.forEach((y, k) => {
    for (let i = 0; i < 4; i++) {
      const rope = put(g, new THREE.CylinderGeometry(c.ropeR, c.ropeR, R * 2, 8), std({color: c.ropeCols[k % c.ropeCols.length], roughness: c.ropeR > .025 ? 1 : .6, transparent: true}), Math.sin(i * Math.PI / 2) * R, y, Math.cos(i * Math.PI / 2) * R);
      if (i % 2 === 0) rope.rotation.z = Math.PI / 2; else rope.rotation.x = Math.PI / 2; // sides 0,2 run along x
      V.ropeSides[i].push(rope);
    }
  });
}
// a standing person: legs, hips, shoulders; flattened front to back, legs darker than the shirt
function figureGeo() {
  const prof = [[.02, 0], [.13, .02], [.13, .5], [.16, .86], [.2, 1.2], [.21, 1.34], [.17, 1.43], [.06, 1.47], [.05, 1.5]].map(p => new THREE.Vector2(p[0], p[1]));
  const geo = new THREE.LatheGeometry(prof, 8); geo.scale(1, 1, .58);
  const p = geo.attributes.position, c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const k = p.getY(i) < .84 ? .42 : 1; c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = k; }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); return geo;
}
function crowd(V, seats, shirts, skins, bare) {
  const afoot = seats.some(s => s.stand != null);
  const bodies = new THREE.InstancedMesh(afoot ? figureGeo() : new THREE.CapsuleGeometry(.2, .32, 3, 6), std({roughness: 1, vertexColors: afoot}), seats.length), heads = new THREE.InstancedMesh(new THREE.SphereGeometry(.13, 8, 6), std({roughness: 1}), seats.length);
  const col = new THREE.Color();
  seats.forEach((s, i) => { const skin = skins[i % skins.length]; bodies.setColorAt(i, col.setHex(bare && s.hue < bare ? skin : shirts[Math.floor(s.hue * shirts.length) % shirts.length])); heads.setColorAt(i, col.setHex(skin)); });
  // two arms each, shown only while that person is cheering
  const armGeo = new THREE.CylinderGeometry(.035, .045, .46, 5); armGeo.translate(0, .23, 0);
  const arms = new THREE.InstancedMesh(armGeo, std({roughness: 1}), seats.length * 2), zero = new THREE.Matrix4().makeScale(0, 0, 0);
  seats.forEach((s, i) => { s.th = .4 + rng() * .85; s.e = 0; col.setHex(skins[i % skins.length]); arms.setColorAt(i * 2, col); arms.setColorAt(i * 2 + 1, col); arms.setMatrixAt(i * 2, zero); arms.setMatrixAt(i * 2 + 1, zero); });
  bodies.frustumCulled = heads.frustumCulled = arms.frustumCulled = false;
  V.group.add(bodies, heads, arms); V.seats = seats; V.bodies = bodies; V.heads = heads; V.arms = arms; V.afoot = afoot; V.placed = false;
}
// raked seating on all four sides
function tierSeats(rows) {
  const seats = [];
  for (let side = 0; side < 4; side++) for (let row = 0; row < rows; row++) {
    const dist = 7.6 + row * .95, y = -.5 + row * .42, n = Math.floor((dist * 2) / .62);
    for (let i = 0; i < n; i++) {
      const u = -dist + i * .62 + (row % 2) * .3 + (rng() - .5) * .12;
      const p = side === 0 ? [u, y, dist] : side === 1 ? [dist, y, u] : side === 2 ? [u, y, -dist] : [-dist, y, u];
      seats.push({x: p[0], y: p[1], z: p[2], ph: rng() * 6.28, s: .85 + rng() * .3, hue: rng(), ax: side % 2 ? 0 : 1});
    }
  }
  return seats;
}
// people on flat ground behind and beside the ring; the camera side stays clear
function groundSeats(o) {
  const seats = [];
  for (let side = 1; side < 4; side++) for (let row = 0; row < o.rows; row++) {
    const dist = o.d0 + row * o.step, n = Math.floor(dist * 2 / .56);
    for (let i = 0; i < n; i++) {
      const u = -dist + i * .56 + (row % 2) * .28 + (rng() - .5) * .2;
      if (side !== 2 && u > o.zMax) continue;
      const d = dist + (rng() - .5) * .3, p = side === 1 ? [d, u] : side === 2 ? [u, -d] : [-d, u];
      if (o.skip && o.skip(p[0], p[1])) continue;
      seats.push({x: p[0], y: o.y, z: p[1], ph: rng() * 6.28, s: (rng() < .12 ? .7 : .94) + rng() * .14, hue: rng(), stand: row >= o.sit, ry: (side === 2 ? 0 : Math.PI / 2) + (rng() - .5) * .5, ax: side === 2 ? 1 : 0});
    }
  }
  return seats;
}
// sky dome: top colour down to the horizon; stars for a night sky
function sky(V, top, mid, horizon, stars) {
  const tex = canvasTex(stars ? 1024 : 16, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h / 2); gr.addColorStop(0, css(top)); gr.addColorStop(.62, css(mid)); gr.addColorStop(1, css(horizon));
    g.fillStyle = gr; g.fillRect(0, 0, w, h / 2); g.fillStyle = css(horizon); g.fillRect(0, h / 2, w, h / 2);
    for (let i = 0; i < (stars || 0); i++) { g.fillStyle = 'rgba(255,255,255,' + (.25 + rng() * .7) + ')'; g.fillRect(rng() * w, rng() * h * .42, 1, 1); }
  });
  V.dome = put(V.group, new THREE.SphereGeometry(70, 24, 12), basic({map: tex, side: THREE.BackSide, fog: false, depthWrite: false}), 0, 0, 0);
}
function groundTex(base, a, b, n) {
  const t = canvasTex(512, 512, (g, w, h) => { g.fillStyle = base; g.fillRect(0, 0, w, h); speckle(g, w, h, n || 2400, a, b, .16, 9); });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(14, 14); return t;
}
// points along a sagging line
function sag(a, b, n, drop) { const out = []; for (let i = 0; i <= n; i++) { const t = i / n; out.push(new THREE.Vector3(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - drop * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t)); } return out; }
function bulbs(V, lines, cols, size) {
  const pts = [].concat(...lines), n = pts.length, col = new THREE.Color();
  const m = new THREE.InstancedMesh(new THREE.SphereGeometry(size || .05, 6, 4), basic({fog: false}), n), d = new THREE.Object3D();
  const pos = new Float32Array(n * 3), cl = new Float32Array(n * 3);
  pts.forEach((p, i) => { d.position.copy(p); d.updateMatrix(); m.setMatrixAt(i, d.matrix); col.setHex(cols[i % cols.length]); m.setColorAt(i, col); p.toArray(pos, i * 3); col.toArray(cl, i * 3); });
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(cl, 3));
  const halo = new THREE.Points(geo, new THREE.PointsMaterial({map: glow(), size: (size || .05) * 9, vertexColors: true, transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false}));
  m.frustumCulled = halo.frustumCulled = false; V.group.add(m, halo);
  lines.forEach(l => V.group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(l), new THREE.LineBasicMaterial({color: 0x15151a}))));
  return halo;
}
function palm(g, x, y, z, h, mat, trunk) {
  const t = new THREE.Group(); t.position.set(x, y, z); t.rotation.z = (rng() - .5) * .16; g.add(t);
  put(t, new THREE.CylinderGeometry(.11, .17, h, 7), trunk, 0, h / 2, 0);
  const leaf = new THREE.SphereGeometry(1, 6, 4);
  for (let i = 0; i < 9; i++) { const p = new THREE.Group(); p.position.y = h; p.rotation.set(0, i * .7 + rng(), -.25 - rng() * .5); const m = put(p, leaf, mat, 1.25, 0, 0); m.scale.set(1.3, .05, .3); t.add(p); }
}
// A banana plant: layered trunk and wide drooping leaves. Used as scenery and as a kicking target.
export function bananaTree(h) {
  const g = new THREE.Group(), leaves = [];
  const bark = canvasTex(128, 256, (c, w, hh) => { c.fillStyle = '#8fa24a'; c.fillRect(0, 0, w, hh); for (let i = 0; i < 26; i++) { c.fillStyle = 'rgba(' + (rng() < .5 ? '210,205,120' : '70,90,30') + ',' + (.15 + rng() * .3) + ')'; c.fillRect(rng() * w, 0, 3 + rng() * 9, hh); } for (let i = 0; i < 5; i++) { c.fillStyle = 'rgba(90,70,30,.35)'; c.fillRect(0, rng() * hh, w, 3); } });
  const trunk = put(g, new THREE.CylinderGeometry(.095, .13, h, 12), std({map: bark, roughness: .7}), 0, h / 2, 0); trunk.castShadow = true;
  const leafTex = canvasTex(64, 256, (c, w, hh) => { c.fillStyle = '#3f8f3a'; c.fillRect(0, 0, w, hh); for (let y = 0; y < hh; y += 7) { c.strokeStyle = 'rgba(20,70,25,.45)'; c.beginPath(); c.moveTo(w / 2, y + 8); c.lineTo(0, y); c.moveTo(w / 2, y + 8); c.lineTo(w, y); c.stroke(); } c.fillStyle = '#b9d27a'; c.fillRect(w / 2 - 2, 0, 4, hh); });
  const leafMat = std({map: leafTex, side: THREE.DoubleSide, roughness: .6});
  for (let i = 0; i < 7; i++) {
    const len = 1.1 + rng() * .5, geo = new THREE.PlaneGeometry(.42, len, 2, 6), p = geo.attributes.position;
    for (let k = 0; k < p.count; k++) { const t = (p.getY(k) + len / 2) / len; p.setXYZ(k, p.getX(k) * (1 - .55 * Math.abs(t - .45)), t * len, -(t * t) * .55 - Math.abs(p.getX(k)) * .25); }
    geo.computeVertexNormals();
    const piv = new THREE.Group(); piv.position.y = h - .04; piv.rotation.set(0, i * .9 + rng() * .4, 0);
    const m = put(piv, geo, leafMat, 0, 0, 0, -.35 - rng() * .55); m.castShadow = true; g.add(piv); leaves.push(m);
  }
  g.userData = {trunk, leaves};
  return g;
}
// gable roof: a triangular prism, ridge along x
function gable(g, w, hgt, depth, mat, x, y, z) {
  const sh = new THREE.Shape(); sh.moveTo(-depth / 2, 0); sh.lineTo(depth / 2, 0); sh.lineTo(0, hgt); sh.closePath();
  const m = put(g, new THREE.ExtrudeGeometry(sh, {depth: w, bevelEnabled: false}), mat, x - w / 2, y, z, 0, Math.PI / 2); return m;
}

// ---------- indoor stadiums ----------
function indoor(c) {
  const V = newVenue(); const g = V.group;
  ringParts(V, {mat: matTex(c.mat), apron: apronTex(c.apron), ground: -.95, posts: {col: 0x30323c, r: .07, h: 1.5, metal: 1}, pads: [0xd9342b, 0xcdd6e4, 0x2f6fe0, 0xcdd6e4], ropeY: [.42, .72, 1.02, 1.32], ropeCols: c.ropes, ropeR: .022});
  put(g, new THREE.PlaneGeometry(80, 80), std({color: c.floor || 0x0b0c12, roughness: 1}), 0, -.95, 0, -Math.PI / 2);
  crowd(V, tierSeats(c.rows), c.shirts || [0x1a1f2c, 0x241c28, 0x162226, 0x28211c, 0x1f2127, 0x2e1b1b, 0x1a2434], [0x4a3425, 0x533b2a, 0x5e4430]);
  // light rig: truss with lamps, visible beams
  const truss = new THREE.Group(); truss.position.y = 6.2; g.add(truss);
  const lampMat = basic({color: 0xfff2d0});
  (c.lamps || [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2], [0, 0]]).forEach((p, i) => {
    put(truss, new THREE.BoxGeometry(.5, .16, .5), lampMat, p[0], 0, p[1]);
    const beam = put(truss, new THREE.ConeGeometry(2.3, 6.3, 20, 1, true), basic({color: c.beamCols[i % c.beamCols.length], transparent: true, opacity: .045, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide}), p[0] * .6, -3.1, p[1] * .6);
    V.beams.push(beam);
  });
  const bar = std({color: 0x1a1c24, roughness: .6, metalness: .5});
  for (const z of [-2.2, 2.2]) put(truss, new THREE.BoxGeometry(6, .12, .12), bar, 0, .14, z);
  for (const x of [-2.2, 2.2]) put(truss, new THREE.BoxGeometry(.12, .12, 6), bar, x, .14, 0);
  if (c.extra) c.extra(V, truss);
  V.light = c.light; V.flashRate = 1;
  return V;
}
const stadium = () => indoor({rows: 7, ropes: [0xe9e9ee, 0xd9342b, 0xe9e9ee, 0x2f6fe0], beamCols: [0xffe2b0, 0xbcd4ff, 0xffe2b0, 0xbcd4ff, 0xffffff],
  mat: {base: '#8fa1b1', ring: 'rgba(20,50,110,.55)', fill: 'rgba(47,118,234,.16)', ink: 'rgba(20,45,100,.8)', t1: 'MUAY', t2: 'ARENA', border: 'rgba(150,30,25,.5)'},
  apron: {bg: '#7c1f1a', fg: 'rgba(255,224,150,.9)', text: 'MUAY ARENA'},
  light: {bg: 0x12141c, fog: .018, hemi: [0xcfdcff, 0x2a2018, 1.05], key: [0xfff1dc, 1.6, 1.5, 7, 4.5], rim: [0xff4a3a, 0x3a7bff, 10, [-5, 2.6, -4], [5, 2.6, -4]], crowd: [0xffe7c2, 60, 0, 7, 0, 30], beam: .012}});
// the big hall for title fights: more tiers, gold and black, screens and moving beams
const champ = () => indoor({rows: 12, ropes: [0xe2b33c, 0x18181c, 0xe2b33c, 0x18181c], beamCols: [0xffe08a, 0xffffff, 0xffe08a, 0xffffff, 0xfff3c4],
  lamps: [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2], [0, 0], [-4.4, -3.4], [4.4, -3.4], [0, -4.4]],
  mat: {base: '#17181d', dark: '0,0,0', ring: 'rgba(226,179,60,.9)', fill: 'rgba(226,179,60,.1)', ink: 'rgba(238,196,84,.95)', t1: 'ศึกชิงแชมป์', t2: 'มวยไทย', size: 70, border: 'rgba(226,179,60,.75)'},
  apron: {bg: '#101013', fg: 'rgba(238,196,84,.95)', text: 'ศึกชิงแชมป์', size: 50},
  shirts: [0x1a1f2c, 0x2a2030, 0x162226, 0x30261c, 0x1f2127, 0x3a1e1e, 0x1a2434, 0x3a3320],
  extra(V) {
    const screen = canvasTex(1024, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#2a1a05'); gr.addColorStop(.5, '#7a5512'); gr.addColorStop(1, '#2a1a05'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = '#ffe9a8'; g.font = 'italic 800 120px Kanit, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ศึกชิงแชมป์มวยไทย', w / 2, h / 2 + 6); g.strokeStyle = '#ffd35a'; g.lineWidth = 8; g.strokeRect(8, 8, w - 16, h - 16); });
    const sm = basic({map: screen, fog: false});
    put(V.group, new THREE.PlaneGeometry(15, 3.75), sm, 0, 9.4, -19.5);
    put(V.group, new THREE.PlaneGeometry(11, 2.75), sm, -19.5, 8.6, -4, 0, Math.PI / 2); put(V.group, new THREE.PlaneGeometry(11, 2.75), sm, 19.5, 8.6, -4, 0, -Math.PI / 2);
    // searchlights sweeping over the crowd
    V.sweeps = [];
    for (let i = 0; i < 6; i++) { const piv = new THREE.Group(); piv.position.set((i - 2.5) * 5.4, 11, -15); V.group.add(piv); put(piv, new THREE.ConeGeometry(1.1, 16, 14, 1, true), basic({color: i % 2 ? 0xffffff : 0xffd35a, transparent: true, opacity: .05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false}), 0, -8, 0); V.sweeps.push(piv); }
    V.anim = time => { V.sweeps.forEach((p, i) => { p.rotation.z = Math.sin(time * .5 + i * 1.3) * .5; p.rotation.x = .5 + Math.sin(time * .37 + i) * .25; }); };
  },
  light: {bg: 0x0a0a0f, fog: .014, hemi: [0xfff0d0, 0x2a2018, .85], key: [0xfff4dc, 1.8, 1.5, 7, 4.5], rim: [0xffc23a, 0xffe9b0, 26, [-5, 2.6, -4], [5, 2.6, -4]], crowd: [0xffdf9a, 95, 0, 8, 0, 38], beam: .02}});
// a provincial boxing hall: a few rows of bleachers, tin roof, strip lights, hand-painted boards
const province = () => indoor({rows: 4, ropes: [0xe9e9ee, 0xd9342b, 0xe9e9ee, 0x2f6fe0], beamCols: [0xfff0c8], lamps: [[-1.6, 0], [1.6, 0]], floor: 0x23201c,
  mat: {base: '#3f7f96', dark: '10,40,50', ring: 'rgba(255,255,255,.7)', ink: 'rgba(255,255,255,.85)', t1: 'ศึกมวยไทย', t2: 'เวทีจังหวัด', size: 70, border: 'rgba(200,40,30,.6)'},
  apron: {bg: '#e6dcc2', fg: 'rgba(170,30,25,.95)', text: 'ศึกมวยไทย', size: 50},
  shirts: [0x2a3040, 0x3a2a2a, 0x24382e, 0x40382a, 0x2c2c34, 0x4a2626, 0x26364a, 0x4a4030],
  extra(V) {
    const g = V.group, D = 12.6;
    const board = canvasTex(1024, 256, (c, w, h) => { c.fillStyle = '#17383c'; c.fillRect(0, 0, w, h); const cols = ['#c9a23a', '#b23a2e', '#e6dcc2', '#2d6f8f'], words = ['มวยไทย', 'ศึกวันศุกร์', 'ค่ายมวย', 'ชกทุกนัด']; for (let i = 0; i < 4; i++) { c.fillStyle = cols[i]; c.fillRect(20 + i * 252, 40, 228, 150); c.fillStyle = i === 2 ? '#7c1f1a' : '#fff'; c.font = '700 44px Kanit, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(words[i], 134 + i * 252, 116); } });
    board.wrapS = THREE.RepeatWrapping; board.repeat.set(3, 1);
    const wall = std({map: board, roughness: 1});
    for (let i = 0; i < 4; i++) put(g, new THREE.PlaneGeometry(D * 2, 6.4), wall, -Math.sin(i * Math.PI / 2) * D, 2.2, -Math.cos(i * Math.PI / 2) * D, 0, i * Math.PI / 2);
    const tin = canvasTex(256, 64, (c, w, h) => { for (let x = 0; x < w; x += 8) { c.fillStyle = x % 16 ? '#3a3d42' : '#26282c'; c.fillRect(x, 0, 8, h); } }); tin.wrapS = tin.wrapT = THREE.RepeatWrapping; tin.repeat.set(10, 6);
    put(g, new THREE.PlaneGeometry(D * 2, D * 2), std({map: tin, roughness: .7, side: THREE.DoubleSide}), 0, 7.4, 0, Math.PI / 2);
    const tube = basic({color: 0xf2fbff, fog: false}), steel = std({color: 0x2a2c30, roughness: .6, metalness: .4});
    for (const z of [-7, -3.5, 3.5, 7]) { put(g, new THREE.BoxGeometry(D * 2, .14, .14), steel, 0, 6.9, z); for (const x of [-7, 0, 7]) put(g, new THREE.BoxGeometry(1.6, .06, .1), tube, x, 6.75, z); }
  },
  light: {bg: 0x14161a, fog: .016, hemi: [0xe6f2ff, 0x3a3024, 1.25], key: [0xfff6e6, 1.5, 1.5, 7, 4.5], rim: [0xfff0d0, 0xfff0d0, 5, [-5, 2.6, -4], [5, 2.6, -4]], crowd: [0xf2fbff, 70, 0, 6.5, 0, 30], beam: .006}});

// ---------- temple fair ----------
function temple() {
  const V = newVenue(), g = V.group, GY = -.95;
  sky(V, 0x04060f, 0x0b1230, 0x1a2244, 420);
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({map: glow(), color: 0xfff3cf, fog: false, depthWrite: false})); moon.position.set(-22, 30, -50); moon.scale.setScalar(9); g.add(moon);
  const ground = put(g, new THREE.PlaneGeometry(90, 90), std({map: groundTex('#4a3826', '120,95,60', '30,22,14')}), 0, GY, 0, -Math.PI / 2); ground.receiveShadow = true;
  ringParts(V, {mat: matTex({base: '#93aab8', noise: .09, ring: 'rgba(150,30,25,.55)', ink: 'rgba(150,30,25,.8)', t1: 'มวยไทย', t2: 'งานวัด', size: 84, border: 'rgba(30,60,120,.5)'}),
    apron: apronTex({bg: '#5d3f27', planks: 1, bunting: ['#c9281f', '#f0f0f2', '#1f55c4', '#e0a52a'], fg: 'rgba(255,236,190,.95)', text: 'งานประจำปี', size: 44}), ground: GY,
    posts: {col: 0x6a5a48, r: .075, h: 1.5}, pads: [0xd9342b, 0xcdd6e4, 0x2f6fe0, 0xcdd6e4], ropeY: [.42, .72, 1.02, 1.32], ropeCols: [0xd8d2c2, 0xc9463c, 0xd8d2c2, 0x4a78c8], ropeR: .024});
  // bamboo poles with strings of coloured bulbs and paper flags
  const bamboo = std({color: 0x8a7a45, roughness: .8}), PX = 5.4, top = 4.3, poles = [[-PX, PX], [PX, PX], [PX, -PX], [-PX, -PX]];
  poles.forEach(p => put(g, new THREE.CylinderGeometry(.05, .07, top - GY, 7), bamboo, p[0], (top + GY) / 2, p[1]));
  const lines = [];
  for (let i = 0; i < 4; i++) { const a = poles[i], b = poles[(i + 1) % 4]; lines.push(sag([a[0], top, a[1]], [b[0], top, b[1]], 30, .7)); }
  lines.push(sag([-PX, top, PX], [PX, top, -PX], 40, .45), sag([PX, top, PX], [-PX, top, -PX], 40, .45));
  // more strings across the fairground behind the crowd, so close shots still have lights in them
  lines.push(sag([-14, 2.5, -11], [14, 2.5, -11], 56, .35), sag([-16, 3.3, -14.5], [16, 3.3, -14.5], 60, .5));
  V.halo = bulbs(V, lines, [0xffd27a, 0xff5a4a, 0x7ad8ff, 0xffd27a, 0x8aff8a, 0xffa23a]);
  const flagGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-.12, 0, 0), new THREE.Vector3(.12, 0, 0), new THREE.Vector3(0, -.3, 0)]); flagGeo.computeVertexNormals();
  const fl = []; for (let i = 0; i < 4; i++) { const a = poles[i], b = poles[(i + 1) % 4]; sag([a[0], 3.3, a[1]], [b[0], 3.3, b[1]], 26, .5).forEach(p => fl.push({p, ry: i % 2 ? Math.PI / 2 : 0})); }
  const flags = new THREE.InstancedMesh(flagGeo, basic({side: THREE.DoubleSide}), fl.length), d = new THREE.Object3D(), col = new THREE.Color(), fc = [0xc9281f, 0xf0f0f2, 0x1f55c4, 0xe0a52a, 0x1f8a4c];
  fl.forEach((f, i) => { d.position.copy(f.p); d.rotation.set(0, f.ry, 0); d.updateMatrix(); flags.setMatrixAt(i, d.matrix); flags.setColorAt(i, col.setHex(fc[i % fc.length]).multiplyScalar(.55)); });
  flags.frustumCulled = false; g.add(flags);
  // tin-shade lamps over the ring
  const shade = std({color: 0x24402e, roughness: .6, side: THREE.DoubleSide}), hot = basic({color: 0xfff0c0, fog: false});
  for (const p of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) { put(g, new THREE.ConeGeometry(.34, .22, 14, 1, true), shade, p[0], 3.5, p[1]); put(g, new THREE.SphereGeometry(.09, 8, 6), hot, p[0], 3.42, p[1]); put(g, new THREE.CylinderGeometry(.008, .008, .7, 4), bamboo, p[0], 3.95, p[1]); }
  // the temple hall behind the fair
  const T = new THREE.Group(); T.position.set(-15, GY, -27); T.rotation.y = -Math.PI / 2; g.add(T); // gable end faces the ring
  const wall = std({color: 0xd9cfb4}), roofM = std({color: 0xa8421f, roughness: .7}), goldM = std({color: 0xd9a531, roughness: .5, metalness: .3, emissive: 0x3a2a05}), dark = std({color: 0x3a1c12});
  put(T, new THREE.BoxGeometry(13, .8, 8), wall, 0, .4, 0); put(T, new THREE.BoxGeometry(11, 4.2, 6.4), wall, 0, 2.9, 0);
  gable(T, 12.6, 3.4, 8.2, roofM, 0, 5, 0); gable(T, 9, 2.8, 6.6, roofM, 0, 6.5, 0); gable(T, 5.4, 2.2, 5, roofM, 0, 7.9, 0);
  for (const [w, y, hgt, dp] of [[12.6, 5, 3.4, 8.2], [9, 6.5, 2.8, 6.6], [5.4, 7.9, 2.2, 5]]) for (const sx of [-1, 1]) { put(T, new THREE.ConeGeometry(.09, 1.1, 5), goldM, sx * (w / 2 + .05), y + hgt + .45, 0, 0, 0, -sx * .35); const len = Math.hypot(dp / 2, hgt); for (const sz of [-1, 1]) put(T, new THREE.BoxGeometry(.12, .14, len), goldM, sx * (w / 2 + .02), y + hgt / 2, sz * dp / 4, sz * Math.atan2(hgt, dp / 2)); }
  for (const z of [-2.1, 2.1]) put(T, new THREE.BoxGeometry(.1, 2.2, .9), dark, 5.52, 2.9, z);
  put(T, new THREE.BoxGeometry(.1, 2.9, 1.5), dark, 5.52, 2.25, 0);
  const chedi = [[2.2, 0], [2.2, 1], [1.5, 1.6], [1.3, 3.2], [.5, 4.4], [.25, 6.4], [.04, 9]].map(p => new THREE.Vector2(p[0], p[1]));
  put(g, new THREE.LatheGeometry(chedi, 14), std({color: 0xcbb37a, roughness: .7, emissive: 0x1a1404}), 3, GY, -30);
  // fair stalls and a ferris wheel
  const awn = canvasTex(128, 32, (c, w, h) => { for (let x = 0; x < w; x += 16) { c.fillStyle = (x / 16) % 2 ? '#c9281f' : '#f0f0f2'; c.fillRect(x, 0, 16, h); } });
  const stallLines = [];
  [[-10.5, -9, .5], [-13.5, -4, .9], [10.5, -9.5, -.5], [13.5, -4.5, -.9], [3.5, -13.5, 0], [-6, -13, .15]].forEach((s, i) => {
    const st = new THREE.Group(); st.position.set(s[0], GY, s[1]); st.rotation.y = s[2]; g.add(st);
    put(st, new THREE.BoxGeometry(2.6, 1, 1.4), std({color: [0x7a5a3a, 0x3a5a7a, 0x7a3a3a][i % 3]}), 0, .5, 0);
    put(st, new THREE.PlaneGeometry(3, 1.5), std({map: awn, side: THREE.DoubleSide}), 0, 2.35, .35, -1.15);
    for (const x of [-1.3, 1.3]) put(st, new THREE.CylinderGeometry(.03, .03, 2.5, 5), bamboo, x, 1.25, .65);
    const a = new THREE.Vector3(-1.4, 1.95, 1), b = new THREE.Vector3(1.4, 1.95, 1); st.updateMatrixWorld(true); st.localToWorld(a); st.localToWorld(b);
    stallLines.push(sag([a.x, a.y, a.z], [b.x, b.y, b.z], 7, .08));
  });
  bulbs(V, stallLines, [0xffe2a0, 0xffe2a0, 0xff7a5a], .045);
  const wheel = new THREE.Group(); wheel.position.set(17, 5.2, -23); g.add(wheel);
  const iron = std({color: 0x4a4f5a, metalness: .4, roughness: .6});
  put(wheel, new THREE.TorusGeometry(5, .07, 6, 40), iron, 0, 0, 0);
  const wl = []; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; put(wheel, new THREE.BoxGeometry(5, .05, .05), iron, Math.cos(a) * 2.5, Math.sin(a) * 2.5, 0, 0, 0, a); put(wheel, new THREE.BoxGeometry(.5, .45, .4), std({color: fc[i % fc.length]}), Math.cos(a) * 5, Math.sin(a) * 5 - .3, 0); }
  for (let i = 0; i < 36; i++) { const a = i / 36 * Math.PI * 2; wl.push(new THREE.Vector3(Math.cos(a) * 5, Math.sin(a) * 5, .1)); }
  const sub = {group: wheel}; bulbs(sub, [wl], [0xffd27a, 0xff5a4a, 0x7ad8ff], .06); wheel.children.filter(c => c.isLine).forEach(c => wheel.remove(c));
  for (const sx of [-1, 1]) put(g, new THREE.CylinderGeometry(.09, .12, 6.4, 6), iron, 17 + sx * 1.6, GY + 3.1, -23.4, 0, 0, sx * .26);
  // trees closing off the fairground
  const leafM = std({color: 0x16261a}), trunkM = std({color: 0x2a2018});
  for (let i = 0; i < 12; i++) { const a = -2.6 + i * .47, d2 = 21 + rng() * 6, x = Math.sin(a) * d2, z = -Math.abs(Math.cos(a)) * d2 - 4; put(g, new THREE.CylinderGeometry(.2, .28, 3.4, 6), trunkM, x, GY + 1.7, z); const s = put(g, new THREE.SphereGeometry(2.6 + rng() * 1.2, 7, 5), leafM, x, GY + 5 + rng(), z); s.scale.y = .75; }
  crowd(V, groundSeats({d0: 4.9, rows: 8, step: .7, y: GY, sit: 0, zMax: 2.6}), [0x7a2c26, 0x254668, 0x857a62, 0x25553a, 0x8a6a22, 0x433058, 0x858072, 0x1c1c24, 0x7a4256], [0x5e4430, 0x6a4c36, 0x533b2a]);
  V.anim = time => { wheel.rotation.z = time * .12; V.halo.material.opacity = .5 + Math.sin(time * 3.1) * .06; };
  V.light = {bg: 0x1a2244, fog: .017, hemi: [0x8a9ad0, 0x4a3826, .62], key: [0xffd9a0, 1.9, .8, 7, 3.6], rim: [0xff7a3a, 0x4ac0ff, 9, [-5, 2.4, -3.5], [5, 2.4, -3.5]], crowd: [0xffc070, 34, 0, 4.6, -3, 30], beam: 0};
  V.flashRate = .3; V.crowdBright = 1;
  return V;
}

// ---------- old-style rope-fist ground ----------
function chuek() {
  const V = newVenue(), g = V.group;
  sky(V, 0x1c1a3c, 0x8a3f52, 0xf0914a);
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({map: glow(), color: 0xffc27a, fog: false, depthWrite: false})); sun.position.set(18, 5, -62); sun.scale.setScalar(26); g.add(sun);
  const ground = put(g, new THREE.PlaneGeometry(90, 90), std({map: groundTex('#8f7048', '190,160,110', '80,58,34')}), 0, 0, 0, -Math.PI / 2); ground.receiveShadow = true;
  const sand = canvasTex(1024, 1024, (c, w, h) => {
    c.fillStyle = '#a5875a'; c.fillRect(0, 0, w, h); speckle(c, w, h, 5200, '225,200,150', '95,70,40', .13, 7);
    c.strokeStyle = 'rgba(240,232,210,.75)'; c.lineWidth = 12; c.setLineDash([46, 9]); c.strokeRect(74, 74, w - 148, h - 148); c.setLineDash([]);
    c.strokeStyle = 'rgba(240,232,210,.4)'; c.lineWidth = 8; c.beginPath(); c.arc(w / 2, h / 2, 200, 0, 7); c.stroke();
  });
  ringParts(V, {mat: sand, apron: null, ground: 0, posts: {col: 0x4a3524, r: .085, h: 1.2, taper: 1.2}, pads: null, ropeY: [.52, .98], ropeCols: [0xb59a66], ropeR: .032});
  const wood = std({color: 0x4a3524}), woodL = std({color: 0x6a4c30}), red = std({color: 0x8f2a1e, roughness: .8}), goldM = std({color: 0xd9a531, roughness: .5, metalness: .3, emissive: 0x2a1c04});
  // torches
  const flameM = () => new THREE.SpriteMaterial({map: glow(), color: 0xffa23a, blending: THREE.AdditiveBlending, depthWrite: false, fog: false});
  V.flames = [];
  for (const p of [[-4.4, -4.4], [4.4, -4.4], [-4.4, 4.2], [4.4, 4.2], [-8.5, -8.6], [8.5, -8.6], [0, -8.9]]) {
    put(g, new THREE.CylinderGeometry(.035, .05, 2.1, 6), wood, p[0], 1.05, p[1]); put(g, new THREE.CylinderGeometry(.13, .06, .2, 8), std({color: 0x2a2420, metalness: .5, roughness: .5}), p[0], 2.2, p[1]);
    const f = new THREE.Sprite(flameM()); f.position.set(p[0], 2.5, p[1]); g.add(f); V.flames.push({f, ph: rng() * 9});
  }
  // long pennants at the corners
  for (const [x, z, c] of [[-4.9, -4.9, 0xc9281f], [4.9, -4.9, 0xe0a52a], [-9.5, -7, 0xe0a52a], [9.5, -7, 0xc9281f]]) {
    put(g, new THREE.CylinderGeometry(.03, .04, 5.2, 6), woodL, x, 2.6, z);
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -.5, 0), new THREE.Vector3(1.9, -.75, 0)]); geo.computeVertexNormals();
    put(g, geo, basic({color: new THREE.Color(c).multiplyScalar(.8), side: THREE.DoubleSide}), x, 5.1, z, 0, .4);
  }
  // royal pavilion behind the crowd
  const P = new THREE.Group(); P.position.set(0, 0, -11.6); g.add(P);
  put(P, new THREE.BoxGeometry(7.4, 1.5, 3.4), woodL, 0, .75, 0); put(P, new THREE.BoxGeometry(7.8, .12, 3.8), red, 0, 1.56, 0);
  for (const x of [-3.4, -1.15, 1.15, 3.4]) for (const z of [-1.4, 1.4]) put(P, new THREE.CylinderGeometry(.09, .09, 2.9, 8), red, x, 3, z);
  gable(P, 8.6, 1.9, 4.6, red, 0, 4.4, 0); gable(P, 5.6, 1.6, 3.6, red, 0, 5.3, 0);
  for (const sx of [-1, 1]) { put(P, new THREE.ConeGeometry(.07, .9, 5), goldM, sx * 4.35, 6.6, 0, 0, 0, -sx * .4); put(P, new THREE.ConeGeometry(.07, .9, 5), goldM, sx * 2.85, 7.2, 0, 0, 0, -sx * .4); }
  for (const x of [-2.5, 2.5]) { put(P, new THREE.CylinderGeometry(.025, .025, 3.4, 5), goldM, x, 3.2, 1.9); for (let k = 0; k < 5; k++) put(P, new THREE.ConeGeometry(.5 - k * .08, .22, 12, 1, true), std({color: k % 2 ? 0xd9a531 : 0xf2ead8, side: THREE.DoubleSide}), x, 3.6 + k * .32, 1.9); }
  // nobles seated on the pavilion
  for (const x of [-1.6, 0, 1.6]) { put(P, new THREE.CapsuleGeometry(.24, .4, 3, 6), std({color: x ? 0x6a2a2a : 0xd9a531}), x, 2.05, 0); put(P, new THREE.SphereGeometry(.15, 8, 6), std({color: 0x8a6245}), x, 2.62, 0); }
  // city wall with merlons, a prang and a chedi beyond it
  const brick = canvasTex(256, 128, (c, w, h) => { c.fillStyle = '#7a4a32'; c.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 16) for (let x = (y / 16) % 2 ? -16 : 0; x < w; x += 32) { c.fillStyle = 'rgba(' + (rng() < .5 ? '40,20,12' : '170,110,80') + ',' + rng() * .3 + ')'; c.fillRect(x + 1, y + 1, 30, 14); } }); brick.wrapS = brick.wrapT = THREE.RepeatWrapping; brick.repeat.set(16, 2);
  const brickM = std({map: brick});
  put(g, new THREE.BoxGeometry(70, 3.6, 1.4), brickM, 0, 1.8, -19);
  const mer = new THREE.InstancedMesh(new THREE.BoxGeometry(.7, .9, 1.4), std({color: 0x74462f}), 46), d = new THREE.Object3D();
  for (let i = 0; i < 46; i++) { d.position.set(-33.8 + i * 1.5, 4.05, -19); d.updateMatrix(); mer.setMatrixAt(i, d.matrix); } g.add(mer);
  const stone = std({color: 0x6a5648, roughness: 1});
  const prang = [[3, 0], [3, 2], [2.3, 2.6], [2.3, 5], [1.9, 5.6], [2, 8], [1.6, 11], [.9, 13.5], [.1, 15.5]].map(p => new THREE.Vector2(p[0], p[1]));
  put(g, new THREE.LatheGeometry(prang, 10), stone, -13, 0, -30);
  const bell = [[3.4, 0], [3.4, 1.4], [2.4, 2], [2.2, 4.4], [.9, 6.2], [.5, 7], [.3, 10], [.04, 12.5]].map(p => new THREE.Vector2(p[0], p[1]));
  put(g, new THREE.LatheGeometry(bell, 14), std({color: 0x8a7a66, roughness: 1}), 14, 0, -31);
  const leafM = std({color: 0x24331c}), trunkM = std({color: 0x3a2c1e});
  for (const [x, z, h] of [[-20, -15, 9], [-9, -16.5, 11], [7.5, -16, 10], [21, -15, 8.5], [-26, -9, 10], [27, -8, 11], [-15.5, -4, 8.5], [16, -3, 9.5]]) palm(g, x, 0, z, h, leafM, trunkM);
  // crowd: two rows squatting in front, the rest standing; many bare-chested
  crowd(V, groundSeats({d0: 4.7, rows: 8, step: .72, y: 0, sit: 2, zMax: 2.6, skip: (x, z) => z < -9.4 && Math.abs(x) < 4.4}), [0x9a927e, 0x1e2438, 0x4a3422, 0x561e1c, 0x8a8068, 0x2a3428], [0x5e4430, 0x6a4c36, 0x533b2a], .42);
  V.anim = time => {
    for (const t of V.flames) { const k = .8 + Math.sin(time * 11 + t.ph) * .12 + Math.sin(time * 23 + t.ph * 2) * .08; t.f.scale.set(.75 * k, 1.15 * k, 1); }
    V.flicker = .86 + Math.sin(time * 9.3) * .08 + Math.sin(time * 17.1) * .06;
  };
  V.light = {bg: 0xd98a52, fog: .011, hemi: [0xd8c0d0, 0x5a4434, .8], key: [0xffc490, 1.9, -4.5, 5.2, 4.2], rim: [0xff8a2a, 0xff8a2a, 30, [-4.4, 2.5, -4.2], [4.4, 2.5, -4.2]], crowd: [0xff9a4a, 26, 0, 3.4, -6, 26], beam: 0};
  V.flashRate = 0; V.crowdBright = 1;
  return V;
}

// ---------- training camp ----------
function camp() {
  const V = newVenue(), g = V.group;
  sky(V, 0x3f7fc8, 0x9cc4e8, 0xf4dfb4);
  const ground = put(g, new THREE.PlaneGeometry(90, 90), std({map: groundTex('#8f7a52', '120,140,70', '90,70,40')}), 0, 0, 0, -Math.PI / 2); ground.receiveShadow = true;
  const slab = canvasTex(1024, 1024, (c, w, h) => { c.fillStyle = '#3d6f8a'; c.fillRect(0, 0, w, h); speckle(c, w, h, 4200, '255,255,255', '15,35,50', .1, 8); c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 10; c.strokeRect(60, 60, w - 120, h - 120); c.fillStyle = 'rgba(255,255,255,.75)'; c.font = 'italic 800 76px Kanit, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('ค่ายมวย', w / 2, h / 2 + 250); });
  const floor = put(g, new THREE.PlaneGeometry(S, S), std({map: slab, roughness: .95}), 0, .004, 0, -Math.PI / 2); floor.receiveShadow = true;
  const wood = std({color: 0x5a4028}), woodL = std({color: 0x7a5a3a});
  // open shed: posts, beams, tin roof
  const H = 3.25, X = 3.9;
  for (const x of [-X, 0, X]) for (const z of [-3.6, 3.6]) if (!(x === 0 && z > 0)) { const p = put(g, new THREE.BoxGeometry(.16, H, .16), wood, x, H / 2, z); p.castShadow = true; }
  for (const z of [-3.6, 0, 3.6]) put(g, new THREE.BoxGeometry(X * 2 + .3, .14, .14), wood, 0, H, z);
  for (const x of [-X, X]) put(g, new THREE.BoxGeometry(.14, .14, 7.4), wood, x, H, 0);
  const tin = canvasTex(256, 64, (c, w, h) => { for (let x = 0; x < w; x += 8) { c.fillStyle = x % 16 ? '#8a8f94' : '#62676c'; c.fillRect(x, 0, 8, h); } c.fillStyle = 'rgba(120,70,30,.25)'; for (let i = 0; i < 30; i++) c.fillRect(rng() * w, rng() * h, 10 + rng() * 30, 3 + rng() * 8); }); tin.wrapS = tin.wrapT = THREE.RepeatWrapping; tin.repeat.set(8, 2);
  const tinM = std({map: tin, roughness: .6, metalness: .3, side: THREE.DoubleSide});
  for (const s of [-1, 1]) put(g, new THREE.PlaneGeometry(X * 2 + 1.2, 4.5), tinM, 0, H + .75, s * 2.05, -s * (Math.PI / 2 - .36));
  // heavy bags hanging at the back, tyres, water jar, bench
  const bagM = [std({color: 0x7c1f1a, roughness: .55}), std({color: 0x1d2f6a, roughness: .55}), std({color: 0x24242a, roughness: .55})], chain = std({color: 0x50545c, metalness: .6, roughness: .5});
  [-2.5, -.6, 2.4].forEach((x, i) => { put(g, new THREE.CylinderGeometry(.012, .012, .9, 4), chain, x, H - .45, -3.55); const b = put(g, new THREE.CapsuleGeometry(.2, .85, 4, 12), bagM[i], x, H - 1.55, -3.55); b.castShadow = true; });
  const tyre = std({color: 0x18181b, roughness: .85});
  for (let k = 0; k < 3; k++) put(g, new THREE.TorusGeometry(.34, .13, 8, 18), tyre, -3.1 + (k === 2 ? .12 : 0), .13 + k * .26, 2.2, Math.PI / 2);
  put(g, new THREE.TorusGeometry(.34, .13, 8, 18), tyre, 3.3, .46, -2.6, 0, .5);
  const jar = [[.05, 0], [.3, .05], [.42, .4], [.36, .75], [.24, .86], [.27, .92]].map(p => new THREE.Vector2(p[0], p[1]));
  put(g, new THREE.LatheGeometry(jar, 14), std({color: 0x7a4a34, roughness: .7}), 3.15, 0, 1.6);
  put(g, new THREE.BoxGeometry(1.8, .07, .36), woodL, -2.9, .45, -2.9); for (const x of [-3.6, -2.2]) put(g, new THREE.BoxGeometry(.07, .45, .3), wood, x, .22, -2.9);
  // old practice ring further back, fence, plants
  const ringG = new THREE.Group(); ringG.position.set(-9, 0, -12); g.add(ringG);
  put(ringG, new THREE.BoxGeometry(5.6, .7, 5.6), std({color: 0x5a6f7a}), 0, .35, 0);
  for (const [x, z] of [[-2.6, -2.6], [2.6, -2.6], [-2.6, 2.6], [2.6, 2.6]]) put(ringG, new THREE.CylinderGeometry(.07, .07, 1.5, 6), wood, x, 1.45, z);
  for (const y of [1.1, 1.5, 1.9]) for (let i = 0; i < 4; i++) put(ringG, new THREE.CylinderGeometry(.02, .02, 5.2, 5), std({color: i % 2 ? 0xc9463c : 0x4a78c8}), Math.sin(i * Math.PI / 2) * 2.6, y, Math.cos(i * Math.PI / 2) * 2.6, 0, 0, 0).rotation.set(i % 2 ? Math.PI / 2 : 0, 0, i % 2 ? 0 : Math.PI / 2);
  const fence = new THREE.InstancedMesh(new THREE.CylinderGeometry(.035, .035, 1.5, 5), std({color: 0x9a8650}), 120), d = new THREE.Object3D();
  for (let i = 0; i < 120; i++) { d.position.set(-21 + i * .35, .72 + (i % 3) * .05, -8.2); d.rotation.z = (rng() - .5) * .08; d.updateMatrix(); fence.setMatrixAt(i, d.matrix); } g.add(fence);
  put(g, new THREE.BoxGeometry(42, .06, .06), woodL, 0, 1.1, -8.15); put(g, new THREE.BoxGeometry(42, .06, .06), woodL, 0, .5, -8.15);
  const leafM = std({color: 0x3f7a33}), trunkM = std({color: 0x6a5a48});
  for (const [x, z, h] of [[-13, -11, 8.5], [-3.5, -13, 10], [6, -11.5, 9], [14, -13, 10.5], [20, -6, 8], [-21, -5, 9.5]]) palm(g, x, 0, z, h, leafM, trunkM);
  for (const [x, z, h] of [[5.6, -5.4, 1.9], [6.5, -6.2, 2.3], [-6.2, -6, 2.1], [8.6, -9.5, 2.2], [1.5, -9.6, 1.8]]) { const b = bananaTree(h); b.position.set(x, 0, z); b.rotation.y = rng() * 6; g.add(b); }
  const hill = std({color: 0x5a8a52, roughness: 1});
  for (const [x, z, r] of [[-30, -48, 16], [5, -55, 22], [38, -50, 15]]) { const m = put(g, new THREE.SphereGeometry(r, 12, 8), hill, x, -r * .55, z); m.scale.y = .6; }
  V.light = {bg: 0xf4dfb4, fog: .007, hemi: [0xdcecff, 0x9a8460, 1.25], key: [0xfff0d2, 2.3, 3.2, 7, 4.2], rim: [0xfff0d0, 0xfff0d0, 0, [-5, 2.6, -4], [5, 2.6, -4]], crowd: [0xfff0d0, 14, 0, 2.6, 1, 14], beam: 0};
  V.flashRate = 0; V.beamY = H;
  return V;
}

function newVenue() { return {group: new THREE.Group(), ropeSides: [[], [], [], []], corners: [], beams: [], seats: null, anim: null, dome: null, flicker: 1}; }
const BUILD = {stadium, champ, province, temple, chuek, camp};
// lighting mood per presentation preset, as multipliers on the venue's own light
const MOOD = {
  broadcast: {bg: 1, fog: 1, hemi: 1, key: 1, rim: 1, crowd: 1, beam: 1, exp: 1},
  cinema: {bg: .42, fog: 1.9, hemi: .3, key: 1.19, rim: 5.5, crowd: .22, beam: 2.5, exp: 1},
  arcade: {bg: 1, fog: 1.1, hemi: .86, key: .94, rim: 4, crowd: .75, beam: 1.8, exp: 1.05},
  ringside: {bg: .6, fog: 1.55, hemi: .45, key: 1.06, rim: 3.4, crowd: .47, beam: 2.1, exp: 1}
};

export function buildArena(scene) {
  const A = {group: new THREE.Group(), flashes: [], hype: 0, venue: '', V: null, look: 'broadcast', dotTex: glow()};
  scene.add(A.group);
  const built = {};
  for (let i = 0; i < 10; i++) { // camera flashes in the crowd
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({map: glow(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0}));
    sp.scale.setScalar(1.1); A.group.add(sp); A.flashes.push({sp, t: 0});
  }
  A.hemi = new THREE.HemisphereLight(0xcfdcff, 0x2a2018, .7); scene.add(A.hemi);
  A.key = new THREE.DirectionalLight(0xfff1dc, 2.2); A.key.position.set(1.5, 7, 4.5); A.key.castShadow = true;
  A.key.shadow.mapSize.set(1024, 1024); const sc = A.key.shadow.camera; sc.left = -4; sc.right = 4; sc.top = 4; sc.bottom = -4; sc.near = 1; sc.far = 16; A.key.shadow.bias = -.0006; A.key.shadow.normalBias = .02;
  scene.add(A.key, A.key.target);
  A.rimR = new THREE.PointLight(0xff4a3a, 30, 14, 2); A.rimB = new THREE.PointLight(0x3a7bff, 30, 14, 2); A.crowdLight = new THREE.PointLight(0xffe7c2, 60, 30, 1.6);
  scene.add(A.rimR, A.rimB, A.crowdLight);
  let ren = null, rimBase = 0;

  function light() {
    const V = A.V; if (!V || !ren) return;
    const L = V.light, M = MOOD[A.look] || MOOD.broadcast, bg = new THREE.Color(L.bg).multiplyScalar(M.bg);
    scene.background = bg; scene.fog = new THREE.FogExp2(bg.getHex(), L.fog * M.fog);
    if (V.dome) V.dome.material.color.setScalar(M.bg);
    A.hemi.color.setHex(L.hemi[0]); A.hemi.groundColor.setHex(L.hemi[1]); A.hemi.intensity = L.hemi[2] * M.hemi;
    A.key.color.setHex(L.key[0]); A.key.intensity = L.key[1] * M.key; A.keyOff = [L.key[2], L.key[3], L.key[4]]; A.keyAt(0);
    A.rimR.color.setHex(L.rim[0]); A.rimB.color.setHex(L.rim[1]); rimBase = L.rim[2] * M.rim; A.rimR.intensity = A.rimB.intensity = rimBase;
    A.rimR.position.fromArray(L.rim[3]); A.rimB.position.fromArray(L.rim[4]);
    A.crowdLight.color.setHex(L.crowd[0]); A.crowdLight.intensity = L.crowd[1] * M.crowd; A.crowdLight.position.set(L.crowd[2], L.crowd[3], L.crowd[4]); A.crowdLight.distance = L.crowd[5];
    V.beams.forEach(b => { b.material.opacity = L.beam * M.beam; });
    ren.toneMappingExposure = M.exp;
  }
  A.keyAt = function (x) { const o = A.keyOff || [1.5, 7, 4.5]; A.key.position.set(x + o[0], o[1], o[2]); A.key.target.position.set(x, 0, 0); };
  A.setVenue = function (key) {
    if (!BUILD[key]) key = 'stadium';
    if (A.venue === key) return;
    if (!built[key]) { built[key] = BUILD[key](); A.group.add(built[key].group); }
    for (const k in built) built[k].group.visible = k === key;
    A.venue = key; A.V = built[key]; A.flashes.forEach(f => { f.t = 0; f.sp.material.opacity = 0; });
    light();
  };
  // look: lighting mood per preset
  A.setLook = function (look, renderer) { A.look = look; ren = renderer; if (!A.V) A.setVenue('stadium'); light(); };
  // ropes between the lens and the fighters fade out; keepNear (0..1) leaves them in, as on TV or at ringside
  A.fadeRopes = function (cam, keepNear) {
    const V = A.V; if (!V) return;
    const beyond = [cam.z - R, cam.x - R, -cam.z - R, -cam.x - R];
    for (let i = 0; i < 4; i++) {
      const d = beyond[i];
      let o = 1;
      if (d > -.9) { const k = Math.max(0, Math.min(1, (d - .5) / .9)); o = keepNear ? k * k * (3 - 2 * k) * keepNear : 0; }
      for (const r of V.ropeSides[i]) { r.visible = o > .03; r.material.opacity = o; }
    }
    // a corner post right in front of the lens would block the shot
    for (const c of V.corners) { const near = Math.hypot(cam.x - c.x, cam.z - c.z) < 2.7; c.post.visible = c.pad.visible = !near; }
  };
  const dummy = new THREE.Object3D();
  A.update = function (time, hype, dt) {
    const V = A.V; if (!V) return;
    A.hype = hype;
    if (V.anim) V.anim(time, hype, dt);
    if (V.flicker !== 1) A.rimR.intensity = A.rimB.intensity = rimBase * V.flicker;
    const seats = V.seats;
    if (seats) {
      // The crowd stays still. When the fight heats up the keener people get to their feet and throw their arms up,
      // more of them the hotter it gets, and they settle again as it cools.
      let moved = false;
      for (let i = 0; i < seats.length; i++) {
        const s = seats[i], want = hype > s.th ? 1 : 0;
        if (V.placed && s.e === want && !want) continue;
        s.e += (want - s.e) * Math.min(1, dt * (want ? 6 : 1.8)); if (Math.abs(want - s.e) < .01) s.e = want;
        const e = s.e, hop = e * Math.abs(Math.sin(time * 5.5 + s.ph)) * .05;
        let sh; // shoulder height
        if (V.afoot) { // on their feet, or squatting in the front rows and rising
          const k = s.stand ? 1 : .6 + .4 * e;
          dummy.position.set(s.x, s.y + hop, s.z); dummy.rotation.set(0, s.ry, 0); dummy.scale.set(s.s, s.s * k, s.s); dummy.updateMatrix(); V.bodies.setMatrixAt(i, dummy.matrix);
          dummy.position.y = s.y + 1.6 * s.s * k + hop; dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(s.s * .92); dummy.updateMatrix(); V.heads.setMatrixAt(i, dummy.matrix);
          sh = s.y + 1.3 * s.s * k + hop;
        } else { // seated: gets up off the bench
          const up = e * .24;
          dummy.position.set(s.x, s.y + .3 + up + hop, s.z); dummy.rotation.set(0, 0, 0); dummy.scale.set(s.s, s.s * (1 + e * .4), s.s); dummy.updateMatrix(); V.bodies.setMatrixAt(i, dummy.matrix);
          dummy.position.y += (.42 + e * .12) * s.s; dummy.scale.setScalar(s.s); dummy.updateMatrix(); V.heads.setMatrixAt(i, dummy.matrix);
          sh = s.y + .44 + up + hop + e * .1;
        }
        for (let a = 0; a < 2; a++) {
          const sg = a ? 1 : -1, tilt = sg * (.42 + Math.sin(time * 7 + s.ph + a) * .16);
          dummy.position.set(s.x + s.ax * sg * .17 * s.s, sh, s.z + (1 - s.ax) * sg * .17 * s.s); dummy.rotation.set(s.ax ? 0 : tilt, 0, s.ax ? -tilt : 0); dummy.scale.set(e, e * s.s, e); dummy.updateMatrix(); V.arms.setMatrixAt(i * 2 + a, dummy.matrix);
        }
        moved = true;
      }
      dummy.rotation.set(0, 0, 0);
      if (moved) { V.bodies.instanceMatrix.needsUpdate = true; V.heads.instanceMatrix.needsUpdate = true; V.arms.instanceMatrix.needsUpdate = true; }
      V.placed = true;
    }
    for (const f of A.flashes) {
      f.t -= dt;
      if (seats && V.flashRate && f.t <= 0 && Math.random() < dt * (0.15 + hype * 5) * V.flashRate) { const s = seats[Math.floor(Math.random() * seats.length)]; f.sp.position.set(s.x, s.y + (V.afoot ? 1.5 : .8), s.z); f.t = .12; }
      f.sp.material.opacity = Math.max(0, f.t / .12);
    }
  };
  return A;
}
