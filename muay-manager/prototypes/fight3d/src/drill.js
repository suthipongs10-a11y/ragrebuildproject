// Training drill: one fighter working a target (heavy bag, banana tree or standing dummy), or sparring with a camp
// partner who covers up from his strikes and throws his own for him to block.
// Presentation only. The game layer decides which strike is thrown and scores the timing;
// this plays the strike, lands it on the target and makes the target react.
import { FLAT, NP, IDX } from './poses.js';
import { MOVES } from './data.js';
import { makeJoints, EFF_JOINT, DIM, solve } from './rig.js';
import { aimEffector } from './timeline.js';
import { bananaTree } from './arena.js';
const THREE = globalThis.THREE;

// what can be thrown at each target: the bag hangs too high for a low kick, a tree trunk has no chin for a hook
export const TARGETS = {
  bag: {th: 'กระสอบทราย', moves: {punch: ['jab', 'cross', 'hook', 'bodyshot'], kick: ['body', 'high', 'body'], teep: ['teep', 'teepFace']}},
  banana: {th: 'ต้นกล้วย', moves: {punch: ['jab', 'cross'], kick: ['low', 'body', 'low', 'high'], teep: ['teep']}},
  dummy: {th: 'หุ่นซ้อม', moves: {punch: ['jab', 'cross', 'hook', 'bodyshot'], kick: ['body', 'high', 'low'], teep: ['teep', 'teepFace']}},
  skip: {th: 'กระโดดเชือก', moves: {jump: ['jump'], punch: ['jab', 'cross', 'hook', 'upper'], kick: ['high', 'body', 'teepFace']}},
  spar: {th: 'คู่ซ้อม', moves: {punch: ['jab', 'cross', 'hook', 'bodyshot'], kick: ['body', 'low', 'body'], teep: ['teep'], guard: []}, partner: ['jab', 'cross', 'body', 'jab', 'teep', 'hook', 'low']}
};
const FIGHTER_X = -.5, TARGET_X = .5, DIST = TARGET_X - FIGHTER_X, SPEED = .8;
const SPAR_X = .62, SDIST = SPAR_X - FIGHTER_X; // the sparring partner stands a little further off, at punching range
// how each side covers a strike: by where it lands
const COVER = mv => mv.kind === 'kick' && mv.lvl === 'leg' ? 'check' : mv.kind === 'kick' && mv.lvl === 'body' && mv.push < 20 ? 'checkBody' : mv.lvl === 'body' ? 'blockBody' : 'block';
const ease = k => k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
const std = o => new THREE.MeshStandardMaterial(Object.assign({roughness: .8}, o));
function tex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
function mesh(g, geo, mat, x, y, z) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; }

// Each target: a group, the radius of its surface at a height, and a spring that swings or wobbles it.
function makeBag(beamY) {
  const g = new THREE.Group(), piv = new THREE.Group(); piv.position.y = beamY; g.add(piv);
  const top = 1.84, len = 1.16, r = .2;
  const skin = tex(512, 512, (c, w, h) => {
    c.fillStyle = '#8a221b'; c.fillRect(0, 0, w, h); c.fillStyle = '#1b1b20'; c.fillRect(0, 0, w, 70); c.fillRect(0, h - 70, w, 70);
    for (let i = 0; i < 60; i++) { c.fillStyle = 'rgba(' + (i % 2 ? '255,200,180' : '30,5,5') + ',' + (.03 + (i * 37 % 10) / 120) + ')'; c.fillRect((i * 97) % w, 70 + (i * 53) % (h - 180), 20 + (i * 13) % 60, 10 + (i * 7) % 40); }
    c.fillStyle = 'rgba(255,224,150,.9)'; c.font = 'italic 800 64px Kanit, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('มวยไทย', w / 4, h / 2); c.fillText('มวยไทย', w * 3 / 4, h / 2);
  });
  mesh(piv, new THREE.CylinderGeometry(r, r, len, 20), std({map: skin, roughness: .55}), 0, top - len / 2 - beamY, 0);
  mesh(piv, new THREE.SphereGeometry(r, 20, 8, 0, 7, Math.PI / 2, Math.PI / 2), std({color: 0x1b1b20, roughness: .55}), 0, top - len - beamY, 0);
  const steel = std({color: 0x595d66, metalness: .6, roughness: .45});
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + .78, s = mesh(piv, new THREE.CylinderGeometry(.008, .008, .34, 4), steel, Math.cos(a) * r * .5, top + .14 - beamY, Math.sin(a) * r * .5); s.rotation.set(Math.sin(a) * .55, 0, -Math.cos(a) * .55); }
  mesh(piv, new THREE.CylinderGeometry(.012, .012, beamY - top - .28, 5), steel, 0, -(beamY - top - .28) / 2, 0);
  return {group: g, sway: piv, radius: () => r, w: 2.6, damp: 1.3, gain: .065, max: .26, chips: 0xe8dcc0};
}
function makeBanana() {
  const g = bananaTree(1.72);
  g.userData.trunk.castShadow = true;
  return {group: g, sway: g, radius: y => .13 - y * .02, w: 10, damp: 4.5, gain: .5, max: .16, leaves: g.userData.leaves, chips: 0xa8d070};
}
function makeDummy() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  mesh(g, new THREE.CylinderGeometry(.36, .4, .12, 20), std({color: 0x1d1d22}), 0, .06, 0);
  const hide = tex(256, 256, (c, w, h) => {
    c.fillStyle = '#b07c48'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 80; i++) { c.fillStyle = 'rgba(' + (i % 2 ? '70,40,15' : '235,200,150') + ',' + (.04 + (i * 31 % 10) / 110) + ')'; c.fillRect((i * 89) % w, (i * 57) % h, 8 + (i * 11) % 40, 4 + (i * 5) % 22); }
    c.strokeStyle = 'rgba(245,240,225,.9)'; c.lineWidth = 5; for (const x of [w / 4, w * 3 / 4]) { c.beginPath(); c.arc(x, h * .45, 30, 0, 7); c.stroke(); c.beginPath(); c.arc(x, h * .45, 9, 0, 7); c.stroke(); }
  });
  const leather = std({map: hide, roughness: .6});
  mesh(body, new THREE.CylinderGeometry(.1, .1, .62, 12), std({color: 0x24242a, roughness: .6}), 0, .43, 0);     // padded leg post
  mesh(body, new THREE.CapsuleGeometry(.19, .44, 6, 16), leather, 0, 1.12, 0).scale.set(1, 1, 1.25);              // torso
  const plain = std({color: 0xa87442, roughness: .6});
  mesh(body, new THREE.CylinderGeometry(.07, .09, .12, 10), plain, 0, 1.47, 0);
  mesh(body, new THREE.SphereGeometry(.115, 16, 12), plain, 0, 1.6, 0).scale.set(1, 1.15, 1);                    // head
  for (const z of [-.3, .3]) mesh(body, new THREE.SphereGeometry(.09, 10, 8), plain, 0, 1.3, z);                 // shoulders
  return {group: g, sway: body, radius: y => y > 1.47 ? .115 : y > .8 ? .19 : .1, w: 8, damp: 1.5, gain: .34, max: .3, chips: 0xe8dcc0};
}
const MAKE = {bag: makeBag, banana: makeBanana, dummy: makeDummy};

export function buildDrill(scene, fx, audio) {
  const D = {on: false, kick: 0, shake: 0, onImpact: null};
  const cur = new Float32Array(NP), from = new Float32Array(NP), J = makeJoints(), pt = new THREE.Vector3(), wp = new THREE.Vector3();
  let fighter = null, T = null, built = {}, queue = [], to = null, pt0 = 0, pd = .001, live = null, ax = 0, az = 0, vx = 0, vz = 0, shakeT = 0, lastKey = '';

  // sparring partner: his own pose, a strike queue of his own, and who is covering up
  let partner = null, pq = [], pto = null, ppt = 0, ppd = .001, plive = null;
  const pcur = new Float32Array(NP), pfrom = new Float32Array(NP), PP = new Float32Array(NP), J2 = makeJoints();
  D.start = function (f, key, beamY, mate) {
    D.stop(); fighter = f; D.on = true;
    if (key === 'skip') { skip = {t0: 0, cross: [], hopT: -9, tripT: -9, rope: null}; lastKey = key; T = null; cur.set(FLAT.skip); queue = []; to = null; live = null; return; }
    skip = null;
    if (key === 'spar') { partner = mate; lastKey = key; T = null; cur.set(FLAT.guard); pcur.set(FLAT.guard); queue = []; to = null; live = null; pq = []; pto = null; plive = null; return; }
    const id = key + (key === 'bag' ? beamY : '');
    if (!built[id]) { built[id] = MAKE[key](beamY || 3.25); built[id].group.position.set(TARGET_X, 0, 0); scene.add(built[id].group); }
    T = built[id]; T.group.visible = true; lastKey = key;
    cur.set(FLAT.guard); queue = []; to = null; live = null; ax = az = vx = vz = 0; shakeT = 0;
  };
  D.stop = function () { D.on = false; fighter = null; partner = null; if (skip && skip.rope) { scene.remove(skip.rope); skip.rope.geometry.dispose(); } skip = null; if (T) T.group.visible = false; T = null; };
  // Skipping rope. The game gives the times (seconds from the start) the rope passes under the feet; a jump pressed
  // near one clears it, a pass with no jump catches the feet.
  let skip = null;
  const ropeMat = new THREE.MeshStandardMaterial({color: 0xd23a2a, roughness: .6}), ropeCurve = new THREE.CatmullRomCurve3(Array.from({length: 17}, () => new THREE.Vector3()));
  D.skipPlan = function (t0, cross) { if (skip) { skip.t0 = t0; skip.cross = cross; } };
  D.trip = function () { if (skip) skip.tripT = performance.now() / 1000; };
  function ropePhase(now) { // angle of the rope: 0 over the head, pi under the feet
    const c = skip.cross, el = now - skip.t0, LAG = .08;
    if (!c.length || el > c[c.length - 1] + LAG + .3) return null; // the rope is put down for the shadowboxing
    let k = 0; while (k < c.length - 1 && c[k + 1] + LAG <= el) k++;
    const a = c[k] + LAG, b = k < c.length - 1 ? c[k + 1] + LAG : a + (k ? c[k] - c[k - 1] : .6);
    if (el < c[0] + LAG) { const p = c.length > 1 ? c[1] - c[0] : .6; return Math.PI - 2 * Math.PI * (a - el) / p; }
    return Math.PI + 2 * Math.PI * (el - a) / (b - a);
  }
  function drawRope(now) {
    const ph = ropePhase(now);
    if (ph == null) { if (skip.rope) skip.rope.visible = false; return; }
    const tripped = now - skip.tripT < .7, phi = tripped ? Math.PI * .97 : ph; // caught on the feet for a moment
    fighter.world('haL', pt); fighter.world('haR', wp);
    const pts = ropeCurve.points, R = .98;
    for (let i = 0; i <= 16; i++) {
      const s = i / 16, b = Math.sin(Math.PI * s), x = pt.x + (wp.x - pt.x) * s, y = pt.y + (wp.y - pt.y) * s, z = pt.z + (wp.z - pt.z) * s;
      pts[i].set(x + Math.sin(phi) * R * b * .55, Math.max(.01, y + Math.cos(phi) * R * b), z);
    }
    const geo = new THREE.TubeGeometry(ropeCurve, 40, .013, 6, false);
    if (!skip.rope) { skip.rope = new THREE.Mesh(geo, ropeMat); skip.rope.castShadow = true; scene.add(skip.rope); } else { skip.rope.geometry.dispose(); skip.rope.geometry = geo; }
    skip.rope.visible = true;
  }
  D.key = () => lastKey;

  // throw a strike; returns seconds until it lands
  D.strike = function (moveKey) {
    if (skip && moveKey === 'jump') { skip.hopT = performance.now() / 1000; audio.swish(false); return .1; }
    const mv = MOVES[moveKey]; if (!mv || !D.on) return 0;
    if (skip) { queue = mv.fr.map(f => ({target: FLAT[f[0]] || FLAT.guard, d: f[1] * SPEED, hit: false})).concat([{target: FLAT.guard, d: .3}]); live = {mv, key: moveKey}; next(); audio.swish(mv.kind === 'kick'); return (mv.fr[0][1] + mv.fr[1][1]) * SPEED; } // shadowboxing: into the air
    queue = mv.fr.map((f, i) => {
      let target = FLAT[f[0]] || FLAT.guard;
      if (i === 1 && partner) { target = new Float32Array(target); aimEffector(target, mv.eff, sparPoint(pcur, mv), J); }
      else if (i === 1) { // land the striking part on the target's surface
        target = new Float32Array(target);
        const hand = mv.eff.startsWith('hand'), base = IDX[(hand ? 'h' : 'f') + mv.eff.slice(-1)], y = target[base + 1] + (hand ? 0 : DIM.ankle), r = T.radius(y);
        if (moveKey === 'hook') pt.set(DIST - r * .45, y, -r * .9);
        else if (mv.kind === 'kick' && mv.eff === 'footR' && !/teep/.test(moveKey)) pt.set(DIST - r * .5, y, r * .85);
        else pt.set(DIST - r, y, 0);
        aimEffector(target, mv.eff, pt, J);
      }
      return {target, d: f[1] * SPEED, hit: i === 1};
    });
    live = {mv, key: moveKey}; next();
    if (partner) cover(true, mv, mv.fr[0][1] * SPEED);
    if (mv.kind === 'kick') audio.swish(false);
    return (mv.fr[0][1] + mv.fr[1][1]) * SPEED;
  };
  // where a strike lands on the other man, in the striker's own frame (the other faces him)
  function sparPoint(other, mv) {
    solve(other, 0, J2);
    const j = mv.lvl === 'leg' ? J2.knL : mv.lvl === 'body' || /teep|body/.test(mv.kind) ? J2.chest : J2.head;
    return pt.set(SDIST - j.x - .1, j.y - (mv.lvl === 'body' ? .12 : 0), -j.z);
  }
  // one side covers up (partner: from our strike, us: from his) for a moment, then back to the guard
  function cover(isPartner, mv, lead) {
    const pose = FLAT[COVER(mv)] || FLAT.block, q = [{target: pose, d: Math.max(.08, lead * .6)}, {target: pose, d: .3}];
    if (isPartner) { pq = q; pnext(); } else { queue = q; live = null; next(); }
  }
  function pnext() { const q = pq.shift(); if (!q) { pto = null; return; } pfrom.set(pcur); pto = q; ppt = 0; ppd = q.d; }
  // the partner throws: returns seconds until it lands; guarded() says at that moment whether we covered in time
  D.incoming = function (moveKey, guarded) {
    const mv = MOVES[moveKey]; if (!mv || !partner) return 0;
    pq = mv.fr.map((f, i) => {
      let target = FLAT[f[0]] || FLAT.guard;
      if (i === 1) { target = new Float32Array(target); aimEffector(target, mv.eff, sparPoint(cur, mv), J); }
      return {target, d: f[1] * SPEED, hit: i === 1};
    });
    plive = {mv, key: moveKey, guarded}; pnext();
    if (mv.kind === 'kick') audio.swish(false);
    return (mv.fr[0][1] + mv.fr[1][1]) * SPEED;
  };
  // we cover up from whatever he is throwing (or a plain high guard)
  D.guard = function () { if (!partner) return; cover(false, plive ? plive.mv : MOVES.jab, .12); };
  function pimpact() {
    const mv = plive.mv, ok = plive.guarded ? plive.guarded() : false, j = mv.kind === 'kick' ? 'anR' : EFF_JOINT[mv.eff] || 'haR';
    partner.world(j, wp);
    if (ok) { audio.block(); fx.sparks(wp, 4, 0xffffff, .6, 1); }
    else { // caught clean: a light one in sparring, but it shows
      queue = [{target: FLAT[mv.lvl === 'body' ? 'hitBody' : 'hitHeadBack'] || FLAT.guard, d: .1}, {target: FLAT.guard, d: .35}]; live = null; next();
      audio.hit(mv.sfx, mv.dmg * .7, false); fx.flash(wp, .4, 0xffffff, .12); D.shake = Math.max(D.shake, .01); D.kick = Math.max(D.kick, .015);
    }
    plive = null;
  }
  function next() { const q = queue.shift(); if (!q) { to = null; return; } from.set(cur); to = q; pt0 = 0; pd = q.d; }
  function impact() {
    if (partner) { const mv = live.mv; fighter.world(EFF_JOINT[mv.eff], wp); audio.block(); audio.hit(mv.sfx, mv.dmg * .5, false); fx.sparks(wp, 5, 0xffffff, .7, 1); D.kick = Math.max(D.kick, .01); if (D.onImpact) D.onImpact(live.key, wp); return; }
    const mv = live.mv, side = /teep|jab|cross|bodyshot/.test(live.key) ? 0 : live.key === 'hook' ? 1 : -1;
    fighter.world(EFF_JOINT[mv.eff], wp);
    const pow = mv.dmg / 12;
    vx += T.gain * pow * (side ? .55 : 1) * 9; vz += T.gain * pow * side * 6;
    fx.sparks(wp, 6 + Math.round(pow * 8), pow > 1 ? 0xffd35a : T.chips, .9 + pow * .4, 1);
    fx.flash(wp, .35 + pow * .45, 0xffffff, .14);
    if (pow > 1) fx.ring(wp, .5, 0xffffff);
    audio.hit(mv.sfx, mv.dmg * 1.25, false);
    D.kick = Math.max(D.kick, .012 + pow * .018); D.shake = Math.max(D.shake, pow * .012); shakeT = .5;
    if (D.onImpact) D.onImpact(live.key, wp);
  }

  // advances the fighter's pose into P and animates the target
  D.update = function (dt, time, P) {
    if (!D.on) return;
    if (to) {
      pt0 += dt; const e = ease(Math.min(1, pt0 / pd));
      for (let j = 0; j < NP; j++) cur[j] = from[j] + (to.target[j] - from[j]) * e;
      if (pt0 >= pd) { const hit = to.hit; if (hit) impact(); next(); }
    } else { // back to the guard (or the skipping stance), bouncing on the lead foot
      const now = performance.now() / 1000, roping = skip && ropePhase(now) != null, k = 1 - Math.exp(-dt * 12), G = roping ? FLAT.skip : FLAT.guard;
      for (let j = 0; j < NP; j++) cur[j] += (G[j] - cur[j]) * k;
    }
    P.set(cur);
    if (skip) {
      const now = performance.now() / 1000, h = now - skip.hopT, tr = now - skip.tripT;
      if (h >= 0 && h < .32) { const u = h / .32, up = Math.sin(Math.PI * u); P[IDX.jump] += up * .13; P[IDX.fL + 1] += up * .05; P[IDX.fR + 1] += up * .05; P[IDX.hip + 1] -= Math.max(0, .02 - u * .08); } // off the ground, knees tucked a little
      if (tr >= 0 && tr < .7) { const u = Math.sin(Math.PI * tr / .7); P[IDX.lean] += .22 * u; P[IDX.hip + 1] -= .06 * u; P[IDX.fR] += .08 * u; } // stumbles over the rope
      fighter.update(P, 0, FIGHTER_X + .45);
      drawRope(now);
      D.kick *= Math.pow(.002, dt); D.shake *= Math.pow(.0006, dt);
      return;
    }
    if (!to) { const b = time * 5.2; P[IDX.fL + 1] += Math.max(0, Math.sin(b)) * .04; P[IDX.hip + 1] += Math.sin(b) * .012; P[IDX.hL] += Math.sin(b * .5) * .02; }
    fighter.update(P, 0, FIGHTER_X);
    if (partner) {
      if (pto) {
        ppt += dt; const e = ease(Math.min(1, ppt / ppd));
        for (let j = 0; j < NP; j++) pcur[j] = pfrom[j] + (pto.target[j] - pfrom[j]) * e;
        if (ppt >= ppd) { const hit = pto.hit; if (hit && plive) pimpact(); pnext(); }
      } else { const k = 1 - Math.exp(-dt * 10), G = FLAT.guard; for (let j = 0; j < NP; j++) pcur[j] += (G[j] - pcur[j]) * k; }
      PP.set(pcur);
      if (!pto) { const b = time * 5.2 + 1.3; PP[IDX.fL + 1] += Math.max(0, Math.sin(b)) * .04; PP[IDX.hip + 1] += Math.sin(b) * .012; }
      partner.update(PP, 0, SPAR_X);
      D.kick *= Math.pow(.002, dt); D.shake *= Math.pow(.0006, dt);
      return;
    }
    // target spring
    const w2 = T.w * T.w;
    vx += (-w2 * ax - T.damp * vx) * dt; vz += (-w2 * az - T.damp * vz) * dt; ax += vx * dt; az += vz * dt;
    ax = Math.max(-T.max, Math.min(T.max, ax)); az = Math.max(-T.max, Math.min(T.max, az));
    T.sway.rotation.z = (T.sway === T.group || lastKey === 'dummy') ? -ax : ax;   // hung from above swings the other way round from something planted
    T.sway.rotation.x = (T.sway === T.group || lastKey === 'dummy') ? az : -az;
    if (T.leaves) { shakeT = Math.max(0, shakeT - dt); T.leaves.forEach((l, i) => { l.rotation.z = Math.sin(time * 21 + i * 1.7) * .16 * shakeT * 2 + Math.sin(time * 1.3 + i) * .03; }); }
    D.kick *= Math.pow(.002, dt); D.shake *= Math.pow(.0006, dt);
  };
  return D;
}
