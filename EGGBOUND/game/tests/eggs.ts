// Egg + growth checks: mystery tiers + pity, incubation slots, hatch = new unit at natural stars, rare form, evolution, skill-ups, save migration.
import { EGG_DROP, EGG_TIERS, SPECIES, MAX_STARS, NAT_STARS, EVO_GOLD, EVO_NAME, monName, SKILL_MAX, levelCap, statAt, skillAt, STAGES, ZONES, DIFFS, DIFF_K, stageOf, stageKey, planOf, RARE_FORM_MULT, NAMED_RARE_FORM, ENERGY_MAX, ENERGY_REGEN_MS, ENERGY_REFILL_GEMS, ENERGY_REFILL_DAILY } from '../src/core/data';
import { newSave, loadSave, writeSave, newMon } from '../src/game/save';
import { stageUnlocked, rollMysteryEgg, hatchEgg, grantRewards, eggOdds, craftEgg, FRAGS_TO_CRAFT, lootOf, monOf, evoCheck, evolve, skillUp, teamHasSpecies, feed, feedPreview, feedValue } from '../src/game/progression';
import { startIncub, incubLeft, incubOf, incubSlots, canHatch, home, HATCH_SPEED } from '../src/game/home';
import { energyNow, energyNext, payAuto, autoCost, buyEnergy, refillsLeft } from '../src/game/energy';
import { QUESTS, CHAPTERS, questsIn, chapterClaimable, claimable, claimQuest, bookGems, buyGoldEgg, rushCost, rushEgg, rushPrice, rushesToday, mysteryEgg } from '../src/game/quests';

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

  // rare form gets rarer with species rarity: rainbow eggs, legendary rare form ≈ 6% × 8% × 0.25
  { const s = newSave(), rnd = lcg(7), N = 400000; let leg = 0, legR = 0, com = 0, comR = 0;
    for (let i = 0; i < N; i++) { const e = mysteryEgg(s, 'rainbow', rnd), r = SPECIES[e.sid].rarity; if (r === 'legendary') { leg++; if (e.rare) legR++; } if (r === 'rare') { com++; if (e.rare) comR++; } }
    const pl = legR / leg, pr = comR / com;
    console.log(`rainbow egg rare form: rare-tier ${(pr * 100).toFixed(2)}% · legendary ${(pl * 100).toFixed(2)}% (1 in ${Math.round(N / Math.max(1, legR))} rainbow eggs)`);
    ok(Math.abs(pl - EGG_TIERS.rainbow.rareForm * RARE_FORM_MULT.legendary) < 0.008 && pl < pr, 'legendary rare form is scaled down'); }

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
    const r = hatchEgg(s, 30)!; ok(r.stars === NAT_STARS.epic + 1 && monOf(s, r.uid)!.rare === true && r.copies === 0, 'rare-form epic hatches at ★5 (epic ★4 + 1)');
    ok(hatchEgg(s, 31)!.stars === 2, 'rare hatches at ★2'); }

  // evolution: max level + `stars` food of the same grade + gold → ★+1, Lv1, food consumed
  { const s = newSave(); s.gold = 99999; const t = monOf(s, 1)!;
    ok(!evoCheck(s, 1, [5]).ok, 'evolve needs max level'); t.lvl = levelCap(1);
    ok(!evoCheck(s, 1, [1]).ok, 'cannot eat itself');
    const before = statAt(SPECIES.A01.base.atk, t.lvl, t.stars), m = evolve(s, 1, [5])!;
    ok(!!m && m.stars === 2 && m.lvl === 1 && !monOf(s, 5) && s.gold === 99999 - EVO_GOLD[1], 'evolve ★1→★2 with 1 food');
    ok(EVO_GOLD.join() === '0,600,2000,6000,16000,40000', 'evolve gold doubled (owner 2026-10-14)');
    ok(monName('A02', 4) === SPECIES.A02.name && monName('A02', 5) === EVO_NAME.A02[0] && monName('A02', 5, true) === EVO_NAME.A02[0] && monName('A02', 2, true) === SPECIES.A02.name, 'evolved name from ★5 (rare forms share it)');
    ok(monName('B05', 6) === SPECIES.B05.name && Object.keys(EVO_NAME).every(id => SPECIES[id] && monName(id, 6) !== SPECIES[id].name), 'evolved names only for species with evolved art');
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

  // power-up: food gives EXP by level/stars, stops at the level cap, food consumed and gold paid
  { const s = newSave(); s.gold = 9999; s.mons.push(newMon(80, 'B01', 10, 1), newMon(81, 'A02', 1, 1)); s.team = [1, 80];
    const v = feedValue(s.mons.find(m => m.uid === 80)!); ok(v > feedValue(s.mons.find(m => m.uid === 81)!), 'higher-level food gives more EXP');
    ok(!feedPreview(s, 1, []).ok && !feedPreview(s, 1, [1]).ok, 'needs valid food');
    const r = feed(s, 1, [80, 81])!; const t = s.mons.find(m => m.uid === 1)!;
    ok(!!r && t.lvl === r.toLvl && t.lvl > 5 && !s.mons.some(m => m.uid === 80 || m.uid === 81) && s.team.join() === '1' && s.gold === 9999 - 110, 'feed levels up, eats food, pays gold');
    t.lvl = 15; ok(!feedPreview(s, 1, [2]).ok, 'max level cannot be fed'); }

  // adventure book: quests unlock from progress, claim once; gems buy gold eggs and rush incubation
  { const s = newSave(); ok(new Set(QUESTS.map(q => q.id)).size === QUESTS.length, 'quest ids unique');
    ok(claimable(s).length === 0 && claimQuest(s, 'win1') === null, 'nothing claimable on a new save');
    grantRewards(s, 'meadow-5', true, 3, ['A02'], 3); ok(claimable(s).some(q => q.id === 'win1') && claimable(s).some(q => q.id === 'zclearmeadow'), 'winning unlocks quests');
    const g0 = s.gems; ok(!!claimQuest(s, 'win1') && s.gems === g0 + 10 && claimQuest(s, 'win1') === null, 'claim once');
    ok(bookGems() === 1725, 'book gem total ' + bookGems()); // 800 (maps 1-3) + difficulties (2026-10-14): normal 15 zones × (10+10) + 40, hard 15 × (15+20) + 60
    ok(CHAPTERS.every(c => questsIn(c.id).length > 0) && QUESTS.every(q => CHAPTERS.some(c => c.id === q.ch)), 'every quest in a chapter, no empty chapter');
    ok(ZONES.every(z => ['zclear', 'zstar', 'zfarm'].every(k => QUESTS.some(q => q.id === k + z.id))), 'every zone has boss/3-star/farm quests');
    for (let i = 0; i < 4; i++) grantRewards(s, 'meadow-5', true, 3, [], 10 + i); ok(claimable(s).some(q => q.id === 'zfarmmeadow'), 'beating a zone boss 5 times unlocks its farm quest');
    ok(claimQuest(s, 'ch:map1') === null, 'chapter chest locked until every quest is claimed');
    { const e0 = s.eggs.length; for (const st of STAGES) if (st.realm === '1') { s.stages[st.id] = 3; s.stats.stageWins[st.id] = 5; }
      for (const q of questsIn('map1')) ok(!!claimQuest(s, q.id), 'claim ' + q.id);
      ok(chapterClaimable(s).some(c => c.id === 'map1'), 'finished chapter is claimable'); const g1 = s.gems;
      ok(!!claimQuest(s, 'ch:map1') && s.gems === g1 + 40 && claimQuest(s, 'ch:map1') === null, 'chapter chest claims once');
      const ne = s.eggs.slice(e0); ok(ne.some(e => e.kind === 'mystery' && e.tier === 'gold') && ne.some(e => e.tier === 'silver'), 'egg rewards land in the egg list'); }
    ok(buyGoldEgg(s) === null, 'no gems, no egg'); s.gems = 250; const e = buyGoldEgg(s)!;
    ok(!!e && e.tier === 'gold' && e.kind === 'mystery' && s.gems === 150 && s.eggs.includes(e), 'buy gold egg');
    const t0 = 5_000_000; ok(startIncub(s, e.id, t0), 'incubate bought egg'); const c = rushCost(s, e.id, t0);
    ok(c === 10 && rushEgg(s, e.id, t0) && s.gems === 140 && canHatch(s, e, t0), 'first rush of the day: gold egg 10 gems (got ' + c + ')');
    // the price climbs a step per rush the same day, a part-done egg pays its share of time left, and a new day starts over
    const free = (id: number) => { home(s).incub = home(s).incub.filter(q => q.id !== id); }; // hatching frees the slot
    free(e.id); const ladder: number[] = [];
    for (let i = 0; i < 14; i++) { s.gems = 1000; const g = mysteryEgg(s, 'gold'); s.eggs.push(g); startIncub(s, g.id, t0); ladder.push(rushCost(s, g.id, t0)); rushEgg(s, g.id, t0); free(g.id); }
    ok(ladder.join(',') === '12,14,16,20,24,30,36,45,55,70,85,100,100,100', 'gold rush ladder ' + ladder.join(','));
    ok(rushPrice(s, 'rainbow', t0) === 300 && rushesToday(s, t0) === 15, 'rainbow capped at 300, 15 rushes today');
    const t1 = t0 + 86_400_000; ok(rushesToday(s, t1) === 0 && rushPrice(s, 'gold', t1) === 10 && rushPrice(s, 'rainbow', t1) === 30, 'ladder resets the next day');
    { const g = mysteryEgg(s, 'gold'); s.eggs.push(g); startIncub(s, g.id, t1); const x = incubOf(s, g.id)!, half = t1 + (x.end - x.start) / 2;
      ok(rushCost(s, g.id, half) === 5 && rushCost(s, g.id, x.end - 1000) === 1, 'part-done egg pays its share of time left'); } }

  // team rule: one per species; a saved team holding two copies is cleaned on load
  { const s = newSave(); s.mons.push(newMon(70, 'A01')); ok(teamHasSpecies(s, 'A01') && !teamHasSpecies(s, 'A05') && !teamHasSpecies(s, 'A01', 1), 'team species check');
    const store: Record<string, string> = {}; (globalThis as any).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; }, removeItem: (k: string) => { delete store[k]; } };
    s.team = [1, 70, 2]; writeSave(s); ok(loadSave().team.join() === '1,2', 'duplicate species removed from team on load'); delete (globalThis as any).localStorage; }

  // v1 save (one entry per species) → v2 units
  { const store: Record<string, string> = {}; (globalThis as any).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; }, removeItem: (k: string) => { delete store[k]; } };
    const v1: any = { ...newSave(), v: 1, mons: { A01: { lvl: 7, exp: 3, stars: 1 }, A09: { lvl: 2, exp: 0, stars: 1, rare: true } }, team: ['A09', 'A01'] };
    delete v1.nextUid; delete v1.items; store['eggbound-p0-save'] = JSON.stringify(v1);
    const d = loadSave(), a9 = d.mons.find(m => m.sid === 'A09')!;
    ok(d.v === 2 && d.mons.length === 2 && a9.stars === 5 && a9.rare === true && d.team[0] === a9.uid && d.nextUid === 3 && d.items.soul === 0, 'v1 save migrates to units');
    delete (globalThis as any).localStorage; }

  // first clear always drops a mystery egg
  { const s = newSave(); const r = grantRewards(s, 'meadow-1', true, 3, ['A02', 'A06'], 7); ok(r.eggs.length === 1 && r.eggs[0].kind === 'mystery', 'first clear drops a mystery egg'); }

  // chest: grade = best item, best item last
  { const base = { win: true, stars: 3, firstClear: false, gold: 300, gains: [], frags: { A02: 1 }, eggs: [] as any[], runes: [] as any[] };
    ok(lootOf(base).grade === 'common' && lootOf(base).items.length === 2, 'chest common without eggs');
    const L = lootOf({ ...base, eggs: [{ id: 1, sid: 'A01', kind: 'mystery', tier: 'rainbow' }, { id: 2, sid: 'A02', kind: 'mystery', tier: 'silver' }] });
    ok(L.grade === 'legendary' && L.items[L.items.length - 1].kind === 'egg' && L.items[0].kind === 'gold', 'chest legendary, best last'); }

  // named craft: the best rare-form odds — above every mystery egg tier for any species rarity
  ok(Object.values(EGG_TIERS).every(t => NAMED_RARE_FORM > t.rareForm * 1.5), 'named egg rare-form chance beats every mystery egg');
  { const s = newSave(); s.frags.A02 = FRAGS_TO_CRAFT; ok(craftEgg(s, 'A02', () => 0) && s.eggs[s.eggs.length - 1].kind === 'named' && s.eggs[s.eggs.length - 1].rare === true, 'craft named egg (rare roll)'); }

  // P0 save migration: eggs without kind → named, home without incub → []
  { const mem: Record<string, string> = {}; (globalThis as any).localStorage = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; }, removeItem: (k: string) => { delete mem[k]; } };
    const old: any = newSave(); old.eggs = [{ id: 1, sid: 'A01' }]; delete old.eggPity; old.home = { castle: 1, lv: { hatchery: 1 }, shrine: {}, relics: [], relic: null, mineAt: 0 };
    mem['eggbound-p0-save'] = JSON.stringify(old);
    const s = loadSave(); ok(s.eggs[0].kind === 'named' && s.eggPity === 0 && Array.isArray(home(s).incub), 'P0 save migrates');
    delete (globalThis as any).localStorage; }

  // energy: only AUTO spends it; refills 1 per ENERGY_REGEN_MS up to the cap, offline too
  { const s = newSave(), t0 = 1_000_000, st = STAGES.find(x => x.id === 'temple-5')!; s.energy = { v: ENERGY_MAX, t: t0 };
    ok(energyNow(s, t0 + 9e9) === ENERGY_MAX, 'energy never passes the cap');
    ok(payAuto(s, st, t0) && energyNow(s, t0) === ENERGY_MAX - autoCost(st), 'AUTO pays the stage cost');
    ok(energyNow(s, t0 + ENERGY_REGEN_MS - 1) === ENERGY_MAX - autoCost(st) && energyNow(s, t0 + ENERGY_REGEN_MS) === ENERGY_MAX - autoCost(st) + 1, 'one point per regen tick');
    s.energy = { v: 2, t: t0 }; ok(!payAuto(s, st, t0) && energyNow(s, t0) === 2, 'not enough energy: nothing spent');
    ok(energyNow(s, t0 + 3 * ENERGY_REGEN_MS + 5) === 5 && energyNext(s, t0 + 3 * ENERGY_REGEN_MS + 5) === ENERGY_REGEN_MS - 5, 'partial point keeps ticking'); }
  // difficulties (owner 2026-10-14): easy = the base stage; normal/hard = same fight one/two star grades up, opened zone by
  // zone by beating the boss one difficulty below; rewards grow; every stage has a tuned multiplier
  { const e = stageOf('meadow-1')!, nn = stageOf('meadow-1@n')!, hh = stageOf('meadow-1@h')!;
    ok(e === STAGES[0] && nn.diff === 1 && hh.diff === 2 && nn.id === 'meadow-1@n' && stageKey('meadow-1', 2) === 'meadow-1@h', 'stage keys per difficulty');
    ok(nn.waves.flat().every((m, i) => m.stars === Math.min(6, (e.waves.flat()[i].stars || 1) + 1)) && hh.waves.flat().every((m, i) => m.stars === Math.min(6, (e.waves.flat()[i].stars || 1) + 2)), 'enemies +1/+2 star grades');
    ok(planOf(nn)[1] === planOf(e)[1] + 1 && planOf(hh)[1] === planOf(e)[1] + 2, 'recommended team moves up with the enemies');
    ok(nn.reward.gold > e.reward.gold && hh.reward.gold > nn.reward.gold && hh.reward.exp > nn.reward.exp && hh.stamina > nn.stamina && nn.stamina > e.stamina, 'rewards and AUTO energy grow with difficulty');
    ok(ZONES.every(z => DIFF_K[z.id]?.every(r => r.length === 5 && r.every(k => k > 0.4 && k < 2))), 'every zone has a tuned multiplier per stage and difficulty');
    const s = newSave();
    ok(!stageUnlocked(s, 'meadow-1@n'), 'normal locked on a new save');
    for (let k = 1; k <= 5; k++) s.stages['meadow-' + k] = 3;
    ok(stageUnlocked(s, 'meadow-1@n') && !stageUnlocked(s, 'meadow-2@n') && !stageUnlocked(s, 'stream-1@n'), 'beating the easy boss opens normal stage 1 of that zone only');
    s.stages['meadow-1@n'] = 1; ok(stageUnlocked(s, 'meadow-2@n') && !stageUnlocked(s, 'meadow-1@h'), 'normal opens stage by stage, hard waits for the normal boss');
    s.stages['meadow-5@n'] = 2; ok(stageUnlocked(s, 'meadow-1@h'), 'beating the normal boss opens hard');
    const r = grantRewards(s, 'meadow-2@n', true, 3, ['A02'], 5); ok(s.stages['meadow-2@n'] === 3 && !s.stages['meadow-2'] || s.stages['meadow-2'] === 3, 'stars are kept per difficulty');
    ok(r.gold === stageOf('meadow-2@n')!.reward.gold * 2 && (r.frags.A02 || 0) >= 1 + DIFFS[1].frag, 'normal pays its own gold (first clear doubled) and more fragments');
    ok(QUESTS.some(q => q.id === 'dnclearmeadow') && QUESTS.some(q => q.id === 'dhstarfirecave'), 'difficulty quests in the book'); }
  // gem refill: +ENERGY_MAX for ENERGY_REFILL_GEMS, ENERGY_REFILL_DAILY per local day (owner 2026-10-13)
  { const s = newSave(), t0 = new Date(2026, 9, 13, 9).getTime(), next = new Date(2026, 9, 14, 0, 0, 1).getTime();
    s.energy = { v: 5, t: t0 }; s.gems = ENERGY_REFILL_GEMS * (ENERGY_REFILL_DAILY + 2);
    ok(buyEnergy(s, t0) && energyNow(s, t0) === 5 + ENERGY_MAX && s.gems === ENERGY_REFILL_GEMS * (ENERGY_REFILL_DAILY + 1), 'refill adds a full bar for its gem price');
    ok(buyEnergy(s, t0) && energyNow(s, t0 + 9e6) === 5 + 2 * ENERGY_MAX, 'refills stack past the cap and do not regen above it');
    for (let i = 2; i < ENERGY_REFILL_DAILY; i++) buyEnergy(s, t0);
    const g = s.gems; ok(refillsLeft(s, t0) === 0 && !buyEnergy(s, t0) && s.gems === g, 'daily refill limit: nothing spent past it');
    ok(refillsLeft(s, next) === ENERGY_REFILL_DAILY && buyEnergy(s, next), 'the limit resets at local midnight');
    s.gems = ENERGY_REFILL_GEMS - 1; ok(!buyEnergy(s, next) && s.gems === ENERGY_REFILL_GEMS - 1, 'not enough gems: nothing bought'); }

  console.log(fail ? `eggs: ${fail} FAILED` : 'eggs OK');
  return fail;
}
