// Ring, crowd and lights. Everything is generated; no asset files.
const THREE = globalThis.THREE;

const R = 3.05;         // ring half size at the ropes
const rng = (() => { let a = 12345; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; })();

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export function buildArena(scene) {
  const A = {group: new THREE.Group(), flashes: [], hype: 0};
  scene.add(A.group);

  // canvas mat
  const mat = canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = '#8fa1b1'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { g.fillStyle = 'rgba(' + (rng() < .5 ? '255,255,255' : '40,60,80') + ',' + (rng() * .05) + ')'; g.fillRect(rng() * w, rng() * h, 2 + rng() * 5, 2 + rng() * 5); }
    g.strokeStyle = 'rgba(20,50,110,.55)'; g.lineWidth = 10; g.beginPath(); g.arc(w / 2, h / 2, 210, 0, 7); g.stroke();
    g.fillStyle = 'rgba(47,118,234,.16)'; g.beginPath(); g.arc(w / 2, h / 2, 205, 0, 7); g.fill();
    g.fillStyle = 'rgba(20,45,100,.8)'; g.font = 'italic 800 78px Kanit, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('MUAY', w / 2, h / 2 - 42); g.fillText('ARENA', w / 2, h / 2 + 42);
    g.strokeStyle = 'rgba(150,30,25,.5)'; g.lineWidth = 14; g.strokeRect(70, 70, w - 140, h - 140);
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(R * 2 + .9, R * 2 + .9), new THREE.MeshStandardMaterial({map: mat, roughness: .92}));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; A.group.add(floor); A.floorMat = floor.material;

  // apron
  const apronTex = canvasTex(1024, 128, (g, w, h) => {
    g.fillStyle = '#7c1f1a'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, 0, w, 14);
    g.fillStyle = 'rgba(255,224,150,.9)'; g.font = 'italic 800 46px Kanit, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 0; i < 3; i++) g.fillText('MUAY ARENA', w / 6 + i * w / 3, h / 2 + 4);
  });
  const apronMat = new THREE.MeshStandardMaterial({map: apronTex, roughness: .8});
  const S = R * 2 + .9;
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(S, .95), apronMat);
    m.position.set(Math.sin(i * Math.PI / 2) * S / 2, -.475, Math.cos(i * Math.PI / 2) * S / 2); m.rotation.y = i * Math.PI / 2; A.group.add(m);
  }
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({color: 0x0b0c12, roughness: 1}));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -.95; A.group.add(ground);

  // posts, pads, ropes
  const postCol = [0xd9342b, 0xe9e9ee, 0x2f6fe0, 0xe9e9ee]; // -x+z is red corner side, +x-z blue
  const corners = [[-R, R], [R, R], [R, -R], [-R, -R]];
  A.corners = [];
  corners.forEach((c, i) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, 1.5, 12), new THREE.MeshStandardMaterial({color: 0x30323c, roughness: .5, metalness: .4}));
    post.position.set(c[0] * 1.03, .75, c[1] * 1.03); post.castShadow = true; A.group.add(post);
    const pad = new THREE.Mesh(new THREE.BoxGeometry(.24, 1.05, .24), new THREE.MeshStandardMaterial({color: postCol[i], roughness: .6}));
    pad.position.set(c[0] * .985, .85, c[1] * .985); pad.rotation.y = Math.PI / 4; pad.castShadow = true; A.group.add(pad);
    A.corners.push({x: c[0], z: c[1], post, pad});
  });
  const ropeCols = [0xe9e9ee, 0xd9342b, 0xe9e9ee, 0x2f6fe0];
  A.ropeSides = [[], [], [], []];
  [.42, .72, 1.02, 1.32].forEach((y, k) => {
    for (let i = 0; i < 4; i++) {
      const m = new THREE.MeshStandardMaterial({color: ropeCols[k], roughness: .6, transparent: true});
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(.022, .022, R * 2, 8), m);
      rope.position.set(Math.sin(i * Math.PI / 2) * R, y, Math.cos(i * Math.PI / 2) * R);
      if (i % 2 === 0) rope.rotation.z = Math.PI / 2; else rope.rotation.x = Math.PI / 2; // sides 0,2 run along x
      A.group.add(rope); A.ropeSides[i].push(rope);
    }
  });
  // ropes between the lens and the fighters fade out; keepNear (0..1) leaves them in, as on TV or at ringside
  A.fadeRopes = function (cam, keepNear) {
    const beyond = [cam.z - R, cam.x - R, -cam.z - R, -cam.x - R];
    for (let i = 0; i < 4; i++) {
      const d = beyond[i];
      let o = 1;
      if (d > -.9) { const k = Math.max(0, Math.min(1, (d - .5) / .9)); o = keepNear ? k * k * (3 - 2 * k) * keepNear : 0; }
      for (const r of A.ropeSides[i]) { r.visible = o > .03; r.material.opacity = o; }
    }
    // a corner post right in front of the lens would block the shot
    for (const c of A.corners) { const near = Math.hypot(cam.x - c.x, cam.z - c.z) < 2.7; c.post.visible = c.pad.visible = !near; }
  };

  // crowd: instanced bodies and heads on raked tiers around the ring
  const seats = [];
  for (let side = 0; side < 4; side++) for (let row = 0; row < 7; row++) {
    const dist = 7.6 + row * .95, y = -.5 + row * .42, n = Math.floor((dist * 2) / .62);
    for (let i = 0; i < n; i++) {
      const u = -dist + i * .62 + (row % 2) * .3 + (rng() - .5) * .12;
      const p = side === 0 ? [u, y, dist] : side === 1 ? [dist, y, u] : side === 2 ? [u, y, -dist] : [-dist, y, u];
      seats.push({x: p[0], y: p[1], z: p[2], ph: rng() * 6.28, s: .85 + rng() * .3, hue: rng()});
    }
  }
  const bodyGeo = new THREE.CapsuleGeometry(.2, .32, 3, 6), headGeo = new THREE.SphereGeometry(.13, 8, 6);
  const crowdMat = new THREE.MeshStandardMaterial({roughness: 1}), crowdHead = new THREE.MeshStandardMaterial({roughness: 1});
  const bodies = new THREE.InstancedMesh(bodyGeo, crowdMat, seats.length), heads = new THREE.InstancedMesh(headGeo, crowdHead, seats.length);
  const col = new THREE.Color(), shirts = [0x1a1f2c, 0x241c28, 0x162226, 0x28211c, 0x1f2127, 0x2e1b1b, 0x1a2434];
  const skins = [0x4a3425, 0x533b2a, 0x5e4430];
  seats.forEach((s, i) => { bodies.setColorAt(i, col.setHex(shirts[Math.floor(s.hue * shirts.length)])); heads.setColorAt(i, col.setHex(skins[i % 3])); });
  A.group.add(bodies, heads); A.seats = seats; A.bodies = bodies; A.heads = heads;

  // camera flashes in the crowd
  const flashTex = canvasTex(64, 64, (g, w) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.3, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
  A.dotTex = flashTex;
  for (let i = 0; i < 10; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({map: flashTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0}));
    sp.scale.setScalar(1.1); A.group.add(sp); A.flashes.push({sp, t: 0});
  }

  // light rig: truss with lamps, visible beams
  const truss = new THREE.Group(); truss.position.y = 6.2; A.group.add(truss);
  const lampMat = new THREE.MeshBasicMaterial({color: 0xfff2d0});
  A.beams = [];
  [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2], [0, 0]].forEach((p, i) => {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(.5, .16, .5), lampMat); lamp.position.set(p[0], 0, p[1]); truss.add(lamp);
    const beam = new THREE.Mesh(new THREE.ConeGeometry(2.3, 6.3, 20, 1, true),
      new THREE.MeshBasicMaterial({color: i === 4 ? 0xffffff : i % 2 ? 0xbcd4ff : 0xffe2b0, transparent: true, opacity: .045, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide}));
    beam.position.set(p[0] * .6, -3.1, p[1] * .6); truss.add(beam); A.beams.push(beam);
  });
  const bar = new THREE.MeshStandardMaterial({color: 0x1a1c24, roughness: .6, metalness: .5});
  for (const z of [-2.2, 2.2]) { const b = new THREE.Mesh(new THREE.BoxGeometry(6, .12, .12), bar); b.position.set(0, .14, z); truss.add(b); }
  for (const x of [-2.2, 2.2]) { const b = new THREE.Mesh(new THREE.BoxGeometry(.12, .12, 6), bar); b.position.set(x, .14, 0); truss.add(b); }

  // lights
  A.hemi = new THREE.HemisphereLight(0xcfdcff, 0x2a2018, .7); scene.add(A.hemi);
  A.key = new THREE.DirectionalLight(0xfff1dc, 2.2); A.key.position.set(1.5, 7, 4.5); A.key.castShadow = true;
  A.key.shadow.mapSize.set(1024, 1024); const sc = A.key.shadow.camera; sc.left = -4; sc.right = 4; sc.top = 4; sc.bottom = -4; sc.near = 1; sc.far = 16; A.key.shadow.bias = -.0006; A.key.shadow.normalBias = .02;
  scene.add(A.key, A.key.target);
  A.rimR = new THREE.PointLight(0xff4a3a, 30, 14, 2); A.rimR.position.set(-5, 2.6, -4); scene.add(A.rimR);
  A.rimB = new THREE.PointLight(0x3a7bff, 30, 14, 2); A.rimB.position.set(5, 2.6, -4); scene.add(A.rimB);
  A.crowdLight = new THREE.PointLight(0xffe7c2, 60, 30, 1.6); A.crowdLight.position.set(0, 7, 0); scene.add(A.crowdLight);

  const dummy = new THREE.Object3D();
  A.update = function (time, hype, dt) {
    A.hype = hype;
    const amp = .03 + hype * .16;
    for (let i = 0; i < seats.length; i++) {
      const s = seats[i], bob = Math.abs(Math.sin(time * (2.2 + hype * 5) + s.ph)) * amp * (hype > .55 && s.hue > .5 ? 2.2 : 1);
      dummy.position.set(s.x, s.y + .3 + bob, s.z); dummy.scale.setScalar(s.s); dummy.updateMatrix(); bodies.setMatrixAt(i, dummy.matrix);
      dummy.position.y += .42 * s.s; dummy.updateMatrix(); heads.setMatrixAt(i, dummy.matrix);
    }
    bodies.instanceMatrix.needsUpdate = true; heads.instanceMatrix.needsUpdate = true;
    for (const f of A.flashes) {
      f.t -= dt;
      if (f.t <= 0 && Math.random() < dt * (0.15 + hype * 5)) { const s = seats[Math.floor(Math.random() * seats.length)]; f.sp.position.set(s.x, s.y + .8, s.z); f.t = .12; }
      f.sp.material.opacity = Math.max(0, f.t / .12);
    }
  };
  // look: lighting mood per preset
  A.setLook = function (look, renderer, scene) {
    const L = {
      broadcast: {bg: 0x12141c, fog: .018, hemi: .75, key: 1.5, rim: 10, crowd: 60, beam: .012, exp: 1.0},
      cinema: {bg: 0x06070b, fog: .034, hemi: .28, key: 1.9, rim: 55, crowd: 12, beam: .03, exp: 1.0},
      arcade: {bg: 0x15102a, fog: .02, hemi: .9, key: 1.5, rim: 40, crowd: 45, beam: .022, exp: 1.05},
      ringside: {bg: 0x0a0b10, fog: .028, hemi: .45, key: 1.7, rim: 34, crowd: 28, beam: .025, exp: 1.0}
    }[look];
    scene.background = new THREE.Color(L.bg); scene.fog = new THREE.FogExp2(L.bg, L.fog);
    A.hemi.intensity = L.hemi; A.key.intensity = L.key; A.rimR.intensity = A.rimB.intensity = L.rim; A.crowdLight.intensity = L.crowd;
    A.beams.forEach(b => { b.material.opacity = L.beam; });
    renderer.toneMappingExposure = L.exp;
  };
  return A;
}
