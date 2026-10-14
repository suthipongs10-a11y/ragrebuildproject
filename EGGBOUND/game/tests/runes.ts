// Runes: rolls, main/sub values, upgrades + gold, set bonuses, battle hooks, the save layer (gift, drops, equip, food).
import { Battle, simulate } from '../src/core/battle';
import { STAGES, stageOf, stageKey, planOf } from '../src/core/data';
import { RUNE_STATS, RUNE_SETS, RUNE_GRADES, SLOT_MAIN, RUNE_MAX_LVL, RUNE_DROP, rollRune, mainValue, upgradeRune, runeUpCost, runeOffCost, runeBonus, type Rune } from '../src/core/runes';
import { newSave, newMon } from '../src/game/save';
import { runesOf, runeBonusOf, equipRune, equipCost, unequipRune, tryUpgrade, sellRune, dropRunes, addRune } from '../src/game/runes';
import { evolve, grantRewards } from '../src/game/progression';
import { home, upgradeCost, FORGE_COST } from '../src/game/home';

export function runeTests(): number {
  let fail = 0;
  const ok = (c: boolean, msg: string) => { if (!c) { fail++; console.log('RUNE FAIL:', msg); } };
  const seq = (seed: number) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
  const W = RUNE_DROP.gradeW[1];

  // rolls: deterministic, the main stat fits the slot, sub count by grade, no duplicates / main repeated
  { const a = rollRune(seq(7), 4, W), b = rollRune(seq(7), 4, W);
    ok(JSON.stringify(a) === JSON.stringify(b), 'rune roll deterministic');
    let good = true;
    for (let i = 0; i < 400; i++) { const r = rollRune(seq(100 + i), 1 + i % 6, W); const ks = r.subs.map(s => s.k);
      if (!SLOT_MAIN[r.slot].includes(r.main) || r.subs.length !== RUNE_GRADES[r.grade].subs || new Set(ks).size !== ks.length || ks.includes(r.main)) good = false; }
    ok(good, 'rolled runes: main fits the slot, subs by grade, no repeats'); }

  // main value: ★6 +12 = the table, +0 = a fifth of it; stars scale it
  { const r = { main: 'atkP' as const, star: 6, lvl: 12 };
    ok(mainValue(r) === RUNE_STATS.atkP.main && mainValue(r, 0) === Math.round(RUNE_STATS.atkP.main * 0.2) && mainValue({ ...r, star: 1 }) < mainValue(r), 'main value by star and level'); }

  // upgrades: every +3 adds a sub (until four) then boosts; failure keeps the level
  { const r = rollRune(seq(3), 6, { common: 0, rare: 0, epic: 0, legendary: 1 }); ok(r.subs.length === 3, 'legendary starts with 3 subs');
    const before = r.subs.reduce((t, s) => t + s.v, 0);
    for (let i = 0; i < RUNE_MAX_LVL; i++) upgradeRune(r, () => 0); // always succeeds
    ok(r.lvl === RUNE_MAX_LVL && r.subs.length === 4 && r.subs.reduce((t, s) => t + s.v, 0) > before + r.subs[3].v, 'legendary +12: 4 subs and boosted');
    const c = rollRune(seq(4), 3, { common: 1, rare: 0, epic: 0, legendary: 0 }); for (let i = 0; i < RUNE_MAX_LVL; i++) upgradeRune(c, () => 0);
    ok(c.subs.length === 4, 'common +12 gains 4 subs');
    const f = rollRune(seq(5), 3, W); f.lvl = 8; ok(!upgradeRune(f, () => 0.999).ok && f.lvl === 8, 'a failed strike keeps the level');
    let mono = true; for (let l = 1; l < 12; l++) if (runeUpCost({ ...f, lvl: l }) <= runeUpCost({ ...f, lvl: l - 1 })) mono = false;
    ok(mono, 'each level costs more'); }

  // set bonuses: pairs of 2-piece sets stack, a 4-piece set needs all four
  { const mk = (set: Rune['set'], slot: 1 | 2 | 3 | 4): Rune => ({ id: slot, slot, set, grade: 'common', star: 1, lvl: 0, main: SLOT_MAIN[slot][0], subs: [] });
    const two = runeBonus([mk('fang', 1), mk('fang', 2), mk('vital', 3), mk('eye', 4)]), four = runeBonus([mk('fang', 1), mk('fang', 2), mk('fang', 3), mk('fang', 4)]);
    const st3 = runeBonus([mk('storm', 1), mk('storm', 2), mk('storm', 3), mk('fang', 4)]), st4 = runeBonus([1, 2, 3, 4].map(k => mk('storm', k as 1)));
    ok(two.sets.join() === 'fang' && two.atkP === RUNE_SETS.fang.b.atkP! + mainValue(mk('vital', 3)) + mainValue(mk('eye', 4)) && two.crit === 0, 'a fang pair gives its ATK% (vital/eye singles give nothing)'); // slots 3–4 default to ATK%
    ok(four.sets.length === 2 && st3.react === 0 && st4.react === RUNE_SETS.storm.b.react && st4.sets.join() === 'storm', 'two fang pairs stack, storm needs four'); }

  // battle: runes raise the unit, change the fight, stay deterministic
  { const st = STAGES[0], base = { sid: 'A01', lvl: 5, stars: 1 };
    const rb = runeBonus([1, 2, 3, 4].map(k => ({ id: k, slot: k as 1, set: 'blood' as const, grade: 'legendary' as const, star: 6, lvl: 12, main: SLOT_MAIN[k as 1][0], subs: [] })));
    const u0 = (new Battle(1, [base], st) as any).units[0], u1 = (new Battle(1, [{ ...base, rb }], st) as any).units[0];
    ok(u1.atk > u0.atk && u1.maxHp > u0.maxHp && u1.leech === RUNE_SETS.blood.b.leech! / 100, 'runes apply to the unit (+ lifesteal set)');
    const team = ['A01', 'A02', 'A03', 'A04'].map(sid => ({ sid, lvl: 5, stars: 1, rb }));
    const a = simulate(9, team, st), b = simulate(9, team, st); ok(a.rng === b.rng && a.log.join() === b.log.join(), 'rune battle deterministic');
    const bt = new Battle(11, team, st) as any; let healed = false;
    for (let g = 0; g < 400 && !bt.over; g++) { const ts = bt.nextTurn(); if (!ts) break; if (ts.skip) continue; const res = bt.act(ts.uid, bt.autoCommand(ts.uid)); if (ts.uid <= 4 && JSON.stringify(res).includes('"t":"heal"')) healed = true; }
    ok(healed, 'blood set heals in battle'); }

  // save layer: gift, equip / move / unequip, upgrade pays gold, selling, food frees runes, drops
  { const s = newSave(); ok(s.runes.length === 0 && !s.runeGift, 'a fresh save has no runes until the gift');
    const g = rollRune(seq(8), 2, W); addRune(s, g); ok(g.id === 1 && s.nextRuneId === 2, 'rune ids');
    s.gold = 0; ok(equipRune(s, g.id, 1) && runesOf(s, 1).length === 1 && !!runeBonusOf(s, 1), 'equip into an empty slot is free');
    const g2 = addRune(s, { ...rollRune(seq(9), 2, W), slot: g.slot });
    ok(equipCost(s, g2.id, 1).gold === runeOffCost(g) && !equipRune(s, g2.id, 1) && g.on === 1, 'pushing a rune out costs its removal gold (refused without gold)');
    s.gold = 5000; ok(equipRune(s, g2.id, 1) && s.gold === 5000 - runeOffCost(g) && runesOf(s, 1)[0].id === g2.id && !g.on, 'same slot swaps, paying for the rune taken off');
    let before0 = s.gold; equipRune(s, g2.id, 2); ok(!runesOf(s, 1).length && runesOf(s, 2)[0].id === g2.id && s.gold === before0 - runeOffCost(g2), 'moving a rune to another monster pays its removal');
    s.gold = 0; ok(!unequipRune(s, g2.id) && g2.on === 2, 'no gold, no removal');
    s.gold = 5000; ok(unequipRune(s, g2.id) && !g2.on && runeBonusOf(s, 2) === undefined && s.gold === 5000 - runeOffCost(g2), 'unequip pays');
    ok(runeOffCost({ ...g2, star: 6, lvl: 12 }) > runeOffCost({ ...g2, star: 6, lvl: 0 }) && runeOffCost({ ...g2, star: 6, lvl: 0 }) > runeOffCost({ ...g2, star: 1, lvl: 0 }), 'removal costs more for higher stars and levels');
    s.gold = 0; ok(tryUpgrade(s, g.id) === null && g.lvl === 0, 'no gold, no strike');
    s.gold = 1e6; const cost = runeUpCost(g), r = tryUpgrade(s, g.id, () => 0); ok(!!r && r.ok && g.lvl === 1 && s.gold === 1e6 - cost && s.stats.runeUp === 1, 'a strike pays its gold');
    const before = s.gold, price = sellRune(s, g.id); ok(price > 0 && s.gold === before + price && !s.runes.some(x => x.id === g.id), 'selling');
    // evolve food wearing a rune: the rune goes back to the bag
    s.mons = [newMon(50, 'A01', 15, 1), newMon(51, 'A02', 1, 1)]; s.team = [50]; const fr = addRune(s, rollRune(seq(10), 1, W)); equipRune(s, fr.id, 51);
    evolve(s, 50, [51]); ok(!fr.on && s.runes.includes(fr), 'eaten monster drops its runes back into the bag');
    // drops: first clear always one, hard drops higher stars
    const st = stageOf(stageKey('meadow-1', 2))!, d = dropRunes(s, st, true, false, seq(12)); ok(d.length >= 1 && d.every(x => x.star >= 3), 'first clear drops a rune, hard = higher stars');
    const s2 = newSave(); s2.runeGift = true; const rw = grantRewards(s2, 'meadow-1', true, 3, ['A02'], 77); ok(rw.runes.length === 1 && s2.runes.length === 1, 'stage rewards carry runes'); }

  // โรงตีรูน (home forge): built with the castle at Lv.2, its levels add success chance to strikes that are not sure
  { const s = newSave(); s.runeGift = true; const h = home(s); h.castle = 2; h.lv.forge = 0; home(s); ok(h.lv.forge === 1, 'forge is built once the castle reaches Lv.2');
    const r = addRune(s, { ...rollRune(seq(40), 3, W), lvl: 11 }); s.gold = 1e7;
    ok(!tryUpgrade(s, r.id, () => 0.33)!.ok && r.lvl === 11, 'without forge levels a 30% strike fails at 0.33');
    h.lv.forge = 3; ok(tryUpgrade(s, r.id, () => 0.33)!.ok && r.lvl === 12, 'forge Lv.3 (+6%) turns it into a success');
    ok(upgradeCost(s, 'forge') === null && FORGE_COST[2] > 0, 'forge upgrades cost gold'); }

  // how much runes move the starter team (log only): realm-fitting rare runes at +6 on every member
  { let d0 = 0, d1 = 0, n = 0;
    for (const st of STAGES.filter((_, i) => i % 5 === 3)) { const [lvl, stars] = planOf(st), realm = st.zone && ['meadow', 'stream', 'rootnest'].includes(st.zone) ? 1 : ['jade', 'palace', 'foxvalley', 'toadbridge', 'heaven', 'firecave'].includes(st.zone!) ? 3 : 2;
      const rs = [1, 2, 3, 4].map(k => { const r = rollRune(seq(k * 31 + realm), realm + 1, { common: 0, rare: 1, epic: 0, legendary: 0 }); r.slot = k as 1; r.main = SLOT_MAIN[k as 1][0]; r.set = k <= 2 ? 'fang' : 'vital'; for (let i = 0; i < 6; i++) upgradeRune(r, () => 0); return r; });
      const rb = runeBonus(rs), team = (x: boolean) => ['A01', 'A02', 'A03', 'A04'].map(sid => ({ sid, lvl, stars, ...(x ? { rb } : {}) }));
      for (let i = 0; i < 40; i++) { if (simulate(4000 + i, team(false), st).win) d0++; if (simulate(4000 + i, team(true), st).win) d1++; } n += 40; }
    console.log(`runes: starter team, stage 4 of every zone — no runes ${Math.round(d0 / n * 100)}% → +6 rare runes ${Math.round(d1 / n * 100)}%`); }

  console.log(fail ? `runes: ${fail} FAILED` : 'runes OK');
  return fail;
}
