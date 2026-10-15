// tune per-stage enemy HP/ATK multipliers k (and the boss HP multiplier) so the starter team at ZONE_PLAN wins ~target
import { simulate } from '../../src/core/battle';
import { ZONES, ZONE_GEN, ZONE_PLAN, zoneStages } from '../../src/core/data';
const TARGET = [85, 82, 78, 75, 62], N = +(process.argv[2] || 150), only = process.argv[3];
const team = (lvl: number, stars: number) => ['A01', 'A02', 'A03', 'A04'].map(sid => ({ sid, lvl, stars }));
const out: Record<string, any> = {}, r2 = (x: number) => Math.round(x * 20) / 20;
ZONES.forEach((z, zi) => {
  if (only && !only.split(',').includes(z.id)) return;
  const g = ZONE_GEN[z.id], [p0, p1, ps] = ZONE_PLAN[z.id], row: string[] = [];
  const run = (n: number) => { const pl = Math.round(p0 + (p1 - p0) * (n - 1) / 4), st = zoneStages(z, zi)[n - 1]; let w = 0; for (let i = 0; i < N; i++) if (simulate(5000 + i, team(pl, ps), st).win) w++; return Math.round(w / N * 100); };
  for (let n = 1; n <= 4; n++) { // win rate falls as k rises: bisect k in [0.3, 2.5]
    let lo = 0.3, hi = 2.5, best: [number, number, number] = [1e9, 1, 0];
    for (let it = 0; it < 9; it++) { const mid = r2((lo + hi) / 2); g.k[n - 1] = mid; const w = run(n); if (Math.abs(w - TARGET[n - 1]) < best[0]) best = [Math.abs(w - TARGET[n - 1]), mid, w]; if (w > TARGET[n - 1]) lo = mid; else hi = mid; if (hi - lo < 0.06) break; }
    g.k[n - 1] = best[1]; row.push(`${n}:k${best[1]} ${best[2]}%`);
  }
  g.k[4] = r2((g.k[2] + g.k[3]) / 2); // boss escorts as tough as the zone's later stages
  g.boss.atkMult = 0.95; let lo = 1.2, hi = 8, best: [number, number, number] = [1e9, 3, 0];
  for (let it = 0; it < 10; it++) { const mid = r2((lo + hi) / 2); g.boss.hpMult = mid; const w = run(5); if (Math.abs(w - TARGET[4]) < best[0]) best = [Math.abs(w - TARGET[4]), mid, w]; if (w > TARGET[4]) lo = mid; else hi = mid; if (hi - lo < 0.06) break; }
  g.boss.hpMult = best[1];
  if (best[2] < TARGET[4] - 4) { // still too hard at the HP floor: soften the boss's ATK instead
    g.boss.hpMult = 1.2; let a = 0.35, b = 0.95, bb: [number, number, number] = [1e9, 0.95, best[2]];
    for (let it = 0; it < 8; it++) { const mid = r2((a + b) / 2); g.boss.atkMult = mid; const w = run(5); if (Math.abs(w - TARGET[4]) < bb[0]) bb = [Math.abs(w - TARGET[4]), mid, w]; if (w > TARGET[4]) a = mid; else b = mid; if (b - a < 0.06) break; }
    g.boss.atkMult = bb[1]; best = [0, 1.2, bb[2]];
  }
  row.push(`boss hp×${g.boss.hpMult} atk×${g.boss.atkMult} ${best[2]}%`);
  out[z.id] = { k: [...g.k], hpMult: g.boss.hpMult, atkMult: g.boss.atkMult };
  console.log(z.id.padEnd(11), row.join('  '));
});
console.log(JSON.stringify(out));
