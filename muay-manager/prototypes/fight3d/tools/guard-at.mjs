// Glove and head heights for one fighter at given times of a fight (cm, rig frame). Usage: node tools/guard-at.mjs seed fighter t1 t2 ...
import * as THREE from 'three';
globalThis.THREE = THREE;
const { simulate } = await import('../src/sim.js');
const { bake } = await import('../src/timeline.js');
const { NP, IDX } = await import('../src/poses.js');
const { solve, makeJoints } = await import('../src/rig.js');
const [seed, fi, ...ts] = process.argv.slice(2).map(Number), f = simulate({seed}), TL = bake(f), J = makeJoints(), P = new Float32Array(NP);
for (const t of ts) {
  TL.sample(fi, t, P); solve(P, 0, J); const k = Math.round(t / f.dt);
  console.log(t.toFixed(2), 'state', f.ticks[(k * 2 + fi) * 9 + 4], 'jump', (P[IDX.jump] * 100).toFixed(1), 'head', (J.head.y * 100).toFixed(0), 'gloveL-head', ((J.haL.y - J.head.y) * 100).toFixed(1), ((J.haL.x - J.head.x) * 100).toFixed(1), 'gloveR-head', ((J.haR.y - J.head.y) * 100).toFixed(1), ((J.haR.x - J.head.x) * 100).toFixed(1), 'lead foot', (P[IDX.fL + 1] * 100).toFixed(1));
}
