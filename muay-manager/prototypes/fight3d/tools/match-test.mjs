// Checks of src/match.js, the part of a match the browser and the server share: what a player sends is cleaned the same
// way whatever it holds, the fight worked out from it is always the same one, and the rests fall where the clock of a
// live match expects them.  usage: node tools/match-test.mjs
import { simulate } from '../src/sim.js';
import { LIVE, PLAN_DEFAULT, SPECIALS, SP_MAX } from '../src/data.js';
import { cleanPlan, cleanSpec, cleanStats, matchCfg, restWalls, STAT_KEYS } from '../src/match.js';

let bad = 0;
const ok = (cond, what) => { if (!cond) { bad++; console.log('FAIL: ' + what); } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// plans: anything that is not a choice becomes the default; real choices are kept
for (const junk of [null, undefined, 7, 'attack', [], {ag: 'win', range: 9, target: null}, {ag: ['attack'], range: ['in']}, {ag: 'constructor', range: 'toString', target: '__proto__'}, {ag: {toString: () => 'attack'}}]) ok(same(cleanPlan(junk), PLAN_DEFAULT), 'plan from ' + JSON.stringify(junk));
ok(same(cleanPlan({ag: 'attack', range: 'in', target: 'leg', extra: 1}), {ag: 'attack', range: 'in', target: 'leg'}), 'a real plan is kept, extra fields dropped');

// stats: whole numbers 20..100 whatever comes in
for (const junk of [null, 'x', {pow: 1e9, kick: -5, spd: NaN, def: '77', end: 55.6, chin: null}, {pow: Infinity}, []]) {
  const st = cleanStats(junk); ok(STAT_KEYS.every(k => Number.isInteger(st[k]) && st[k] >= 20 && st[k] <= 100) && Object.keys(st).length === STAT_KEYS.length, 'stats from ' + JSON.stringify(junk));
}
ok(same(cleanStats({pow: 1e9, kick: -5, spd: NaN, def: '77', end: 55.6, chin: null}), {pow: 100, kick: 20, spd: 40, def: 77, end: 56, chin: 40}), 'stats are clamped and rounded');

// a fighter: known style, at most three known signature moves, levels 1..SP_MAX
const wild = cleanSpec({style: 'god', stats: {pow: 999}, sp: ['spKick', 'nuke', 'spFly', 'spChop', 'spHanu', 'spKick'], spLv: {spKick: 99, spFly: -3, nuke: 5, spChop: 'x'}, hp: 1e6}, 'ทดสอบ');
ok(wild.style === 'tech' && wild.stats.pow === 100 && wild.sp.length === 3 && wild.sp.every(k => SPECIALS.includes(k)), 'a fighter with made-up values is brought into range');
ok(Object.keys(wild.spLv).every(k => SPECIALS.includes(k) && wild.spLv[k] >= 1 && wild.spLv[k] <= SP_MAX) && !('hp' in wild), 'signature levels in range, unknown fields dropped');
ok(same(cleanSpec(null, 'ก'), cleanSpec({}, 'ก')) && cleanSpec('str', 'ก').style === 'tech', 'a fighter from nothing');

// the fight: a round with no plan of its own keeps the one before; the same input gives the same fight
const A = {name: 'แดง', spec: {style: 'puncher', stats: {pow: 60, kick: 40, spd: 50, def: 45, end: 50, chin: 50}, sp: ['spChop'], spLv: {spChop: 2}}, plans: [{ag: 'attack', range: 'in', target: 'head'}]};
const B = {name: 'น้ำเงิน', spec: {style: 'kicker', stats: {pow: 40, kick: 60, spd: 50, def: 45, end: 50, chin: 45}}, plans: [{ag: 'counter', range: 'out', target: 'leg'}, null, {ag: 'attack', range: 'mixed', target: 'body'}]};
const cfg = matchCfg(4242, [A, B], 'temple');
ok(same(cfg.plans[0], [A.plans[0], A.plans[0], A.plans[0]]), 'one plan serves all three rounds');
ok(same(cfg.plans[1], [B.plans[0], B.plans[0], B.plans[2]]), 'a missing round keeps the plan before it');
ok(matchCfg(0, [A, B], 'nowhere').seed === 1 && matchCfg(0, [A, B], 'nowhere').rules === null && matchCfg(1, [A, B], 'constructor').rules === null && matchCfg(1, [A, B], 'chuek').rules, 'no seed becomes 1, an unknown venue has no special rules');
ok(same(simulate(cfg).result, simulate(matchCfg(4242, [JSON.parse(JSON.stringify(A)), JSON.parse(JSON.stringify(B))], 'temple')).result), 'the same match twice is the same fight');
// a later round's plan does not change the rounds already fought
{ const f1 = simulate(cfg), f2 = simulate(matchCfg(4242, [Object.assign({}, A, {plans: [A.plans[0], {ag: 'counter', range: 'out', target: 'leg'}]}), B], 'temple'));
  const w1 = restWalls(f1), cut = f1.events.find(e => e.type === 'phase' && e.phase === 'rest');
  if (cut) { const head = f => JSON.stringify(f.events.filter(e => e.t <= cut.t)); ok(head(f1) === head(f2), 'changing the plan of round 2 leaves round 1 as it was'); ok(w1.length >= 1, 'this fight has a rest'); } }

// the rests: one per round break, at the bell of the round plus LIVE.cornerIn, each LIVE.rest after the one before
let fights = 0, rests = 0;
for (let seed = 1; seed <= 50; seed++) {
  const f = simulate({seed}), w = restWalls(f), ev = f.events.filter(e => e.type === 'phase' && e.phase === 'rest');
  fights++; rests += w.length;
  ok(w.length === ev.length && w.length <= 2, 'seed ' + seed + ': one rest per round break');
  w.forEach((t, n) => ok(Math.abs(t - (ev[n].t + LIVE.cornerIn + n * LIVE.rest)) < 1e-9 && (n === 0 || t > w[n - 1] + LIVE.rest), 'seed ' + seed + ': rest ' + (n + 1) + ' on the clock'));
}
console.log(bad ? bad + ' check(s) failed' : `PASS: plans, stats and fighters are cleaned, matches repeat, ${rests} rests of ${fights} fights fall on the clock`);
process.exit(bad ? 1 : 0);
