// Determinism + balance sanity: run each stage many times with the default team.
import { simulate } from '../src/core/battle';
import { STAGES, SPECIES, planOf, stageOf, stageKey, DIFFS, HELL, HELL_MIN } from '../src/core/data';
import { kitBonus } from '../src/core/runes';
import { eggTests } from './eggs';
import { passiveTests } from './passives';
import { runeTests } from './runes';
import { mechanicsTests } from './mechanics';
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
// hell (2026-10-14, "สุดโหด", awakened enemies): every wave ≥ HELL_MIN runed, awakened monsters; the recommended team
// wearing the BEST rune kit (★6 +12) wins some (tuned ~35% → boss ~10%), without runes it practically never wins
{ const kit = (st: any) => { const [lvl, stars] = planOf(st); return ['A01', 'A02', 'A03', 'A04'].map(sid => ({ sid, lvl, stars, rb: kitBonus(SPECIES[sid].role, 6, 12) })); };
  const rates: [string, number][] = []; let bare = 0, shape = true, n = 0;
  for (const base of STAGES) { const st = stageOf(stageKey(base.id, HELL))!, [lvl, ps] = planOf(st), N = 30; let w = 0;
    if (!st.waves.every(wv => wv.length >= HELL_MIN && wv.every(m => !!m.rb && m.awake))) shape = false;
    for (let i = 0; i < N; i++) { if (simulate(5100 + i, kit(st), st).win) w++; if (base.n % 2 && simulate(5100 + i, team(lvl, ps), st).win) bare++; }
    rates.push([st.id, w / N]); if (base.n % 2) n += N; }
  const lo = rates.reduce((a, b) => b[1] < a[1] ? b : a), hi = rates.reduce((a, b) => b[1] > a[1] ? b : a);
  const avg = rates.reduce((t, r) => t + r[1], 0) / rates.length;
  console.log(`${DIFFS[HELL].name}: ${rates.length} stages, best-rune team avg ${Math.round(avg * 100)}%, ${Math.round(lo[1] * 100)}% (${lo[0]}) … ${Math.round(hi[1] * 100)}% (${hi[0]}) · without runes ${Math.round(bare / n * 100)}%`);
  if (!shape) { fail++; console.log('HELL: a wave with fewer than ' + HELL_MIN + ' monsters, or not awakened / without runes'); }
  if (avg < 0.08 || avg > 0.6 || hi[1] > 0.85 || bare / n > 0.05) { fail++; console.log('HELL OUT OF RANGE'); } }
fail += eggTests();
fail += passiveTests();
fail += runeTests();
fail += mechanicsTests();
(globalThis as any).process?.exit(fail ? 1 : 0);
