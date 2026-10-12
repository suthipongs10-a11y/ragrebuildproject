// Egg system checks (P1 M0): mystery tiers + pity, incubation slots, hatch stars / overflow, rare form, save migration.
import { EGG_DROP, EGG_TIERS, SPECIES, MAX_STARS, NAT_STARS } from '../src/core/data';
import { newSave, loadSave, writeSave } from '../src/game/save';
import { rollMysteryEgg, hatchEgg, grantRewards, eggOdds, craftEgg, FRAGS_TO_CRAFT, lootOf } from '../src/game/progression';
import { startIncub, incubLeft, incubSlots, canHatch, home, HATCH_SPEED } from '../src/game/home';

export function eggTests(): number {
  let fail = 0;
  const ok = (c: boolean, msg: string) => { if (!c) { fail++; console.log('EGG FAIL:', msg); } };
  const lcg = (seed: number) => { let r = seed >>> 0; return () => { r = (r * 1664525 + 1013904223) >>> 0; return r / 4294967296; }; };

  // pity: rnd always 0 → common every time, the Nth must be forced gold+
  { const s = newSave(); const tiers: string[] = []; for (let i = 0; i < EGG_DROP.pity * 2; i++) tiers.push(rollMysteryEgg(s, () => 0).tier!);
    ok(tiers.slice(0, EGG_DROP.pity - 1).every(t => t === 'common'), 'pity: commons before threshold');
    ok(tiers[EGG_DROP.pity - 1] === 'gold' || tiers[EGG_DROP.pity - 1] === 'rainbow', 'pity: forced gold+ at ' + EGG_DROP.pity);
    ok(tiers[EGG_DROP.pity] === 'common', 'pity resets'); }

  // disclosed odds vs rolled distribution (pity only lifts gold+)
  { const odds = eggOdds(); ok(Math.abs(Object.values(odds).reduce((a, b) => a + b, 0) - 1) < 1e-9, 'odds sum to 1');
    const s = newSave(), rnd = lcg(42), n: Record<string, number> = {}, N = 50000; let rare = 0;
    for (let i = 0; i < N; i++) { const e = rollMysteryEgg(s, rnd); n[e.tier!] = (n[e.tier!] || 0) + 1; if (e.rare) rare++; ok(!!SPECIES[e.sid] && !SPECIES[e.sid].boss, 'species valid'); if (fail > 5) break; }
    const line = Object.keys(odds).map(k => `${k} ${(odds[k as keyof typeof odds] * 100).toFixed(1)}%→${((n[k] || 0) / N * 100).toFixed(1)}%`).join('  ');
    console.log(`mystery eggs (listed→rolled incl. pity): ${line}  rare form ${(rare / N * 100).toFixed(1)}%`);
    ok(Math.abs((n.common || 0) / N - odds.common) < 0.03, 'common rate close to listed'); }

  // incubation: gold egg blocks hatch until done; slots = hatchery level
  { const s = newSave(), t0 = 1_000_000; s.eggs = [];
    const g1 = { id: 10, sid: 'A03', kind: 'mystery' as const, tier: 'gold' as const }, g2 = { ...g1, id: 11 }, c = { id: 12, sid: 'A05', kind: 'mystery' as const, tier: 'common' as const };
    s.eggs.push(g1, g2, c);
    ok(hatchEgg(s, 10, t0) === null, 'gold egg cannot hatch before incubation');
    ok(!startIncub(s, 12, t0), 'common egg does not incubate');
    ok(startIncub(s, 10, t0) && incubSlots(s) === 1 && !startIncub(s, 11, t0), 'one slot at hatchery Lv1');
    const ms = EGG_TIERS.gold.incubateMin * 60000 * HATCH_SPEED[1];
    ok(incubLeft(s, 10, t0 + ms - 1)! > 0 && !canHatch(s, g1, t0 + ms - 1), 'still incubating');
    const before = s.mons.A03.stars, r = hatchEgg(s, 10, t0 + ms);
    ok(!!r && r.dup && r.stars === Math.min(MAX_STARS, before + EGG_TIERS.gold.stars), 'gold dup adds tier stars');
    ok(home(s).incub.length === 0 && !s.eggs.some(e => e.id === 10), 'slot + egg freed after hatch');
    const rc = hatchEgg(s, 12, t0); ok(!!rc, 'common hatches instantly'); }

  // new monster at its natural stars + rare form; overflow past ★6 → gold
  { const s = newSave(); delete s.mons.A06; s.eggs = [{ id: 20, sid: 'A06', kind: 'mystery', tier: 'silver', rare: true }];
    const r = hatchEgg(s, 20)!; ok(!r.dup && s.mons.A06.stars === 1 && s.mons.A06.rare === true && r.rareNew, 'new rare-form monster');
    s.mons.A01.stars = MAX_STARS; const g = s.gold; s.eggs = [{ id: 21, sid: 'A01', kind: 'mystery', tier: 'rainbow' }];
    home(s).incub.push({ id: 21, start: 0, end: 0 });
    const r2 = hatchEgg(s, 21, 1)!; ok(r2.stars === MAX_STARS && r2.gold === 500 && s.gold === g + 500, 'overflow stars → gold'); }

  // natural stars by rarity: epic hatches at ★3, rare at ★2; old saves are raised to their natural stars
  { const s = newSave(); s.eggs = [{ id: 30, sid: 'A09', kind: 'named' }, { id: 31, sid: 'B05', kind: 'named' }];
    ok(hatchEgg(s, 30)!.stars === 3 && s.mons.A09.stars === NAT_STARS.epic, 'epic hatches at ★3');
    ok(hatchEgg(s, 31)!.stars === 2, 'rare hatches at ★2');
    const store: Record<string, string> = {}; (globalThis as any).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; }, removeItem: (k: string) => { delete store[k]; } };
    s.mons.A09.stars = 1; writeSave(s); ok(loadSave().mons.A09.stars === 3, 'migration raises stars to natural'); delete (globalThis as any).localStorage; }

  // first clear always drops a mystery egg
  { const s = newSave(); const r = grantRewards(s, '1-1', true, 3, ['A02', 'A06'], 7); ok(r.eggs.length === 1 && r.eggs[0].kind === 'mystery', 'first clear drops a mystery egg'); }

  // chest: grade = best item, best item last
  { const base = { win: true, stars: 3, firstClear: false, gold: 300, gains: [], frags: { A02: 1 }, eggs: [] as any[] };
    ok(lootOf(base).grade === 'common' && lootOf(base).items.length === 2, 'chest common without eggs');
    const L = lootOf({ ...base, eggs: [{ id: 1, sid: 'A01', kind: 'mystery', tier: 'rainbow' }, { id: 2, sid: 'A02', kind: 'mystery', tier: 'silver' }] });
    ok(L.grade === 'legendary' && L.items[L.items.length - 1].kind === 'egg' && L.items[0].kind === 'gold', 'chest legendary, best last'); }

  // named craft
  { const s = newSave(); s.frags.A02 = FRAGS_TO_CRAFT; ok(craftEgg(s, 'A02', () => 0) && s.eggs[s.eggs.length - 1].kind === 'named' && s.eggs[s.eggs.length - 1].rare === true, 'craft named egg (rare roll)'); }

  // P0 save migration: eggs without kind → named, home without incub → []
  { const mem: Record<string, string> = {}; (globalThis as any).localStorage = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; }, removeItem: (k: string) => { delete mem[k]; } };
    const old: any = newSave(); old.eggs = [{ id: 1, sid: 'A01' }]; delete old.eggPity; old.home = { castle: 1, lv: { hatchery: 1 }, shrine: {}, relics: [], relic: null, mineAt: 0 };
    mem['eggbound-p0-save'] = JSON.stringify(old);
    const s = loadSave(); ok(s.eggs[0].kind === 'named' && s.eggPity === 0 && Array.isArray(home(s).incub), 'P0 save migrates');
    delete (globalThis as any).localStorage; }

  console.log(fail ? `eggs: ${fail} FAILED` : 'eggs OK');
  return fail;
}
