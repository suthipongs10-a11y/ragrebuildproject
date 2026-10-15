// Average a candidate's swap-in win rate over three base teams (attacker slot 0, healer slot 1, defender slot 3).
import { simulate } from '../../src/core/battle';
import { STAGES, planOf } from '../../src/core/data';
const N = 16, bases = [['A01', 'A02', 'A03', 'A04'], ['B05', 'B04', 'B02', 'B01'], ['B03', 'C04', 'C02', 'C03']];
const wr = (ids: string[], st: any) => { const [lvl, stars] = planOf(st); let w = 0; for (let i = 0; i < N; i++) if (simulate(7000 + i, ids.map(sid => ({ sid, lvl, stars })), st).win) w++; return w / N; };
const STS = bases.map(b => STAGES.filter((st, i) => i % 2 === 0 && (r => r >= 0.25 && r <= 0.85)(wr(b, st))));
const only = process.argv[2]?.split(',');
const slots: [number, string[]][] = [[0, ['A01', 'B03', 'E10', 'G01', 'H01', 'B05', 'E01', 'B08']], [3, ['A04', 'B01', 'C03', 'F01']], [1, ['A02', 'B04', 'C04', 'H04', 'B06']]];
for (const [slot, cands] of slots) for (const c of cands) { if (only && !only.includes(c)) continue; const per = bases.map((b, bi) => { const t = b.slice(); t[slot] = c; let s = 0; for (const st of STS[bi]) s += wr(t, st); return s / STS[bi].length * 100; });
  console.log(`slot${slot} ${c.padEnd(4)} avg ${(per.reduce((a, b) => a + b) / 3).toFixed(1)}  [${per.map(x => x.toFixed(0)).join(' ')}]`); }
