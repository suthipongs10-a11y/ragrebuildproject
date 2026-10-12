// Hatch-rate report: `node build.mjs --rates` → prints the full odds table (exact + simulated with pity).
import { EGG_TIERS, EGG_TIER_ORDER, EGG_DROP } from '../src/core/data';
import { newSave } from '../src/game/save';
import { rollTier, rollRarity, eggOdds } from '../src/game/progression';

const R = ['common', 'rare', 'epic', 'legendary'] as const;
const pct = (v: number) => (v * 100).toFixed(v < 0.001 ? 3 : 2).padStart(7) + '%';
const sum = (w: Record<string, number>) => Object.values(w).reduce((a, b) => a + b, 0);
const odds = eggOdds();
console.log('== per egg tier (rarity of the monster inside) ==');
for (const t of EGG_TIER_ORDER) { const w = EGG_TIERS[t].rarityW as Record<string, number>, n = sum(w); console.log(t.padEnd(8), R.map(r => `${r} ${pct((w[r] || 0) / n)}`).join('  '), ` rare form ${pct(EGG_TIERS[t].rareForm)}`); }

const exact: Record<string, number> = {};
for (const t of EGG_TIER_ORDER) { const w = EGG_TIERS[t].rarityW as Record<string, number>, n = sum(w); for (const r of R) exact[r] = (exact[r] || 0) + odds[t] * (w[r] || 0) / n; }
const s = newSave(); let rs = 12345; const rnd = () => { rs = (rs * 1664525 + 1013904223) >>> 0; return rs / 4294967296; };
const N = 2_000_000, sim: Record<string, number> = {}, tiers: Record<string, number> = {};
for (let i = 0; i < N; i++) { const t = rollTier(s, rnd); tiers[t] = (tiers[t] || 0) + 1; const r = rollRarity(t, rnd); sim[r] = (sim[r] || 0) + 1; }
console.log('\n== per mystery egg ==');
console.log('tier       listed   with pity');
for (const t of EGG_TIER_ORDER) console.log(t.padEnd(8), pct(odds[t]), pct((tiers[t] || 0) / N));
console.log('rarity     listed   with pity   1 in N eggs   per stage win (x' + EGG_DROP.chance + ')');
for (const r of R) { const p = (sim[r] || 0) / N; console.log(r.padEnd(9), pct(exact[r]), pct(p), String(Math.round(1 / p)).padStart(10), pct(p * EGG_DROP.chance)); }
