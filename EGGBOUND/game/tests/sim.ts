// Determinism + balance sanity: run each stage many times with the default team.
import { simulate } from '../src/core/battle';
import { STAGES, planOf, stageOf, stageKey, DIFFS } from '../src/core/data';
import { eggTests } from './eggs';
import { passiveTests } from './passives';
import { runeTests } from './runes';
const team = (lvl: number, stars = 1) => ['A01', 'A02', 'A03', 'A04'].map(sid => ({ sid, lvl, stars }));
let fail = 0;
for (const st of STAGES) {
  const a = simulate(1234, team(5), st), b = simulate(1234, team(5), st);
  const same = a.rng === b.rng && a.log.join('|') === b.log.join('|');
  if (!same) { fail++; console.log('NON-DETERMINISTIC', st.id); }
}
// intended team per stage = the zone's recommended level (ZONE_PLAN in data.ts, also shown on the map); enemy multipliers
// were tuned so the starter team there wins ~85% (stage 1) → ~75% (stage 4) and ~62% against the zone boss
for (const st of STAGES) {
  const [lvl, ps] = planOf(st), N = 100;
  let w = 0, turns = 0, stars = 0, react = 0;
  for (let i = 0; i < N; i++) { const r = simulate(1000 + i, team(lvl, ps), st); if (r.win) w++; turns += r.turns; stars += r.stars; react += r.reactions; }
  console.log(`${st.id.padEnd(12)} team ★${ps} Lv${lvl}: win ${(w / N * 100).toFixed(0)}%  avgTurns ${(turns / N).toFixed(0)}  avgStars ${(stars / N).toFixed(2)}  reactions/battle ${(react / N).toFixed(1)}`);
}
console.log(fail ? 'DETERMINISM FAILED' : 'determinism OK');
// normal/hard (2026-10-14): each stage was tuned (DIFF_K) so the recommended team wins ~70-85%, bosses ~50%; guard
// against a stage drifting into "cannot be won" after balance changes
for (const d of [1, 2]) {
  const rates: [string, number][] = [];
  for (const base of STAGES) { const st = stageOf(stageKey(base.id, d))!, [lvl, ps] = planOf(st), N = 30; let w = 0; for (let i = 0; i < N; i++) if (simulate(3000 + i, team(lvl, ps), st).win) w++; rates.push([st.id, w / N]); }
  const bad = rates.filter(([, r]) => r < 0.2), lo = rates.reduce((a, b) => b[1] < a[1] ? b : a), hi = rates.reduce((a, b) => b[1] > a[1] ? b : a);
  console.log(`${DIFFS[d].name}: ${rates.length} stages, win ${Math.round(lo[1] * 100)}% (${lo[0]}) … ${Math.round(hi[1] * 100)}% (${hi[0]})`);
  if (bad.length) { fail++; console.log('DIFFICULTY OUT OF RANGE', bad.map(([id, r]) => `${id} ${Math.round(r * 100)}%`).join(', ')); }
}
fail += eggTests();
fail += passiveTests();
fail += runeTests();
(globalThis as any).process?.exit(fail ? 1 : 0);
