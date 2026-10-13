// Determinism + balance sanity: run each stage many times with the default team.
import { simulate } from '../src/core/battle';
import { STAGES } from '../src/core/data';
import { eggTests } from './eggs';
import { passiveTests } from './passives';
const team = (lvl: number, stars = 1) => ['A01', 'A02', 'A03', 'A04'].map(sid => ({ sid, lvl, stars }));
let fail = 0;
for (const st of STAGES) {
  const a = simulate(1234, team(5), st), b = simulate(1234, team(5), st);
  const same = a.rng === b.rng && a.log.join('|') === b.log.join('|');
  if (!same) { fail++; console.log('NON-DETERMINISTIC', st.id); }
}
// intended team level and stars per stage (starter team): map 1 at ★1, map 2 at ★2, map 3 at ★3 — the boss of each map wants the cap
const plan: Record<string, [number, number]> = { '1-1': [5, 1], '1-2': [7, 1], '1-3': [10, 1], '2-1': [5, 2], '2-2': [8, 2], '2-3': [14, 2], '2-4': [16, 2], '2-5': [17, 2], '2-6': [20, 2],
  '3-1': [5, 3], '3-2': [7, 3], '3-3': [12, 3], '3-4': [16, 3], '3-5': [18, 3], '3-6': [25, 3] };
for (const st of STAGES) {
  const [pl, ps] = plan[st.id] || [10, 1];
  for (const lvl of st.id[0] === '1' ? [pl - 1, pl, pl + 2] : [pl]) {
    let w = 0, turns = 0, stars = 0, react = 0; const N = st.id[0] === '1' ? 400 : 150;
    for (let i = 0; i < N; i++) { const r = simulate(1000 + i, team(lvl, ps), st); if (r.win) w++; turns += r.turns; stars += r.stars; react += r.reactions; }
    console.log(`${st.id} team ★${ps} Lv${lvl}: win ${(w / N * 100).toFixed(0)}%  avgTurns ${(turns / N).toFixed(0)}  avgStars ${(stars / N).toFixed(2)}  reactions/battle ${(react / N).toFixed(1)}`);
  }
}
console.log(fail ? 'DETERMINISM FAILED' : 'determinism OK');
fail += eggTests();
fail += passiveTests();
(globalThis as any).process?.exit(fail ? 1 : 0);
