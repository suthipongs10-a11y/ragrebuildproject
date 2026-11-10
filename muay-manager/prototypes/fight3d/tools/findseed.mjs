// Finds sample fights that end in different ways, for the demo's opening picks. Usage: node tools/findseed.mjs [count]
import { simulate } from '../src/sim.js';
const want = {punch: ['cross', 'hook', 'upper'], highkick: ['high'], elbow: ['elbow', 'spinElbow'], special: ['spCroc', 'spKick', 'spFly', 'spChop', 'spHanu']}, out = {punch: [], highkick: [], elbow: [], special: [], decision: []};
for (let seed = 1; seed <= +(process.argv[2] || 4000); seed++) {
  const f = simulate({seed}), r = f.result, ev = f.events;
  const clinch = ev.filter(e => e.type === 'clinch').length, catches = ev.filter(e => e.type === 'hit' && e.res === 'catch').length, kd = r.kd[0] + r.kd[1];
  if (clinch < 1 || catches < 1 || r.leadChanges < 1 || f.specs[0].style === f.specs[1].style) continue;
  const ko = ev.find(e => e.type === 'ko'), byBlow = ko && ev.some(e => e.type === 'hit' && e.res === 'hit' && e.t === ko.t);
  const line = `${seed} R${r.round} ${r.move || 'pts'} ${f.specs[0].style} v ${f.specs[1].style} kd ${r.kd} clinch ${clinch} catch ${catches}`;
  if (r.how === 'คะแนน') { if (kd >= 1 && Math.abs(r.pts[0] - r.pts[1]) < 12) out.decision.push(line); continue; }
  if (!byBlow || r.round < 2) continue;
  for (const k in want) if (want[k].includes(r.move)) out[k].push(line);
}
for (const k in out) console.log(k + ':\n  ' + out[k].slice(0, 4).join('\n  '));
