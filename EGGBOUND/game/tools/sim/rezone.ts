// Keep zone difficulty when a pool changes: measure old win rates per stage/difficulty, then solve a factor f on the
// enemy HP/ATK so the new waves are won as often. mode old → rezone_old.json · easy → f for g.k (escorts only on stage 5)
// · diff → f for DIFF_K (d 1–3, all enemies) · check → old vs now.
import { simulate } from '../../src/core/battle';
import { STAGES, SPECIES, planOf, stageOf, stageKey } from '../../src/core/data';
import { kitBonus } from '../../src/core/runes';
import * as fs from 'fs';
const ZS = ['ricefield', 'village', 'kinnari', 'jade', 'palace', 'foxvalley'];
const mode = process.argv[2], N = +(process.argv[3] || 300), F = 'tools/sim/out/rezone_old.json';
const team = (st: any, d: number) => { const [lvl, stars] = planOf(st); return ['A01', 'A02', 'A03', 'A04'].map(sid => ({ sid, lvl, stars, ...(d === 3 ? { rb: kitBonus(SPECIES[sid].role, 6, 12) } : {}) })); };
const mul = (st: any, f: number, escortsOnly: boolean) => ({ ...st, waves: st.waves.map((w: any[]) => w.map(m => escortsOnly && m.boss ? m : { ...m, hpMult: (m.hpMult || 1) * f, atkMult: (m.atkMult || 1) * f })) });
const rate = (st: any, d: number) => { const t = team(st, d); let w = 0; for (let i = 0; i < N; i++) if (simulate(9000 + i, t, st).win) w++; return w / N; };
const key = (z: string, n: number, d: number) => stageKey(`${z}-${n}`, d);
const stagesFor = (d: number) => ZS.flatMap(z => (d === 0 || d === 3 ? [1, 2, 3, 4, 5] : [4, 5]).map(n => [z, n] as [string, number]));
function solve(st: any, d: number, target: number, escortsOnly: boolean) { let lo = Math.log(0.5), hi = Math.log(2);
  for (let it = 0; it < 9; it++) { const mid = (lo + hi) / 2; if (rate(mul(st, Math.exp(mid), escortsOnly), d) > target) lo = mid; else hi = mid; }
  return Math.exp((lo + hi) / 2); }
if (mode === 'old') { const o: Record<string, number> = {}; for (const d of [0, 1, 2, 3]) for (const [z, n] of stagesFor(d)) o[key(z, n, d)] = rate(stageOf(key(z, n, d)), d); fs.writeFileSync(F, JSON.stringify(o)); console.log(o); }
else { const old = JSON.parse(fs.readFileSync(F, 'utf8')), ds = mode === 'easy' ? [0] : mode === 'diff' ? [1, 2, 3] : [0, 1, 2, 3], out: any = {};
  for (const d of ds) for (const [z, n] of stagesFor(d)) { if (d === 0 && n < 4) continue; const k = key(z, n, d), st = stageOf(k)!, now = rate(st, d);
    if (mode === 'check') { console.log(k.padEnd(16), 'old', Math.round(old[k] * 100), 'now', Math.round(now * 100)); continue; }
    const f = Math.abs(now - old[k]) < 0.03 ? 1 : solve(st, d, old[k], d === 0 && n === 5); out[k] = Math.round(f * 1000) / 1000; console.log(k.padEnd(16), 'old', Math.round(old[k] * 100), 'now', Math.round(now * 100), 'f', out[k]); }
  fs.writeFileSync(F.replace('old', mode), JSON.stringify(out)); }
