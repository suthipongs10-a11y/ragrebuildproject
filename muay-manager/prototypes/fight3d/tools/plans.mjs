// How much each corner plan changes the result when both fighters have the same stats.
// Usage: node tools/plans.mjs [fightsPerCell=400]
import { simulate } from '../src/sim.js';
import { STYLES, PLAN, STYLE_PLAN, PLAN_RULES } from '../src/data.js';
if (process.env.PR) Object.assign(PLAN_RULES, JSON.parse(process.env.PR));
const ME = process.env.ME || 'tech';
const N = +(process.argv[2] || 400), stats = {pow: 60, kick: 60, spd: 60, def: 60, end: 60, chin: 60};
const spec = (style, name) => ({name, first: name, style, stats, skin: 0});
function rate(me, opp, plan) {
  let w = 0;
  for (let i = 0; i < N; i++) {
    const flip = i % 2, specs = flip ? [spec(opp, 'B'), spec(me, 'A')] : [spec(me, 'A'), spec(opp, 'B')];
    const op = [STYLE_PLAN[opp]], plans = flip ? [op, [plan]] : [[plan], op]; // the opponent fights the way the game's rivals do
    if (simulate({seed: 1000 + i, specs, plans}).result.w === (flip ? 1 : 0)) w++;
  }
  return w / N * 100;
}
const out = {};
for (const opp of STYLES) {
  const base = rate(ME, opp.id, {ag: 'balanced', range: 'mixed', target: 'mixed'}), row = {};
  for (const ag in PLAN.ag) row['ag:' + ag] = (rate(ME, opp.id, {ag, range: 'mixed', target: 'mixed'}) - base).toFixed(0);
  for (const range in PLAN.range) row['rg:' + range] = (rate(ME, opp.id, {ag: 'balanced', range, target: 'mixed'}) - base).toFixed(0);
  for (const target in PLAN.target) row['tg:' + target] = (rate(ME, opp.id, {ag: 'balanced', range: 'mixed', target}) - base).toFixed(0);
  row.base = base.toFixed(0); out['vs ' + opp.th] = row;
}
if (process.argv.includes('--json')) { console.log(JSON.stringify(out)); process.exit(0); }
console.table(out);

// style against style at equal stats, default plans (row beats column, %)
const M = {};
for (const a of STYLES) { M[a.th] = {}; for (const b of STYLES) M[a.th][b.th] = a === b ? '-' : (() => { let w = 0; for (let i = 0; i < N; i++) { const flip = i % 2; const r = simulate({seed: 5000 + i, specs: flip ? [spec(b.id, 'B'), spec(a.id, 'A')] : [spec(a.id, 'A'), spec(b.id, 'B')]}).result; if (r.w === (flip ? 1 : 0)) w++; } return (w / N * 100).toFixed(0); })(); }
console.table(M);
