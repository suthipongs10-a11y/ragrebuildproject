// Impact effects: spark particles, flash sprites, shock rings, limb trails.
const THREE = globalThis.THREE;

function tex(size, draw) {
  const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function buildFx(scene) {
  const N = 420;
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const P = []; for (let i = 0; i < N; i++) P.push({life: 0, t: 0, vx: 0, vy: 0, vz: 0, r: 1, g: 1, b: 1, grav: 0});
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const dot = tex(64, (g, s) => { const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); gr.addColorStop(0, '#fff'); gr.addColorStop(.35, 'rgba(255,255,255,.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); });
  const points = new THREE.Points(geo, new THREE.PointsMaterial({size: .1, map: dot, vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, sizeAttenuation: true}));
  points.frustumCulled = false; scene.add(points);
  let next = 0;
  const c3 = new THREE.Color();

  const burst = tex(256, (g, s) => {
    g.translate(s / 2, s / 2);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, s / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, s / 2, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,.9)';
    for (let i = 0; i < 12; i++) { g.rotate(Math.PI / 6); const l = (i % 2 ? .46 : .3) * s; g.beginPath(); g.moveTo(0, -5); g.lineTo(l, 0); g.lineTo(0, 5); g.fill(); }
  });
  const flashes = [];
  for (let i = 0; i < 8; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({map: burst, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, depthTest: false, opacity: 0}));
    sp.visible = false; sp.renderOrder = 5; scene.add(sp); flashes.push({sp, t: 0, life: .2, size: 1});
  }
  const rings = [];
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(new THREE.RingGeometry(.82, 1, 40), new THREE.MeshBasicMaterial({color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, side: THREE.DoubleSide}));
    m.visible = false; m.renderOrder = 5; scene.add(m); rings.push({m, t: 0, life: .3, size: 1});
  }

  // trails: one camera-facing ribbon per fighter
  const TN = 16;
  const trails = [0, 1].map(i => {
    const g = new THREE.BufferGeometry(), p = new Float32Array(TN * 2 * 3), c = new Float32Array(TN * 2 * 3), idx = [];
    for (let k = 0; k < TN - 1; k++) { const a = k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide}));
    m.frustumCulled = false; scene.add(m);
    return {m, p, c, pts: [], color: new THREE.Color(i ? 0x6aa8ff : 0xff7a5a)};
  });
  const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3();

  const FX = {
    amount: 1, trailWidth: .09,
    sparks(p, n, color, speed, dirX) {
      n = Math.round(n * FX.amount); c3.set(color);
      for (let i = 0; i < n; i++) {
        const q = P[next], j = next * 3; next = (next + 1) % N;
        const a = Math.random() * 6.283, e = (Math.random() - .3) * 2.2, v = (0.6 + Math.random() * 2.6) * (speed || 1);
        q.vx = Math.cos(a) * Math.cos(e) * v + (dirX || 0) * 1.6; q.vy = Math.sin(e) * v + .8; q.vz = Math.sin(a) * Math.cos(e) * v;
        q.life = .22 + Math.random() * .32; q.t = 0; q.r = c3.r; q.g = c3.g; q.b = c3.b; q.grav = 5;
        pos[j] = p.x; pos[j + 1] = p.y; pos[j + 2] = p.z;
      }
    },
    sweat(p, n, dirX) {
      n = Math.round(n * FX.amount);
      for (let i = 0; i < n; i++) {
        const q = P[next], j = next * 3; next = (next + 1) % N;
        q.vx = dirX * (0.6 + Math.random() * 2.4) + (Math.random() - .5); q.vy = .6 + Math.random() * 2.2; q.vz = (Math.random() - .5) * 2.4;
        q.life = .35 + Math.random() * .4; q.t = 0; q.r = .55; q.g = .75; q.b = .95; q.grav = 8;
        pos[j] = p.x; pos[j + 1] = p.y; pos[j + 2] = p.z;
      }
    },
    flash(p, size, color, life) {
      const f = flashes.find(f => f.t >= f.life) || flashes[0];
      f.sp.position.copy(p); f.sp.material.color.set(color || 0xffffff); f.t = 0; f.life = life || .2; f.size = size; f.sp.material.rotation = Math.random() * 6; f.sp.visible = true;
    },
    ring(p, size, color) {
      const r = rings.find(r => r.t >= r.life) || rings[0];
      r.m.position.copy(p); r.m.material.color.set(color || 0xffffff); r.t = 0; r.life = .32; r.size = size; r.m.visible = true;
    },
    trailPush(i, p) { const t = trails[i]; t.pts.unshift(p.clone()); if (t.pts.length > TN) t.pts.pop(); t.idle = 0; },
    trailClear() { trails.forEach(t => { t.pts.length = 0; }); },
    update(dt, cam) {
      for (let i = 0; i < N; i++) {
        const q = P[i], j = i * 3;
        if (q.t >= q.life) { col[j] = col[j + 1] = col[j + 2] = 0; continue; }
        q.t += dt; q.vy -= q.grav * dt;
        pos[j] += q.vx * dt; pos[j + 1] += q.vy * dt; pos[j + 2] += q.vz * dt;
        if (pos[j + 1] < .02) { pos[j + 1] = .02; q.vy *= -.3; }
        const k = Math.max(0, 1 - q.t / q.life);
        col[j] = q.r * k; col[j + 1] = q.g * k; col[j + 2] = q.b * k;
      }
      geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
      for (const f of flashes) {
        if (f.t >= f.life) { f.sp.visible = false; continue; }
        f.t += dt; const k = Math.min(1, f.t / f.life);
        f.sp.scale.setScalar(f.size * (.35 + k * .9)); f.sp.material.opacity = (1 - k) * (1 - k);
      }
      for (const r of rings) {
        if (r.t >= r.life) { r.m.visible = false; continue; }
        r.t += dt; const k = Math.min(1, r.t / r.life);
        r.m.scale.setScalar(r.size * (.2 + k)); r.m.material.opacity = (1 - k) * .8; r.m.quaternion.copy(cam.quaternion);
      }
      for (const t of trails) {
        t.idle = (t.idle || 0) + dt;
        if (t.idle > .03 && t.pts.length) { t.pts.pop(); if (t.pts.length) t.pts.pop(); }
        const n = t.pts.length;
        for (let k = 0; k < TN; k++) {
          const a = k * 6;
          if (k >= n || n < 2) { for (let j = 0; j < 6; j++) { t.p[a + j] = n ? t.pts[0].getComponent(j % 3) : 0; t.c[a + j] = 0; } continue; }
          const p = t.pts[k], q = t.pts[Math.min(n - 1, k + 1)], pr = t.pts[Math.max(0, k - 1)];
          va.copy(pr).sub(q); vb.copy(cam.position).sub(p); vc.crossVectors(va, vb);
          const l = vc.length(); if (l > 1e-6) vc.multiplyScalar(1 / l); else vc.set(0, 1, 0);
          const f = 1 - k / n, w = FX.trailWidth * f;
          t.p[a] = p.x + vc.x * w; t.p[a + 1] = p.y + vc.y * w; t.p[a + 2] = p.z + vc.z * w;
          t.p[a + 3] = p.x - vc.x * w; t.p[a + 4] = p.y - vc.y * w; t.p[a + 5] = p.z - vc.z * w;
          const b = f * f * .9;
          for (let j = 0; j < 2; j++) { t.c[a + j * 3] = t.color.r * b; t.c[a + j * 3 + 1] = t.color.g * b; t.c[a + j * 3 + 2] = t.color.b * b; }
        }
        t.m.geometry.attributes.position.needsUpdate = true; t.m.geometry.attributes.color.needsUpdate = true;
      }
    }
  };
  return FX;
}
