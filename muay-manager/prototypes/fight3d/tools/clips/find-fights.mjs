// Looks through many simulated fights for the ones worth a short clip (docs/TIKTOK_PLAN.md): a knockout, and the
// seconds before it full of action. The fights are the fight lab's (the same seed and plans as LAB.newFight(seed)), so
// tools/clips/render.mjs can play any of them back exactly.
// usage: node tools/clips/find-fights.mjs [count=4000] [from=1]       → the best 15, best first; --json for the list
import { simulate } from '../../src/sim.js';
import { MOVES } from '../../src/data.js';

const args = process.argv.slice(2).filter(a => !a.startsWith('--')), N = +args[0] || 4000, FROM = +args[1] || 1, JSON_OUT = process.argv.includes('--json');
const PLANS = [[{ag: 'attack', range: 'mixed', target: 'mixed'}], [{ag: 'counter', range: 'mixed', target: 'mixed'}]]; // the lab's corners (main.js OPT agR / agB)

// how good a clip the last stretch of a fight makes
export function rate(fight, win = 16) {
  const ev = fight.events, ko = ev.find(e => e.type === 'ko');
  if (!ko) return null;
  const t0 = ko.t - win, recent = ev.filter(e => e.t >= t0 && e.t <= ko.t);
  const big = recent.filter(e => e.type === 'hit' && e.res === 'hit' && e.sev >= 3).length;
  const landed = recent.filter(e => e.type === 'hit' && e.res === 'hit').length;
  const kds = ev.filter(e => e.type === 'kd'), kdLate = kds.filter(e => e.t >= t0).length;
  const special = MOVES[ko.move] && MOVES[ko.move].special; // ended by a signature move
  const specialsLate = recent.filter(e => e.type === 'move' && e.special).length;
  const comeback = kds.some(e => e.on === ko.by); // the winner had been down himself
  const score = 10 + big * 3 + landed * .5 + kdLate * 6 + (special ? 12 : 0) + specialsLate * 3 + (comeback ? 15 : 0) + (ko.how === 'น็อก' ? 4 : 0) - Math.max(0, fight.result.round - 2) * 2;
  return {seed: fight.seed, score: +score.toFixed(1), round: fight.result.round, koT: +ko.t.toFixed(2), how: ko.how, move: ko.move, moveTh: MOVES[ko.move] ? MOVES[ko.move].th : ko.move,
    special: !!special, by: ko.by, kds: kds.length, kdLate, big, landed, comeback, names: [0, 1].map(i => fight.specs ? fight.specs[i].name : '')};
}

if (import.meta.url === 'file://' + process.argv[1]) {
  const out = [];
  for (let s = FROM; s < FROM + N; s++) { const f = simulate({seed: s, plans: PLANS}); f.seed = s; const r = rate(f); if (r) out.push(r); }
  out.sort((a, b) => b.score - a.score);
  if (JSON_OUT) console.log(JSON.stringify(out.slice(0, 50)));
  else {
    console.log(`${out.length} knockouts in ${N} fights (seeds ${FROM}–${FROM + N - 1}); the best:`);
    for (const r of out.slice(0, 15)) console.log(`seed ${String(r.seed).padStart(5)}  score ${String(r.score).padStart(5)}  round ${r.round}  ${r.how} by ${r.moveTh}${r.special ? ' (signature)' : ''}  knockdowns ${r.kds} (${r.kdLate} late)  big hits ${r.big}${r.comeback ? '  COMEBACK' : ''}`);
  }
}
