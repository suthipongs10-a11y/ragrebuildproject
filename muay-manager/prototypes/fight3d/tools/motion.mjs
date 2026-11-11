// How much the fighters move on their own between exchanges, per attitude. Usage: node tools/motion.mjs [fights=20]
// Reports, as a share of fighting time: time spent free to move (idle), time in the air from the bounce, and how far the
// head travels up-down, side to side and front to back while idle (cm, 5th to 95th percentile), and its average speed.
import * as THREE from 'three';
globalThis.THREE = THREE;
const { simulate, STATE } = await import('../src/sim.js');
const { bake } = await import('../src/timeline.js');
const { NP, IDX } = await import('../src/poses.js');
const { solve, makeJoints } = await import('../src/rig.js');
const N = +(process.argv[2] || 20), AG = ['balanced', 'attack', 'counter'], TH = {balanced: 'ดูเชิง', attack: 'เดินตี', counter: 'ตั้งรับ'};
const out = {}, J = makeJoints(), P = new Float32Array(NP);
const pct = (a, q) => { if (!a.length) return 0; a.sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(a.length * q))]; };
for (const ag of AG) {
  let fightT = 0, idleT = 0, airT = 0, hops = 0, sp = 0, spN = 0, last = null; const hy = [], hz = [], hx = [];
  for (let s = 1; s <= N; s++) {
    const pl = [{ag, range: 'mixed', target: 'mixed'}], f = simulate({seed: s, plans: [pl, [{ag: 'balanced', range: 'mixed', target: 'mixed'}]]}), TL = bake(f);
    let prevUp = false;
    for (let k = 0; k < f.nTicks; k += 2) {
      const st = f.ticks[(k * 2) * 9 + 4]; if (st === STATE.intro || st === STATE.rest || st === STATE.win || st === STATE.ko || st === STATE.down || st === STATE.getup) { prevUp = false; continue; }
      fightT++; TL.sample(0, k * f.dt, P);
      const up = P[IDX.jump] > .004; if (up) airT++; if (up && !prevUp) hops++; prevUp = up;
      if (st !== STATE.idle) { last = null; continue; }
      idleT++; solve(P, 0, J); const h = [J.head.x, J.head.y + P[IDX.jump], J.head.z]; hy.push(h[1]); hz.push(h[2]); hx.push(h[0]);
      if (last) { sp += Math.hypot(h[0] - last[0], h[1] - last[1], h[2] - last[2]) / (2 * f.dt); spN++; } last = h;
    }
  }
  const span = a => Math.round((pct(a, .95) - pct(a, .05)) * 100);
  out[TH[ag]] = {'ว่าง (ยืนคุมเชิง)': (idleT / fightT * 100).toFixed(0) + '%', 'ลอยจากการเด้ง': (airT / fightT * 100).toFixed(0) + '%', 'เด้งต่อนาที': (hops / (fightT * 2 / 60) * 60).toFixed(0), 'หัวขึ้นลง ซม.': span(hy), 'หัวซ้ายขวา ซม.': span(hz), 'หัวหน้าหลัง ซม.': span(hx), 'ความเร็วหัวเฉลี่ย ซม./วิ': Math.round(sp / spN * 100)};
}
console.table(out);
