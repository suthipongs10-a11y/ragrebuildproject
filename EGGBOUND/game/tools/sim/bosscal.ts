// S05–S07 bosses: easy boss HP multiplier (starter team at plan → ~62%), then the boss-stage DIFF_K factors for
// normal (~55%), hard (~50%) and hell (best-rune kit ~10%), relative to the zone's current DIFF_K.
import { simulate } from '../../src/core/battle';
import { ZONES, ZONE_GEN, SPECIES, planOf, stageOf, stageKey, zoneStages, DIFF_K, STAGES } from '../../src/core/data';
import { kitBonus } from '../../src/core/runes';
const N = +(process.argv[2] || 60), zones = (process.argv[3] || 'jade,palace,firecave').split(','), mode = process.argv[4] || 'easy';
const team = (st: any, runes = false) => { const [lvl, stars] = planOf(st); return ['A01', 'A02', 'A03', 'A04'].map(sid => ({ sid, lvl, stars, ...(runes ? { rb: kitBonus(SPECIES[sid].role, 6, 12) } : {}) })); };
const scaled = (st: any, k: number) => ({ ...st, waves: st.waves.map((w: any[]) => w.map(m => ({ ...m, hpMult: (m.hpMult || 1) * k, atkMult: (m.atkMult || 1) * k }))) });
const wr = (st: any, runes = false, seed = 5000) => { let w = 0; const t = team(st, runes); for (let i = 0; i < N; i++) if (simulate(seed + i, t, st).win) w++; return w / N; };
for (const zid of zones) {
  const zi = ZONES.findIndex(z => z.id === zid), z = ZONES[zi], g = ZONE_GEN[zid];
  if (mode === 'easy') {
    let lo = 0.8, hi = 9, best = [1e9, 3, 0];
    for (let it = 0; it < 11; it++) { const mid = Math.round((lo + hi) / 2 * 20) / 20; g.boss.hpMult = mid; const st = zoneStages(z, zi)[4], w = wr(st);
      if (Math.abs(w - 0.62) < best[0]) best = [Math.abs(w - 0.62), mid, w]; if (w > 0.62) lo = mid; else hi = mid; if (hi - lo < 0.06) break; }
    console.log(zid, 'easy boss hpMult', best[1], Math.round(best[2] * 100) + '%');
  } else if (mode === 'atk') { // still too strong at the HP floor: keep HP ×1.2 and soften the boss's ATK
    g.boss.hpMult = 1.2; let lo = 0.35, hi = 0.95, best = [1e9, 0.95, 0];
    for (let it = 0; it < 9; it++) { const mid = Math.round((lo + hi) / 2 * 20) / 20; g.boss.atkMult = mid; const w = wr(zoneStages(z, zi)[4]);
      if (Math.abs(w - 0.62) < best[0]) best = [Math.abs(w - 0.62), mid, w]; if (w > 0.62) lo = mid; else hi = mid; if (hi - lo < 0.06) break; }
    console.log(zid, 'easy boss hp 1.2 atkMult', best[1], Math.round(best[2] * 100) + '%');
  } else {
    const out: number[] = [];
    for (const [d, tgt, runes, seed] of [[1, 0.55, false, 5000], [2, 0.5, false, 5000], [3, 0.1, true, 7000]] as [number, number, boolean, number][]) {
      const st = stageOf(stageKey(zid + '-5', d))!; let lo = Math.log(0.1), hi = Math.log(6);
      for (let it = 0; it < 10; it++) { const mid = (lo + hi) / 2; if (wr(scaled(st, Math.exp(mid)), runes, seed) > tgt) lo = mid; else hi = mid; }
      const f = Math.exp((lo + hi) / 2), k = Math.round(DIFF_K[zid][d - 1][4] * f * 100) / 100; out.push(k);
      console.log(zid, 'd' + d, 'old', DIFF_K[zid][d - 1][4], 'new', k, Math.round(wr(scaled(st, f), runes, seed) * 100) + '%');
    }
    console.log(zid, JSON.stringify(out));
  }
}
