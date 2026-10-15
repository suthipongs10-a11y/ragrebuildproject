// Marginal effect of making ONE member rare, per species, on non-saturated stages of its team.
import { simulate } from '../../src/core/battle';
import { STAGES, SPECIES, planOf } from '../../src/core/data';
const mode = process.argv[2] || 'full', N = +(process.argv[3] || 60);
const ids = Object.values(SPECIES).filter((s: any) => !s.boss && !s.starborn).map((s: any) => s.id);
if (mode === 'formonly') for (const id of ids) (SPECIES as any)[id].rarePassive = undefined;
if (mode === 'passiveonly') for (const id of ids) (SPECIES as any)[id].rareForm = undefined;
const teams = [...Array.from({ length: Math.ceil(ids.length / 4) }, (_, i) => ids.slice(i * 4, i * 4 + 4)).filter(t => t.length === 4), ['B05','B04','B07','A08'], ['A05','C01','B01','A06']];
const wr = (team: string[], st: any, rare: (j: number) => boolean, lvl: number, stars: number) => { let w = 0; for (let i = 0; i < N; i++) if (simulate(5000 + i, team.map((sid, j) => ({ sid, lvl, stars, rare: rare(j) })), st).win) w++; return w / N; };
const acc: Record<string, [number, number]> = {};
for (const t of teams) for (const st of STAGES) { const [lvl, ps] = planOf(st); const a = wr(t, st, () => false, lvl, ps); if (a < 0.25 || a > 0.85) continue;
  t.forEach((sid, k) => { const b = wr(t, st, j => j === k, lvl, ps); (acc[sid] ||= [0, 0]); acc[sid][0] += b - a; acc[sid][1]++; }); }
console.log(Object.entries(acc).sort((x, y) => y[1][0] / y[1][1] - x[1][0] / x[1][1]).map(([s, [d, n]]) => s + ' ' + (SPECIES as any)[s].rarePassive?.kind + ' ' + (d / n * 100).toFixed(1) + ' (' + n + ')').join('\n'));
