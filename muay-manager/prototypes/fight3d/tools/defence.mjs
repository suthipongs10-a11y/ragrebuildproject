// How strikes end, by kind: landed, blocked, dodged, out of range, caught. Also how many landed while the defender
// had his guard up at the right height (state 'cover'), which a viewer reads as a blocked shot. Usage: node tools/defence.mjs [fights]
import { simulate, STATE, TICK_FIELDS } from '../src/sim.js';
import { MOVES } from '../src/data.js';
const N = +(process.argv[2] || 2000), G = {}, grp = k => { const m = MOVES[k]; if (m.special) return 'ท่าไม้ตาย'; if (m.inClinch) return 'ในวงกอด';
  if (m.kind === 'punch') return m.sfx === 'elbow' ? 'ศอก' : m.lvl === 'head' ? 'หมัดหัว' : 'หมัดลำตัว';
  return k === 'knee' ? 'เข่า' : k === 'high' ? 'เตะสูง' : k === 'body' ? 'เตะลำตัว' : k === 'low' ? 'เตะขา' : k.startsWith('teep') ? 'ถีบ' : 'อื่น'; };
let pts = 0, ptsCover = 0;
for (let s = 1; s <= N; s++) {
  const f = simulate({seed: s});
  for (const e of f.events) {
    if (e.type !== 'hit' || MOVES[e.move].throw) continue;
    const g = G[grp(e.move)] = G[grp(e.move)] || {n: 0, hit: 0, block: 0, dodge: 0, miss: 0, catch: 0, coverHit: 0};
    g.n++; g[e.res]++;
    if (e.res === 'hit') {
      const k = Math.max(0, Math.round(e.t / f.dt) - 1), st = f.ticks[(k * 2 + e.on) * TICK_FIELDS + 4];
      if (st === STATE.cover) { g.coverHit++; ptsCover += [0, 1, 1, 2][e.sev]; }
      pts += [0, 1, 1, 2][e.sev];
    }
  }
}
const pc = (a, b) => (b ? (a / b * 100).toFixed(0) + '%' : '-');
console.table(Object.fromEntries(Object.entries(G).sort((a, b) => b[1].n - a[1].n).map(([k, g]) => [k, {'ต่อไฟต์': (g.n / N).toFixed(1), 'เข้า': pc(g.hit, g.n), 'บัง': pc(g.block, g.n), 'หลบ': pc(g.dodge, g.n), 'วืดระยะ': pc(g.miss, g.n), 'จับขา': pc(g.catch, g.n), 'เข้าทั้งที่ยกการ์ด': pc(g.coverHit, g.n)}])));
console.log('แต้มจากลูกที่เข้าตอนอีกฝ่ายยกการ์ดอยู่: ' + pc(ptsCover, pts) + ' ของแต้มจากการตีทั้งหมด');
