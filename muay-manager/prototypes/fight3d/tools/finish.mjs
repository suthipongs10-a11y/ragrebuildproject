// How fights end: which blow finishes them. Usage: node tools/finish.mjs [fights=2000]
import { simulate } from '../src/sim.js';
import { MOVES, RULES } from '../src/data.js';
if (process.env.RULES) Object.assign(RULES, JSON.parse(process.env.RULES));
const N = +(process.argv[2] || 2000), by = {}, grp = {punch: 0, elbow: 0, highkick: 0, knee: 0, other: 0, special: 0};
let ko = 0, clinch = 0, catches = 0, ckHits = 0;
for (let i = 1; i <= N; i++) {
  const f = simulate({seed: i}), r = f.result;
  for (const e of f.events) { if (e.type === 'clinch') clinch++; if (e.type === 'hit' && e.res === 'catch') catches++; if (e.type === 'hit' && e.move === 'clinchKnee' && e.res === 'hit') ckHits++; }
  if (r.how === 'คะแนน') continue;
  ko++; by[r.move] = (by[r.move] || 0) + 1;
  const m = MOVES[r.move];
  grp[m.special ? 'special' : ['jab', 'cross', 'hook', 'upper', 'bodyshot', 'catchPunch', 'catchBody'].includes(r.move) ? 'punch' : ['elbow', 'spinElbow'].includes(r.move) ? 'elbow' : r.move === 'high' ? 'highkick' : ['knee', 'clinchKnee'].includes(r.move) ? 'knee' : 'other']++;
}
const pc = v => (v / ko * 100).toFixed(1) + '%';
console.log('stoppages', ko, 'of', N, '| clinches/fight', (clinch / N).toFixed(2), '| clinch knees landed/fight', (ckHits / N).toFixed(2), '| kick catches/fight', (catches / N).toFixed(2));
console.log(Object.entries(grp).map(([k, v]) => k + ' ' + pc(v)).join('  '));
console.log(Object.entries(by).sort((a, b) => b[1] - a[1]).map(([k, v]) => MOVES[k].th + ' ' + pc(v)).join('  '));
