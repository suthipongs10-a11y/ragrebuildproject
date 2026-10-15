// Calibrate hell: starter team at the hell plan wearing the same role kit as the enemies → targets per stage.
import { simulate } from '../../src/core/battle';
import { STAGES, ZONES, SPECIES, planOf, stageOf, stageKey, HELL, HELL_RUNES, DIFF_K } from '../../src/core/data';
import { kitBonus } from '../../src/core/runes';
const N = +(process.argv[2] || 40), TGT = [0.35, 0.3, 0.25, 0.2, 0.1], only = process.argv[3];
for (const z of Object.keys(DIFF_K)) DIFF_K[z][2] = [1, 1, 1, 1, 1]; // calibrate from the bare hell stage
const KS = 6, KL = 12; // reference: the best rune kit (★6 +12) on every realm
const team = (st: any, runes = true) => { const [lvl, stars] = planOf(st), r = +st.realm; return ['A01', 'A02', 'A03', 'A04'].map(sid => ({ sid, lvl, stars, ...(runes ? { rb: kitBonus(SPECIES[sid].role, KS, KL) } : {}) })); };
const scaled = (st: any, k: number) => ({ ...st, waves: st.waves.map((w: any[]) => w.map(m => ({ ...m, hpMult: (m.hpMult || 1) * k, atkMult: (m.atkMult || 1) * k }))) });
const wr = (st: any, runes = true) => { let w = 0; const t = team(st, runes); for (let i = 0; i < N; i++) if (simulate(7000 + i, t, st).win) w++; return w / N; };
const out: Record<string, number[]> = {};
for (const z of ZONES) { if (only && z.id !== only) continue; out[z.id] = [];
  for (let n = 1; n <= 5; n++) { const st = stageOf(stageKey(z.id + '-' + n, HELL))!; let lo = Math.log(0.05), hi = Math.log(6);
    for (let it = 0; it < 10; it++) { const mid = (lo + hi) / 2; if (wr(scaled(st, Math.exp(mid))) > TGT[n - 1]) lo = mid; else hi = mid; }
    const k = Math.round(Math.exp((lo + hi) / 2) * 100) / 100; out[z.id].push(k);
    process.stderr.write(z.id + '-' + n + ' k=' + k + ' runed ' + Math.round(wr(scaled(st, k)) * 100) + '% bare ' + Math.round(wr(scaled(st, k), false) * 100) + '%\n'); } }
console.log(JSON.stringify(out));
