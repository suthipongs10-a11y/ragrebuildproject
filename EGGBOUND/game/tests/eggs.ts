// Egg + growth checks: mystery tiers + pity, incubation slots, hatch = new unit at natural stars, rare form, evolution, skill-ups, save migration.
import { EGG_DROP, EGG_TIERS, SPECIES, MAX_STARS, NAT_STARS, EVO_GOLD, SKILL_MAX, levelCap, statAt, skillAt } from '../src/core/data';
import { newSave, loadSave, writeSave, newMon } from '../src/game/save';
import { rollMysteryEgg, hatchEgg, grantRewards, eggOdds, craftEgg, FRAGS_TO_CRAFT, lootOf, monOf, evoCheck, evolve, skillUp } from '../src/game/progression';
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
    const n0 = s.mons.length, r = hatchEgg(s, 10, t0 + ms);
    ok(!!r && r.copies === 1 && s.mons.length === n0 + 1 && monOf(s, r.uid)!.stars === 1 && monOf(s, 3)!.stars === 1, 'duplicate = new separate unit, no auto star-up');
    ok(home(s).incub.length === 0 && !s.eggs.some(e => e.id === 10), 'slot + egg freed after hatch');
    const rc = hatchEgg(s, 12, t0); ok(!!rc, 'common hatches instantly'); }

  // natural stars by rarity + rare form
  { const s = newSave(); s.eggs = [{ id: 30, sid: 'A09', kind: 'named', rare: true }, { id: 31, sid: 'B05', kind: 'named' }];
    const r = hatchEgg(s, 30)!; ok(r.stars === NAT_STARS.epic && monOf(s, r.uid)!.rare === true && r.copies === 0, 'epic hatches at ★3 (rare form kept)');
    ok(hatchEgg(s, 31)!.stars === 2, 'rare hatches at ★2'); }

  // evolution: max level + `stars` food of the same grade + gold → ★+1, Lv1, food consumed
  { const s = newSave(); s.gold = 99999; const t = monOf(s, 1)!;
    ok(!evoCheck(s, 1, [5]).ok, 'evolve needs max level'); t.lvl = levelCap(1);
    ok(!evoCheck(s, 1, [1]).ok, 'cannot eat itself');
    const before = statAt(SPECIES.A01.base.atk, t.lvl, t.stars), m = evolve(s, 1, [5])!;
    ok(!!m && m.stars === 2 && m.lvl === 1 && !monOf(s, 5) && s.gold === 99999 - EVO_GOLD[1], 'evolve ★1→★2 with 1 food');
    ok(statAt(SPECIES.A01.base.atk, 1, 2) > before * .9, 'new grade Lv1 ≈ old grade max');
    m.lvl = levelCap(2); s.mons.push(newMon(50, 'A02', 1, 2), newMon(51, 'B01', 1, 1));
    ok(!evoCheck(s, 1, [50, 51]).ok, 'food must share the star grade'); s.mons.find(x => x.uid === 51)!.stars = 2;
    ok(!!evolve(s, 1, [50, 51]) && m.stars === 3 && s.team.every(u => monOf(s, u)), 'evolve ★2→★3 with 2 food, team cleaned'); }

  // skill-ups: same-species copy or a soul crystal → +1 to a non-maxed skill; damage scales, max level cuts the cooldown
  { const s = newSave(); s.mons.push(newMon(60, 'A01'), newMon(61, 'A02'));
    ok(skillUp(s, 1, 61) === -1, 'skill-up needs the same species');
    const slot = skillUp(s, 1, 60, () => 0); ok(slot === 0 && monOf(s, 1)!.sk[0] === 2 && !monOf(s, 60), 'copy eaten, +1 skill');
    ok(skillUp(s, 1, null) === -1, 'no soul crystal'); s.items.soul = 1; ok(skillUp(s, 1, null, () => .99) === 2 && s.items.soul === 0, 'soul crystal works');
    const k = SPECIES.A01.skills[2], top = skillAt(k, SKILL_MAX[2], 2); ok(top.mult > k.mult && top.cd === k.cd - 1, 'max skill: more damage, -1 cooldown'); }

  // v1 save (one entry per species) → v2 units
  { const store: Record<string, string> = {}; (globalThis as any).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; }, removeItem: (k: string) => { delete store[k]; } };
    const v1: any = { ...newSave(), v: 1, mons: { A01: { lvl: 7, exp: 3, stars: 1 }, A09: { lvl: 2, exp: 0, stars: 1, rare: true } }, team: ['A09', 'A01'] };
    delete v1.nextUid; delete v1.items; store['eggbound-p0-save'] = JSON.stringify(v1);
    const d = loadSave(), a9 = d.mons.find(m => m.sid === 'A09')!;
    ok(d.v === 2 && d.mons.length === 2 && a9.stars === 3 && a9.rare === true && d.team[0] === a9.uid && d.nextUid === 3 && d.items.soul === 0, 'v1 save migrates to units');
    delete (globalThis as any).localStorage; }

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
