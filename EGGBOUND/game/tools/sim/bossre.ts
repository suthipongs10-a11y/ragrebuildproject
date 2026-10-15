// Boss stages after boss abilities (2026-10-14): keep each zone's boss-stage win rates as before.
// old → bossre_old.json · easy → factor on the boss unit only (its hpMult/atkMult) · diff → factor on DIFF_K[.][d][4] · check
import { simulate } from '../../src/core/battle';
import { SPECIES, ZONES, planOf, stageOf, stageKey } from '../../src/core/data';
import { kitBonus } from '../../src/core/runes';
import * as fs from 'fs';
const mode = process.argv[2], N = +(process.argv[3] || 300), F = 'tools/sim/out/bossre_old.json';
const team = (st: any, d: number) => { const [lvl, stars] = planOf(st); return ['A01', 'A02', 'A03', 'A04'].map(sid => ({ sid, lvl, stars, ...(d === 3 ? { rb: kitBonus(SPECIES[sid].role, 6, 12) } : {}) })); };
const mul = (st: any, f: number, bossOnly: boolean) => ({ ...st, waves: st.waves.map((w: any[]) => w.map(m => bossOnly && !(m.boss || SPECIES[m.sid].boss) ? m : { ...m, hpMult: (m.hpMult || 1) * f, atkMult: (m.atkMult || 1) * f })) });
const rate = (st: any, d: number) => { const t = team(st, d); let w = 0; for (let i = 0; i < N; i++) if (simulate(9100 + i, t, st).win) w++; return w / N; };
function solve(st: any, d: number, target: number, bossOnly: boolean) { let lo = Math.log(0.3), hi = Math.log(2);
  for (let it = 0; it < 9; it++) { const mid = (lo + hi) / 2; if (rate(mul(st, Math.exp(mid), bossOnly), d) > target) lo = mid; else hi = mid; } return Math.exp((lo + hi) / 2); }
const ONLY = process.env.ONLY?.split(','); const keys = (ds: number[]) => ZONES.filter(z => !ONLY || ONLY.includes(z.id)).flatMap(z => ds.map(d => [z.id, d] as [string, number]));
if (mode === 'old') { const o: any = {}; for (const [z, d] of keys([0, 1, 2, 3])) o[stageKey(z + '-5', d)] = rate(stageOf(stageKey(z + '-5', d)), d); fs.writeFileSync(F, JSON.stringify(o)); console.log(JSON.stringify(o)); }
else { const old = JSON.parse(fs.readFileSync(F, 'utf8')), ds = mode === 'easy' ? [0] : mode === 'diff' ? [1, 2, 3] : [0, 1, 2, 3], out: any = {};
  for (const [z, d] of keys(ds)) { const k = stageKey(z + '-5', d), st = stageOf(k)!, now = rate(st, d);
    if (mode === 'check') { console.log(k.padEnd(18), 'old', Math.round(old[k] * 100), 'now', Math.round(now * 100)); continue; }
    const f = Math.abs(now - old[k]) < 0.03 ? 1 : solve(st, d, old[k], d === 0); out[k] = Math.round(f * 1000) / 1000; console.log(k.padEnd(18), 'old', Math.round(old[k] * 100), 'now', Math.round(now * 100), 'f', out[k]); }
  fs.writeFileSync(F.replace('old', mode), JSON.stringify(out)); }
