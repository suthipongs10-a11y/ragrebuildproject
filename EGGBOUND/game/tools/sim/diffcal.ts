// Calibrate a per-zone HP/ATK multiplier for normal/hard so the recommended team (planOf) wins about as often as on easy.
import { simulate } from '../../src/core/battle';
import { STAGES, ZONES, planOf, stageOf, stageKey } from '../../src/core/data';
import type { StageDef } from '../../src/core/types';
const team = (lvl: number, stars = 1) => ['A01', 'A02', 'A03', 'A04'].map(sid => ({ sid, lvl, stars }));
const N = +(process.argv[2] || 30), only = process.argv[3];
const TARGET = { 1: { st: 0.8, boss: 0.56 }, 2: { st: 0.76, boss: 0.5 } } as Record<number, { st: number; boss: number }>;
const mul = (st: StageDef, k: number): StageDef => ({ ...st, waves: st.waves.map(w => w.map(m => ({ ...m, hpMult: (m.hpMult || 1) * k, atkMult: (m.atkMult || 1) * k }))) });
const rate = (sts: StageDef[], k: number) => { let w = 0, n = 0; for (const st of sts) { const [lvl, ps] = planOf(st), t = team(lvl, ps), s2 = mul(st, k); for (let i = 0; i < N; i++) { n++; if (simulate(5000 + i, t, s2).win) w++; } } return w / n; };
function solve(sts: StageDef[], target: number) { let lo = Math.log(0.25), hi = Math.log(4); for (let it = 0; it < 8; it++) { const mid = (lo + hi) / 2; if (rate(sts, Math.exp(mid)) > target) lo = mid; else hi = mid; } const k = Math.exp((lo + hi) / 2); return [Math.round(k * 100) / 100, rate(sts, Math.round(k * 100) / 100)]; }
// per-stage targets (easy is tuned ~85% → ~75% → boss ~62%): normal a touch lower, hard lower again
const TGT: Record<number, number[]> = { 1: [0.84, 0.8, 0.77, 0.74, 0.55], 2: [0.8, 0.76, 0.73, 0.7, 0.5] };
const out: Record<string, number[][]> = {};
for (const z of ZONES) {
  if (only && z.id !== only) continue;
  const row: number[][] = [], info: string[] = [];
  for (const d of [1, 2]) {
    const ks: number[] = [], rs: number[] = [];
    for (let n = 1; n <= 5; n++) { const [k, r] = solve([stageOf(stageKey(`${z.id}-${n}`, d))!], TGT[d][n - 1]); ks.push(k); rs.push(Math.round(r * 100)); }
    row.push(ks); info.push(`d${d} ${ks.map((k, i) => `×${k}(${rs[i]}%)`).join(' ')}`);
  }
  out[z.id] = row; console.log(z.id.padEnd(11), info.join(' | '));
}
console.log(JSON.stringify(out));
