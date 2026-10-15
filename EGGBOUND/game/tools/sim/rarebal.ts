// All-rare team advantage over the normal team on non-saturated stages (normal win 25–85%).
import { simulate } from '../../src/core/battle';
import { STAGES, SPECIES, planOf } from '../../src/core/data';
const mode = process.argv[2] || 'full', N = +(process.argv[3] || 60);
const ids = Object.values(SPECIES).filter((s: any) => !s.boss && !s.starborn).map((s: any) => s.id);
if (mode === 'formonly') for (const id of ids) (SPECIES as any)[id].rarePassive = undefined;
const IDF = +(process.env.IDF || 1);
for (const id of ids) { const f = (SPECIES as any)[id].rareForm; if (f) for (const k of f.skills) { if (k.ignoreDef) k.ignoreDef *= IDF; k.cd += k.ult ? +(process.env.UCD || 0) : +(process.env.CD || 0); } }
if (mode === 'passiveonly') for (const id of ids) (SPECIES as any)[id].rareForm = undefined;
const teams = [...Array.from({ length: Math.ceil(ids.length / 4) }, (_, i) => ids.slice(i * 4, i * 4 + 4)).filter(t => t.length === 4), ['B05','B04','B07','A08'], ['A05','C01','B01','A06']];
const wr = (team: string[], st: any, rare: boolean, lvl: number, stars: number) => { let w = 0; for (let i = 0; i < N; i++) if (simulate(5000 + i, team.map(sid => ({ sid, lvl, stars, rare })), st).win) w++; return w / N; };
let tot = 0, cnt = 0;
for (const t of teams) {
  let d = 0, n = 0;
  for (const st of STAGES) { const [lvl, ps] = planOf(st); const a = wr(t, st, false, lvl, ps); if (a < 0.25 || a > 0.85) continue; const b = wr(t, st, true, lvl, ps); d += b - a; n++; }
  if (n) { console.log(t.join(','), 'stages', n, 'avg +' + (d / n * 100).toFixed(1)); tot += d; cnt += n; }
}
console.log(mode, 'OVERALL avg +' + (tot / cnt * 100).toFixed(1), 'over', cnt, 'team-stages');
