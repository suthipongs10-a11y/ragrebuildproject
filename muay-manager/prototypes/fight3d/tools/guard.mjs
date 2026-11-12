// Where the gloves and elbows sit relative to the head while a fighter stands between exchanges in round 1, per attitude (cm). Usage: node tools/guard.mjs
import * as THREE from 'three';
globalThis.THREE = THREE;
const D = '../src/';
const { simulate, STATE } = await import(D + 'sim.js');
const { bake } = await import(D + 'timeline.js');
const { NP, IDX, FLAT } = await import(D + 'poses.js');
const { solve, makeJoints } = await import(D + 'rig.js');
const J = makeJoints(), P = new Float32Array(NP), out = {};
solve(FLAT.guard, 0, J);
const row = () => ({lx: (J.haL.x - J.head.x) * 100, ly: (J.haL.y - J.head.y) * 100, rx: (J.haR.x - J.head.x) * 100, ry: (J.haR.y - J.head.y) * 100, elDropL: (J.shL.y - J.elL.y) * 100, elDropR: (J.shR.y - J.elR.y) * 100, elOutL: (J.shL.z - J.elL.z) * 100, headY: J.head.y * 100, hipY: J.hip.y * 100});
const fmt = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, +v.toFixed(1)]));
out['ท่าการ์ดพื้นฐาน'] = fmt(row());
for (const ag of ['balanced', 'attack', 'counter']) {
  const acc = {}; let n = 0;
  for (let s = 1; s <= 6; s++) {
    const f = simulate({seed: s, plans: [[{ag, range: 'mixed', target: 'mixed'}], [{ag, range: 'mixed', target: 'mixed'}]]}), TL = bake(f);
    for (let k = 0; k < f.nTicks; k += 6) {
      if (f.ticks[(k * 2) * 9 + 4] !== STATE.idle || f.clock[k * 2] !== 1) continue;
      TL.sample(0, k * f.dt, P); if (P[IDX.jump] > .002) continue; solve(P, 0, J);
      const r = row(); for (const q in r) acc[q] = (acc[q] || 0) + r[q]; n++;
    }
  }
  for (const q in acc) acc[q] /= n; out[ag] = fmt(acc);
}
console.table(out);
